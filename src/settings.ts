// file: settings.js | Sort and closes duplicate tabs in your web browser
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

var IS_SAVING = false;
var SAVING_ID: NodeJS.Timeout | null = null;

function escapeHtml(unsafe: string): string {
    return unsafe.replace(/[&<>"']/g, function (m) {
        switch (m) {
            case '&':
                return '&amp;';
            case '<':
                return '&lt;';
            case '>':
                return '&gt;';
            case '"':
                return '&quot;';
            case "'":
                return '&#39;';
            default:
                return m;
        }
    });
}

function savingUiStatemachine(
    saveIndicatorSpan: HTMLElement,
    state: string,
): void {
    switch (state) {
        case 'prep':
            saveIndicatorSpan.classList.add('saving');
            saveIndicatorSpan.classList.remove('saved');
            saveIndicatorSpan.textContent = '⌛';
            saveIndicatorSpan.style.opacity = '1';
            break;
        case 'saving':
            saveIndicatorSpan.classList.add('saving');
            saveIndicatorSpan.classList.remove('saved');
            saveIndicatorSpan.textContent = '💾 Saving...';
            saveIndicatorSpan.style.opacity = '1';
            break;

        case 'saved':
            saveIndicatorSpan.classList.add('saved');
            saveIndicatorSpan.classList.remove('saving');
            saveIndicatorSpan.textContent = 'Save is complete!';
            break;
        case 'hide':
            saveIndicatorSpan.classList.remove('saved'); // Remove 'saved' class, which sets opacity: 0 via animation
            saveIndicatorSpan.textContent = '💾 Saving...'; // Reset text for next save
            saveIndicatorSpan.style.opacity = '0'; // Ensure it's hidden if animation didn't fully reset
            break;
    }
}

function getElementById(idName: string): HTMLElement {
    const elem = document.getElementById(idName);
    if (elem == null) throw new Error(`Element "${idName}" is missing`);
    return elem;
}

document.addEventListener('DOMContentLoaded', () => {
    const setting_HideAppTitle = getElementById(
        'setting_HideAppTitle',
    ) as HTMLInputElement;
    const setting_UrlLitterTextarea = getElementById(
        'setting_UrlLitter',
    ) as HTMLTextAreaElement;
    const error_UrlLitterDiv = getElementById('error_UrlLitter');
    const saveIndicatorSpan = getElementById('saveIndicator');

    // Load settings when the settings page is opened
    loadSettings();

    // Automatically validate regex memo on input
    setting_UrlLitterTextarea.addEventListener('input', validateUrlLitterMemo);
    // Automatically save settings when checkbox is changed
    setting_HideAppTitle.addEventListener('change', initiateSaveSettings);

    function initiateSaveSettings() {
        // New function to handle indicator and delayed save
        if (IS_SAVING) return;

        IS_SAVING = true;
        savingUiStatemachine(saveIndicatorSpan, 'prep');
        if (SAVING_ID != null) {
            clearTimeout(SAVING_ID);
        }
        // Delay the actual save by 2 seconds
        SAVING_ID = setTimeout(saveSettings, 2000);
    }

    function saveSettings() {
        SAVING_ID = null;

        savingUiStatemachine(saveIndicatorSpan, 'saving');

        const HideAppTitleValue = setting_HideAppTitle.checked;
        const UrlLitterValue = setting_UrlLitterTextarea.value;

        chrome.storage.sync.set(
            {
                HideAppTitle: HideAppTitleValue,
                UrlLitter: UrlLitterValue,
            },
            () => {
                IS_SAVING = false;
                console.log('Settings saved');

                // Provide "Save complete!" feedback and fade out
                savingUiStatemachine(saveIndicatorSpan, 'saved');

                // After fade out animation (approx 1s), hide the indicator completely (optional)
                setTimeout(() => {
                    savingUiStatemachine(saveIndicatorSpan, 'hide');
                }, 1000); // Match fadeOut animation duration (1s)
            },
        );
    }

    function loadSettings(): void {
        chrome.storage.sync.get(['HideAppTitle', 'UrlLitter'], (result) => {
            const storedHideAppTitle = result.HideAppTitle;
            if (storedHideAppTitle !== undefined) {
                setting_HideAppTitle.checked = storedHideAppTitle;
            }

            const storedUrlLitter = result.UrlLitter;
            if (storedUrlLitter !== undefined) {
                setting_UrlLitterTextarea.value = storedUrlLitter;
                // Validate on load to show errors if any were saved previously
                validateUrlLitterMemo();
            }
        });
    }

    function validateUrlLitterMemo(): void {
        const memoText = setting_UrlLitterTextarea.value;
        const regexLines = memoText.split('\n');
        let errorMessages = [];
        let hasError = false;

        for (let i = 0; i < regexLines.length; i++) {
            const regexString = regexLines[i].trim();
            if (regexString === '') continue;

            try {
                // Try to create a RegExp object
                new RegExp(regexString);
            } catch (error) {
                hasError = true;
                const message =
                    error instanceof Error ? error.message : `${error}`;
                errorMessages.push(`Line ${i + 1}: Invalid regex - ${message}`);
            }
        }

        if (hasError) {
            // Display error messages
            setting_UrlLitterTextarea.classList.add('error');
            error_UrlLitterDiv.innerHTML = errorMessages
                .map(escapeHtml)
                .join('<br>');
        } else {
            setting_UrlLitterTextarea.classList.remove('error');
            error_UrlLitterDiv.textContent = '';
        }
    }
});
