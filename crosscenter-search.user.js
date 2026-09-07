// ==UserScript==
// @name         PDA - Cross-workcenter search (XHR data)
// @namespace    http://tampermonkey.net/
// @version      0.0.3
// @description  Searchbar na vyhladavanie naprieč vsetkymi pracoviskami
// @author       Gabris
// @updateURL    https://github.com/Dan1elG94/HF-Slovakia-PDA-scripts/raw/refs/heads/main/crosscenter-search.user.js
// @downloadURL  https://github.com/Dan1elG94/HF-Slovakia-PDA-scripts/raw/refs/heads/main/crosscenter-search.user.js
// @match        https://hf.simplifier.cloud/appDirect/PDA/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=simplifier.cloud
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ---------- XHR intercept: naplnanie PDA_ORDERS_INDEX ----------
  const TARGET_URL_SUBSTRING = '/client/1.0/executeBO';
  const TARGET_BO_METHOD = 'getOperationListTempForWorkcenters';

  window.PDA_ORDERS_INDEX = window.PDA_ORDERS_INDEX || [];
  let lastIndexUpdate = null;

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._pda_url = url;
    return originalOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (body) {
    if (this._pda_url && this._pda_url.includes(TARGET_URL_SUBSTRING)) {
      let parsedBody = null;
      try { parsedBody = JSON.parse(body); } catch (e) { /* ignore */ }

      if (parsedBody && parsedBody.BOMethod === TARGET_BO_METHOD) {
        this.addEventListener('load', function () {
          try {
            const data = JSON.parse(this.responseText);
            const workcenters = data.result.aOperationListTempForWorkcenter || [];

            const flatOrders = [];
            workcenters.forEach((wc) => {
              (wc.operationList || []).forEach((op) => {
                flatOrders.push({
                  workcenter: wc.workcenterDescription,
                  workcenterCode: wc.workcenter,
                  salesOrderNo: op.salesOrderNo,
                  salesOrderItem: op.salesOrderItem,
                  productionOrderNo: op.productionOrderNo,
                  operationNo: op.operationNo,
                  sequenceNo: op.sequenceNo,
                  materialNo: op.materialNo,
                  material: op.material,
                  description: op.description,
                  descriptionShort: op.descriptionShort,
                  status: op.status,
                  confirmed: op.confirmed,
                });
              });
            });

            window.PDA_ORDERS_INDEX = flatOrders;
            lastIndexUpdate = new Date();
            console.log('[PDA orders] index naplneny, pocet zakaziek:', flatOrders.length);
            refreshSearchUIIfPresent();
          } catch (e) {
            console.warn('[PDA orders] chyba pri spracovani response', e);
          }
        });
      }
    }
    return originalSend.apply(this, arguments);
  };

  // ---------- Layout (lavy sidebar) ----------
  const PANEL_ID = 'Main--Workcenter_Panel';
  const CONTENT_ID = 'Main--Workcenter_Panel-content';
  const WORKCENTER_TILE_SELECTOR = '[id^="Main--Workcenter_Toolbar-Main--ui_layout_Grid3-"]';
  const LIST_UL_ID = 'WorkcenterDetail--Work_List-listUl';
  const HOME_BUTTON_ID = 'Main--Button_HomeScreen';

  const WRAPPER_ID = '__pda_content_wrapper__';
  const SIDEBAR_ID = '__pda_search_sidebar__';
  const UI_ID = '__pda_custom_search_ui__';

  const TILE_WAIT_TIMEOUT = 15000;
  const SETTLE_DELAY = 350;

  const TILE_ID_PREFIX = 'Main--Workcenter_Toolbar-';
  const LIST_ID_PREFIX = 'Main--List2-';

  let opening = false;
  let renderFn = null;

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  function waitFor(checkFn, { interval = 200, timeout = 10000 } = {}) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const timer = setInterval(() => {
        const result = checkFn();
        if (result) {
          clearInterval(timer);
          resolve(result);
        } else if (Date.now() - start > timeout) {
          clearInterval(timer);
          reject(new Error('waitFor timeout'));
        }
      }, interval);
    });
  }

  function pressElement(domEl) {
    let control = null;
    try {
      if (window.sap && sap.ui && sap.ui.core && typeof sap.ui.core.Element.closestTo === 'function') {
        control = sap.ui.core.Element.closestTo(domEl);
      }
      if (!control && window.sap && sap.ui && sap.ui.getCore) {
        control = sap.ui.getCore().byId(domEl.id);
      }
    } catch (e) { /* ignore */ }
    if (control && typeof control.firePress === 'function') {
      control.firePress();
      return;
    }
    domEl.click();
  }

  function getWorkcenterName(tile) {
    const suffix = tile.id.replace('Main--Workcenter_Toolbar-', '');
    const nameEl = document.getElementById(`Main--WorkcenterDescription_Label-${suffix}-bdi`);
    return nameEl ? nameEl.textContent.trim() : tile.id;
  }

  function extractField(li, marker) {
    const el = li.querySelector(`[id*="${marker}"][id$="-bdi"]`);
    return el ? el.textContent.trim() : '';
  }

  function formatProductionOrder(item) {
    return `${item.productionOrderNo} - ${item.operationNo} - ${item.sequenceNo}`;
  }

  function setStatus(msg) {
        const el = document.getElementById('__pda_status__');
        if (el) el.textContent = msg;
  }



  function getListIdForTile(tile) {
    if (!tile.id || !tile.id.startsWith(TILE_ID_PREFIX)) return null;
    const suffix = tile.id.slice(TILE_ID_PREFIX.length); // napr. "Main--ui_layout_Grid3-5"
    return LIST_ID_PREFIX + suffix; // "Main--List2-Main--ui_layout_Grid3-5"
  }

  function extractOrderText(li) {
    // Title control vnoreny v li, ID koncici na "-inner" (rovnaky pattern ako inde v apke)
    const titleEl = li.querySelector('[id*="Title"][id$="-inner"]');
    return titleEl ? titleEl.textContent.trim() : '';
  }

  async function openItem(item) {
  if (opening) return;
  opening = true;
  try {
    setStatus('Otváram zákazku...');

    const tiles = Array.from(document.querySelectorAll(WORKCENTER_TILE_SELECTOR));
    const tile = tiles.find((t) => getWorkcenterName(t) === item.workcenter);
    if (!tile) {
      setStatus('Pracovisko sa nenašlo.');
      return;
    }

    const listId = getListIdForTile(tile);
    let list = listId ? document.getElementById(listId) : null;

    // Ak zoznam este nie je v DOM (panel nemusi byt rozbaleny), klikneme na dlazdicu a pockame
    if (!list) {
      pressElement(tile);
      list = listId
        ? await waitFor(() => document.getElementById(listId), { timeout: TILE_WAIT_TIMEOUT })
        : null;
    }

    if (!list) {
      setStatus('Zoznam zákaziek pre toto pracovisko sa nenašiel.');
      return;
    }

    list.scrollIntoView({ block: 'center' });
    await sleep(SETTLE_DELAY);

    const targetText = formatProductionOrder(item);
    let li = Array.from(list.querySelectorAll('li')).find(
      (el) => extractOrderText(el) === targetText
    );

    // Ak sa zoznam este dorenderoval po kliku na dlazdicu, dame mu druhu sancu
    if (!li) {
      await sleep(SETTLE_DELAY);
      li = Array.from(list.querySelectorAll('li')).find(
        (el) => extractOrderText(el) === targetText
      );
    }

    if (!li) {
      setStatus('Konkrétna zákazka sa nenašla, otvorené je aspoň pracovisko.');
      return;
    }

    li.scrollIntoView({ block: 'center' });
    li.click();
    setStatus('Otvorené: ' + targetText);
  } catch (e) {
    console.warn('[PDA search] chyba pri otváraní položky', e);
    setStatus('Chyba pri otváraní zákazky.');
  } finally {
    opening = false;
  }
}

  function ensureLayout() {
    let wrapper = document.getElementById(WRAPPER_ID);
    let sidebar = document.getElementById(SIDEBAR_ID);

    const panel = document.getElementById(PANEL_ID);
    const content = document.getElementById(CONTENT_ID);
    if (!panel || !content) return null;

    if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.id = WRAPPER_ID;
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'row';
        wrapper.style.alignItems = 'flex-start';
        wrapper.style.width = '100%';
        wrapper.style.backgroundColor = '#ffffff';
        wrapper.style.paddingLeft = '10px';
    }
    if (!sidebar) {
      sidebar = document.createElement('div');
      sidebar.id = SIDEBAR_ID;
      sidebar.style.flex = '0 0 340px';
      sidebar.style.maxWidth = '340px';
      sidebar.style.maxHeight = '80vh';
      sidebar.style.overflowY = 'auto';
      sidebar.style.border = '1px solid #000000';
    }

    if (!wrapper.contains(content)) {
      panel.insertBefore(wrapper, content);
      wrapper.appendChild(sidebar);
      wrapper.appendChild(content);
      content.style.flex = '1 1 auto';
      content.style.minWidth = '0';
    }

    if (!document.getElementById(UI_ID)) buildCustomSearchUI(sidebar);
    return { wrapper, sidebar };
  }

  function buildCustomSearchUI(sidebar) {
    const list = document.createElement('div');
    list.id = UI_ID;
    list.className = 'sapMList sapMListBGSolid';
    list.style.width = '100%';

    const header = document.createElement('div');
    header.className = 'sapMIBar sapMTB sapMTBNewFlex sapMTBInactive sapMTBStandard sapMTB-Transparent-CTX sapMListHdr sapMListHdrTBar sapMTBHeader-CTX';
    const headerTitle = document.createElement('div');
    headerTitle.className = 'sapMTitle sapMTitleStyleAuto sapMTitleNoWrap sapUiSelectable sapMTitleMaxWidth sapMTitleTB sapMBarChild sapMTBShrinkItem';
    headerTitle.innerHTML = '<span dir="auto">Hľadanie naprieč pracoviskami</span>';
    header.appendChild(headerTitle);

    const searchToolbarContainer = document.createElement('div');
    searchToolbarContainer.className = 'sapMListInfoTBarContainer';
    const searchToolbar = document.createElement('div');
    searchToolbar.className = 'sapMIBar sapMTB sapMTBNewFlex sapMTBInactive sapMTBClear sapMTB-Transparent-CTX sapMListInfoTBar';
    const sf = document.createElement('div');
    sf.className = 'sapMSF sapMSFVal sapMBarChild sapMTBShrinkItem';
    sf.style.width = '100%';
    const form = document.createElement('form');
    form.className = 'sapMSFF';
    form.addEventListener('submit', (e) => e.preventDefault());
    const input = document.createElement('input');
    input.type = 'search';
    input.autocomplete = 'off';
    input.placeholder = 'Order number / material';
    input.className = 'sapMSFI';
    const resetDiv = document.createElement('div');
    resetDiv.title = 'Resetovať';
    resetDiv.className = 'sapMSFR sapMSFB';
    resetDiv.addEventListener('click', () => { input.value = ''; render(''); input.focus(); });
    const searchDiv = document.createElement('div');
    searchDiv.title = 'Hľadať';
    searchDiv.className = 'sapMSFS sapMSFB';
    form.appendChild(input);
    form.appendChild(resetDiv);
    form.appendChild(searchDiv);
    sf.appendChild(form);
    searchToolbar.appendChild(sf);
    searchToolbarContainer.appendChild(searchToolbar);

    const status = document.createElement('div');
    status.id = '__pda_status__';
    status.style.fontSize = '0.72rem';
    status.style.color = '#888';
    status.style.padding = '0.2rem 0.5rem';

    const resultsUl = document.createElement('ul');
    resultsUl.className = 'sapMListItems sapMListUl sapMListHighlight sapMListShowSeparatorsAll sapMListModeSingleSelectMaster';
    resultsUl.setAttribute('role', 'listbox');
    resultsUl.tabIndex = 0;

    function renderItem(it) {
      const li = document.createElement('li');
      li.tabIndex = 0;
      li.setAttribute('role', 'option');
      li.className = 'sapMLIB sapMLIB-CTX sapMLIBShowSeparator sapMLIBTypeActive sapMLIBActionable sapMLIBHoverable sapMLIBFocusable sapMCLI sapUiTinyMargin';
      li.innerHTML = `
        <div class="sapMLIBContent">
          <div class="sapMFlexBoxFit sapMFlexBox sapMHBox sapMFlexBoxJustifyStart sapMFlexBoxAlignItemsStretch sapMFlexBoxWrapNoWrap sapMFlexBoxAlignContentSpaceBetween sapMFlexBoxBGTransparent" style="height:100%;width:100%;">
            <div class="sapMFlexBox sapMVBox sapMFlexBoxJustifyStart sapMFlexBoxAlignItemsStretch sapMFlexBoxWrapNoWrap sapMFlexBoxAlignContentSpaceBetween sapMFlexBoxBGTransparent sapMFlexItem" style="height:100%;width:100%;">
              <span class="sapMLabel sapUiSelectable sapMLabelMaxWidth sapUiTinyMargin sapUiNoMarginBottom sapMFlexItem" style="font-weight:bold;text-align:left;">
                <span class="sapMLabelTextWrapper"><bdi>${formatProductionOrder(it)}</bdi></span>
              </span>
              <span class="sapMLabel sapUiSelectable sapMLabelMaxWidth sapUiTinyMargin sapUiNoMarginBottom sapMFlexItem" style="text-align:left;">
                <span class="sapMLabelTextWrapper"><bdi>${it.workcenter}</bdi></span>
              </span>
              <span class="sapMLabel sapUiSelectable sapMLabelMaxWidth sapUiTinyMargin sapUiNoMarginBottom sapMFlexItem" style="text-align:left;">
                <span class="sapMLabelTextWrapper"><bdi>${it.material || ''}</bdi></span>
              </span>
              <span class="sapMLabel sapUiSelectable sapMLabelMaxWidth sapMFlexItem" style="text-align:left;">
                <span class="sapMLabelTextWrapper"><bdi>${it.descriptionShort || ''}</bdi></span>
              </span>
            </div>
          </div>
        </div>`;
      li.addEventListener('click', () => openItem(it));
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openItem(it); }
      });
      return li;
    }

    function matchesTerm(it, term) {
        const dashIndex = term.indexOf('-');
        if (dashIndex !== -1) {
            const orderPart = term.slice(0, dashIndex).trim();
            const opPart = term.slice(dashIndex + 1).trim();
            const orderMatch = !orderPart || (it.productionOrderNo || '').toLowerCase().includes(orderPart);
            const opMatch = !opPart || (it.operationNo || '').toLowerCase().includes(opPart);
            return orderMatch && opMatch;
        }
        return (
            (it.productionOrderNo || '').toLowerCase().includes(term) ||
            (it.salesOrderNo || '').toLowerCase().includes(term) ||
            (it.materialNo || '').toLowerCase().includes(term) ||
            (it.material || '').toLowerCase().includes(term)
        );
    }

    function render(filterText) {
      resultsUl.innerHTML = '';
        const term = filterText.trim().toLowerCase();
        const index = window.PDA_ORDERS_INDEX || [];
        if (!term) {
            setStatus(`Index: ${index.length} zákaziek` + (lastIndexUpdate ? ` (aktualiz. ${lastIndexUpdate.toLocaleTimeString()})` : ' (čaká sa na načítanie appky)'));
            return;
        }
        const matches = index.filter((it) => matchesTerm(it, term));
        setStatus(`${matches.length} výsledok/-ov (z ${index.length} položiek)`);
        matches.slice(0, 200).forEach((it) => resultsUl.appendChild(renderItem(it)));
    }

    input.addEventListener('input', () => render(input.value));

    list.appendChild(header);
    list.appendChild(searchToolbarContainer);
    list.appendChild(status);
    list.appendChild(resultsUl);
    sidebar.appendChild(list);

    render('');
    renderFn = render;
  }

  function refreshSearchUIIfPresent() {
    if (renderFn) {
      const input = document.querySelector(`#${UI_ID} input.sapMSFI`);
      renderFn(input ? input.value : '');
    }
  }

  function isOnMainScreen() {
    return !!(document.getElementById(HOME_BUTTON_ID) && document.getElementById(CONTENT_ID));
  }

  function init() {
    if (!isOnMainScreen()) return;
    ensureLayout();
  }

  let debounceTimer = null;
  function scheduleInit() {
    if (debounceTimer) return;
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      if (!opening) init();
    }, 500);
  }

  scheduleInit();
  const observer = new MutationObserver(() => {
    if (!document.getElementById(UI_ID) && !opening) scheduleInit();
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();