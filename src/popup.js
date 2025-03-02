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

const DEFAULT_FAV_ICON = 'images/favicon-16x16.png';

function timeAgo(lastAccessed) {
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

async function gatherTabs() {
    const tabs = await chrome.tabs.query({
        currentWindow: true
    });

    return tabs;
}

function filterLitterTabs(tabs, predicate) {
    const tabs_by_url = new Map();
    for (const tab of tabs) {
        const url = tab.url;

        if (tabs_by_url.has(url)) {
            tabs_by_url.get(url).push(tab);
        } else {
            tabs_by_url.set(url, [tab]);
        }
    }

    for (const [url, dup_tabs] of tabs_by_url) {
        if (dup_tabs.lenght <= 1) {
            continue;
        }
        // Sort duplicated by last access (last accessed is first in the list)
        dup_tabs.sort((a, b) => a.lastAccessed >= b.lastAccessed)

        // skip first item to show only DUPLICATES
        for (const tab of dup_tabs.slice(1)) {
            predicate(tab)
        }
    }
}

async function Handler_SortTabs() {
    const tabs = await gatherTabs();

    // TODO: Keep pins pinned

    // TODO: Respect groups

    // Sort tabs by title alphabetically
    tabs.sort((a, b) => {
        const getCompareHash = (tab) => {
            const prio_pin = (tab.pinned) ? '0' : '';

            try {
                const parsedUrl = new URL(tab.url);
                // reverse host name to respect main domain name
                // example www.domain.com vs help.domain.com
                const reversed_hostname = parsedUrl.hostname.split('.').reverse().join('.');

                // use protocol to get "major" priority
                const raw_proto = parsedUrl.protocol;
                const proto = (raw_proto === 'http:' || raw_proto === 'https:')
                    ? 'http(s):' : raw_proto;

                return prio_pin + proto + reversed_hostname + '#' + tab.url;
            } catch (error) {
                console.error(`Invalid URL: ${tab.url}`);

                return prio_pin + '#' + tab.url;
            }
        };

        const hash_a = getCompareHash(a);
        const hash_b = getCompareHash(b);

        return hash_a.localeCompare(hash_b);
    });

    // Move tabs to their new positions
    tabs.forEach((tab, index) => {
        chrome.tabs.move(tab.id, { index });
    });

    populateListOfDuplicates(tabs);
}

function populateListOfDuplicates(tabs) {
    const dupsListElem = document.getElementById('dups-list');
    dupsListElem.innerHTML = ''; // purge data

    const template = document.getElementById('li_template');
    const elements = new Set();

    filterLitterTabs(tabs, (tab) => {
        const element = template.content.firstElementChild.cloneNode(true);

        const title = tab.title.split('|')[0].trim();

        element.querySelector('.title').textContent = title;
        element.querySelector('.lastAccessed').textContent = timeAgo(tab.lastAccessed);

        // Set tab icon
        const iconElement = element.querySelector('.icon');
        iconElement.src = tab.favIconUrl || DEFAULT_FAV_ICON;
        iconElement.style.display = 'inline'; // Show icon if URL is available

        element.querySelector('a').addEventListener('click', async () => {
            // close tab on click
            await chrome.tabs.remove(tab.id);

            // TODO: add a dedicated button for close and by default - "activate"
            // need to focus window as well as the active tab
            // await chrome.tabs.update(tab.id, { active: true });
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

async function Handler_MergeAllWindowsToCurrent() {
    const currentWindow = await chrome.windows.getCurrent();
    const currentWindowId = currentWindow.id;

    const allWindows = await chrome.windows.getAll();
    for (const window of allWindows) {
        // Skip the current window itself
        if (window.id === currentWindowId)
            continue;
        // Keep only "normal" windows (ie no popups, apps, etc)
        if (window.type !== chrome.windows.WindowType.NORMAL)
            continue;

        const tabsInOtherWindow = await chrome.tabs.query({ windowId: window.id });
        const allTabsId = tabsInOtherWindow.map(object => object.id)
        await chrome.tabs.move(allTabsId, {
            // The position to move the window to.
            // Use -1 to place the tab at the end of the window.
            index: -1,
            windowId: currentWindowId
        });
    }
}

function openSettingsPopup() {
    chrome.tabs.create({
        url: 'src/settings.html'
    });
}

/// Main
document.addEventListener('DOMContentLoaded', async function main() {

    function try_register(predicate, message) {
        try {
            predicate();
        } catch (error) {
            console.error(`can not register a listener: ${message} - ${error}`);
        }
    }

    try_register(async () => {
        document.getElementById('sort_tabs').addEventListener('click', Handler_SortTabs);
    }, "sort-btn");

    try_register(async () => {
        document.getElementById('merge_windows').addEventListener('click', Handler_MergeAllWindowsToCurrent);
    }, "merge-btn");

    try_register(async () => {
        document.getElementById('settings').addEventListener('click', openSettingsPopup);
    }, "merge-btn");

    function loadUiSettings() {
        chrome.storage.sync.get(['HideAppTitle'], (result) => {
            const storedHideAppTitle = result.HideAppTitle;
            if (storedHideAppTitle !== undefined && storedHideAppTitle) {
                document.getElementById('apptitle').hidden = true;
            }
        });
    }

    loadUiSettings();

    const tabs1 = await gatherTabs();
    populateListOfDuplicates(tabs1);
});
