// ==UserScript==
// @name         PDA - Order drawing button
// @namespace    http://tampermonkey.net/
// @version      0.0.2
// @description  Nacita Excel s vykresmi zo sietoveho disku, sleduje aktualne otvorenu operaciu a zobrazuje cislo vykresu + verziu v tlacidle
// @author       Gabris
// @updateURL    https://github.com/Dan1elG94/HF-Slovakia-PDA-scripts/raw/refs/heads/main/order-drawing-button.user.js
// @downloadURL  https://github.com/Dan1elG94/HF-Slovakia-PDA-scripts/raw/refs/heads/main/order-drawing-button.user.js
// @match        https://hf.simplifier.cloud/appDirect/PDA/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=simplifier.cloud
// @run-at       document-start
// @grant        none
// @require      https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js
// ==/UserScript==

(function () {
    'use strict';

    // ---------- Excel: manualny vyber suboru a vytvorenie indexu cislo zakazky -> vykres/verzia ----------

    const SHEET_NAME = null; // null = prvy list v subore

    const COL_ORDER_NO = 7;    // stlpec H
    const COL_DRAWING_NO = 33; // stlpec AH
    const COL_VERSION = 34;    // stlpec AI

    let drawingIndex = {};
    let excelLoaded = false;

    function buildDrawingIndex(rows) {
        const index = {};

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row) continue;

            const orderNoRaw = row[COL_ORDER_NO];
            if (orderNoRaw === undefined || orderNoRaw === null || orderNoRaw === '') continue;

            const key = String(orderNoRaw).trim();
            if (!key) continue;

            index[key] = {
                drawingNo: row[COL_DRAWING_NO] != null ? String(row[COL_DRAWING_NO]).trim() : '',
                version: row[COL_VERSION] != null ? String(row[COL_VERSION]).trim() : '',
            };
        }

        console.log('[PDA drawing-button] ukazka prvych 5 klucov v indexe:', Object.keys(index).slice(0, 5));
        return index;
    }

    function handleExcelFile(file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = SHEET_NAME || workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                if (!sheet) {
                    console.warn('[PDA drawing-button] list', sheetName, 'sa v exceli nenasiel');
                    return;
                }

                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                drawingIndex = buildDrawingIndex(rows);
                window.PDA_DRAWING_INDEX = drawingIndex;
                excelLoaded = true;

                console.log('[PDA drawing-button] index vytvoreny, pocet zaznamov:', Object.keys(drawingIndex).length);
                updateLoadButtonState();

                if (window.PDA_CURRENT_OPERATION) {
                    applyDrawingForCurrentOperation(window.PDA_CURRENT_OPERATION);
                }
            } catch (err) {
                console.warn('[PDA drawing-button] chyba pri spracovani excelu', err);
            }
        };
        reader.onerror = function (err) {
            console.warn('[PDA drawing-button] chyba pri citani suboru', err);
        };
        reader.readAsArrayBuffer(file);
    }

    function findDrawingByOrderNo(orderNo) {
        return drawingIndex[orderNo] || null;
    }
    window.PDA_findDrawingByOrderNo = findDrawingByOrderNo;

    // ---------- XHR intercept: sledovanie aktualne otvorenej operacie ----------
    const TARGET_URL_SUBSTRING = '/client/1.0/executeBO';

    window.PDA_CURRENT_OPERATION = window.PDA_CURRENT_OPERATION || null;

    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        this._pdaDrawing_url = url;
        return originalOpen.call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.send = function (body) {
        const url = this._pdaDrawing_url || '';

        if (url.includes(TARGET_URL_SUBSTRING)) {
            this.addEventListener('load', function () {
                try {
                    const data = JSON.parse(this.responseText);
                    if (data && data.result && data.result.operation) {
                        handleCurrentOperationResponse(data.result.operation);
                    }
                } catch (e) {
                    // ignorujeme odpovede, ktore nie su JSON alebo nas nezaujimaju
                }
            });
        }

        return originalSend.apply(this, arguments);
    };

    function handleCurrentOperationResponse(operation) {
        const current = {
            workcenter: operation.workcenterDescription,
            workcenterCode: operation.workcenter,
            productionOrderNo: operation.productionOrderNo,
            operationNo: operation.operationNo,
            sequenceNo: operation.sequenceNo,
            materialNo: operation.materialNo,
            material: operation.material,
        };

        window.PDA_CURRENT_OPERATION = current;
        applyDrawingForCurrentOperation(current);
    }

    function applyDrawingForCurrentOperation(current) {
        const orderNoForLookup = "'" + (current.productionOrderNo || '').slice(2);
        const drawing = findDrawingByOrderNo(orderNoForLookup);

        if (drawing) {
            console.log('[PDA drawing-button] vykres pre zakazku', current.productionOrderNo, '->', drawing.drawingNo, '| verzia:', drawing.version);
        } else {
            console.log('[PDA drawing-button] vykres pre zakazku', current.productionOrderNo, '(hladane cislo', orderNoForLookup, ') sa v Exceli nenasiel');
        }

        updateDrawingButtonDisplay(drawing);
    }

    function updateDrawingButtonDisplay(drawing) {
        const valueEl = document.getElementById('__pda_order_drawing_value__');
        const revisionEl = document.getElementById('__pda_order_drawing_revision__');
        if (!valueEl || !revisionEl) return;

        if (drawing) {
            valueEl.textContent = drawing.drawingNo || '—';
            revisionEl.textContent = drawing.version ? 'rev. ' + drawing.version : '';
        } else {
            valueEl.textContent = '—';
            revisionEl.textContent = '';
        }
    }

    // ---------- Vykreslenie tlacidla + file picker ----------
    const CONTAINER_ID = 'WorkcenterDetail--Order_FlexBox';
    const WRAPPER_ID = '__pda_order_drawing_wrapper__';
    const BUTTON_ID = '__pda_order_drawing_button__';
    const LOAD_BUTTON_ID = '__pda_order_drawing_load_button__';
    const FILE_INPUT_ID = '__pda_order_drawing_file_input__';

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
        button.style.width = '150px';
        button.style.flexShrink = '0';
        button.style.marginRight = '8px';

        const label = document.createElement('span');
        label.textContent = 'VÝKRES';
        label.style.fontSize = '0.65rem';
        label.style.color = '#888888';
        label.style.letterSpacing = '0.05em';

        const value = document.createElement('span');
        value.id = '__pda_order_drawing_value__';
        value.textContent = '—';
        value.style.fontSize = '0.9rem';
        value.style.fontWeight = 'bold';
        value.style.color = '#000000';

        const revision = document.createElement('span');
        revision.id = '__pda_order_drawing_revision__';
        revision.textContent = '';
        revision.style.fontSize = '0.75rem';
        revision.style.color = '#555555';

        button.appendChild(label);
        button.appendChild(value);
        button.appendChild(revision);

        return button;
    }

    function buildLoadButton() {
        const loadButton = document.createElement('button');
        loadButton.id = LOAD_BUTTON_ID;
        loadButton.type = 'button';
        loadButton.textContent = 'Načítať Excel';

        loadButton.style.padding = '6px 10px';
        loadButton.style.border = '1px solid #cccccc';
        loadButton.style.borderRadius = '6px';
        loadButton.style.backgroundColor = '#f5f5f5';
        loadButton.style.cursor = 'pointer';
        loadButton.style.fontSize = '0.75rem';
        loadButton.style.marginRight = '8px';
        loadButton.style.alignSelf = 'center';

        loadButton.addEventListener('click', () => {
            const fileInput = document.getElementById(FILE_INPUT_ID);
            if (fileInput) fileInput.click();
        });

        return loadButton;
    }

    function updateLoadButtonState() {
        const loadButton = document.getElementById(LOAD_BUTTON_ID);
        if (!loadButton) return;

        if (excelLoaded) {
            loadButton.textContent = 'Excel načítaný ✓';
            loadButton.style.backgroundColor = '#e6f4ea';
            loadButton.style.borderColor = '#34a853';
        } else {
            loadButton.textContent = 'Načítať Excel';
            loadButton.style.backgroundColor = '#f5f5f5';
            loadButton.style.borderColor = '#cccccc';
        }
    }

    function ensureFileInput() {
        if (document.getElementById(FILE_INPUT_ID)) return;

        const fileInput = document.createElement('input');
        fileInput.id = FILE_INPUT_ID;
        fileInput.type = 'file';
        fileInput.accept = '.xlsx,.xls';
        fileInput.style.display = 'none';

        fileInput.addEventListener('change', () => {
            const file = fileInput.files && fileInput.files[0];
            if (file) handleExcelFile(file);
        });

        document.body.appendChild(fileInput);
    }

    function buildWrapper() {
        const wrapper = document.createElement('div');
        wrapper.id = WRAPPER_ID;
        wrapper.style.display = 'flex';
        wrapper.style.justifyContent = 'flex-end';
        wrapper.style.alignItems = 'center';
        wrapper.style.width = '100%';
        wrapper.style.boxSizing = 'border-box';
        wrapper.style.marginBottom = '8px';

        wrapper.appendChild(buildLoadButton());
        wrapper.appendChild(buildButton());
        return wrapper;
    }

    function ensureButton() {
        ensureFileInput();

        const container = document.getElementById(CONTAINER_ID);
        if (!container) return;
        if (document.getElementById(WRAPPER_ID)) return;

        const wrapper = buildWrapper();
        container.insertBefore(wrapper, container.firstChild);

        updateLoadButtonState();

        if (window.PDA_CURRENT_OPERATION) {
            applyDrawingForCurrentOperation(window.PDA_CURRENT_OPERATION);
        }
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
        if (!document.getElementById(WRAPPER_ID)) scheduleEnsure();
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();