// ==UserScript==
// @name         PDA - Color and reorder buttons
// @namespace    http://tampermonkey.net/
// @version      2.0.0
// @description  Reorder status buttons (visual styling moved to new-ui.user.js)
// @author       Gabris
// @updateURL    https://github.com/Dan1elG94/HF-Slovakia-PDA-scripts/raw/refs/heads/main/color-and-reorder-buttons.user.js
// @downloadURL  https://github.com/Dan1elG94/HF-Slovakia-PDA-scripts/raw/refs/heads/main/color-and-reorder-buttons.user.js
// @match        https://hf.simplifier.cloud/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=simplifier.cloud
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // POZNAMKA: farbenie tlacidiel (styleButton) bolo presunute do new-ui.user.js,
  // aby vsetka vizualna stylizacia stranky sedela na jednom mieste.
  // Tento skript uz iba prerada tlacidla podla priority stavu.

  const CONTAINER_ID = 'WorkcenterDetail--Order_Status_Flexbox';

  const PRIORITY = { productive: 0, downtime: 1, fault: 2 };

  const STATUS_MAP = {
    'Výroba': 'productive',
    'Upinanie': 'productive',

    'Programovanie': 'downtime',
    'Upratovanie stola': 'downtime',
    'Meranie v Procese s OTK': 'downtime',

    'Chyba programu': 'fault',
  };

  function textOf(btn) {
    const el = btn.querySelector('.sapMBtnContent bdi, .sapMBtnContent');
    return el ? el.textContent.trim() : '';
  }

  function getButtons() {
    const container = document.getElementById(CONTAINER_ID);
    if (!container) return { container: null, buttons: [] };
    const buttons = Array.from(container.children).filter((el) => el.classList.contains('statusBtn'));
    return { container, buttons };
  }

  function reorderButtons(container, buttons) {
    if (!container || buttons.length === 0) return;

    const priorityOf = (btn) => PRIORITY[STATUS_MAP[textOf(btn)]] ?? 1.5;
    const sorted = [...buttons].sort((a, b) => priorityOf(a) - priorityOf(b));

    const alreadyOrdered = sorted.every((btn, i) => buttons[i] === btn);
    if (alreadyOrdered) return;

    sorted.forEach((btn) => container.appendChild(btn));
  }

  function updateAll() {
    const { container, buttons } = getButtons();
    reorderButtons(container, buttons);
  }

  updateAll();

  const observer = new MutationObserver(() => updateAll());
  observer.observe(document.body, { childList: true, subtree: true });
})();
