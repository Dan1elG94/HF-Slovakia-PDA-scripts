// ==UserScript==
// @name         PDA - Order drawing button
// @namespace    http://tampermonkey.net/
// @version      0.0.1
// @description  Prida tlacidlo s odkazom na vykres zakazky do detailu objednavky
// @author       Gabris
// @updateURL    https://github.com/Dan1elG94/HF-Slovakia-PDA-scripts/raw/refs/heads/main/order-drawing-button.user.js
// @downloadURL  https://github.com/Dan1elG94/HF-Slovakia-PDA-scripts/raw/refs/heads/main/order-drawing-button.user.js
// @match        https://hf.simplifier.cloud/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=simplifier.cloud
// @run-at       document-start
// @grant        none



// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const CONTAINER_ID = 'WorkcenterDetail--Order_FlexBox';
    const BUTTON_ID = '__pda_order_drawing_button__';

    function buildButton() {
        const button = document.createElement('button');
        button.id = BUTTON_ID;
        button.type = 'button';

        button.style.display = 'flex';
        button.style.flexDirection = 'column';
        button.style.alignItems = 'flex-end';
        button.style.gap = '2px';
        button.style.padding = '6px 12px';
        button.style.border = '1px solid #5b9bd5';
        button.style.borderRadius = '6px';
        button.style.backgroundColor = '#ffffff';
        button.style.cursor = 'pointer';
        button.style.marginBottom = '8px';
        button.style.width = '150px';
        button.style.flex = '0 0 150px';
        button.style.alignSelf = 'flex-start';
        button.style.marginLeft = 'auto';

        const label = document.createElement('span');
        label.textContent = 'VÝKRES';
        label.style.fontSize = '0.65rem';
        label.style.color = '#888888';
        label.style.letterSpacing = '0.05em';

        const value = document.createElement('span');
        value.id = '__pda_order_drawing_value__';
        value.textContent = '2-59.1.-06.25-018';
        value.style.fontSize = '0.9rem';
        value.style.fontWeight = 'bold';
        value.style.color = '#000000';

        const revision = document.createElement('span');
        revision.id = '__pda_order_drawing_revision__';
        revision.textContent = 'rev. AA';
        revision.style.fontSize = '0.75rem';
        revision.style.color = '#555555';

        button.appendChild(label);
        button.appendChild(value);
        button.appendChild(revision);

        return button;
    }

    function ensureButton() {
        const container = document.getElementById(CONTAINER_ID);
        if (!container) return;
        if (document.getElementById(BUTTON_ID)) return;

        const button = buildButton();
        container.insertBefore(button, container.firstChild);
    }

    let debounceTimer = null;
    function scheduleEnsure() {
        if (debounceTimer) return;
        debounceTimer = setTimeout(() => {
            debounceTimer = null;
            ensureButton();
        }, 300);
    }

    scheduleEnsure();
    const observer = new MutationObserver(() => {
        if (!document.getElementById(BUTTON_ID)) scheduleEnsure();
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();