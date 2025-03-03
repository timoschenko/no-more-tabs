// file: popup.js | Sort and closes duplicate tabs in your web browser
// Copyright (C) 2025 Sergei Timoshchenko
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

const DEFAULT_FAV_ICON = './images/favicon-16x16.png';

var LITTER: Array<RegExp> = [];

function timeAgo(lastAccessed: number): string {
    const now = Date.now();
    const diffInMilliseconds = now - lastAccessed;

    const minutesAgo = Math.floor(diffInMilliseconds / (1000 * 60));

    if (minutesAgo < 60) {
        return `${minutesAgo} minutes ago`;
    }
    // Handle cases where the difference is more than an hour
    const hoursAgo = Math.floor(minutesAgo / 60);
    if (hoursAgo < 24) {
        return `${hoursAgo} hours ${minutesAgo - 60 * hoursAgo} minutes ago`;
    }

    // Handle cases where the difference is more than a day
    const daysAgo = Math.floor(hoursAgo / 24);
    return `${daysAgo} days and ${hoursAgo - 24 * daysAgo} hours ago`;
}

async function gatherTabs(): Promise<Array<chrome.tabs.Tab>> {
    const tabs = await chrome.tabs.query({
        currentWindow: true,
    });

    return tabs;
}

async function BuildUrlLitterFilter(): Promise<Array<RegExp>> {
    const UrlLitterStorage: string = (
        (await chrome.storage.sync.get(['UrlLitter'])).UrlLitter || ''
    ).trim();
    if (UrlLitterStorage.length === 0)
        // fast path
        return [];

    return UrlLitterStorage.split('\n')
        .map((x: string) => x.trim())
        .filter((x: string) => x.length > 0)
        .map((x) => new RegExp(x));
}

function filterLitterTabs(
    tabs: Array<chrome.tabs.Tab>,
    callback: (tab: chrome.tabs.Tab) => void,
): void {
    const tabs_by_url: Map<string, Array<chrome.tabs.Tab>> = new Map();
    for (const tab of tabs) {
        const url = tab.url;
        if (url === undefined) continue;
        // process litter
        if (LITTER.some((x) => x.test(url))) {
            callback(tab);
            // no point to process for dublicates because it anyway a "garbage"
            continue;
        }

        if (tabs_by_url.has(url)) {
            tabs_by_url.get(url)!.push(tab);
        } else {
            tabs_by_url.set(url, [tab]);
        }
    }

    for (const [url, dup_tabs] of tabs_by_url) {
        if (dup_tabs.length <= 1) {
            continue;
        }
        // Sort duplicated by last access (last accessed is first in the list)
        dup_tabs.sort(
            (a: chrome.tabs.Tab, b: chrome.tabs.Tab): number =>
                a.lastAccessed! - b.lastAccessed!,
        );

        // skip first item to show only DUPLICATES
        for (const tab of dup_tabs.slice(0, -1)) {
            callback(tab);
        }
    }
}

async function Handler_SortTabs() {
    const tabs = await gatherTabs();

    // TODO: Keep pins pinned

    // TODO: Respect groups

    // Sort tabs by title alphabetically
    tabs.sort((a: chrome.tabs.Tab, b: chrome.tabs.Tab) => {
        const getCompareHash = (tab: chrome.tabs.Tab) => {
            const prio_pin = tab.pinned ? '0' : '';

            try {
                const parsedUrl = new URL(tab.url || '');
                // reverse host name to respect main domain name
                // example www.domain.com vs help.domain.com
                const reversed_hostname = parsedUrl.hostname
                    .split('.')
                    .reverse()
                    .join('.');

                // use protocol to get "major" priority
                const raw_proto = parsedUrl.protocol;
                const proto =
                    raw_proto === 'http:' || raw_proto === 'https:'
                        ? 'http(s):'
                        : raw_proto;

                return prio_pin + proto + reversed_hostname + '#' + tab.url;
            } catch (error) {
                console.error(`Invalid URL: ${tab.url} - ${error}`);

                return prio_pin + '#' + tab.url;
            }
        };

        const hash_a = getCompareHash(a);
        const hash_b = getCompareHash(b);

        return hash_a.localeCompare(hash_b);
    });

    // Move tabs to their new positions
    tabs.forEach((tab: chrome.tabs.Tab, new_index: number) => {
        chrome.tabs.move(tab.id!, { index: new_index });
    });

    populateListOfDuplicates(tabs);
}

