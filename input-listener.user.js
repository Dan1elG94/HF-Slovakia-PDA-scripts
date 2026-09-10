// ==UserScript==
// @name         PDA - Input listener (skener + RFID citacka)
// @namespace    http://tampermonkey.net/
// @version      0.0.1
// @description  Invisible listener for user input
// @author       Gabris
// @updateURL    https://github.com/Dan1elG94/HF-Slovakia-PDA-scripts/raw/refs/heads/main/color-and-reorder-buttons.user.js
// @downloadURL  https://github.com/Dan1elG94/HF-Slovakia-PDA-scripts/raw/refs/heads/main/color-and-reorder-buttons.user.js
// @match        https://hf.simplifier.cloud/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=simplifier.cloud
// @run-at       document-start
// @grant        none

// ==/UserScript==

(function () {
    'use strict';

    const HIDDEN_INPUT_ID = '__pda_hidden_scanner_input__';
    const CARD_ID_LENGTH = 10;
    const REFOCUS_INTERVAL = 1000;

    const SCANNER_CHAR_MAP = {
        '+': '1',
        'ľ': '2',
        'š': '3',
        'č': '4',
        'ť': '5',
        'ž': '6',
        'ý': '7',
        'á': '8',
        'í': '9',
        'é': '0',
    };

    function decodeRawInput(raw) {
    // ak je prvy znak J - odstranit
    const stripped = raw.length > 0 && raw[0] === 'J' ? raw.slice(1) : raw;

    let translated = '';
    for (const ch of stripped) {
        if (ch === '.') {
            translated += '-';
        } else if (SCANNER_CHAR_MAP.hasOwnProperty(ch)) {
            translated += SCANNER_CHAR_MAP[ch];
        } else {
            translated += ch;
        }}
    return translated;
    }

    function classifyInput(decoded) {
        if (decoded.length === CARD_ID_LENGTH) {
            return { type: 'card', value: decoded };
        }
        return { type: 'order', value: decoded };
    }

    function handleRawInput(raw) {
        const decoded = decodeRawInput(raw);
        const classified = classifyInput(decoded);

        if (classified.type === 'card') {
            console.log('[PDA input-listener] rozpoznane ID karty:', classified.value, '(dlzka:', decoded.length, ')');
        } else {
            console.log('[PDA input-listener] rozpoznane cislo zakazky:', classified.value, '(dlzka:', decoded.length, ')');
        }
    }

    function createHiddenInput() {
        let input = document.getElementById(HIDDEN_INPUT_ID);
        if (input) return input;

        input = document.createElement('input');
        input.id = HIDDEN_INPUT_ID;
        input.type = 'text';
        input.autocomplete = 'off';

        // vizualne skryte, ale stale v DOM a focusovatelne
        input.style.position = 'fixed';
        input.style.top = '0';
        input.style.left = '0';
        input.style.width = '1px';
        input.style.height = '1px';
        input.style.opacity = '0';
        input.style.border = 'none';
        input.style.padding = '0';
        input.style.margin = '0';
        input.style.pointerEvents = 'none';

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const raw = input.value;
                input.value = '';
                if (raw) handleRawInput(raw);
            }
        });

        document.body.appendChild(input);
        return input;
    }

    function ensureFocus(input) {
        const active = document.activeElement;
        const isButton = !!active && (active.tagName === 'BUTTON' || active.getAttribute('role') === 'button');
        const okToRefocus = !active || active === document.body || isButton;

        if (okToRefocus) {
            input.focus();
        }
    }

    function init() {
        const input = createHiddenInput();
        input.focus();
        setInterval(() => ensureFocus(input), REFOCUS_INTERVAL);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();