// ==UserScript==
// @name         PDA - Enhanced Header
// @namespace    http://tampermonkey.net/
// @version      2.0.0
// @updateURL    https://github.com/Dan1elG94/HF-Slovakia-PDA-scripts/raw/refs/heads/main/enhanced-header.user.js
// @downloadURL  https://github.com/Dan1elG94/HF-Slovakia-PDA-scripts/raw/refs/heads/main/enhanced-header.user.js
// @description  Added text labels next to header icon buttons (visual styling moved to new-ui.user.js)
// @author       Gabris
// @match        https://hf.simplifier.cloud/appDirect/PDA/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=simplifier.cloud
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // POZNAMKA: styl (velkost/farba mena, farba logout tlacidla) bol presunuty
  // do new-ui.user.js. Tento skript uz iba doplna textove popisky k ikonovym
  // tlacidlam v hlavicke, co je funkcna (nie vizualna) uprava.

  const BUTTON_TEXT_MARGIN_RIGHT = '0.6rem';

  const BUTTONS = [
    { suffix: 'Button_HomeScreen-img', label: 'Pracoviská' },
    { suffix: 'Button_Reporting-img', label: 'Reporty' },
    { suffix: 'Button_Message-img', label: 'Správy' },
    { suffix: 'Button_Schedule-img', label: 'Rozvrh' },
    { suffix: 'Button_Settings-img', label: 'Admin' },
    { suffix: 'Button_ChangeUser-img', label: 'Zmena používateľa' },
    { suffix: 'Button_Logout-img', label: 'Odhlásenie' },
  ];

  function applyTextOnBtns() {
    BUTTONS.forEach(({ suffix, label }) => {
      document.querySelectorAll(`[id$="${suffix}"]`).forEach((img) => {
        if (img.dataset.pdaTextAdded) return;

        const textSpan = document.createElement('span');
        textSpan.className = 'sapMBtnContent';
        textSpan.style.marginRight = BUTTON_TEXT_MARGIN_RIGHT;
        textSpan.innerHTML = `<bdi>${label}</bdi>`;

        img.insertAdjacentElement('afterend', textSpan);
        img.dataset.pdaTextAdded = '1';
      });
    });
  }

  applyTextOnBtns();

  const observer = new MutationObserver(applyTextOnBtns);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
})();