function populateListOfDuplicates(tabs: Array<chrome.tabs.Tab>): void {
    const dupsListElem = document.getElementById('dups-list');
    if (dupsListElem === null) throw new Error('"dups-list" is missing');

    dupsListElem.innerHTML = ''; // purge data

    const template = document.getElementById(
        'li_template',
    ) as HTMLTemplateElement;
    if (template === null || template.content.firstElementChild === null)
        throw new Error('"li_template" is missing');

    const elements: Set<HTMLElement> = new Set();

    filterLitterTabs(tabs, (tab: chrome.tabs.Tab) => {
        const tabId = tab.id!;

        const element = template.content.firstElementChild!.cloneNode(
            true,
        ) as HTMLElement;

        const title = (tab.title || '').split('|', 1)[0].trim();

        element.querySelector('.title')!.textContent = title;
        element.querySelector('.lastAccessed')!.textContent =
            tab.lastAccessed === undefined ? '' : timeAgo(tab.lastAccessed);

        // Set tab icon
        const iconElement = element.querySelector('.icon')! as HTMLImageElement;
        iconElement.src = tab.favIconUrl || DEFAULT_FAV_ICON;
        iconElement.style.display = 'inline'; // Show icon if URL is available

        element.querySelector('a')!.addEventListener('click', async () => {
            // close tab on click
            await chrome.tabs.remove(tabId);

            // TODO: add a dedicated button for close and by default - "activate"
            // need to focus window as well as the active tab
            // await chrome.tabs.update(tabId, { active: true });
            // await chrome.windows.update(tab.windowId, { focused: true });

            try {
                element.remove(); // Remove li element immediately after closing from popup
            } catch (error) {
                console.error(`can not delete element: ${element} - ${error}`);
            }
        });

        elements.add(element);
    });

    dupsListElem.append(...elements);
}

async function Handler_MergeAllWindowsToCurrent(): Promise<void> {
    const currentWindow = await chrome.windows.getCurrent();
    const currentWindowId = currentWindow.id;
    if (currentWindowId === undefined)
        throw new Error(`currentWindowId is undefined - ${currentWindow}`);

    const allWindows = await chrome.windows.getAll();
    for (const window of allWindows) {
        // Skip the current window itself
        if (window.id === currentWindowId) continue;
        // Keep only "normal" windows (ie no popups, apps, etc)
        if (window.type !== 'normal') continue;

        const tabsInOtherWindow = await chrome.tabs.query({
            windowId: window.id,
        });
        const allTabsId = tabsInOtherWindow.map((x: chrome.tabs.Tab) => x.id!);
        await chrome.tabs.move(allTabsId, {
            // The position to move the window to.
            // Use -1 to place the tab at the end of the window.
            index: -1,
            windowId: currentWindowId,
        });
    }
}

function openSettingsPopup(): void {
    chrome.tabs.create({
        url: 'settings.html',
    });
}

/// Main
document.addEventListener('DOMContentLoaded', async () => {
    function try_register(
        elementId: string,
        type: string,
        callback: EventListenerOrEventListenerObject,
    ): void {
        try {
            const elem = document.getElementById(elementId);
            if (elem === null)
                throw new Error(`"${elementId}" element is missing`);

            elem.addEventListener(type, callback);
        } catch (error) {
            console.error(`can not register a listener: ${error}`);
        }
    }

    LITTER = await BuildUrlLitterFilter();

    try_register('sort_tabs', 'click', Handler_SortTabs);

    try_register('merge_windows', 'click', Handler_MergeAllWindowsToCurrent);

    try_register('settings', 'click', openSettingsPopup);

    function loadUiSettings(): void {
        chrome.storage.sync.get(['HideAppTitle'], (result) => {
            const storedHideAppTitle = result.HideAppTitle;
            if (storedHideAppTitle !== undefined && storedHideAppTitle) {
                const apptitleElem = document.getElementById('apptitle');
                if (apptitleElem != null) apptitleElem.hidden = true;
            }
        });
    }

    loadUiSettings();

    const tabs1 = await gatherTabs();
    populateListOfDuplicates(tabs1);
});
