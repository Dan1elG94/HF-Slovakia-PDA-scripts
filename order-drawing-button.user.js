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
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @require      https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js
// ==/UserScript==

(function () {
    'use strict';

    // ---------- Excel: nacitanie a vytvorenie indexu cislo zakazky -> vykres/verzia ----------

    // UPRAV podla realnej cesty k suboru:
    // - mapovany sietovy disk:      'file:///Z:/cesta/k/suboru/plan.xlsx'
    // - UNC cesta (bez mapovania):  'file://server/share/plan.xlsx'
    const EXCEL_FILE_URL = 'file:///C:/Users/Gabris/OneDrive - HF MIXING GROUP/HFSK O.4 Production - Data source/AutomatedOQ180.xlsx';

    // nazov listu v Exceli - null = pouzije sa prvy list v subore
    const SHEET_NAME = null;

    const COL_ORDER_NO = 7;    // stlpec H
    const COL_DRAWING_NO = 33; // stlpec AH
    const COL_VERSION = 34;    // stlpec AI

    let drawingIndex = {};

    function buildDrawingIndex(rows) {
        const index = {};

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row) continue;

            const orderNoRaw = row[COL_ORDER_NO];
            if (orderNoRaw === undefined || orderNoRaw === null || orderNoRaw === '') continue;

            const key = String(orderNoRaw).trim();
            const drawingNoRaw = row[COL_DRAWING_NO];
            const versionRaw = row[COL_VERSION];

            index[key] = {
                drawingNo: drawingNoRaw != null ? String(drawingNoRaw).trim() : '',
                version: versionRaw != null ? String(versionRaw).trim() : '',
            };
        }

        return index;
    }

    function loadExcel() {
        GM_xmlhttpRequest({
            method: 'GET',
            url: EXCEL_FILE_URL,
            responseType: 'arraybuffer',
            onload: function (response) {
                try {
                    const data = new Uint8Array(response.response);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = SHEET_NAME || workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    if (!sheet) {
                        console.warn('[PDA drawing-button] list', sheetName, 'sa v exceli nenasiel');
                        return;
                    }

                    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                    drawingIndex = buildDrawingIndex(rows);
                    unsafeWindow.PDA_DRAWING_INDEX = drawingIndex;

                    console.log('[PDA drawing-button] index vytvoreny, pocet zaznamov:', Object.keys(drawingIndex).length);

                    if (unsafeWindow.PDA_CURRENT_OPERATION) {
                        applyDrawingForCurrentOperation(unsafeWindow.PDA_CURRENT_OPERATION);
                    }
                } catch (e) {
                    console.warn('[PDA drawing-button] chyba pri spracovani excelu', e);
                }
            },
            onerror: function (err) {
                console.warn('[PDA drawing-button] chyba pri nacitani suboru (skontroluj cestu a "Allow access to file URLs")', err);
            },
        });
    }

    function findDrawingByOrderNo(orderNo) {
        return drawingIndex[orderNo] || null;
    }
    unsafeWindow.PDA_findDrawingByOrderNo = findDrawingByOrderNo;

    // ---------- XHR intercept: sledovanie aktualne otvorenej operacie ----------
    const TARGET_URL_SUBSTRING = '/client/1.0/executeBO';

    unsafeWindow.PDA_CURRENT_OPERATION = unsafeWindow.PDA_CURRENT_OPERATION || null;

    const originalOpen = unsafeWindow.XMLHttpRequest.prototype.open;
    const originalSend = unsafeWindow.XMLHttpRequest.prototype.send;

    unsafeWindow.XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        this._pdaDrawing_url = url;
        return originalOpen.call(this, method, url, ...rest);
    };

    unsafeWindow.XMLHttpRequest.prototype.send = function (body) {
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

        unsafeWindow.PDA_CURRENT_OPERATION = current;
        applyDrawingForCurrentOperation(current);
    }

    function applyDrawingForCurrentOperation(current) {
        const orderNoForLookup = (current.productionOrderNo || '').slice(2);
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

    // ---------- Vykreslenie tlacidla ----------
    const CONTAINER_ID = 'WorkcenterDetail--Order_FlexBox';
    const WRAPPER_ID = '__pda_order_drawing_wrapper__';
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

    function buildWrapper() {
        const wrapper = document.createElement('div');
        wrapper.id = WRAPPER_ID;
        wrapper.style.display = 'flex';
        wrapper.style.justifyContent = 'flex-end';
        wrapper.style.width = '100%';
        wrapper.style.boxSizing = 'border-box';
        wrapper.style.marginBottom = '8px';

        wrapper.appendChild(buildButton());
        return wrapper;
    }

    function ensureButton() {
        const container = document.getElementById(CONTAINER_ID);
        if (!container) return;
        if (document.getElementById(WRAPPER_ID)) return;

        const wrapper = buildWrapper();
        container.insertBefore(wrapper, container.firstChild);

        if (unsafeWindow.PDA_CURRENT_OPERATION) {
            applyDrawingForCurrentOperation(unsafeWindow.PDA_CURRENT_OPERATION);
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

    loadExcel();
})();