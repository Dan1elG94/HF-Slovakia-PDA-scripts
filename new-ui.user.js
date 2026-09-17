// ==UserScript==
// @name         PDA - New UI
// @namespace    http://tampermonkey.net/
// @version      2.1.0
// @description  Centralna vizualna stylizacia celej PDA stranky (farby, karty, zaoblenia, preusporiadanie do 4 riadkov, nadpis "Stav operácie", jednotny radius tlacidiel) podla navrhu. Jedine miesto, kde sa mení CSS existujucich elementov.
// @author       Gabris
// @match        https://hf.simplifier.cloud/appDirect/PDA/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=simplifier.cloud
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // =====================================================================
    // POZNAMKA K ROZSAHU (precitaj pred upravou):
    //
    // - Vsetky farby/zaoblenia/tiene existujucich prvkov stranky su odteraz
    //   TU, na jednom mieste (ine skripty uz CSS nemenia).
    // - Text popiskov v hlavicke navrhu ("Prehľad", "Exporty", "Recepty")
    //   sa NEZHODUJE s realnymi tlacidlami v HTML (realne su Pracoviská /
    //   Reporty / Správy / Rozvrh / Admin / Zmena používateľa / Odhlásenie).
    //   Kedze nemam prekryvat existujuce tlacidla novymi/inak pomenovanymi,
    //   ponechavam realne popisky a menim iba vizual (farby, tvar, medzery).
    // - Vyhladavaci riadok z navrhu (hore v hlavicke) v realnom HTML na tomto
    //   mieste neexistuje - existujuci vyhladavaci riadok (crosscenter-search
    //   skript) je vlozeny nizsie na stranke. Nepremiestnoval som ho do
    //   hlavicky (riskantny zasah do DOM-u, ktory spravuje iny skript),
    //   iba som mu upravil vizual na mieste, kde je.
    // - Donut grafy (SAP Setup/Machine/Labor Time) su vykreslene do <canvas>
    //   - ich farby sa neda menit cez CSS, tak som styloval iba okolie
    //   (karta, popisky, hodnoty).
    // - Pravy panel "PDA" (Výkresy, CHIPS, Majster...) v realnom HTML vobec
    //   neexistuje. Podla zadania je tu zatial iba placeholder v DOM.
    // =====================================================================

    const STYLE_TAG_ID = '__pda_new_ui_styles__';

    function injectStyles() {
        if (document.getElementById(STYLE_TAG_ID)) return;

        const style = document.createElement('style');
        style.id = STYLE_TAG_ID;
        style.textContent = `
        :root {
            --pda-primary: #2f6fed;
            --pda-primary-dark: #1d4ed8;
            --pda-bg: #eef2f8;
            --pda-card-bg: #ffffff;
            --pda-border: #e1e6ee;
            --pda-text: #1a2233;
            --pda-text-muted: #6b7280;
            --pda-radius-lg: 14px;
            --pda-radius-md: 10px;
            --pda-radius-sm: 8px;
            --pda-shadow: 0 1px 3px rgba(16,24,40,.06), 0 1px 2px rgba(16,24,40,.04);
            --pda-success: #2f9e44;
            --pda-warning: #d9772f;
            --pda-danger: #d64545;
            --pda-info: #2f6fed;
        }

        /* ---------- Podklad stranky ---------- */
        #Main--MainPage-cont { background-color: var(--pda-bg) !important; }

        /* ---------- Hlavicka ---------- */
        #Main--Bar_Header {
            background-color: var(--pda-card-bg) !important;
            border-bottom: 1px solid var(--pda-border) !important;
            box-shadow: var(--pda-shadow) !important;
        }
        #Main--Image_Logo { height: 2.25rem !important; }
        #Main--Label_Username-bdi {
            font-size: 1.15rem !important;
            font-weight: 700 !important;
            color: var(--pda-text) !important;
        }
        #Main--Hour_Date_Title-inner {
            color: var(--pda-text-muted) !important;
            font-size: 0.85rem !important;
        }
        #Main--Bar_Header-BarRight button.sapMBtnBase {
            border-radius: var(--pda-radius-sm) !important;
            transition: background-color .12s ease;
        }
        #Main--Bar_Header-BarRight .sapMBtnInner {
            border-radius: var(--pda-radius-sm) !important;
            padding: 0 0.9rem !important;
        }
        #Main--Bar_Header-BarRight button.sapMBtnBase:hover .sapMBtnInner {
            background-color: var(--pda-bg) !important;
        }
        #Main--Button_Logout-inner {
            background-color: #fbe9e7 !important;
            color: #c0392b !important;
        }
        #Main--Button_Logout-inner .sapMBtnContent bdi { color: #c0392b !important; }

        /* ---------- Jednotny radius vsetkych tlacidiel v aplikacii (8px) ---------- */
        .sapMBtnBase,
        .sapMBtnBase .sapMBtnInner,
        .sapMBtnInner {
            border-radius: var(--pda-radius-sm) !important;
        }

        /* ---------- Lavy panel: Pracovny zoznam ---------- */
        #Main--Workcenter_Panel,
        #WorkcenterDetail--Work_List {
            background-color: var(--pda-card-bg) !important;
            border-radius: var(--pda-radius-lg) !important;
            box-shadow: var(--pda-shadow) !important;
            border: 1px solid var(--pda-border) !important;
            overflow: hidden;
        }
        #WorkcenterDetail--WorkList_Title-inner {
            font-size: 0.78rem !important;
            font-weight: 700 !important;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: var(--pda-text-muted) !important;
        }
        #WorkcenterDetail--WorkcenterDetail_SearchField-I,
        #__pda_custom_search_ui__ input.sapMSFI {
            background-color: var(--pda-bg) !important;
            border-radius: var(--pda-radius-sm) !important;
            border: 1px solid var(--pda-border) !important;
            padding-left: 0.6rem !important;
        }
        #WorkcenterDetail--Work_List-listUl li.sapMLIB {
            border-radius: var(--pda-radius-md) !important;
            margin: 4px 8px !important;
            border: 1px solid transparent !important;
        }
        #WorkcenterDetail--Work_List-listUl li.sapMLIB:hover {
            background-color: var(--pda-bg) !important;
        }
        #WorkcenterDetail--Work_List-listUl li.sapMLIBSelected {
            background-color: var(--pda-primary) !important;
            border-color: var(--pda-primary-dark) !important;
        }
        #WorkcenterDetail--Work_List-listUl li.sapMLIBSelected * {
            color: #ffffff !important;
        }

        /* ---------- Karty v detaile zakazky ---------- */
        #WorkcenterDetail--Main_SimpleForm,
        #WorkcenterDetail--Description_SimpleForm,
        #WorkcenterDetail--TimerCharts_FlexBox,
        #WorkcenterDetail--OrderStatus_List {
            background-color: var(--pda-card-bg) !important;
            border: 1px solid var(--pda-border) !important;
            border-radius: var(--pda-radius-lg) !important;
            box-shadow: var(--pda-shadow) !important;
            padding: 14px 16px !important;
            box-sizing: border-box !important;
            margin-bottom: 0 !important;
            width: 100% !important;
        }
        #WorkcenterDetail--TimerCharts_FlexBox { padding-top: 30px !important; position: relative; }

        /* ---------- Preusporiadanie WorkcenterDetail--Order_FlexBox do 4 riadkov ---------- */
        #WorkcenterDetail--Order_FlexBox {
            display: grid !important;
            grid-template-columns: 1fr !important;
            grid-template-rows: repeat(4, auto) !important;
            gap: 12px !important;
            align-items: start !important;
            width: 100% !important;
        }
        #__pda_order_status_wrapper__ {
            grid-row: 1 !important;
            grid-column: 1 !important;
            background-color: var(--pda-card-bg) !important;
            border: 1px solid var(--pda-border) !important;
            border-radius: var(--pda-radius-lg) !important;
            box-shadow: var(--pda-shadow) !important;
            padding: 14px 16px !important;
            box-sizing: border-box !important;
            width: 100% !important;
        }
        #__pda_order_status_wrapper__ > .pda-section-heading { margin: 0 0 10px 0; }
        #__pda_order_row2__ {
            grid-row: 2 !important;
            grid-column: 1 !important;
            display: flex !important;
            gap: 8px !important;
            align-items: stretch !important;
            width: 100% !important;
        }
        #__pda_order_row2__ > .sapMFlexItem,
        #__pda_order_row2__ > button {
            flex: 1 1 0 !important;
            width: auto !important;
        }
        #__pda_order_row2__ > #__pda_order_drawing_wrapper__ {
            flex: 0 0 auto !important;
        }
        #__pda_order_row3__,
        #__pda_order_row4__ {
            grid-column: 1 !important;
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 12px !important;
            align-items: start !important;
            width: 100% !important;
        }
        #__pda_order_row3__ { grid-row: 3 !important; }
        #__pda_order_row4__ { grid-row: 4 !important; }
        #__pda_order_row3__ > *,
        #__pda_order_row4__ > * {
            min-width: 0 !important;
        }

        .pda-section-heading {
            font-size: 0.72rem;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: var(--pda-primary);
            margin: 0 0 10px 0;
        }
        #WorkcenterDetail--TimerCharts_FlexBox > .pda-section-heading {
            position: absolute;
            top: 12px;
            left: 16px;
            margin: 0;
        }

        #WorkcenterDetail--OrderStatus_List-header {
            background: transparent !important;
            font-size: 0.72rem !important;
            font-weight: 700 !important;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: var(--pda-primary) !important;
            padding: 0 0 10px 0 !important;
            border: none !important;
        }

        /* ---------- Stavove tlacidla operacie ---------- */
        #WorkcenterDetail--Order_Status_Flexbox { gap: 8px; }
        #WorkcenterDetail--Order_Status_Flexbox .statusBtn,
        #WorkcenterDetail--Order_Status_Flexbox .statusBtn .sapMBtnInner {
            border-radius: var(--pda-radius-sm) !important;
        }
        #WorkcenterDetail--Order_Status_Flexbox .statusBtn .sapMBtnInner {
            font-weight: 600 !important;
        }
        #WorkcenterDetail--Order_Status_Flexbox .statusBtn[data-pda-status="productive"] .sapMBtnInner {
            background-color: var(--pda-success) !important;
            border-color: var(--pda-success) !important;
            color: #ffffff !important;
        }
        #WorkcenterDetail--Order_Status_Flexbox .statusBtn[data-pda-status="downtime"] .sapMBtnInner {
            background-color: var(--pda-warning) !important;
            border-color: var(--pda-warning) !important;
            color: #ffffff !important;
        }
        #WorkcenterDetail--Order_Status_Flexbox .statusBtn[data-pda-status="fault"] .sapMBtnInner {
            background-color: var(--pda-danger) !important;
            border-color: var(--pda-danger) !important;
            color: #ffffff !important;
        }
        #WorkcenterDetail--Order_Status_Flexbox .statusBtn[data-pda-status="productive"] .sapMBtnContent,
        #WorkcenterDetail--Order_Status_Flexbox .statusBtn[data-pda-status="downtime"] .sapMBtnContent,
        #WorkcenterDetail--Order_Status_Flexbox .statusBtn[data-pda-status="fault"] .sapMBtnContent {
            color: #ffffff !important;
        }

        /* ---------- Vykres / Components/BOM / Operation Complete ---------- */
        #WorkcenterDetail--Order_Info_Buttons_FlexBox .sapMBtnBase {
            border-radius: var(--pda-radius-sm) !important;
        }
        #WorkcenterDetail--BoM_Button .sapMBtnInner {
            border-radius: var(--pda-radius-sm) !important;
            border-color: var(--pda-border) !important;
        }
        #WorkcenterDetail--Confirm_Button .sapMBtnInner {
            background-color: var(--pda-primary) !important;
            border-color: var(--pda-primary) !important;
            border-radius: var(--pda-radius-sm) !important;
            font-weight: 700 !important;
        }
        #WorkcenterDetail--Confirm_Button .sapMBtnContent,
        #WorkcenterDetail--Confirm_Button .sapMBtnContent bdi {
            color: #ffffff !important;
        }

        /* ---------- Paralelne procesy - polozky (ked sa objavia) ---------- */
        #WorkcenterDetail--OrderStatus_List-listUl li.sapMLIB {
            border-radius: var(--pda-radius-sm) !important;
            border: 1px solid var(--pda-border) !important;
            margin-bottom: 6px !important;
        }

        /* ---------- Pravy PDA panel - zatial iba placeholder ---------- */
        #__pda_right_sidebar_placeholder__ {
            position: fixed;
            top: 90px;
            right: 14px;
            width: 190px;
            max-height: calc(100vh - 110px);
            overflow-y: auto;
            background-color: var(--pda-card-bg);
            border: 1px solid var(--pda-border);
            border-radius: var(--pda-radius-lg);
            box-shadow: var(--pda-shadow);
            padding: 14px;
            box-sizing: border-box;
            font-family: inherit;
            z-index: 500;
        }
        #__pda_right_sidebar_placeholder__ .pda-rs-title {
            font-size: 0.72rem;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: var(--pda-primary);
            margin-bottom: 8px;
        }
        #__pda_right_sidebar_placeholder__ .pda-rs-empty {
            font-size: 0.8rem;
            color: var(--pda-text-muted);
        }
        `;
        document.head.appendChild(style);
    }

    // ---------- Farby statusovych tlacidiel podla textu ----------
    const STATUS_MAP = {
        'Výroba': 'productive',
        'Upinanie': 'productive',
        'Upínanie': 'productive',

        'Programovanie': 'downtime',
        'Upratovanie stola': 'downtime',
        'Meranie v Procese s OTK': 'downtime',

        'Chyba programu': 'fault',
    };

    function textOf(btn) {
        const el = btn.querySelector('.sapMBtnContent bdi, .sapMBtnContent');
        return el ? el.textContent.trim() : '';
    }

    function applyStatusButtonColors() {
        const container = document.getElementById('WorkcenterDetail--Order_Status_Flexbox');
        if (!container) return;

        container.querySelectorAll('.statusBtn').forEach((btn) => {
            const category = STATUS_MAP[textOf(btn)];
            if (category) {
                btn.setAttribute('data-pda-status', category);
            } else {
                btn.removeAttribute('data-pda-status');
            }
        });
    }

    // ---------- Decorativne nadpisy karet (iba text, ziadne tlacidla) ----------
    function ensureHeadingInside(containerId, headingId, text) {
        const container = document.getElementById(containerId);
        if (!container) return;
        if (document.getElementById(headingId)) return;

        const heading = document.createElement('div');
        heading.id = headingId;
        heading.className = 'pda-section-heading';
        heading.textContent = text;
        container.insertBefore(heading, container.firstChild);
    }

    function renameParallelProcessesHeader() {
        const header = document.getElementById('WorkcenterDetail--OrderStatus_List-header');
        if (header && header.textContent.trim() === 'Parallel Process Handling') {
            header.textContent = 'Paralelné procesy';
        }
    }

    // ---------- Preusporiadanie WorkcenterDetail--Order_FlexBox do 4 riadkov ----------
    const ORDER_FLEXBOX_ID = 'WorkcenterDetail--Order_FlexBox';
    const ROW1_ID = 'WorkcenterDetail--Order_Status_Flexbox';
    const STATUS_WRAPPER_ID = '__pda_order_status_wrapper__';
    const ROW2_WRAPPER_ID = '__pda_order_row2__';
    const ROW3_WRAPPER_ID = '__pda_order_row3__';
    const ROW4_WRAPPER_ID = '__pda_order_row4__';
    const DRAWING_WRAPPER_ID = '__pda_order_drawing_wrapper__';

    const ROW2_ITEM_IDS = ['__pda_order_drawing_button__', 'WorkcenterDetail--BoM_Button', 'WorkcenterDetail--Confirm_Button'];
    const ROW3_ITEM_IDS = ['WorkcenterDetail--Main_SimpleForm', 'WorkcenterDetail--TimerCharts_FlexBox'];
    const ROW4_ITEM_IDS = ['WorkcenterDetail--Description_SimpleForm', 'WorkcenterDetail--OrderStatus_List'];

    function ensureRowWrapper(id) {
        let wrapper = document.getElementById(id);
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.id = id;
        }
        return wrapper;
    }

    function reorganizeOrderLayout() {
        const orderFlexBox = document.getElementById(ORDER_FLEXBOX_ID);
        if (!orderFlexBox) return;

        const statusWrapper = ensureRowWrapper(STATUS_WRAPPER_ID);
        const row2 = ensureRowWrapper(ROW2_WRAPPER_ID);
        const row3 = ensureRowWrapper(ROW3_WRAPPER_ID);
        const row4 = ensureRowWrapper(ROW4_WRAPPER_ID);

        // Wrappery pripojime do gridu hned, aby ich nasledne vedeli najst
        // pomocnici pracujuci cez document.getElementById (napr. ensureHeadingInside).
        [statusWrapper, row2, row3, row4].forEach((el) => {
            if (el && el.parentElement !== orderFlexBox) orderFlexBox.appendChild(el);
        });

        // Riadok 1: nadpis "STAV OPERÁCIE" a pod nim stavove tlacidla
        const statusFlexbox = document.getElementById(ROW1_ID);
        if (statusFlexbox && statusFlexbox.parentElement !== statusWrapper) {
            statusWrapper.appendChild(statusFlexbox);
        }
        ensureHeadingInside(STATUS_WRAPPER_ID, '__pda_heading_status__', 'STAV OPERÁCIE');

        // Riadok 2: presunut tlacidla do wrappera (v poradi Vykres, BOM, Operation Complete)
        ROW2_ITEM_IDS.forEach((id) => {
            const el = document.getElementById(id);
            if (el && el.parentElement !== row2) row2.appendChild(el);
        });
        // vlastny wrapper tlacidla na vykres (moze obsahovat aj tlacidlo "Nacitat Excel")
        // presunieme tiez do riadku 2, aby neostal ako osamoteny prvok inde na stranke
        const drawingWrapper = document.getElementById(DRAWING_WRAPPER_ID);
        if (drawingWrapper && drawingWrapper.parentElement !== row2) row2.appendChild(drawingWrapper);

        // Riadok 3: Zakazka a material (lavo) + SAP casy (pravo)
        ROW3_ITEM_IDS.forEach((id) => {
            const el = document.getElementById(id);
            if (el && el.parentElement !== row3) row3.appendChild(el);
        });

        // Riadok 4: Popis operacie (lavo) + Paralelne procesy (pravo)
        ROW4_ITEM_IDS.forEach((id) => {
            const el = document.getElementById(id);
            if (el && el.parentElement !== row4) row4.appendChild(el);
        });

        // Vsetko ostatne, co ostalo priamym dietatom Order_FlexBox (povodne wrappery,
        // z ktorych sme prvky vytiahli), skryjeme, aby nerozbijalo 4-riadkovy grid.
        const allowed = new Set([statusWrapper, row2, row3, row4].filter(Boolean));
        Array.from(orderFlexBox.children).forEach((child) => {
            if (!allowed.has(child)) {
                if (child.style.display !== 'none') child.style.setProperty('display', 'none', 'important');
            }
        });
    }

    // ---------- Pravy PDA panel - placeholder ----------
    const RIGHT_SIDEBAR_ID = '__pda_right_sidebar_placeholder__';

    function ensureRightSidebarPlaceholder() {
        if (document.getElementById(RIGHT_SIDEBAR_ID)) return;
        if (!document.getElementById('Main--MainPage')) return;

        const panel = document.createElement('div');
        panel.id = RIGHT_SIDEBAR_ID;
        panel.innerHTML = `
            <div class="pda-rs-title">PDA</div>
            <div class="pda-rs-empty">Pripravuje sa…</div>
        `;
        document.body.appendChild(panel);
    }

    // ---------- Aplikovanie vsetkeho, opakovane pri zmenach DOM ----------
    function applyAll() {
        injectStyles();
        reorganizeOrderLayout();
        applyStatusButtonColors();
        ensureHeadingInside('WorkcenterDetail--Main_SimpleForm', '__pda_heading_order__', 'Zákazka a materiál');
        ensureHeadingInside('WorkcenterDetail--Description_SimpleForm', '__pda_heading_description__', 'Popis operácie');
        ensureHeadingInside('WorkcenterDetail--TimerCharts_FlexBox', '__pda_heading_times__', 'SAP časy');
        renameParallelProcessesHeader();
        ensureRightSidebarPlaceholder();
    }

    let debounceTimer = null;
    function scheduleApply() {
        if (debounceTimer) return;
        debounceTimer = setTimeout(() => {
            debounceTimer = null;
            applyAll();
        }, 200);
    }

    applyAll();
    const observer = new MutationObserver(scheduleApply);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
})();
