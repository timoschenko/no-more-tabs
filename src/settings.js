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


document.addEventListener('DOMContentLoaded', () => {
    const setting_HideAppTitle = document.getElementById('setting_HideAppTitle');

    // Load settings when the settings page is opened
    loadSettings();

    // Automatically save settings when checkbox is changed
    setting_HideAppTitle.addEventListener('change', saveSettings);

    function saveSettings() {
        const HideAppTitleValue = setting_HideAppTitle.checked;

        chrome.storage.sync.set({
            HideAppTitle: HideAppTitleValue
        }, () => {
            console.log('Settings saved');
        });
    }

    function loadSettings() {
        chrome.storage.sync.get(['HideAppTitle'], (result) => {
            const storedHideAppTitle = result.HideAppTitle;
            if (storedHideAppTitle !== undefined) {
                setting_HideAppTitle.checked = storedHideAppTitle;
            }
        });
    }
});
