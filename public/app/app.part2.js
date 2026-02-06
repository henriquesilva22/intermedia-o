'use strict';

//#region PART 2/3: Render, UI e Handlers

  //#region Startup (DOMContentLoaded / Bootstrap)

  // Constantes do sistema
  const INTERMEDIARY_ADDRESS = {
    street: 'Av. Paulista', // Endereço mais realista para SP
    number: '1000',
    district: 'Bela Vista',
    city: 'São Paulo',
    state: 'SP',
    cep: '01310-100'
  };

  const PRODUCT_CATEGORIES = [
    'Conta de jogo',
    'Moedas / Gold / Créditos',
    'Chave de jogo / DLC',
    'Boost de Rank',
    'Carry de Conteúdo (PvE)',
    'Leveling',
    'Conquistas e Colecionáveis',
    'Serviço de Temporada',
    'Serviço Personalizado',
    'Troca de serviço',
    'Notebook',
    'Smartphone',
    'Celular',
    'Produto físico (pequeno)',
    'Outros (produtos físicos)'
  ];

  const DIGITAL_PRODUCT_CATEGORIES = [
    'Conta de jogo',
    'Moedas / Gold / Créditos',
    'Chave de jogo / DLC',
    'Boost de Rank',
    'Carry de Conteúdo (PvE)',
    'Leveling',
    'Conquistas e Colecionáveis',
    'Serviço de Temporada',
    'Serviço Personalizado',
    'Troca de serviço'
  ];

  const PHYSICAL_PRODUCT_CATEGORIES = [
    'Notebook',
    'Smartphone',
    'Celular',
    'Produto físico (pequeno)',
    'Outros (produtos físicos)'
  ];

  const CATEGORY_GAME_ACCOUNT = 'Conta de jogo';
  const CATEGORY_CURRENCY = 'Moedas / Gold / Créditos';
  const CATEGORY_KEY_DLC = 'Chave de jogo / DLC';
  // Service categories (new taxonomy)
  const CATEGORY_BOOST_RANK = 'Boost de Rank';
  const CATEGORY_CARRY_PVE = 'Carry de Conteúdo (PvE)';
  const CATEGORY_LEVELING = 'Leveling';
  const CATEGORY_COLLECTIBLES = 'Conquistas e Colecionáveis';
  const CATEGORY_SEASONAL = 'Serviço de Temporada';
  const CATEGORY_CUSTOM_SERVICE = 'Serviço Personalizado';

  // Back-compat (older category label)
  const CATEGORY_SERVICE = 'Serviço (boosting / rank / leveling)';
  const CATEGORY_SERVICE_EXCHANGE = 'Troca de serviço';
  const CATEGORY_SKIN = 'Skins / Roupas / Cosméticos';
  const CATEGORY_ITEM = 'Itens / Equipamentos (in-game)';
  const CATEGORY_OTHERS = 'Outros (jogos)';

  const SERVICE_CATEGORY_LABEL_TO_ID = {
    [CATEGORY_BOOST_RANK]: 'boost_rank',
    [CATEGORY_CARRY_PVE]: 'carry_pve',
    [CATEGORY_LEVELING]: 'leveling',
    [CATEGORY_COLLECTIBLES]: 'collectibles',
    [CATEGORY_SEASONAL]: 'seasonal',
    [CATEGORY_CUSTOM_SERVICE]: 'custom',
  };

  function isServiceTaxonomyCategory(category) {
    const c = String(category || '').trim();
    return Boolean(SERVICE_CATEGORY_LABEL_TO_ID[c]);
  }

  function isServiceProductFlowCategory(category) {
    const c = String(category || '').trim();
    // Service product flow = category implies service_id + game + dynamic fields.
    // "Troca de serviço" is a separate category (no dynamic service form).
    return isServiceTaxonomyCategory(c) || c === CATEGORY_SERVICE;
  }

  function isServiceScheduleCategory(category) {
    const c = String(category || '').trim();
    if (c === CATEGORY_CUSTOM_SERVICE || c === CATEGORY_SEASONAL || c === CATEGORY_COLLECTIBLES) {
      return false;
    }
    return isServiceTaxonomyCategory(c) || c === CATEGORY_SERVICE;
  }

  const DIGITAL_DELIVERY_DEADLINE_BUSINESS_DAYS = 3;
  const DIGITAL_KEY_DELIVERY_MAX_DAYS = 15;
  const DIGITAL_SERVICE_DELIVERY_MAX_DAYS = 25;
  const DIGITAL_SERVICE_EXCHANGE_MAX_DAYS = 3;

  function toTitleCasePtBr(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/(^|[\s\-\/])([A-Za-zÀ-ÖØ-öø-ÿ])/g, (_, sep, ch) => `${sep}${String(ch).toLocaleUpperCase('pt-BR')}`);
  }

  function capitalizeFirstPtBr(value) {
    const s = String(value || '').trim();
    if (!s) return '';
    const first = s[0].toLocaleUpperCase('pt-BR');
    return `${first}${s.slice(1)}`;
  }

  function capitalizeFirstPtBrLive(value) {
    const s = String(value ?? '');
    if (!s) return '';
    const firstNonSpace = s.search(/\S/);
    if (firstNonSpace < 0) return s;
    const c = s[firstNonSpace];
    return `${s.slice(0, firstNonSpace)}${c.toLocaleUpperCase('pt-BR')}${s.slice(firstNonSpace + 1)}`;
  }

  function formatPhoneDd9(value) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
    const ddd = digits.slice(0, 2);
    const p1 = digits.slice(2, 7);
    const p2 = digits.slice(7, 11);
    if (!digits) return '';
    if (digits.length <= 2) return ddd;
    if (digits.length <= 7) return `${ddd}-${digits.slice(2)}`;
    return `${ddd}-${p1}${p2 ? `-${p2}` : ''}`;
  }

  function normalizePhoneDd9(value) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
    if (digits.length !== 11) return '';
    return formatPhoneDd9(digits);
  }

  function extractLineValue(text, keyLabel) {
    const raw = String(text || '');
    const key = String(keyLabel || '').trim();
    if (!raw || !key) return '';
    const lines = raw.split(/\r?\n/g);
    const line = lines.find((l) => String(l || '').trim().toLowerCase().startsWith(key.toLowerCase()));
    if (!line) return '';
    const idx = line.indexOf(':');
    if (idx < 0) return '';
    return String(line.slice(idx + 1) || '').trim();
  }

  function parseIsoToMs(value) {
    const s = String(value || '').trim();
    if (!s) return 0;
    // Laravel can return ISO8601 or "YYYY-MM-DD HH:MM:SS".
    // Normalize the latter to an ISO-like string for consistent parsing.
    const normalized = s.includes('T') ? s : s.replace(' ', 'T');
    const ms = Date.parse(normalized);
    return Number.isFinite(ms) ? ms : 0;
  }

  function getOnlineStatus(lastSeenAtIso, thresholdMinutes = 5) {
    const ms = parseIsoToMs(lastSeenAtIso);
    if (!ms) return { label: 'Indisponível', className: 'bg-gray-500' };
    const ageMs = Date.now() - ms;
    // Allow small client/server clock skew.
    const skewMs = 2 * 60 * 1000;
    const online = ageMs >= -skewMs && ageMs <= thresholdMinutes * 60 * 1000;
    return online
      ? { label: 'Online', className: 'bg-success-600' }
      : { label: 'Offline', className: 'bg-gray-600' };
  }

  function normalizeTimeOptions(raw, max = 5) {
    const text = Array.isArray(raw) ? raw.join('\n') : String(raw || '');
    const items = text
      .split(/\r?\n/)
      .map((line) => String(line || '').trim())
      .filter(Boolean);
    const seen = new Set();
    const unique = [];
    for (const item of items) {
      const key = item.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(item);
      if (unique.length >= max) break;
    }
    return unique;
  }

  function normalizeDateOptions(raw, max = 3) {
    const text = Array.isArray(raw) ? raw.join('\n') : String(raw || '');
    const items = text
      .split(/\r?\n/)
      .map((line) => String(line || '').trim())
      .filter(Boolean)
      .filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(v));
    const seen = new Set();
    const unique = [];
    for (const item of items) {
      if (seen.has(item)) continue;
      seen.add(item);
      unique.push(item);
      if (unique.length >= max) break;
    }
    return unique;
  }

  function normalizeTimeRangeOptions(raw, max = 5) {
    const text = Array.isArray(raw) ? raw.join('\n') : String(raw || '');
    const items = text
      .split(/\r?\n/)
      .map((line) => String(line || '').trim())
      .filter(Boolean);
    const isValid = (range) => {
      const m = /^([0-2]\d):([0-5]\d)-([0-2]\d):([0-5]\d)$/.exec(range);
      if (!m) return false;
      const h1 = Number(m[1]);
      const m1 = Number(m[2]);
      const h2 = Number(m[3]);
      const m2 = Number(m[4]);
      if (h1 > 23 || h2 > 23) return false;
      const start = h1 * 60 + m1;
      const end = h2 * 60 + m2;
      return end > start;
    };

    const seen = new Set();
    const unique = [];
    for (const item of items) {
      if (!isValid(item)) continue;
      if (seen.has(item)) continue;
      seen.add(item);
      unique.push(item);
      if (unique.length >= max) break;
    }
    return unique;
  }

  function isDigitalDeliveryCategory(category) {
    const c = String(category || '').trim();
    return c === CATEGORY_GAME_ACCOUNT
      || c === CATEGORY_CURRENCY
      || c === CATEGORY_KEY_DLC
      || isServiceTaxonomyCategory(c)
      || c === CATEGORY_SERVICE
      || c === CATEGORY_SERVICE_EXCHANGE;
  }

  function isCurrencyCategory(category) {
    return String(category || '').trim() === CATEGORY_CURRENCY;
  }

  function categoryAllowsPublicDescription(category) {
    const c = String(category || '').trim();
    return c === CATEGORY_SKIN
      || c === CATEGORY_ITEM
      || isServiceTaxonomyCategory(c)
      || c === CATEGORY_SERVICE
      || c === CATEGORY_SERVICE_EXCHANGE
      || c === CATEGORY_OTHERS;
  }

  function categoryDeliveryDaysMax(category) {
    const c = String(category || '').trim();
    if (c === CATEGORY_KEY_DLC) return DIGITAL_KEY_DELIVERY_MAX_DAYS;
    if (isServiceTaxonomyCategory(c) || c === CATEGORY_SERVICE) return DIGITAL_SERVICE_DELIVERY_MAX_DAYS;
    if (c === CATEGORY_SERVICE_EXCHANGE) return DIGITAL_SERVICE_EXCHANGE_MAX_DAYS;
    return 0;
  }

  function getCreateNegotiationType() {
    const raw = String(state.createNegForm?.negotiationType ?? '').trim();
    if (raw === 'digital' || raw === 'physical') return raw;
    return '';
  }

  function getCreateNegotiationDeliveryDaysMax() {
    if (getCreateNegotiationType() !== 'digital') return 0;
    const selectedCategory = String(state.createNegForm?.category || '').trim();
    const byCategory = categoryDeliveryDaysMax(selectedCategory);
    return byCategory > 0 ? byCategory : DIGITAL_SERVICE_DELIVERY_MAX_DAYS;
  }

  function categoryDeliveryDaysDefault(category) {
    const c = String(category || '').trim();
    if (isServiceTaxonomyCategory(c) || c === CATEGORY_SERVICE) return 7;
    if (c === CATEGORY_KEY_DLC) return 3;
    if (c === CATEGORY_SERVICE_EXCHANGE) return 3;
    return '';
  }

  function getCreateNegotiationDeadlineCopy() {
    const selectedCategory = String(state.createNegForm?.category || '').trim();
    const maxDays = getCreateNegotiationDeliveryDaysMax();
    if (maxDays > 0) {
      const raw = state.createNegForm?.deliveryDays;
      const parsed = parseInt(raw || '', 10);
      const fallback = categoryDeliveryDaysDefault(selectedCategory);
      const days = parsed && parsed >= 1 && parsed <= maxDays ? parsed : (typeof fallback === 'number' ? fallback : Math.min(3, maxDays));
      return { kind: 'selectable_days', days, maxDays };
    }
    return { kind: 'business_days', days: DIGITAL_DELIVERY_DEADLINE_BUSINESS_DAYS };
  }

  function updateCreateNegotiationStepUI() {
    try {
      if (!state.showCreateNegotiationModal) return;
      const root = document.getElementById('app');
      if (!root) return;
      const modal = root.querySelector('[data-create-neg-modal]');
      if (!(modal instanceof HTMLElement)) return;

      const step = Math.max(1, Math.min(4, Number(state.createNegStep) || 1));

      const steps = modal.querySelectorAll('[data-create-step]');
      steps.forEach((el) => {
        if (!(el instanceof HTMLElement)) return;
        const s = Number(el.dataset.createStep) || 0;
        el.classList.toggle('hidden', s !== step);
      });

      const indicators = modal.querySelectorAll('[data-create-step-indicator]');
      indicators.forEach((el) => {
        if (!(el instanceof HTMLElement)) return;
        const s = Number(el.dataset.createStepIndicator) || 0;
        const active = s === step;
        const done = s < step;
        el.classList.toggle('bg-primary-600', active || done);
        el.classList.toggle('text-white', active || done);
        el.classList.toggle('bg-gray-200', !active && !done);
        el.classList.toggle('text-gray-700', !active && !done);
      });

      const title = modal.querySelector('[data-create-step-title]');
      if (title instanceof HTMLElement) {
        title.textContent = ['Essencial', 'Detalhes', 'Comprador', 'Confirmar'][step - 1] || 'Nova Negociação';
      }

      const termsModal = root.querySelector('[data-create-terms-modal]');
      if (termsModal instanceof HTMLElement) {
        const shouldShow = Boolean(state.showCreateTerms) && step === 4;
        termsModal.classList.toggle('hidden', !shouldShow);
      }
    } catch {
      // ignore
    }
  }

  function renderCreateNegotiationDeadlineField() {
    const negotiationType = getCreateNegotiationType();
    if (!negotiationType) {
      return `
        <label class="block text-sm text-gray-700 font-medium mb-2">Prazo de entrega</label>
        <input type="text" value="Selecione o tipo de negociação" disabled class="w-full px-4 py-3 bg-gray-200 border border-gray-300 rounded-lg text-gray-600 cursor-not-allowed">
        <span class="text-xs text-gray-500 mt-1 block"><i class="fas fa-info-circle mr-1"></i>O prazo depende do tipo (digital/física).</span>
      `;
    }
    if (negotiationType !== 'digital') {
      return `
        <label class="block text-sm text-gray-700 font-medium mb-2">Prazo de entrega</label>
        <input type="text" value="A combinar com o comprador" disabled class="w-full px-4 py-3 bg-gray-200 border border-gray-300 rounded-lg text-gray-600 cursor-not-allowed">
        <span class="text-xs text-gray-500 mt-1 block"><i class="fas fa-info-circle mr-1"></i>O prazo exato pode variar conforme envio e recebimento.</span>
      `;
    }

    const deadline = getCreateNegotiationDeadlineCopy();
    if (deadline.kind === 'selectable_days') {
      const { days, maxDays } = deadline;
      return `
        <label class="block text-sm text-gray-700 font-medium mb-2">Prazo máximo de entrega (dias) *</label>
        <select name="delivery_days" required data-action="updateNegFormField" data-field="deliveryDays" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
          ${Array.from({ length: maxDays }, (_, i) => i + 1).map((d) => `<option value="${d}" ${d === days ? 'selected' : ''}>${d} dia${d === 1 ? '' : 's'}</option>`).join('')}
        </select>
        <span class="text-xs text-warning-600 mt-1 block"><i class="fas fa-info-circle mr-1"></i>Selecione até ${maxDays} dias.</span>
      `;
    }

    return `
      <label class="block text-sm text-gray-700 font-medium mb-2">Prazo digital</label>
      <input type="text" value="Até ${DIGITAL_DELIVERY_DEADLINE_BUSINESS_DAYS} dias úteis" disabled class="w-full px-4 py-3 bg-gray-200 border border-gray-300 rounded-lg text-gray-600 cursor-not-allowed">
      <span class="text-xs text-warning-600 mt-1 block"><i class="fas fa-info-circle mr-1"></i>Prazo fixo obrigatório (após aprovação)</span>
    `;
  }

  function persistCreateNegotiationDraftFromDOM(form) {
    try {
      if (!(form instanceof HTMLFormElement)) return;

      const fields = [
        'title',
        'universal_game_type',
        'universal_game_name',
        'universal_product_name',
        'price',
        'buyer_email',
        'negotiation_type',
        'category',
        'game_account_game',
        'game_account_platform',
        'game_account_level',
        'game_account_rank',
        'game_account_has_ban',
        'game_account_first_owner',
        'game_account_has_original_email',
        'game_account_region',
        'game_account_seller_notes',
        'game_title',
        'item_name',
        'item_general_info',
        'digital_game',
        'digital_quantity',
        'digital_platform_server',
        'digital_delivery_method',
        'game_account_type',
        'game_account_platform',
        'game_account_game',
        'game_account_first_owner',
        'game_account_has_original_email',
        'game_account_game_other',
        'game_account_can_change_credentials',
        'game_account_punishment_history',
        'what_will_be_delivered',
        'gold_seller_time_options',
        'service_seller_start_date_options',
        'service_seller_time_range_options',
        'description',
        'buyerTag'
      ];

      const draft = {};
      for (const name of fields) {
        try {
          const el = form.querySelector(`[name="${name}"]`);
          if (!(el instanceof HTMLElement)) {
            draft[name] = '';
            continue;
          }

          if (el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox')) {
            const checked = form.querySelector(`[name="${name}"]:checked`);
            draft[name] = checked instanceof HTMLInputElement ? checked.value : '';
            continue;
          }

          const value = 'value' in el ? el.value : '';
          draft[name] = value !== undefined ? value : '';
        } catch {
          // ignore single field errors
        }
      }

      // Game account linked providers (checkboxes)
      try {
        const providers = Array.from(form.querySelectorAll('[name="game_account_linked_providers[]"]'))
          .filter((el) => el instanceof HTMLInputElement && el.checked)
          .map((el) => (el instanceof HTMLInputElement ? String(el.value || '').trim() : ''))
          .filter(Boolean);
        draft.game_account_linked_providers = providers;
      } catch {
        // ignore
      }

      // Game account extras (checkboxes)
      try {
        const extras = Array.from(form.querySelectorAll('[name="game_account_extras[]"]'))
          .filter((el) => el instanceof HTMLInputElement && el.checked)
          .map((el) => (el instanceof HTMLInputElement ? String(el.value || '').trim() : ''))
          .filter(Boolean);
        draft.game_account_extras = extras;
      } catch {
        // ignore
      }

      // Seller time options (up to 3) - stored as array
      try {
        const times = Array.from(form.querySelectorAll('[name="gold_seller_time_options[]"]'))
          .map((el) => (el instanceof HTMLInputElement ? String(el.value || '').trim() : ''))
          .filter(Boolean)
          .slice(0, 3);
        if (times.length) draft.gold_seller_time_options = times;
      } catch {
        // ignore
      }

      // Service start date options (up to 3)
      try {
        const dates = Array.from(form.querySelectorAll('[name="service_seller_start_date_options[]"]'))
          .map((el) => (el instanceof HTMLInputElement ? String(el.value || '').trim() : ''))
          .filter(Boolean)
          .slice(0, 3);
        if (dates.length) draft.service_seller_start_date_options = dates;
      } catch {
        // ignore
      }

      // Service time range options (up to 3) from paired inputs
      try {
        const starts = Array.from(form.querySelectorAll('[name="service_seller_time_range_start[]"]'))
          .map((el) => (el instanceof HTMLInputElement ? String(el.value || '').trim() : ''));
        const ends = Array.from(form.querySelectorAll('[name="service_seller_time_range_end[]"]'))
          .map((el) => (el instanceof HTMLInputElement ? String(el.value || '').trim() : ''));

        const ranges = [];
        for (let i = 0; i < Math.max(starts.length, ends.length); i += 1) {
          const a = starts[i] || '';
          const b = ends[i] || '';
          if (!a || !b) continue;
          ranges.push(`${a}-${b}`);
        }
        const normalized = normalizeTimeRangeOptions(ranges, 3);
        if (normalized.length) draft.service_seller_time_range_options = normalized;
      } catch {
        // ignore
      }

      // Capture dynamic fields (universal form): any name starting with ga_ or ts_
      try {
        const dynamicEls = Array.from(form.querySelectorAll('input[name], select[name], textarea[name]'));
        for (const el of dynamicEls) {
          const name = String(el.getAttribute('name') || '').trim();
          if (!name || (!name.startsWith('ga_') && !name.startsWith('ts_'))) continue;

          if (el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox')) {
            if (el.type === 'radio') {
              const checked = form.querySelector(`input[name="${CSS.escape(name)}"]:checked`);
              draft[name] = checked instanceof HTMLInputElement ? String(checked.value || '') : '';
            } else {
              // For checkboxes with the same name, store an array of values
              const boxes = Array.from(form.querySelectorAll(`input[name="${CSS.escape(name)}"]`))
                .filter((x) => x instanceof HTMLInputElement);
              const values = boxes
                .filter((x) => x.checked)
                .map((x) => String(x.value || '').trim())
                .filter(Boolean);
              draft[name] = values;
            }
            continue;
          }

          const value = 'value' in el ? el.value : '';
          draft[name] = value !== undefined ? value : '';
        }
      } catch {
        // ignore
      }

      // Universal game/product flow (digital): derive backend-required fields from the universal inputs.
      // This avoids relying on hidden inputs being refreshed while the user is typing.
      try {
        const negotiationType = String(draft.negotiation_type || '').trim();
        const category = String(draft.category || '').trim();
        const useUniversal = negotiationType === 'digital' && (category === CATEGORY_SKIN || category === CATEGORY_ITEM || category === CATEGORY_OTHERS);
        if (useUniversal) {
          const uGameType = String(draft.universal_game_type || '').trim();
          const uGameNameRaw = String(draft.universal_game_name || '').trim();
          const uProductNameRaw = String(draft.universal_product_name || '').trim();

          const typeLabelByValue = {
            mmorpg: 'MMORPG',
            fps: 'FPS',
            moba: 'MOBA',
            battle_royale: 'Battle Royale',
            mobile: 'Mobile',
            estrategia: 'Estratégia',
            esporte: 'Esporte',
            other: 'Outro',
          };

          const uGameName = uGameNameRaw ? capitalizeFirstPtBr(uGameNameRaw) : '';
          const uProductName = uProductNameRaw ? capitalizeFirstPtBr(uProductNameRaw) : '';
          const uTypeLabel = typeLabelByValue[uGameType] || '';

          const titleComputedRaw = [
            uProductName,
            uGameName ? `— ${uGameName}` : '',
            uTypeLabel ? `(${uTypeLabel})` : ''
          ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
          const titleComputed = titleComputedRaw ? String(titleComputedRaw).slice(0, 255) : '';

          const descComputedRaw = [
            uProductName ? `Produto: ${uProductName}` : '',
            uGameName ? `Jogo: ${uGameName}` : '',
            uTypeLabel ? `Tipo: ${uTypeLabel}` : ''
          ].filter(Boolean).join(' | ').replace(/\s+/g, ' ').trim();
          const descComputed = descComputedRaw ? String(descComputedRaw).slice(0, 200) : '';

          if (titleComputed) draft.title = titleComputed;
          if (descComputed) draft.description = descComputed;
          if (uGameName) draft.game_title = String(uGameName).slice(0, 120);

          if (category === CATEGORY_ITEM) {
            if (uProductName) draft.item_name = String(uProductName).slice(0, 160);
            const itemInfo = uTypeLabel ? `Tipo do jogo: ${uTypeLabel}` : '';
            if (itemInfo) draft.item_general_info = String(itemInfo).slice(0, 1000);
          }
        }
      } catch {
        // ignore
      }

      state.createNegForm = { ...state.createNegForm, ...draft };
    } catch {
      // ignore
    }
  }

  function updateCreateNegotiationModalDynamicUI() {
    try {
      if (!state.showCreateNegotiationModal) return;
      const root = document.getElementById('app');
      if (!root) return;
      const form = root.querySelector('form[data-action="createNegotiation"]');
      if (!(form instanceof HTMLFormElement)) return;

      // IMPORTANT: this function re-renders chunks via innerHTML.
      // Persist current values first to avoid wiping what the user typed.
      persistCreateNegotiationDraftFromDOM(form);

      const structured = form.querySelector('[data-create-neg-structured]');
      const serviceProduct = form.querySelector('[data-create-neg-service-product]');
      const description = form.querySelector('[data-create-neg-description]');
      const currency = form.querySelector('[data-create-neg-currency]');
          const serviceSchedule = form.querySelector('[data-create-neg-service-schedule]');
      const photos = form.querySelector('[data-create-neg-photos]');
      const deadline = form.querySelector('[data-create-neg-deadline]');
      const feeGuide = form.querySelector('[data-create-fee-guide]');

      const selectedCategory = String(state.createNegForm?.category || '').trim();
      const showCurrencyFields = selectedCategory === CATEGORY_CURRENCY;
      const showServiceFields = isServiceTaxonomyCategory(selectedCategory) || selectedCategory === CATEGORY_SERVICE;
      const showServiceScheduleFields = showServiceFields
        && selectedCategory !== CATEGORY_BOOST_RANK
        && ![CATEGORY_CUSTOM_SERVICE, CATEGORY_SEASONAL, CATEGORY_COLLECTIBLES].includes(selectedCategory);
      const showServiceProductFlow = isServiceProductFlowCategory(selectedCategory);
      const showGameAccountFields = selectedCategory === CATEGORY_GAME_ACCOUNT;
      const showSkinFields = selectedCategory === CATEGORY_SKIN;
      const showItemFields = selectedCategory === CATEGORY_ITEM;
      const negotiationType = getCreateNegotiationType();
      const isDigital = negotiationType === 'digital';
      const isPhysicalType = negotiationType === 'physical';
      const useUniversalGameProductFlow = isDigital && (selectedCategory === CATEGORY_SKIN || selectedCategory === CATEGORY_ITEM || selectedCategory === CATEGORY_OTHERS);
      const showDescription = (isPhysicalType || selectedCategory === CATEGORY_SKIN) && !useUniversalGameProductFlow;
      const requiresPhotos = categoryRequiresImages(selectedCategory);
      const showPhotos = categoryAllowsImages(selectedCategory, negotiationType);
      const minImages = requiresPhotos ? categoryMinImages(selectedCategory) : 0;
      const maxImages = categoryMaxAllowedImages(selectedCategory, negotiationType);
      const productPhotos = Array.isArray(state.createNegForm?.productPhotos) ? state.createNegForm.productPhotos : [];

      const draft = state.createNegForm || {};
      const snakeToCamel = (value) => String(value || '').replace(/_([a-z])/g, (_, c) => String(c || '').toUpperCase());
      const getDraft = (name) => {
        const direct = draft?.[name];
        if (Array.isArray(direct)) return direct.join('\n');
        if (typeof direct === 'string' || typeof direct === 'number') return String(direct);
        const camel = snakeToCamel(name);
        const alt = draft?.[camel];
        if (Array.isArray(alt)) return alt.join('\n');
        if (typeof alt === 'string' || typeof alt === 'number') return String(alt);
        return '';
      };

      const getDraftArray = (name) => {
        const direct = draft?.[name];
        if (Array.isArray(direct)) {
          return direct.map((v) => String(v || '').trim()).filter(Boolean).slice(0, 5);
        }
        const text = getDraft(name);
        return String(text || '')
          .split(/\r?\n/)
          .map((v) => String(v || '').trim())
          .filter(Boolean)
          .slice(0, 5);
      };

      const photosHtml = productPhotos.map((photo, idx) => `
        <div class="relative group">
          <img src="${photo.preview}" alt="Foto ${idx + 1}" class="w-full h-24 object-cover rounded-lg border border-gray-200">
          <button type="button" class="absolute top-1 right-1 w-6 h-6 bg-danger-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition" data-action="removeProductPhoto" data-index="${idx}">✕</button>
        </div>
      `).join('');

      // proof images preview (if any)
      const proofImages = Array.isArray(draft.proofImages) ? draft.proofImages : [];
      const proofHtml = proofImages.map((p, idx) => `
        <div class="relative group">
          <img src="${p.preview}" alt="Prova ${idx + 1}" class="w-full h-24 object-cover rounded-lg border border-gray-200">
          <button type="button" class="absolute top-1 right-1 w-6 h-6 bg-danger-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition" data-action="removeProofImage" data-index="${idx}">✕</button>
        </div>
      `).join('');

      if (serviceProduct instanceof HTMLElement) {
        if (!showServiceProductFlow) {
          serviceProduct.innerHTML = '';
        } else {
          if (!state.serviceFormsConfig && !state.serviceFormsLoading) {
            try { ensureServiceFormsConfigLoaded(); } catch { /* ignore */ }
          }

          const cfg = state.serviceFormsConfig;
          const currentServiceId = String(draft?.serviceId || draft?.service_id || SERVICE_CATEGORY_LABEL_TO_ID[selectedCategory] || '').trim();
          const currentGameId = String(draft?.gameId || draft?.game_id || '').trim();
          const serviceFields = (draft?.serviceFields && typeof draft.serviceFields === 'object') ? draft.serviceFields : {};

          const servicesList = Array.isArray(cfg?.services) ? cfg.services : [];
          const gamesMap = (cfg?.games && typeof cfg.games === 'object') ? cfg.games : {};
          const serviceGames = (cfg?.serviceGames && typeof cfg.serviceGames === 'object') ? cfg.serviceGames : {};
          const allowedGames = Array.isArray(serviceGames?.[currentServiceId]) ? serviceGames[currentServiceId] : [];
          const formFields = (cfg?.formFields && typeof cfg.formFields === 'object') ? cfg.formFields : {};
          const fieldDefs = Array.isArray(formFields?.[currentServiceId]?.[currentGameId]) ? formFields[currentServiceId][currentGameId] : [];

          const isCarryPveUniversal = currentServiceId === 'carry_pve';
          const isBoostRankUniversal = currentServiceId === 'boost_rank';
          const isCustomUniversal = currentServiceId === 'custom';
          const isSeasonalUniversal = currentServiceId === 'seasonal';
          const isCollectiblesUniversal = currentServiceId === 'collectibles';

          if (state.serviceFormsLoading) {
            serviceProduct.innerHTML = `
              <div class="p-4 bg-white border border-gray-200 rounded-xl">
                <div class="flex items-center gap-2 text-gray-900 font-semibold">
                  <i class="fas fa-list-alt text-primary-600"></i>
                  Produto do serviço
                </div>
                <p class="text-sm text-gray-600 mt-2"><i class="fas fa-spinner fa-spin mr-2"></i>Carregando serviços…</p>
              </div>
            `;
          } else if (!cfg) {
            serviceProduct.innerHTML = `
              <div class="p-4 bg-white border border-gray-200 rounded-xl">
                <div class="flex items-center gap-2 text-gray-900 font-semibold">
                  <i class="fas fa-list-alt text-primary-600"></i>
                  Produto do serviço
                </div>
                <p class="text-sm text-danger-600 mt-2">Não foi possível carregar a configuração de serviços.</p>
                <button type="button" class="mt-3 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-700 transition" data-action="reloadServiceFormsConfig">
                  Tentar novamente
                </button>
              </div>
            `;
          } else {
            const gameOptionsHtml = allowedGames.map((gid) => {
              const v = String(gid || '').trim();
              const label = String(gamesMap?.[v] || v).trim();
              return `<option value="${escapeAttr(v)}" ${v && v === currentGameId ? 'selected' : ''}>${escapeHtml(label)}</option>`;
            }).join('');

            if (isCustomUniversal) {
              const f = serviceFields || {};
              const v = (key) => {
                const raw = f?.[key];
                return raw === null || raw === undefined ? '' : String(raw);
              };
              const platformOptions = ['PC','PlayStation','Xbox','Mobile','Outro'];
              const objectiveCategories = ['PvE','PvP','Progressão','Farm','Coaching','Evento','Social / Roleplay','Outro'];
              const complexityOptions = ['Simples','Média','Alta','Não sei'];
              const hasNumericGoal = String(v('has_numeric_goal') || '').trim();
              const showNumericGoal = hasNumericGoal === 'Sim';
              const access = String(v('needs_account_access') || '').trim();
              const showAccessAlert = access === 'Sim';
              const knownRisk = String(v('known_risk') || '').trim();
              const showRiskDetails = knownRisk === 'Sim';
              const desiredDeadline = String(v('desired_deadline') || '').trim();
              const deliveryDays = Number(draft?.deliveryDays || draft?.delivery_days || 0);
              const showShortDeadlineWarning = (deliveryDays > 0 && deliveryDays <= 2) || /hoje|amanh|\b[12]\s*dias?\b/i.test(desiredDeadline);

              serviceProduct.innerHTML = `
                <div class="p-4 bg-white border border-gray-200 rounded-xl space-y-6">
                  <div class="flex items-center gap-2 text-gray-900 font-semibold">
                    <i class="fas fa-list-alt text-primary-600"></i>
                    Produto do serviço
                  </div>

                  <div>
                    <div class="text-sm text-gray-700 font-medium mb-2">Serviço selecionado</div>
                    <div class="text-sm text-gray-900 font-semibold">${escapeHtml(selectedCategory || 'Serviço Personalizado')}</div>
                  </div>

                  <input type="hidden" name="game_id" value="other">

                  <div class="space-y-6">
                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">🧩 Identificação do Serviço</div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Nome do jogo *</label>
                        <input type="text" maxlength="120" required data-action="updateCreateServiceField" data-field-id="game_name" value="${escapeAttr(v('game_name'))}" placeholder="Ex: World of Warcraft" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                      </div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Plataforma</label>
                        <select data-action="updateCreateServiceField" data-field-id="platform" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          <option value="" ${v('platform') === '' ? 'selected' : ''}>Selecione (opcional)</option>
                          ${platformOptions.map((opt) => `<option value="${escapeAttr(opt)}" ${opt === v('platform') ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                        </select>
                      </div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Região / Servidor</label>
                        <input type="text" maxlength="120" data-action="updateCreateServiceField" data-field-id="region_server" value="${escapeAttr(v('region_server'))}" placeholder="Opcional" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                      </div>
                    </div>

                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">⭐ Objetivo do Serviço</div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">O que deseja que seja feito? *</label>
                        <textarea rows="3" required data-action="updateCreateServiceField" data-field-id="objective_what" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all resize-none">${escapeHtml(v('objective_what'))}</textarea>
                      </div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Resultado esperado *</label>
                        <textarea rows="2" required data-action="updateCreateServiceField" data-field-id="objective_expected" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all resize-none">${escapeHtml(v('objective_expected'))}</textarea>
                      </div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Categoria aproximada do serviço</label>
                        <select data-action="updateCreateServiceField" data-field-id="objective_category" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          <option value="" ${v('objective_category') === '' ? 'selected' : ''}>Selecione (opcional)</option>
                          ${objectiveCategories.map((opt) => `<option value="${escapeAttr(opt)}" ${opt === v('objective_category') ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                        </select>
                      </div>
                    </div>

                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">⚔️ Escopo do Serviço</div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Existe meta numérica?</label>
                        <select data-action="updateCreateServiceField" data-field-id="has_numeric_goal" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          <option value="" ${hasNumericGoal === '' ? 'selected' : ''}>Selecione (opcional)</option>
                          ${['Sim','Não'].map((opt) => `<option value="${escapeAttr(opt)}" ${opt === hasNumericGoal ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                        </select>
                      </div>
                      ${showNumericGoal ? `
                        <div>
                          <label class="block text-sm text-gray-700 font-medium mb-2">Descrição da meta *</label>
                          <textarea rows="2" required data-action="updateCreateServiceField" data-field-id="numeric_goal_desc" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all resize-none">${escapeHtml(v('numeric_goal_desc'))}</textarea>
                        </div>
                        <div>
                          <label class="block text-sm text-gray-700 font-medium mb-2">Valor/meta numérica *</label>
                          <input type="number" inputmode="numeric" required data-action="updateCreateServiceField" data-field-id="numeric_goal_value" value="${escapeAttr(v('numeric_goal_value'))}" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                        </div>
                      ` : ''}
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Complexidade estimada pelo cliente</label>
                        <select data-action="updateCreateServiceField" data-field-id="complexity" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          <option value="" ${v('complexity') === '' ? 'selected' : ''}>Selecione (opcional)</option>
                          ${complexityOptions.map((opt) => `<option value="${escapeAttr(opt)}" ${opt === v('complexity') ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                        </select>
                      </div>
                    </div>

                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">⏳ Execução</div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Forma do serviço *</label>
                        <select required data-action="updateCreateServiceField" data-field-id="execution_method" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          <option value="" ${v('execution_method') === '' ? 'selected' : ''}>Selecione</option>
                          ${['Booster joga na conta','Cliente participa','Coaching','Misto'].map((opt) => `<option value="${escapeAttr(opt)}" ${opt === v('execution_method') ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                        </select>
                      </div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Necessita acesso à conta?</label>
                        <select data-action="updateCreateServiceField" data-field-id="needs_account_access" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          <option value="" ${v('needs_account_access') === '' ? 'selected' : ''}>Selecione (opcional)</option>
                          ${['Sim','Não'].map((opt) => `<option value="${escapeAttr(opt)}" ${opt === v('needs_account_access') ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                        </select>
                        ${showAccessAlert ? `
                          <div class="mt-2 p-3 rounded-lg bg-warning-50 border border-warning-200 text-warning-700 text-xs">
                            <i class="fas fa-exclamation-triangle mr-1"></i>
                            Atenção: solicitar acesso à conta envolve riscos. Combine segurança e termos claros.
                          </div>
                        ` : ''}
                      </div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Cliente pode jogar durante o serviço?</label>
                        <select data-action="updateCreateServiceField" data-field-id="client_can_play" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          <option value="" ${v('client_can_play') === '' ? 'selected' : ''}>Selecione (opcional)</option>
                          ${['Sim','Não','Depende'].map((opt) => `<option value="${escapeAttr(opt)}" ${opt === v('client_can_play') ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                        </select>
                      </div>
                    </div>

                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">📅 Prazo e Disponibilidade</div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Prazo desejado</label>
                        <input type="text" maxlength="120" data-action="updateCreateServiceField" data-field-id="desired_deadline" value="${escapeAttr(v('desired_deadline'))}" placeholder="Opcional" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                      </div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Horários disponíveis</label>
                        <textarea rows="2" maxlength="500" data-action="updateCreateServiceField" data-field-id="available_times" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all resize-none">${escapeHtml(v('available_times'))}</textarea>
                      </div>
                      ${showShortDeadlineWarning ? `
                        <div class="p-3 bg-warning-50 border border-warning-200 rounded-lg text-warning-700 text-xs">
                          <i class="fas fa-exclamation-triangle mr-1"></i>
                          Prazo curto pode aumentar o risco de atraso. Combine expectativas antes de confirmar.
                        </div>
                      ` : ''}
                    </div>

                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">🛡️ Garantias e Segurança</div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Possui garantia?</label>
                        <select data-action="updateCreateServiceField" data-field-id="warranty" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          <option value="" ${v('warranty') === '' ? 'selected' : ''}>Selecione (opcional)</option>
                          ${['Sim','Não'].map((opt) => `<option value="${escapeAttr(opt)}" ${opt === v('warranty') ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                        </select>
                      </div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Existe risco conhecido?</label>
                        <select data-action="updateCreateServiceField" data-field-id="known_risk" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          <option value="" ${knownRisk === '' ? 'selected' : ''}>Selecione (opcional)</option>
                          ${['Sim','Não'].map((opt) => `<option value="${escapeAttr(opt)}" ${opt === knownRisk ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                        </select>
                      </div>
                      ${showRiskDetails ? `
                        <div>
                          <label class="block text-sm text-gray-700 font-medium mb-2">Detalhes do risco</label>
                          <textarea rows="2" maxlength="800" data-action="updateCreateServiceField" data-field-id="known_risk_details" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all resize-none">${escapeHtml(v('known_risk_details'))}</textarea>
                        </div>
                      ` : ''}
                    </div>

                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">📎 Provas do Serviço</div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Provas</label>
                        <select data-action="updateCreateServiceField" data-field-id="proofs" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          <option value="" ${v('proofs') === '' ? 'selected' : ''}>Selecione (opcional)</option>
                          ${['Screenshot','Vídeo','Stream','Log','Nenhum'].map((opt) => `<option value="${escapeAttr(opt)}" ${opt === v('proofs') ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                        </select>
                      </div>
                    </div>

                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">📝 Observações gerais</div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Observações</label>
                        <textarea rows="3" maxlength="2000" data-action="updateCreateServiceField" data-field-id="notes" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all resize-none">${escapeHtml(v('notes'))}</textarea>
                      </div>
                    </div>
                  </div>
                </div>
              `;
              return;
            }

            if (isSeasonalUniversal) {
              const f = serviceFields || {};
              const v = (key) => {
                const raw = f?.[key];
                return raw === null || raw === undefined ? '' : String(raw);
              };
              const platformOptions = ['PC','PlayStation','Xbox','Mobile','Outro'];
              const seasonTypes = ['Passe de batalha','Temporada ranqueada','Evento sazonal','Progressão PvE','Outro'];
              const access = String(v('needs_account_access') || '').trim();
              const showAccessAlert = access === 'Sim';
              const desiredDeadline = String(v('desired_deadline') || '').trim();
              const deliveryDays = Number(draft?.deliveryDays || draft?.delivery_days || 0);
              const showShortDeadlineWarning = (deliveryDays > 0 && deliveryDays <= 2) || /hoje|amanh|\b[12]\s*dias?\b/i.test(desiredDeadline);

              serviceProduct.innerHTML = `
                <div class="p-4 bg-white border border-gray-200 rounded-xl space-y-6">
                  <div class="flex items-center gap-2 text-gray-900 font-semibold">
                    <i class="fas fa-list-alt text-primary-600"></i>
                    Produto do serviço
                  </div>

                  <div>
                    <div class="text-sm text-gray-700 font-medium mb-2">Serviço selecionado</div>
                    <div class="text-sm text-gray-900 font-semibold">${escapeHtml(selectedCategory || 'Serviço de Temporada')}</div>
                  </div>

                  <input type="hidden" name="game_id" value="other">

                  <div class="space-y-6">
                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">🧩 Identificação</div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Nome do jogo *</label>
                        <input type="text" maxlength="120" required data-action="updateCreateServiceField" data-field-id="game_name" value="${escapeAttr(v('game_name'))}" placeholder="Ex: Fortnite" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                      </div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Plataforma</label>
                        <select data-action="updateCreateServiceField" data-field-id="platform" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          <option value="" ${v('platform') === '' ? 'selected' : ''}>Selecione (opcional)</option>
                          ${platformOptions.map((opt) => `<option value="${escapeAttr(opt)}" ${opt === v('platform') ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                        </select>
                      </div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Região / Servidor</label>
                        <input type="text" maxlength="120" data-action="updateCreateServiceField" data-field-id="region_server" value="${escapeAttr(v('region_server'))}" placeholder="Opcional" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                      </div>
                    </div>

                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">⭐ Informações da Temporada</div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Nome ou número da temporada *</label>
                        <input type="text" maxlength="120" required data-action="updateCreateServiceField" data-field-id="season_name" value="${escapeAttr(v('season_name'))}" placeholder="Ex: Temporada 12 / Capítulo 5" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                      </div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Tipo de temporada *</label>
                        <select required data-action="updateCreateServiceField" data-field-id="season_type" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          <option value="" ${v('season_type') === '' ? 'selected' : ''}>Selecione</option>
                          ${seasonTypes.map((opt) => `<option value="${escapeAttr(opt)}" ${opt === v('season_type') ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                        </select>
                      </div>
                    </div>

                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">🏆 Objetivo da Temporada</div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Recompensa desejada *</label>
                        <input type="text" maxlength="200" required data-action="updateCreateServiceField" data-field-id="reward_desired" value="${escapeAttr(v('reward_desired'))}" placeholder="Ex: Skin X, Passe nível 50" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                      </div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Progresso atual do cliente</label>
                        <textarea rows="2" maxlength="800" data-action="updateCreateServiceField" data-field-id="progress_current" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all resize-none">${escapeHtml(v('progress_current'))}</textarea>
                      </div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Meta desejada</label>
                        <textarea rows="2" maxlength="800" data-action="updateCreateServiceField" data-field-id="goal_target" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all resize-none">${escapeHtml(v('goal_target'))}</textarea>
                      </div>
                    </div>

                    <details class="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <summary class="cursor-pointer text-sm font-semibold text-gray-900">📈 Ranking / Progressão (opcional)</summary>
                      <div class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label class="block text-sm text-gray-700 font-medium mb-2">Tier atual</label>
                          <input type="text" maxlength="60" data-action="updateCreateServiceField" data-field-id="rank_current_tier" value="${escapeAttr(v('rank_current_tier'))}" class="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                        </div>
                        <div>
                          <label class="block text-sm text-gray-700 font-medium mb-2">Score atual</label>
                          <input type="number" inputmode="numeric" data-action="updateCreateServiceField" data-field-id="rank_current_score" value="${escapeAttr(v('rank_current_score'))}" class="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                        </div>
                        <div>
                          <label class="block text-sm text-gray-700 font-medium mb-2">Tier desejado</label>
                          <input type="text" maxlength="60" data-action="updateCreateServiceField" data-field-id="rank_target_tier" value="${escapeAttr(v('rank_target_tier'))}" class="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                        </div>
                        <div>
                          <label class="block text-sm text-gray-700 font-medium mb-2">Score desejado</label>
                          <input type="number" inputmode="numeric" data-action="updateCreateServiceField" data-field-id="rank_target_score" value="${escapeAttr(v('rank_target_score'))}" class="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                        </div>
                      </div>
                    </details>

                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">⚔️ Execução</div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Forma do serviço *</label>
                        <select required data-action="updateCreateServiceField" data-field-id="execution_method" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          <option value="" ${v('execution_method') === '' ? 'selected' : ''}>Selecione</option>
                          ${['Booster joga','Cliente participa','Misto'].map((opt) => `<option value="${escapeAttr(opt)}" ${opt === v('execution_method') ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                        </select>
                      </div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Necessita acesso à conta?</label>
                        <select data-action="updateCreateServiceField" data-field-id="needs_account_access" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          <option value="" ${v('needs_account_access') === '' ? 'selected' : ''}>Selecione (opcional)</option>
                          ${['Sim','Não'].map((opt) => `<option value="${escapeAttr(opt)}" ${opt === v('needs_account_access') ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                        </select>
                        ${showAccessAlert ? `
                          <div class="mt-2 p-3 rounded-lg bg-warning-50 border border-warning-200 text-warning-700 text-xs">
                            <i class="fas fa-exclamation-triangle mr-1"></i>
                            Atenção: solicitar acesso à conta envolve riscos. Combine segurança e termos claros.
                          </div>
                        ` : ''}
                      </div>
                    </div>

                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">⏳ Prazo</div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Data limite da temporada</label>
                        <input type="date" data-action="updateCreateServiceField" data-field-id="deadline_date" value="${escapeAttr(v('deadline_date'))}" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                      </div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Prazo desejado para conclusão</label>
                        <input type="text" maxlength="120" data-action="updateCreateServiceField" data-field-id="desired_deadline" value="${escapeAttr(v('desired_deadline'))}" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                      </div>
                      ${showShortDeadlineWarning ? `
                        <div class="p-3 bg-warning-50 border border-warning-200 rounded-lg text-warning-700 text-xs">
                          <i class="fas fa-exclamation-triangle mr-1"></i>
                          Prazo curto pode aumentar o risco de atraso. Combine expectativas antes de confirmar.
                        </div>
                      ` : ''}
                    </div>

                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">🎁 Recompensas extras</div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Recompensas extras</label>
                        <textarea rows="2" maxlength="800" data-action="updateCreateServiceField" data-field-id="extra_rewards" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all resize-none">${escapeHtml(v('extra_rewards'))}</textarea>
                      </div>
                    </div>

                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">📎 Provas</div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Provas</label>
                        <select data-action="updateCreateServiceField" data-field-id="proofs" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          <option value="" ${v('proofs') === '' ? 'selected' : ''}>Selecione (opcional)</option>
                          ${['Screenshot','Vídeo','Stream','Log','Nenhum'].map((opt) => `<option value="${escapeAttr(opt)}" ${opt === v('proofs') ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                        </select>
                      </div>
                    </div>

                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">📝 Observações</div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Observações</label>
                        <textarea rows="3" maxlength="2000" data-action="updateCreateServiceField" data-field-id="notes" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all resize-none">${escapeHtml(v('notes'))}</textarea>
                      </div>
                    </div>
                  </div>
                </div>
              `;
              return;
            }

            if (isCollectiblesUniversal) {
              const f = serviceFields || {};
              const v = (key) => {
                const raw = f?.[key];
                return raw === null || raw === undefined ? '' : String(raw);
              };
              const platformOptions = ['PC','PlayStation','Xbox','Mobile','Outro'];
              const collectibleTypes = ['Montaria','Skin','Transmog','Skin de arma','Mascote','Emote / Dança','Título','Item raro','Outro'];
              const obtainMethods = ['Drop','Evento','Quest','Craft','Loja do jogo','Outro'];
              const executionMethods = ['Farm repetitivo','Completar conteúdo','Evento limitado','Outro'];
              const rng = String(v('rng_has_chance') || '').trim();
              const showRngDetails = rng === 'Sim';
              const access = String(v('needs_account_access') || '').trim();
              const showAccessAlert = access === 'Sim';
              const desiredDeadline = String(v('desired_deadline') || '').trim();
              const deliveryDays = Number(draft?.deliveryDays || draft?.delivery_days || 0);
              const showShortDeadlineWarning = (deliveryDays > 0 && deliveryDays <= 2) || /hoje|amanh|\b[12]\s*dias?\b/i.test(desiredDeadline);

              serviceProduct.innerHTML = `
                <div class="p-4 bg-white border border-gray-200 rounded-xl space-y-6">
                  <div class="flex items-center gap-2 text-gray-900 font-semibold">
                    <i class="fas fa-list-alt text-primary-600"></i>
                    Produto do serviço
                  </div>

                  <div>
                    <div class="text-sm text-gray-700 font-medium mb-2">Serviço selecionado</div>
                    <div class="text-sm text-gray-900 font-semibold">${escapeHtml(selectedCategory || 'Conquistas e Colecionáveis')}</div>
                  </div>

                  <input type="hidden" name="game_id" value="other">

                  <div class="space-y-6">
                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">🧩 Identificação</div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Nome do jogo *</label>
                        <input type="text" maxlength="120" required data-action="updateCreateServiceField" data-field-id="game_name" value="${escapeAttr(v('game_name'))}" placeholder="Ex: WoW" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                      </div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Plataforma</label>
                        <select data-action="updateCreateServiceField" data-field-id="platform" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          <option value="" ${v('platform') === '' ? 'selected' : ''}>Selecione (opcional)</option>
                          ${platformOptions.map((opt) => `<option value="${escapeAttr(opt)}" ${opt === v('platform') ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                        </select>
                      </div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Região / Servidor</label>
                        <input type="text" maxlength="120" data-action="updateCreateServiceField" data-field-id="region_server" value="${escapeAttr(v('region_server'))}" placeholder="Opcional" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                      </div>
                    </div>

                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">⭐ Tipo de Colecionável</div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Tipo de colecionável *</label>
                        <select required data-action="updateCreateServiceField" data-field-id="collectible_type" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          <option value="" ${v('collectible_type') === '' ? 'selected' : ''}>Selecione</option>
                          ${collectibleTypes.map((opt) => `<option value="${escapeAttr(opt)}" ${opt === v('collectible_type') ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                        </select>
                      </div>
                    </div>

                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">🎯 Item ou Conquista Desejada</div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Nome do item ou conquista *</label>
                        <input type="text" maxlength="200" required data-action="updateCreateServiceField" data-field-id="item_name" value="${escapeAttr(v('item_name'))}" placeholder="Ex: Montaria X" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                      </div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Forma de obtenção</label>
                        <select data-action="updateCreateServiceField" data-field-id="obtain_method" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          <option value="" ${v('obtain_method') === '' ? 'selected' : ''}>Selecione (opcional)</option>
                          ${obtainMethods.map((opt) => `<option value="${escapeAttr(opt)}" ${opt === v('obtain_method') ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                        </select>
                      </div>
                    </div>

                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">⚔️ Execução</div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Método de obtenção</label>
                        <select data-action="updateCreateServiceField" data-field-id="execution_method" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          <option value="" ${v('execution_method') === '' ? 'selected' : ''}>Selecione (opcional)</option>
                          ${executionMethods.map((opt) => `<option value="${escapeAttr(opt)}" ${opt === v('execution_method') ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                        </select>
                      </div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Necessita acesso à conta?</label>
                        <select data-action="updateCreateServiceField" data-field-id="needs_account_access" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          <option value="" ${v('needs_account_access') === '' ? 'selected' : ''}>Selecione (opcional)</option>
                          ${['Sim','Não'].map((opt) => `<option value="${escapeAttr(opt)}" ${opt === v('needs_account_access') ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                        </select>
                        ${showAccessAlert ? `
                          <div class="mt-2 p-3 rounded-lg bg-warning-50 border border-warning-200 text-warning-700 text-xs">
                            <i class="fas fa-exclamation-triangle mr-1"></i>
                            Atenção: solicitar acesso à conta envolve riscos. Combine segurança e termos claros.
                          </div>
                        ` : ''}
                      </div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Cliente participa?</label>
                        <select data-action="updateCreateServiceField" data-field-id="client_participation" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          <option value="" ${v('client_participation') === '' ? 'selected' : ''}>Selecione (opcional)</option>
                          ${['Sim','Não','Depende'].map((opt) => `<option value="${escapeAttr(opt)}" ${opt === v('client_participation') ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                        </select>
                      </div>
                    </div>

                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">🎲 RNG</div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Existe chance aleatória?</label>
                        <select data-action="updateCreateServiceField" data-field-id="rng_has_chance" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          <option value="" ${rng === '' ? 'selected' : ''}>Selecione (opcional)</option>
                          ${['Sim','Não'].map((opt) => `<option value="${escapeAttr(opt)}" ${opt === rng ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                        </select>
                      </div>
                      ${showRngDetails ? `
                        <div>
                          <label class="block text-sm text-gray-700 font-medium mb-2">Tentativas incluídas *</label>
                          <input type="number" inputmode="numeric" required data-action="updateCreateServiceField" data-field-id="rng_attempts" value="${escapeAttr(v('rng_attempts'))}" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                        </div>
                        <div>
                          <label class="block text-sm text-gray-700 font-medium mb-2">Política caso não drope *</label>
                          <textarea rows="2" required maxlength="800" data-action="updateCreateServiceField" data-field-id="rng_policy" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all resize-none">${escapeHtml(v('rng_policy'))}</textarea>
                        </div>
                      ` : ''}
                    </div>

                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">⏳ Prazo</div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Prazo desejado</label>
                        <input type="text" maxlength="120" data-action="updateCreateServiceField" data-field-id="desired_deadline" value="${escapeAttr(v('desired_deadline'))}" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                      </div>
                      ${showShortDeadlineWarning ? `
                        <div class="p-3 bg-warning-50 border border-warning-200 rounded-lg text-warning-700 text-xs">
                          <i class="fas fa-exclamation-triangle mr-1"></i>
                          Prazo curto pode aumentar o risco de atraso. Combine expectativas antes de confirmar.
                        </div>
                      ` : ''}
                    </div>

                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">🎁 Recompensas secundárias</div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Recompensas secundárias</label>
                        <textarea rows="2" maxlength="800" data-action="updateCreateServiceField" data-field-id="extra_rewards" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all resize-none">${escapeHtml(v('extra_rewards'))}</textarea>
                      </div>
                    </div>

                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">📎 Provas</div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Provas</label>
                        <select data-action="updateCreateServiceField" data-field-id="proofs" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          <option value="" ${v('proofs') === '' ? 'selected' : ''}>Selecione (opcional)</option>
                          ${['Screenshot','Vídeo','Stream','Log','Nenhum'].map((opt) => `<option value="${escapeAttr(opt)}" ${opt === v('proofs') ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                        </select>
                      </div>
                    </div>

                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">📝 Observações</div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Observações</label>
                        <textarea rows="3" maxlength="2000" data-action="updateCreateServiceField" data-field-id="notes" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all resize-none">${escapeHtml(v('notes'))}</textarea>
                      </div>
                    </div>
                  </div>
                </div>
              `;
              return;
            }

            // Carry PvE (universal): render a custom form (no game dropdown).
            if (isCarryPveUniversal) {
              const f = serviceFields || {};
              const v = (key) => {
                const raw = f?.[key];
                return raw === null || raw === undefined ? '' : String(raw);
              };
              const isYes = (key) => String(v(key) || '').trim() === 'Sim';
              const scoreHasSystem = String(v('score_has_system') || '').trim();
              const showScoreDetails = scoreHasSystem !== '' || String(v('score_current') || '').trim() !== '' || String(v('score_target') || '').trim() !== '' || String(v('score_type') || '').trim() !== '';
              const showParticipationExtras = isYes('client_participation');
              const showAccountAccessAlert = isYes('needs_account_access');

              // Availability slots UI state (1..3)
              const uiCountRaw = Number(draft?._uiCarryPveSlotCount) || 0;
              const hasSlot2Data = Boolean(String(v('slot2_date') || '').trim() || String(v('slot2_time') || '').trim());
              const hasSlot3Data = Boolean(String(v('slot3_date') || '').trim() || String(v('slot3_time') || '').trim());
              const derivedCount = 1 + (hasSlot2Data ? 1 : 0) + (hasSlot3Data ? 1 : 0);
              const slotCount = Math.max(1, Math.min(3, uiCountRaw || derivedCount || 1));

              const toSlotLabel = (idx) => {
                const d = String(v(`slot${idx}_date`) || '').trim();
                const t = String(v(`slot${idx}_time`) || '').trim();
                if (!d && !t) return `Opção ${idx}`;
                if (d && t) return `${d} ${t}`;
                return `${d || '—'} ${t || '—'}`.trim();
              };

              const preferredSlot = String(v('preferred_slot') || '').trim();
              const preferredOptions = [1, 2, 3]
                .slice(0, slotCount)
                .map((idx) => {
                  const val = String(idx);
                  const label = toSlotLabel(idx);
                  return `<option value="${escapeAttr(val)}" ${(preferredSlot ? preferredSlot === val : idx === 1) ? 'selected' : ''}>${escapeHtml(label)}</option>`;
                })
                .join('');

              serviceProduct.innerHTML = `
                <div class="p-4 bg-white border border-gray-200 rounded-xl space-y-6">
                  <div class="flex items-center gap-2 text-gray-900 font-semibold">
                    <i class="fas fa-list-alt text-primary-600"></i>
                    Produto do serviço
                  </div>

                  <div>
                    <div class="text-sm text-gray-700 font-medium mb-2">Serviço selecionado</div>
                    <div class="text-sm text-gray-900 font-semibold">${escapeHtml(selectedCategory || 'Carry de Conteúdo (PvE)')}</div>
                  </div>

                  <!-- Keep backend contract: service flow requires game_id; Carry PvE uses 'other' internally. -->
                  <input type="hidden" name="game_id" value="other">

                  <div class="space-y-6">
                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">🧩 1. Identificação do Serviço</div>

                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Nome do jogo *</label>
                        <input type="text" maxlength="120" required data-action="updateCreateServiceField" data-field-id="game_other_name" value="${escapeAttr(v('game_other_name'))}" placeholder="Ex: World of Warcraft" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                      </div>

                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Plataforma</label>
                        <input type="text" maxlength="120" data-action="updateCreateServiceField" data-field-id="platform" value="${escapeAttr(v('platform'))}" placeholder="Ex: PC, PS5, Xbox" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                      </div>

                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Região / Servidor</label>
                        <input type="text" maxlength="120" data-action="updateCreateServiceField" data-field-id="region_server" value="${escapeAttr(v('region_server'))}" placeholder="Opcional (recomendado)" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                      </div>
                    </div>

                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">🎮 2. Definição do Conteúdo</div>

                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Tipo de Conteúdo *</label>
                        <select required data-action="updateCreateServiceField" data-field-id="content_type" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          <option value="" ${v('content_type') === '' ? 'selected' : ''}>Selecione</option>
                          ${['Raid','Dungeon','Boss','Evento','Farm','Missão','Outro'].map((opt) => `<option value="${escapeAttr(opt)}" ${opt === v('content_type') ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                        </select>
                      </div>

                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Nome do Conteúdo *</label>
                        <input type="text" maxlength="200" required data-action="updateCreateServiceField" data-field-id="content_name" value="${escapeAttr(v('content_name'))}" placeholder="Ex: Raid X, Dungeon Y" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                      </div>

                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Objetivo do Serviço *</label>
                        <select required data-action="updateCreateServiceField" data-field-id="objective" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          <option value="" ${v('objective') === '' ? 'selected' : ''}>Selecione</option>
                          ${['Completar conteúdo','Farmar item','Conquista','Liberar conteúdo','Outro'].map((opt) => `<option value="${escapeAttr(opt)}" ${opt === v('objective') ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                        </select>
                      </div>
                    </div>

                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">⚔️ 3. Execução do Serviço</div>

                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Dificuldade *</label>
                        <input type="text" maxlength="200" required data-action="updateCreateServiceField" data-field-id="difficulty" value="${escapeAttr(v('difficulty'))}" placeholder="Ex: Normal, Heroic, +15..." class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                      </div>

                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Quantidade de Runs *</label>
                        <input type="number" inputmode="numeric" min="1" required data-action="updateCreateServiceField" data-field-id="runs_count" value="${escapeAttr(v('runs_count'))}" placeholder="Ex: 10" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                      </div>

                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Cliente participa?</label>
                        <select data-action="updateCreateServiceField" data-field-id="client_participation" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          <option value="" ${v('client_participation') === '' ? 'selected' : ''}>Selecione</option>
                          ${['Sim','Não'].map((opt) => `<option value="${escapeAttr(opt)}" ${opt === v('client_participation') ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                        </select>
                      </div>

                      ${showParticipationExtras ? `
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label class="block text-sm text-gray-700 font-medium mb-2">Classe / Build</label>
                            <input type="text" maxlength="200" data-action="updateCreateServiceField" data-field-id="client_class_build" value="${escapeAttr(v('client_class_build'))}" placeholder="Opcional" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          </div>
                          <div>
                            <label class="block text-sm text-gray-700 font-medium mb-2">Função no grupo</label>
                            <input type="text" maxlength="200" data-action="updateCreateServiceField" data-field-id="client_group_role" value="${escapeAttr(v('client_group_role'))}" placeholder="Opcional" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          </div>
                        </div>
                      ` : ''}
                    </div>

                    <details class="p-4 bg-gray-50 rounded-xl border border-gray-100" ${showScoreDetails ? 'open' : ''}>
                      <summary class="cursor-pointer select-none flex items-center justify-between">
                        <div class="text-sm font-semibold text-gray-900">⭐ 4. Pontuação / Score (opcional)</div>
                        <i class="fas fa-chevron-down text-gray-400"></i>
                      </summary>
                      <div class="mt-3 space-y-3">
                        <p class="text-xs text-gray-600">
                          Use este bloco apenas se quiser informar seu score/ilvl/rating atual e o desejado. Isso ajuda em serviços progressivos.
                        </p>
                        <div>
                          <label class="block text-sm text-gray-700 font-medium mb-2">Conta possui sistema de pontuação?</label>
                          <select data-action="updateCreateServiceField" data-field-id="score_has_system" class="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                            <option value="" ${scoreHasSystem === '' ? 'selected' : ''}>Selecione</option>
                            ${['Sim','Não','Não sei'].map((opt) => `<option value="${escapeAttr(opt)}" ${opt === scoreHasSystem ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                          </select>
                        </div>

                        ${scoreHasSystem === 'Sim' ? `
                          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label class="block text-sm text-gray-700 font-medium mb-2">Pontuação atual do cliente</label>
                              <input type="number" inputmode="numeric" data-action="updateCreateServiceField" data-field-id="score_current" value="${escapeAttr(v('score_current'))}" placeholder="Ex: Mythic+ Score" class="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                            </div>
                            <div>
                              <label class="block text-sm text-gray-700 font-medium mb-2">Pontuação desejada</label>
                              <input type="number" inputmode="numeric" data-action="updateCreateServiceField" data-field-id="score_target" value="${escapeAttr(v('score_target'))}" placeholder="Ex: 2500" class="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                            </div>
                          </div>
                          <div>
                            <label class="block text-sm text-gray-700 font-medium mb-2">Tipo de pontuação</label>
                            <input type="text" maxlength="120" data-action="updateCreateServiceField" data-field-id="score_type" value="${escapeAttr(v('score_type'))}" placeholder="Ex: Mythic+ Score, Gear Score, Raid Progress" class="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          </div>
                        ` : ''}
                      </div>
                    </details>

                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">📅 5. Disponibilidade e Prazo</div>

                      <div class="space-y-3">
                        <div class="text-xs text-gray-600">
                          Selecione uma data e um horário principal. Se quiser, adicione até 2 opções extras (máx. 3).
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label class="block text-sm text-gray-700 font-medium mb-2">Data (principal)</label>
                            <input type="date" required data-action="updateCreateServiceField" data-field-id="slot1_date" value="${escapeAttr(v('slot1_date'))}" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          </div>
                          <div>
                            <label class="block text-sm text-gray-700 font-medium mb-2">Hora (principal)</label>
                            <input type="time" required data-action="updateCreateServiceField" data-field-id="slot1_time" value="${escapeAttr(v('slot1_time'))}" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          </div>
                        </div>

                        ${slotCount >= 2 ? `
                          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label class="block text-sm text-gray-700 font-medium mb-2">Data (opcional)</label>
                              <input type="date" data-action="updateCreateServiceField" data-field-id="slot2_date" value="${escapeAttr(v('slot2_date'))}" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                            </div>
                            <div class="relative">
                              <label class="block text-sm text-gray-700 font-medium mb-2">Hora (opcional)</label>
                              <input type="time" data-action="updateCreateServiceField" data-field-id="slot2_time" value="${escapeAttr(v('slot2_time'))}" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                              <button type="button" class="absolute right-2 top-9 text-xs px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-700" data-action="carryPveRemoveSlot" data-index="2">Remover</button>
                            </div>
                          </div>
                        ` : ''}

                        ${slotCount >= 3 ? `
                          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label class="block text-sm text-gray-700 font-medium mb-2">Data (opcional)</label>
                              <input type="date" data-action="updateCreateServiceField" data-field-id="slot3_date" value="${escapeAttr(v('slot3_date'))}" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                            </div>
                            <div class="relative">
                              <label class="block text-sm text-gray-700 font-medium mb-2">Hora (opcional)</label>
                              <input type="time" data-action="updateCreateServiceField" data-field-id="slot3_time" value="${escapeAttr(v('slot3_time'))}" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                              <button type="button" class="absolute right-2 top-9 text-xs px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-700" data-action="carryPveRemoveSlot" data-index="3">Remover</button>
                            </div>
                          </div>
                        ` : ''}

                        <div class="flex items-center gap-3">
                          <button type="button" class="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm text-gray-700 transition" data-action="carryPveAddSlot" ${slotCount >= 3 ? 'disabled' : ''}>
                            Adicionar data e hora
                          </button>
                          <div class="text-xs text-gray-500">Máximo: 3 opções</div>
                        </div>

                        ${slotCount > 1 ? `
                          <div>
                            <label class="block text-sm text-gray-700 font-medium mb-2">Horário principal</label>
                            <select data-action="updateCreateServiceField" data-field-id="preferred_slot" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                              ${preferredOptions}
                            </select>
                            <p class="text-xs text-gray-500 mt-1">Escolha qual opção deve ser considerada a principal.</p>
                          </div>
                        ` : ''}
                      </div>

                      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label class="block text-sm text-gray-700 font-medium mb-2">Prazo para entrega</label>
                          <input type="text" maxlength="200" data-action="updateCreateServiceField" data-field-id="delivery_deadline" value="${escapeAttr(v('delivery_deadline'))}" placeholder="Ex: até 7 dias" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                        </div>
                        <div>
                          <label class="block text-sm text-gray-700 font-medium mb-2">Tempo necessário para realizar</label>
                          <input type="text" maxlength="200" data-action="updateCreateServiceField" data-field-id="time_needed" value="${escapeAttr(v('time_needed'))}" placeholder="Ex: 2h" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                        </div>
                      </div>
                    </div>

                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">💰 6. Forma de Execução</div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Como será feito *</label>
                        <select required data-action="updateCreateServiceField" data-field-id="execution_method" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          <option value="" ${v('execution_method') === '' ? 'selected' : ''}>Selecione</option>
                          ${['Cliente joga junto','Booster joga','Misto'].map((opt) => `<option value="${escapeAttr(opt)}" ${opt === v('execution_method') ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                        </select>
                      </div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Necessita acesso à conta?</label>
                        <select data-action="updateCreateServiceField" data-field-id="needs_account_access" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          <option value="" ${v('needs_account_access') === '' ? 'selected' : ''}>Selecione</option>
                          ${['Sim','Não'].map((opt) => `<option value="${escapeAttr(opt)}" ${opt === v('needs_account_access') ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                        </select>
                        ${showAccountAccessAlert ? `
                          <div class="mt-2 p-3 rounded-lg bg-warning-50 border border-warning-200 text-warning-700 text-xs">
                            <i class="fas fa-exclamation-triangle mr-1"></i>
                            Atenção: solicitar acesso à conta envolve risco e deve ser combinado com segurança e termos claros.
                          </div>
                        ` : ''}
                      </div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Possui garantia?</label>
                        <select data-action="updateCreateServiceField" data-field-id="warranty" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          <option value="" ${v('warranty') === '' ? 'selected' : ''}>Selecione</option>
                          ${['Sim','Não'].map((opt) => `<option value="${escapeAttr(opt)}" ${opt === v('warranty') ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                        </select>
                      </div>
                    </div>

                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">🎁 7. Recompensas Esperadas</div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Recompensa principal *</label>
                        <input type="text" maxlength="200" required data-action="updateCreateServiceField" data-field-id="reward_main" value="${escapeAttr(v('reward_main'))}" placeholder="Ex: Item X, Conquista Y" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                      </div>
                    </div>

                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">📎 8. Provas</div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Provas</label>
                        <select data-action="updateCreateServiceField" data-field-id="proofs" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          <option value="" ${v('proofs') === '' ? 'selected' : ''}>Selecione</option>
                          ${['Screenshot','Vídeo','Stream','Log','Nenhum'].map((opt) => `<option value="${escapeAttr(opt)}" ${opt === v('proofs') ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                        </select>
                      </div>
                    </div>

                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">📝 9. Observações Gerais</div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Observações</label>
                        <textarea rows="3" maxlength="2000" data-action="updateCreateServiceField" data-field-id="notes" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all resize-none">${escapeHtml(v('notes'))}</textarea>
                      </div>
                    </div>
                  </div>
                </div>
              `;
              return;
            }

            // Boost de Rank (universal): custom form (no game dropdown).
            if (isBoostRankUniversal) {
              const f = serviceFields || {};
              const v = (key) => {
                const raw = f?.[key];
                return raw === null || raw === undefined ? '' : String(raw);
              };

              const slotCountRaw = Number(draft?._uiBoostRankSlotCount) || 1;
              const slotCount = Math.max(1, Math.min(3, slotCountRaw));

              const currentTier = String(v('rank_current_tier') || '').trim();
              const targetTier = String(v('rank_target_tier') || '').trim();
              const tierOptions = ['Bronze', 'Prata', 'Ouro', 'Platina', 'Diamante', 'Mestre', 'Outro'];

              const access = String(v('needs_account_access') || '').trim();
              const showAccessAlert = access === 'Sim';

              const risk = String(v('downgrade_risk') || '').trim();
              const showPolicy = risk === '1' || risk === 'true' || risk === 'on' || risk === 'yes';

              serviceProduct.innerHTML = `
                <div class="p-4 bg-white border border-gray-200 rounded-xl space-y-4">
                  <div class="flex items-center gap-2 text-gray-900 font-semibold">
                    <i class="fas fa-list-alt text-primary-600"></i>
                    Produto do serviço
                  </div>

                  <!-- Keep backend contract: service flow requires game_id; Boost Rank uses 'other' internally. -->
                  <input type="hidden" name="game_id" value="other">

                  <div class="space-y-6">
                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">🧩 1. Identificação do Serviço</div>

                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Nome do jogo *</label>
                        <input type="text" maxlength="120" required data-action="updateCreateServiceField" data-field-id="game_other_name" value="${escapeAttr(v('game_other_name'))}" placeholder="Ex: Valorant" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                      </div>

                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Plataforma</label>
                        <select data-action="updateCreateServiceField" data-field-id="platform" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          <option value="" ${v('platform') === '' ? 'selected' : ''}>Selecione (opcional)</option>
                          ${['PC','PlayStation','Xbox','Mobile','Outro'].map((opt) => `<option value="${escapeAttr(opt)}" ${opt === v('platform') ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                        </select>
                      </div>

                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Região / Servidor</label>
                        <input type="text" maxlength="120" data-action="updateCreateServiceField" data-field-id="region_server" value="${escapeAttr(v('region_server'))}" placeholder="Ex: BR / NA / EU / Servidor" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                        <p class="text-xs text-gray-500 mt-1">Opcional (mas muito recomendado).</p>
                      </div>
                    </div>

                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">🏆 2. Objetivo do Boost</div>

                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Tipo de Boost *</label>
                        <select required data-action="updateCreateServiceField" data-field-id="boost_type" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          <option value="" ${v('boost_type') === '' ? 'selected' : ''}>Selecione</option>
                          ${['Rank competitivo PvP','Rank PvE competitivo','Liberação de modo ranqueado','Conquista competitiva','Outro'].map((opt) => `<option value="${escapeAttr(opt)}" ${opt === v('boost_type') ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                        </select>
                      </div>

                      <details class="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        <summary class="cursor-pointer text-sm font-medium text-gray-800">Campos de ranking (opcional)</summary>
                        <div class="mt-3 space-y-4">
                          <div class="text-xs text-gray-600">
                            Você pode preencher só o Tier, só o Score, ou ambos.
                          </div>

                          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div class="p-3 bg-white border border-gray-200 rounded-lg space-y-3">
                              <div class="text-sm font-medium text-gray-800">Ranking atual</div>

                              <div>
                                <label class="block text-sm text-gray-700 font-medium mb-2">Tier atual</label>
                                <select data-action="updateCreateServiceField" data-field-id="rank_current_tier" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                                  <option value="" ${currentTier === '' ? 'selected' : ''}>Selecione (opcional)</option>
                                  ${tierOptions.map((opt) => `<option value="${escapeAttr(opt)}" ${opt === currentTier ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                                </select>
                              </div>

                              <div>
                                <label class="block text-sm text-gray-700 font-medium mb-2">Score atual</label>
                                <input type="number" inputmode="numeric" data-action="updateCreateServiceField" data-field-id="rank_current_score" value="${escapeAttr(v('rank_current_score'))}" placeholder="Ex: 120" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                              </div>
                            </div>

                            <div class="p-3 bg-white border border-gray-200 rounded-lg space-y-3">
                              <div class="text-sm font-medium text-gray-800">Ranking desejado</div>

                              <div>
                                <label class="block text-sm text-gray-700 font-medium mb-2">Tier desejado</label>
                                <select data-action="updateCreateServiceField" data-field-id="rank_target_tier" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                                  <option value="" ${targetTier === '' ? 'selected' : ''}>Selecione (opcional)</option>
                                  ${tierOptions.map((opt) => `<option value="${escapeAttr(opt)}" ${opt === targetTier ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                                </select>
                              </div>

                              <div>
                                <label class="block text-sm text-gray-700 font-medium mb-2">Score desejado</label>
                                <input type="number" inputmode="numeric" data-action="updateCreateServiceField" data-field-id="rank_target_score" value="${escapeAttr(v('rank_target_score'))}" placeholder="Ex: 300" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                              </div>
                            </div>
                          </div>

                          <div>
                            <label class="block text-sm text-gray-700 font-medium mb-2">Tipo de pontuação usada pelo jogo</label>
                            <input type="text" maxlength="60" data-action="updateCreateServiceField" data-field-id="score_type" value="${escapeAttr(v('score_type'))}" placeholder="Ex: LP, MMR, SR, Elo" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          </div>
                        </div>
                      </details>
                    </div>

                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">⚔️ 3. Execução do Boost</div>

                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Forma do Boost *</label>
                        <select required data-action="updateCreateServiceField" data-field-id="boost_method" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          <option value="" ${v('boost_method') === '' ? 'selected' : ''}>Selecione</option>
                          ${['Booster joga na conta','Cliente joga junto','Coaching','Misto'].map((opt) => `<option value="${escapeAttr(opt)}" ${opt === v('boost_method') ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                        </select>
                      </div>

                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Necessita acesso à conta?</label>
                        <select data-action="updateCreateServiceField" data-field-id="needs_account_access" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          <option value="" ${v('needs_account_access') === '' ? 'selected' : ''}>Selecione (opcional)</option>
                          ${['Sim','Não'].map((opt) => `<option value="${escapeAttr(opt)}" ${opt === v('needs_account_access') ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                        </select>
                        ${showAccessAlert ? `
                          <div class="mt-2 p-3 bg-warning-50 border border-warning-200 rounded-lg text-sm text-warning-800">
                            Atenção: nunca compartilhe senha reutilizada. Recomendado: alterar senha antes/depois e ativar 2FA.
                          </div>
                        ` : ''}
                      </div>

                      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label class="block text-sm text-gray-700 font-medium mb-2">Cliente pode jogar durante o boost?</label>
                          <select data-action="updateCreateServiceField" data-field-id="client_can_play" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                            <option value="" ${v('client_can_play') === '' ? 'selected' : ''}>Selecione (opcional)</option>
                            ${['Sim','Não','Depende'].map((opt) => `<option value="${escapeAttr(opt)}" ${opt === v('client_can_play') ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                          </select>
                        </div>
                        <div>
                          <label class="block text-sm text-gray-700 font-medium mb-2">Pode usar VPN?</label>
                          <select data-action="updateCreateServiceField" data-field-id="can_use_vpn" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                            <option value="" ${v('can_use_vpn') === '' ? 'selected' : ''}>Selecione (opcional)</option>
                            ${['Sim','Não','Depende'].map((opt) => `<option value="${escapeAttr(opt)}" ${opt === v('can_use_vpn') ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                          </select>
                          <p class="text-xs text-gray-500 mt-1">Importante para segurança da conta.</p>
                        </div>
                      </div>
                    </div>

                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">📊 4. Informações Técnicas do Ranking</div>
                      <details class="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        <summary class="cursor-pointer text-sm font-medium text-gray-800">Bloco opcional</summary>
                        <div class="mt-3 space-y-3">
                          <div>
                            <label class="block text-sm text-gray-700 font-medium mb-2">Histórico competitivo relevante</label>
                            <textarea rows="2" maxlength="800" data-action="updateCreateServiceField" data-field-id="tech_history" class="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all resize-none">${escapeHtml(v('tech_history'))}</textarea>
                          </div>

                          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label class="block text-sm text-gray-700 font-medium mb-2">Melhor rank já alcançado (Tier)</label>
                              <input type="text" maxlength="60" data-action="updateCreateServiceField" data-field-id="best_rank_tier" value="${escapeAttr(v('best_rank_tier'))}" placeholder="Ex: Diamante" class="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                            </div>
                            <div>
                              <label class="block text-sm text-gray-700 font-medium mb-2">Melhor rank já alcançado (Score)</label>
                              <input type="number" inputmode="numeric" data-action="updateCreateServiceField" data-field-id="best_rank_score" value="${escapeAttr(v('best_rank_score'))}" placeholder="Ex: 500" class="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                            </div>
                          </div>

                          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label class="block text-sm text-gray-700 font-medium mb-2">Taxa de vitória atual (Winrate %)</label>
                              <input type="number" inputmode="numeric" data-action="updateCreateServiceField" data-field-id="winrate" value="${escapeAttr(v('winrate'))}" placeholder="Ex: 55" class="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                            </div>
                            <div>
                              <label class="block text-sm text-gray-700 font-medium mb-2">Partidas necessárias (aprox.)</label>
                              <input type="number" inputmode="numeric" data-action="updateCreateServiceField" data-field-id="matches_estimate" value="${escapeAttr(v('matches_estimate'))}" placeholder="Ex: 20" class="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                            </div>
                          </div>
                        </div>
                      </details>
                    </div>

                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">📅 5. Disponibilidade e Prazo</div>

                      <div class="text-xs text-gray-600">
                        Horários disponíveis são opcionais. Se quiser, adicione até 3 opções.
                      </div>

                      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label class="block text-sm text-gray-700 font-medium mb-2">Data (principal)</label>
                          <input type="date" data-action="updateCreateServiceField" data-field-id="slot1_date" value="${escapeAttr(v('slot1_date'))}" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                        </div>
                        <div>
                          <label class="block text-sm text-gray-700 font-medium mb-2">Hora (principal)</label>
                          <input type="time" data-action="updateCreateServiceField" data-field-id="slot1_time" value="${escapeAttr(v('slot1_time'))}" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                        </div>
                      </div>

                      ${slotCount >= 2 ? `
                        <div class="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                          <div class="flex items-center justify-between">
                            <div class="text-sm font-medium text-gray-800">Opção 2 (opcional)</div>
                            <button type="button" class="text-xs px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-700 transition" data-action="boostRankRemoveSlot" data-index="2">Remover</button>
                          </div>
                          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label class="block text-sm text-gray-700 font-medium mb-2">Data</label>
                              <input type="date" data-action="updateCreateServiceField" data-field-id="slot2_date" value="${escapeAttr(v('slot2_date'))}" class="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                            </div>
                            <div>
                              <label class="block text-sm text-gray-700 font-medium mb-2">Hora</label>
                              <input type="time" data-action="updateCreateServiceField" data-field-id="slot2_time" value="${escapeAttr(v('slot2_time'))}" class="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                            </div>
                          </div>
                        </div>
                      ` : ''}

                      ${slotCount >= 3 ? `
                        <div class="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                          <div class="flex items-center justify-between">
                            <div class="text-sm font-medium text-gray-800">Opção 3 (opcional)</div>
                            <button type="button" class="text-xs px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-700 transition" data-action="boostRankRemoveSlot" data-index="3">Remover</button>
                          </div>
                          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label class="block text-sm text-gray-700 font-medium mb-2">Data</label>
                              <input type="date" data-action="updateCreateServiceField" data-field-id="slot3_date" value="${escapeAttr(v('slot3_date'))}" class="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                            </div>
                            <div>
                              <label class="block text-sm text-gray-700 font-medium mb-2">Hora</label>
                              <input type="time" data-action="updateCreateServiceField" data-field-id="slot3_time" value="${escapeAttr(v('slot3_time'))}" class="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                            </div>
                          </div>
                        </div>
                      ` : ''}

                      <div class="flex items-center gap-3">
                        <button type="button" class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition disabled:opacity-50" data-action="boostRankAddSlot" ${slotCount >= 3 ? 'disabled' : ''}>
                          Adicionar data e hora
                        </button>

                        ${slotCount > 1 ? `
                          <div class="flex-1">
                            <label class="block text-sm text-gray-700 font-medium mb-2">Horário principal</label>
                            <select data-action="updateCreateServiceField" data-field-id="preferred_slot" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                              ${Array.from({ length: slotCount }).map((_, i) => {
                                const n = String(i + 1);
                                const current = String(v('preferred_slot') || '').trim() || '1';
                                return `<option value="${escapeAttr(n)}" ${n === current ? 'selected' : ''}>Opção ${escapeHtml(n)}</option>`;
                              }).join('')}
                            </select>
                          </div>
                        ` : ''}
                      </div>

                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Prazo desejado</label>
                        <input type="text" maxlength="120" data-action="updateCreateServiceField" data-field-id="desired_deadline" value="${escapeAttr(v('desired_deadline'))}" placeholder="Ex: até domingo / 7 dias" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                      </div>
                    </div>

                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">💰 6. Garantias e Regras</div>

                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Possui garantia de rank?</label>
                        <select data-action="updateCreateServiceField" data-field-id="has_rank_warranty" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          <option value="" ${v('has_rank_warranty') === '' ? 'selected' : ''}>Selecione (opcional)</option>
                          ${['Sim','Não'].map((opt) => `<option value="${escapeAttr(opt)}" ${opt === v('has_rank_warranty') ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                        </select>
                      </div>

                      <div class="flex items-start gap-3">
                        <input type="checkbox" ${showPolicy ? 'checked' : ''} data-action="updateCreateServiceField" data-field-id="downgrade_risk" value="1" class="mt-1">
                        <div class="flex-1">
                          <div class="text-sm font-medium text-gray-800">Existe risco de rebaixamento?</div>
                          <div class="text-xs text-gray-600">Se marcado, você pode descrever a política abaixo.</div>
                        </div>
                      </div>

                      ${showPolicy ? `
                        <div>
                          <label class="block text-sm text-gray-700 font-medium mb-2">Política caso caia de rank</label>
                          <textarea rows="2" maxlength="800" data-action="updateCreateServiceField" data-field-id="downgrade_policy" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all resize-none">${escapeHtml(v('downgrade_policy'))}</textarea>
                        </div>
                      ` : ''}
                    </div>

                    <div class="space-y-3">
                      <div class="text-sm font-semibold text-gray-900">📝 Observações</div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Observações</label>
                        <textarea rows="3" maxlength="2000" data-action="updateCreateServiceField" data-field-id="notes" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all resize-none">${escapeHtml(v('notes'))}</textarea>
                      </div>
                    </div>
                  </div>
                </div>
              `;
              return;
            }

            const isBoostRank = currentServiceId === 'boost_rank';
            const boostSlotCountRaw = Number(draft?._uiBoostRankSlotCount) || 1;
            const boostSlotCount = Math.max(1, Math.min(3, boostSlotCountRaw));
            const boostV = (key) => {
              const raw = serviceFields?.[key];
              return raw === null || raw === undefined ? '' : String(raw);
            };

            const boostScheduleHtml = isBoostRank ? `
              <div class="pt-4 border-t border-gray-100 space-y-3">
                <div class="text-sm font-semibold text-gray-900">📅 Disponibilidade (data e hora)</div>
                <div class="text-xs text-gray-600">
                  Selecione uma data e um horário principal. Se quiser, adicione até 2 opções extras (máx. 3).
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-sm text-gray-700 font-medium mb-2">Data (principal) *</label>
                    <input type="date" required data-action="updateCreateServiceField" data-field-id="slot1_date" value="${escapeAttr(boostV('slot1_date'))}" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                  </div>
                  <div>
                    <label class="block text-sm text-gray-700 font-medium mb-2">Hora (principal) *</label>
                    <input type="time" required data-action="updateCreateServiceField" data-field-id="slot1_time" value="${escapeAttr(boostV('slot1_time'))}" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                  </div>
                </div>

                ${boostSlotCount >= 2 ? `
                  <div class="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                    <div class="flex items-center justify-between">
                      <div class="text-sm font-medium text-gray-800">Opção 2 (opcional)</div>
                      <button type="button" class="text-xs px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-700 transition" data-action="boostRankRemoveSlot" data-index="2">Remover</button>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Data</label>
                        <input type="date" data-action="updateCreateServiceField" data-field-id="slot2_date" value="${escapeAttr(boostV('slot2_date'))}" class="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                      </div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Hora</label>
                        <input type="time" data-action="updateCreateServiceField" data-field-id="slot2_time" value="${escapeAttr(boostV('slot2_time'))}" class="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                      </div>
                    </div>
                  </div>
                ` : ''}

                ${boostSlotCount >= 3 ? `
                  <div class="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                    <div class="flex items-center justify-between">
                      <div class="text-sm font-medium text-gray-800">Opção 3 (opcional)</div>
                      <button type="button" class="text-xs px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-700 transition" data-action="boostRankRemoveSlot" data-index="3">Remover</button>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Data</label>
                        <input type="date" data-action="updateCreateServiceField" data-field-id="slot3_date" value="${escapeAttr(boostV('slot3_date'))}" class="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                      </div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Hora</label>
                        <input type="time" data-action="updateCreateServiceField" data-field-id="slot3_time" value="${escapeAttr(boostV('slot3_time'))}" class="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                      </div>
                    </div>
                  </div>
                ` : ''}

                <div class="flex items-center gap-3">
                  <button type="button" class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition disabled:opacity-50" data-action="boostRankAddSlot" ${boostSlotCount >= 3 ? 'disabled' : ''}>
                    Adicionar data e hora
                  </button>

                  ${boostSlotCount > 1 ? `
                    <div class="flex-1">
                      <label class="block text-sm text-gray-700 font-medium mb-2">Horário principal</label>
                      <select data-action="updateCreateServiceField" data-field-id="preferred_slot" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                        ${Array.from({ length: boostSlotCount }).map((_, i) => {
                          const n = String(i + 1);
                          const current = String(boostV('preferred_slot') || '').trim() || '1';
                          return `<option value="${escapeAttr(n)}" ${n === current ? 'selected' : ''}>Opção ${escapeHtml(n)}</option>`;
                        }).join('')}
                      </select>
                    </div>
                  ` : ''}
                </div>
              </div>
            ` : '';

            const fieldHtml = fieldDefs.length ? `
              <div class="pt-4 border-t border-gray-100 space-y-3">
                <div class="text-sm font-semibold text-gray-900">Informações do serviço</div>
                ${fieldDefs.map((def) => {
                  const fieldId = String(def?.id || '').trim();
                  const label = String(def?.label || fieldId).trim();
                  const type = String(def?.type || 'text').trim();
                  const rawValue = serviceFields?.[fieldId];
                  const value = rawValue === null || rawValue === undefined ? '' : String(rawValue);
                  const common = `data-action="updateCreateServiceField" data-field-id="${escapeAttr(fieldId)}"`;

                  if (!fieldId) return '';

                  if (type === 'textarea') {
                    return `
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">${escapeHtml(label)}</label>
                        <textarea rows="3" maxlength="2000" ${common} class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all resize-none">${escapeHtml(value)}</textarea>
                      </div>
                    `;
                  }

                  if (type === 'select') {
                    const options = Array.isArray(def?.options) ? def.options : [];
                    const opts = options.map((opt) => {
                      if (typeof opt === 'string') {
                        const v = opt;
                        return `<option value="${escapeAttr(v)}" ${v === value ? 'selected' : ''}>${escapeHtml(v)}</option>`;
                      }
                      const v = String(opt?.value ?? opt?.id ?? '').trim();
                      const l = String(opt?.label ?? v).trim();
                      return `<option value="${escapeAttr(v)}" ${v === value ? 'selected' : ''}>${escapeHtml(l)}</option>`;
                    }).join('');

                    return `
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">${escapeHtml(label)}</label>
                        <select ${common} class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          <option value="" ${value === '' ? 'selected' : ''}>Selecione</option>
                          ${opts}
                        </select>
                      </div>
                    `;
                  }

                  if (type === 'number') {
                    return `
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">${escapeHtml(label)}</label>
                        <input type="number" inputmode="numeric" ${common} value="${escapeAttr(value)}" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                      </div>
                    `;
                  }

                  return `
                    <div>
                      <label class="block text-sm text-gray-700 font-medium mb-2">${escapeHtml(label)}</label>
                      <input type="text" maxlength="2000" ${common} value="${escapeAttr(value)}" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                    </div>
                  `;
                }).join('')}
                ${boostScheduleHtml}
              </div>
            ` : `
              <div class="pt-4 border-t border-gray-100">
                <p class="text-sm text-gray-600">Sem campos adicionais para este serviço/jogo.</p>
              </div>
            `;

            serviceProduct.innerHTML = `
              <div class="p-4 bg-white border border-gray-200 rounded-xl space-y-4">
                <div class="flex items-center gap-2 text-gray-900 font-semibold">
                  <i class="fas fa-list-alt text-primary-600"></i>
                  Produto do serviço
                </div>

                <div>
                  <div class="text-sm text-gray-700 font-medium mb-2">Serviço selecionado</div>
                  <div class="text-sm text-gray-900 font-semibold">${escapeHtml(selectedCategory || (servicesList.find((s) => String(s?.id || '').trim() === currentServiceId)?.label) || '—')}</div>
                </div>

                <div>
                  <label class="block text-sm text-gray-700 font-medium mb-2">Selecionar jogo *</label>
                  <select name="game_id" required data-action="updateCreateGameId" ${currentServiceId ? '' : 'disabled'} class="w-full px-4 py-3 ${currentServiceId ? 'bg-gray-50 text-gray-700' : 'bg-gray-200 text-gray-600 cursor-not-allowed'} border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                    <option value="" ${currentGameId === '' ? 'selected' : ''}>${currentServiceId ? 'Selecione' : 'Selecione o serviço na etapa 1'}</option>
                    ${gameOptionsHtml}
                  </select>
                  <p class="text-xs text-gray-500 mt-1">Se não estiver na lista, escolha “Outro (escrever)”.</p>
                </div>

                ${currentServiceId && currentGameId ? fieldHtml : '<p class="text-sm text-gray-600">Selecione o serviço e o jogo para ver o formulário.</p>'}
              </div>
            `;
          }
        }
      }

      // Game Account: show all games as suggestions (independent of service rules)
      if (showGameAccountFields && !state.serviceFormsConfig && !state.serviceFormsLoading) {
        try { ensureServiceFormsConfigLoaded(); } catch { /* ignore */ }
      }

      if (structured instanceof HTMLElement) {
        const cfgGamesMap = (state.serviceFormsConfig?.games && typeof state.serviceFormsConfig.games === 'object')
          ? state.serviceFormsConfig.games
          : {};
        const gameAccountGameSuggestions = Object.entries(cfgGamesMap)
          .filter(([gid]) => String(gid || '').trim() && !['any', 'other'].includes(String(gid || '').trim()))
          .map(([, label]) => String(label || '').trim())
          .filter(Boolean);
        const fallbackGameAccountSuggestions = [
          'World of Warcraft',
          'Valorant',
          'Counter-Strike 2',
          'League of Legends',
          'Final Fantasy XIV',
          'Tibia',
          'Diablo IV',
          'Albion Online',
        ];
        const gameAccountGameOptionsList = (gameAccountGameSuggestions.length ? gameAccountGameSuggestions : fallbackGameAccountSuggestions);
        const currentGameAccountType = String(getDraft('game_account_type') || '').trim();
        const currentOtherGameName = String(getDraft('game_account_game_other') || '').trim();
        const currentGameNameForHints = (currentGameAccountType === 'other' ? currentOtherGameName : currentGameAccountType);
        const hasCustomCurrentType = !!(currentGameAccountType && currentGameAccountType !== 'other' && !gameAccountGameOptionsList.includes(currentGameAccountType));
        const gameAccountTypeOptionsHtml = [
          `<option value="" ${currentGameAccountType === '' ? 'selected' : ''}>Selecione</option>`,
          ...(hasCustomCurrentType ? [currentGameAccountType] : []),
          ...gameAccountGameOptionsList,
          'other',
        ].map((name) => {
          const label = name === 'other' ? 'Outro (escrever)' : String(name || '').trim();
          const value = name === 'other' ? 'other' : String(name || '').trim();
          const selected = value === currentGameAccountType;
          return `<option value="${escapeAttr(value)}" ${selected ? 'selected' : ''}>${escapeHtml(label)}</option>`;
        }).join('');

        const gameNameNormalized = String(currentGameNameForHints || '').trim().toLowerCase();
        const rankedGames = [
          'valorant',
          'league of legends',
          'counter-strike 2',
          'cs2',
          'fortnite',
          'apex legends',
          'overwatch 2',
          'rainbow six siege',
        ];
        const regionGames = [
          'world of warcraft',
          'final fantasy xiv',
          'tibia',
          'albion online',
          'diablo iv',
          'diablo 4',
        ];
        const supportsRank = rankedGames.some((g) => gameNameNormalized.includes(g));
        const supportsRegion = regionGames.some((g) => gameNameNormalized.includes(g));
        const hideLevel = (gameNameNormalized.includes('world of warcraft') || gameNameNormalized === 'wow' || gameNameNormalized.includes(' wow'));
        const linkedProviders = getDraftArray('game_account_linked_providers');
        const extras = getDraftArray('game_account_extras');
        const firstOwner = String(getDraft('game_account_first_owner') || '').trim();
        const hasOriginalEmail = String(getDraft('game_account_has_original_email') || '').trim();
        const hasExtrasOpen = Boolean(getDraft('game_account_rank') || getDraft('game_account_region') || extras.length || getDraft('game_account_seller_notes'));

        const gameType = String(getDraft('game_account_type') || '').trim();
        const isCompetitiveType = ['fps', 'moba', 'battle_royale', 'mobile', 'esporte'].includes(gameType);
        const hasExclusiveItems = String(getDraft('ga_has_exclusive_items') || '').trim();
        const exclusiveItems = Array.isArray(draft?.exclusiveItems) ? draft.exclusiveItems : [];

        const nonEmpty = (v) => String(v || '').trim() !== '';
        const uiOpen = (key) => Boolean(draft && draft[`_uiGaOpen_${key}`]);

        const layer1Done = nonEmpty(getDraft('game_account_type')) && nonEmpty(getDraft('game_account_platform')) && nonEmpty(getDraft('game_account_game'));
        const rankingDone = !isCompetitiveType || nonEmpty(getDraft('ga_rank_current_tier'));

        const exclusiveItemsDone = (() => {
          if (hasExclusiveItems !== '1') return true;
          if (!Array.isArray(exclusiveItems) || exclusiveItems.length < 1) return false;
          return exclusiveItems.some((it) => Boolean(String(it?.preview || '').trim()));
        })();
        const exclusiveDone = (hasExclusiveItems === '0' || hasExclusiveItems === '1') && exclusiveItemsDone;

        const specificDone = (() => {
          const reqAll = (names) => names.every((n) => nonEmpty(getDraft(n)));
          if (!gameType) return false;
          if (gameType === 'mmorpg') return reqAll(['ts_mm_avg_level', 'ts_mm_endgame', 'ts_mm_playtime', 'ts_mm_complete_builds', 'ts_mm_has_currency']);
          if (gameType === 'fps') return reqAll(['ts_fps_level']);
          if (gameType === 'moba') return reqAll(['ts_moba_level', 'ts_moba_chars_unlocked']);
          if (gameType === 'battle_royale') return reqAll(['ts_br_level', 'ts_br_old_seasons', 'ts_br_old_passes']);
          if (gameType === 'mobile') return reqAll(['ts_mobile_level']);
          if (gameType === 'estrategia') return reqAll(['ts_strat_base_level', 'ts_strat_alliances']);
          if (gameType === 'esporte') return reqAll(['ts_sport_level']);
          if (gameType === 'other') return reqAll(['ts_other_progression_general', 'ts_other_has_competitive']);
          return true;
        })();

        // Entrega (Camada 7) não é necessária no fluxo de conta de jogo: usar texto padrão.
        const DEFAULT_GAME_ACCOUNT_DELIVERABLE = 'Acesso à conta (login e senha) + instruções para troca de credenciais.';
        const deliverableValue = nonEmpty(getDraft('what_will_be_delivered'))
          ? String(getDraft('what_will_be_delivered') || '').trim()
          : DEFAULT_GAME_ACCOUNT_DELIVERABLE;
        const deliveryDone = nonEmpty(deliverableValue);

        const securityDone = (() => {
          const providers = Array.isArray(draft?.game_account_linked_providers)
            ? draft.game_account_linked_providers.map((v) => String(v || '').trim()).filter(Boolean)
            : getDraftArray('game_account_linked_providers');
          if (!['0', '1'].includes(firstOwner)) return false;
          if (!['0', '1'].includes(hasOriginalEmail)) return false;
          if (!['yes', 'no', 'partial'].includes(String(getDraft('game_account_can_change_credentials') || '').trim())) return false;
          if (!nonEmpty(getDraft('game_account_punishment_history'))) return false;
          if (!Array.isArray(providers) || providers.length < 1) return false;
          if (providers.includes('none') && providers.length > 1) return false;
          return true;
        })();

        const canOpenRanking = layer1Done;
        const canOpenExclusive = layer1Done && rankingDone;
        const canOpenSpecific = canOpenExclusive && exclusiveDone;
        const canOpenSecurity = canOpenSpecific && specificDone && deliveryDone;

        let activeKey = '';
        if (layer1Done) {
          if (isCompetitiveType && !rankingDone) activeKey = 'ranking';
          else if (!exclusiveDone) activeKey = 'exclusive';
          else if (!specificDone) activeKey = 'specific';
          else if (!securityDone) activeKey = 'security';
        }

        const UNIVERSAL_GAME_TYPES = [
          { v: 'mmorpg', l: 'MMORPG' },
          { v: 'fps', l: 'FPS' },
          { v: 'moba', l: 'MOBA' },
          { v: 'battle_royale', l: 'Battle Royale' },
          { v: 'mobile', l: 'Mobile' },
          { v: 'estrategia', l: 'Estratégia' },
          { v: 'esporte', l: 'Esporte' },
          { v: 'other', l: 'Outro' },
        ];
        const useUniversalGameProductFlow = isDigital && (showSkinFields || showItemFields || selectedCategory === CATEGORY_OTHERS);
        const uGameType = String(getDraft('universal_game_type') || '').trim();
        const uGameName = String(getDraft('universal_game_name') || '').trim();
        const uProductName = String(getDraft('universal_product_name') || '').trim();
        const uTypeLabel = (UNIVERSAL_GAME_TYPES.find((t) => t.v === uGameType) || {}).l || '';
        const titleComputedRaw = [
          uProductName,
          uGameName ? `— ${uGameName}` : '',
          uTypeLabel ? `(${uTypeLabel})` : ''
        ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
        const titleComputed = titleComputedRaw ? capitalizeFirstPtBr(titleComputedRaw) : '';
        const descComputedRaw = [
          uProductName ? `Produto: ${uProductName}` : '',
          uGameName ? `Jogo: ${uGameName}` : '',
          uTypeLabel ? `Tipo: ${uTypeLabel}` : ''
        ].filter(Boolean).join(' | ').replace(/\s+/g, ' ').trim();
        const descComputed = descComputedRaw ? capitalizeFirstPtBr(descComputedRaw).slice(0, 200) : '';

        structured.innerHTML = `
          ${showGameAccountFields ? `
            <div class="space-y-4">
              <div class="p-4 bg-white border border-gray-200 rounded-xl space-y-4" data-ga-layer="layer1">
                <div class="flex items-center gap-2 text-gray-900 font-semibold">
                  <i class="fas fa-layer-group text-primary-600"></i>
                  Camada 1 — Identificação do produto
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm text-gray-700 font-medium mb-2">Tipo do jogo *</label>
                    <select name="game_account_type" required data-action="refreshCreateNegDynamicUI" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                      <option value="" ${gameType === '' ? 'selected' : ''}>Selecione</option>
                      <option value="mmorpg" ${gameType === 'mmorpg' ? 'selected' : ''}>MMORPG</option>
                      <option value="fps" ${gameType === 'fps' ? 'selected' : ''}>FPS</option>
                      <option value="moba" ${gameType === 'moba' ? 'selected' : ''}>MOBA</option>
                      <option value="battle_royale" ${gameType === 'battle_royale' ? 'selected' : ''}>Battle Royale</option>
                      <option value="mobile" ${gameType === 'mobile' ? 'selected' : ''}>Mobile</option>
                      <option value="estrategia" ${gameType === 'estrategia' ? 'selected' : ''}>Estratégia</option>
                      <option value="esporte" ${gameType === 'esporte' ? 'selected' : ''}>Esporte</option>
                      <option value="other" ${gameType === 'other' ? 'selected' : ''}>Outro</option>
                    </select>
                  </div>

                  <div>
                    <label class="block text-sm text-gray-700 font-medium mb-2">Plataforma *</label>
                    <select name="game_account_platform" required data-action="refreshCreateNegDynamicUI" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                      <option value="" ${String(getDraft('game_account_platform') || '').trim() === '' ? 'selected' : ''}>Selecione</option>
                      <option value="PC" ${String(getDraft('game_account_platform') || '').trim() === 'PC' ? 'selected' : ''}>PC</option>
                      <option value="PlayStation" ${String(getDraft('game_account_platform') || '').trim() === 'PlayStation' ? 'selected' : ''}>PlayStation</option>
                      <option value="Xbox" ${String(getDraft('game_account_platform') || '').trim() === 'Xbox' ? 'selected' : ''}>Xbox</option>
                      <option value="Mobile" ${String(getDraft('game_account_platform') || '').trim() === 'Mobile' ? 'selected' : ''}>Mobile</option>
                      <option value="Multiplataforma" ${String(getDraft('game_account_platform') || '').trim() === 'Multiplataforma' ? 'selected' : ''}>Multiplataforma</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label class="block text-sm text-gray-700 font-medium mb-2">Nome do jogo *</label>
                  <input type="text" name="game_account_game" required maxlength="80" value="${escapeAttr(getDraft('game_account_game'))}" placeholder="Ex: World of Warcraft" data-action="refreshCreateNegDynamicUI" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                </div>

                <input type="hidden" name="what_will_be_delivered" value="${escapeAttr(deliverableValue)}">
              </div>

              <!-- Camada 2 (Segurança) movida para o final para performance/fluidez -->

              ${isCompetitiveType ? `
                <div class="p-4 bg-white border border-gray-200 rounded-xl space-y-4" data-ga-layer="ranking">
                  <div class="flex items-center justify-between gap-3">
                    <div class="flex items-center gap-2 text-gray-900 font-semibold">
                      <i class="fas fa-trophy text-primary-600"></i>
                      Camada 3 — Ranking (universal)
                    </div>
                    <button type="button" class="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed" data-action="toggleGaLayer" data-key="ranking" ${canOpenRanking ? '' : 'disabled'}>
                      ${canOpenRanking ? ((activeKey === 'ranking' || uiOpen('ranking')) ? 'Ocultar' : 'Preencher agora') : 'Complete a Camada 1'}
                    </button>
                  </div>

                  ${(canOpenRanking && (activeKey === 'ranking' || uiOpen('ranking'))) ? `
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Tier atual *</label>
                        <select name="ga_rank_current_tier" required data-action="refreshCreateNegDynamicUI" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          <option value="" ${String(getDraft('ga_rank_current_tier') || '').trim() === '' ? 'selected' : ''}>Selecione</option>
                          ${['Bronze','Prata','Ouro','Platina','Diamante','Mestre','Grão-Mestre','Top Global','Outro'].map((t) => `<option value="${escapeAttr(t)}" ${String(getDraft('ga_rank_current_tier') || '').trim() === t ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}
                        </select>
                      </div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Score atual (MMR/LP/etc.)</label>
                        <input type="number" inputmode="numeric" name="ga_rank_current_score" value="${escapeAttr(getDraft('ga_rank_current_score'))}" placeholder="Ex: 2500" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                      </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Melhor tier já alcançado</label>
                        <select name="ga_rank_best_tier" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                          <option value="" ${String(getDraft('ga_rank_best_tier') || '').trim() === '' ? 'selected' : ''}>Selecione</option>
                          ${['Bronze','Prata','Ouro','Platina','Diamante','Mestre','Grão-Mestre','Top Global','Outro'].map((t) => `<option value="${escapeAttr(t)}" ${String(getDraft('ga_rank_best_tier') || '').trim() === t ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}
                        </select>
                      </div>
                      <div>
                        <label class="block text-sm text-gray-700 font-medium mb-2">Melhor score</label>
                        <input type="number" inputmode="numeric" name="ga_rank_best_score" value="${escapeAttr(getDraft('ga_rank_best_score'))}" placeholder="Ex: 2800" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                      </div>
                    </div>

                    <div class="space-y-2">
                      <div class="text-sm text-gray-700 font-medium">Participou de competitivo oficial?</div>
                      ${[
                        { v: '1', l: 'Sim' },
                        { v: '0', l: 'Não' },
                      ].map((opt) => `
                        <label class="flex items-center gap-2 text-sm text-gray-700">
                          <input type="radio" name="ga_rank_official" value="${opt.v}" ${String(getDraft('ga_rank_official') || '').trim() === opt.v ? 'checked' : ''}>
                          ${opt.l}
                        </label>
                      `).join('')}
                    </div>
                  ` : (canOpenRanking ? `
                    <div class="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3">
                      Clique em <strong>Preencher agora</strong> para abrir o ranking.
                    </div>
                  ` : `
                    <div class="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3">
                      Preencha a Camada 1 para liberar o ranking.
                    </div>
                  `)}
                </div>
              ` : ''}

              <div class="p-4 bg-white border border-gray-200 rounded-xl space-y-4" data-ga-layer="exclusive">
                <div class="flex items-center gap-2 text-gray-900 font-semibold">
                  <i class="fas fa-star text-primary-600"></i>
                  Camada 4 — Itens exclusivos / colecionáveis
                </div>

                <div class="flex items-center justify-between gap-3">
                  <div class="text-xs text-gray-600">Esta camada só abre após a anterior.</div>
                  <button type="button" class="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed" data-action="toggleGaLayer" data-key="exclusive" ${canOpenExclusive ? '' : 'disabled'}>
                    ${canOpenExclusive ? ((activeKey === 'exclusive' || uiOpen('exclusive')) ? 'Ocultar' : 'Preencher agora') : (isCompetitiveType ? 'Complete o Ranking' : 'Complete a Camada 1')}
                  </button>
                </div>

                ${(canOpenExclusive && (activeKey === 'exclusive' || uiOpen('exclusive'))) ? `

                <div class="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3">
                  Adicione as imagens dos itens cosméticos/exclusivos relevantes. Se tiver <strong>mais de um</strong> (ex: várias montarias), escreva os nomes na <strong>descrição</strong>.
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div class="space-y-2">
                    <div class="text-sm text-gray-700 font-medium">Possui itens exclusivos? *</div>
                    ${[
                      { v: '1', l: 'Sim' },
                      { v: '0', l: 'Não' },
                    ].map((opt) => `
                      <label class="flex items-center gap-2 text-sm text-gray-700">
                        <input type="radio" name="ga_has_exclusive_items" value="${opt.v}" ${hasExclusiveItems === opt.v ? 'checked' : ''} data-action="refreshCreateNegDynamicUI">
                        ${opt.l}
                      </label>
                    `).join('')}
                  </div>
                  <div class="flex items-end">
                    ${hasExclusiveItems === '1' ? `
                      <button type="button" class="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-800 font-semibold transition w-full" data-action="addExclusiveItem">
                        <i class="fas fa-plus mr-2"></i>Adicionar Imagem Exclusiva
                      </button>
                    ` : ''}
                  </div>
                </div>

                ${hasExclusiveItems === '1' ? `
                  <div class="space-y-3">
                    ${(exclusiveItems.length ? exclusiveItems : [{ type: '', name: '', rarity: '', description: '', preview: '' }]).map((it, idx) => `
                      <div class="p-3 rounded-xl border border-gray-200 bg-gray-50 space-y-3">
                        <div class="flex items-center justify-between gap-3">
                          <div class="text-sm font-semibold text-gray-900">Item #${idx + 1}</div>
                          ${exclusiveItems.length ? `<button type="button" class="text-xs text-danger-600 hover:text-danger-700" data-action="removeExclusiveItem" data-index="${idx}">Remover</button>` : ''}
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label class="block text-xs text-gray-600 font-medium mb-1">Imagem *</label>
                            <div class="flex items-center gap-3">
                              ${it?.preview ? `<img src="${escapeAttr(it.preview)}" class="w-14 h-14 rounded-lg object-cover border border-gray-200" />` : '<div class="w-14 h-14 rounded-lg bg-white border border-dashed border-gray-300"></div>'}
                              <label class="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 cursor-pointer hover:bg-gray-100 transition">
                                Selecionar
                                <input type="file" accept="image/jpeg,image/png,image/webp" class="hidden" data-action="setExclusiveItemImage" data-index="${idx}">
                              </label>
                            </div>
                          </div>
                          <div>
                            <label class="block text-xs text-gray-600 font-medium mb-1">Descrição (opcional)</label>
                            <input type="text" class="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-800" value="${escapeAttr(it?.description || '')}" data-action="updateExclusiveItemField" data-index="${idx}" data-field="description" placeholder="Ex: Montaria A, Montaria B, Skin X..." />
                          </div>
                        </div>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
                ` : (canOpenExclusive ? `
                  <div class="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3">
                    Clique em <strong>Preencher agora</strong> para abrir esta camada.
                  </div>
                ` : `
                  <div class="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3">
                    Complete a camada anterior para liberar esta.
                  </div>
                `)}
              </div>

              <div class="p-4 bg-white border border-gray-200 rounded-xl space-y-4" data-ga-layer="specific">
                <div class="flex items-center gap-2 text-gray-900 font-semibold">
                  <i class="fas fa-sliders-h text-primary-600"></i>
                  Camada 5 — Dados específicos por tipo
                </div>

                <div class="flex items-center justify-between gap-3">
                  <div class="text-xs text-gray-600">Libera após itens exclusivos.</div>
                  <button type="button" class="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed" data-action="toggleGaLayer" data-key="specific" ${canOpenSpecific ? '' : 'disabled'}>
                    ${canOpenSpecific ? ((activeKey === 'specific' || uiOpen('specific')) ? 'Ocultar' : 'Preencher agora') : 'Complete a Camada 4'}
                  </button>
                </div>

                ${(canOpenSpecific && (activeKey === 'specific' || uiOpen('specific'))) ? `

                ${gameType === 'mmorpg' ? `
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm text-gray-700 font-medium mb-2">Nível médio da conta *</label>
                      <input type="number" inputmode="numeric" name="ts_mm_avg_level" required value="${escapeAttr(getDraft('ts_mm_avg_level'))}" data-action="refreshCreateNegDynamicUI" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800">
                    </div>
                    <div>
                      <label class="block text-sm text-gray-700 font-medium mb-2">Possui conteúdo endgame *</label>
                      <select name="ts_mm_endgame" required data-action="refreshCreateNegDynamicUI" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700">
                        <option value="" ${String(getDraft('ts_mm_endgame') || '').trim() === '' ? 'selected' : ''}>Selecione</option>
                        <option value="yes" ${String(getDraft('ts_mm_endgame') || '').trim() === 'yes' ? 'selected' : ''}>Sim</option>
                        <option value="partial" ${String(getDraft('ts_mm_endgame') || '').trim() === 'partial' ? 'selected' : ''}>Parcial</option>
                        <option value="no" ${String(getDraft('ts_mm_endgame') || '').trim() === 'no' ? 'selected' : ''}>Não</option>
                      </select>
                    </div>
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm text-gray-700 font-medium mb-2">Tempo aproximado de jogo *</label>
                      <select name="ts_mm_playtime" required data-action="refreshCreateNegDynamicUI" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700">
                        <option value="" ${String(getDraft('ts_mm_playtime') || '').trim() === '' ? 'selected' : ''}>Selecione</option>
                        <option value="low" ${String(getDraft('ts_mm_playtime') || '').trim() === 'low' ? 'selected' : ''}>Baixo</option>
                        <option value="medium" ${String(getDraft('ts_mm_playtime') || '').trim() === 'medium' ? 'selected' : ''}>Médio</option>
                        <option value="high" ${String(getDraft('ts_mm_playtime') || '').trim() === 'high' ? 'selected' : ''}>Alto</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-sm text-gray-700 font-medium mb-2">Personagens ativos (aprox.)</label>
                      <input type="number" inputmode="numeric" name="ts_mm_characters_count" value="${escapeAttr(getDraft('ts_mm_characters_count'))}" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800">
                    </div>
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm text-gray-700 font-medium mb-2">Possui builds/classes completas *</label>
                      <select name="ts_mm_complete_builds" required data-action="refreshCreateNegDynamicUI" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700">
                        <option value="" ${String(getDraft('ts_mm_complete_builds') || '').trim() === '' ? 'selected' : ''}>Selecione</option>
                        <option value="yes" ${String(getDraft('ts_mm_complete_builds') || '').trim() === 'yes' ? 'selected' : ''}>Sim</option>
                        <option value="partial" ${String(getDraft('ts_mm_complete_builds') || '').trim() === 'partial' ? 'selected' : ''}>Parcial</option>
                        <option value="no" ${String(getDraft('ts_mm_complete_builds') || '').trim() === 'no' ? 'selected' : ''}>Não</option>
                      </select>
                    </div>
                    <div class="space-y-2">
                      <div class="text-sm text-gray-700 font-medium">Possui moeda relevante acumulada? *</div>
                      ${[
                        { v: '1', l: 'Sim' },
                        { v: '0', l: 'Não' },
                      ].map((opt) => `
                        <label class="flex items-center gap-2 text-sm text-gray-700">
                          <input type="radio" name="ts_mm_has_currency" value="${opt.v}" ${String(getDraft('ts_mm_has_currency') || '').trim() === opt.v ? 'checked' : ''} data-action="refreshCreateNegDynamicUI">
                          ${opt.l}
                        </label>
                      `).join('')}
                    </div>
                  </div>
                  <div>
                    <label class="block text-sm text-gray-700 font-medium mb-2">Itens lendários/raros (opcional)</label>
                    <textarea name="ts_mm_legendary_items" rows="3" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 resize-none">${escapeHtml(getDraft('ts_mm_legendary_items'))}</textarea>
                  </div>
                ` : ''}

                ${gameType === 'fps' ? `
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm text-gray-700 font-medium mb-2">Nível da conta *</label>
                      <input type="number" inputmode="numeric" name="ts_fps_level" required value="${escapeAttr(getDraft('ts_fps_level'))}" data-action="refreshCreateNegDynamicUI" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800">
                    </div>
                    <div>
                      <label class="block text-sm text-gray-700 font-medium mb-2">Tempo de jogo aproximado</label>
                      <select name="ts_fps_playtime" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700">
                        <option value="" ${String(getDraft('ts_fps_playtime') || '').trim() === '' ? 'selected' : ''}>Selecione</option>
                        <option value="low" ${String(getDraft('ts_fps_playtime') || '').trim() === 'low' ? 'selected' : ''}>Baixo</option>
                        <option value="medium" ${String(getDraft('ts_fps_playtime') || '').trim() === 'medium' ? 'selected' : ''}>Médio</option>
                        <option value="high" ${String(getDraft('ts_fps_playtime') || '').trim() === 'high' ? 'selected' : ''}>Alto</option>
                      </select>
                    </div>
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm text-gray-700 font-medium mb-2">K/D médio</label>
                      <input type="number" step="0.01" inputmode="decimal" name="ts_fps_kd" value="${escapeAttr(getDraft('ts_fps_kd'))}" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800">
                    </div>
                    <div>
                      <label class="block text-sm text-gray-700 font-medium mb-2">Taxa de vitória (%)</label>
                      <input type="number" step="0.01" inputmode="decimal" name="ts_fps_win_rate" value="${escapeAttr(getDraft('ts_fps_win_rate'))}" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800">
                    </div>
                  </div>
                ` : ''}

                ${gameType === 'moba' ? `
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm text-gray-700 font-medium mb-2">Nível da conta</label>
                      <input type="number" inputmode="numeric" name="ts_moba_level" value="${escapeAttr(getDraft('ts_moba_level'))}" data-action="refreshCreateNegDynamicUI" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800">
                    </div>
                    <div>
                      <label class="block text-sm text-gray-700 font-medium mb-2">Qtd. de personagens liberados</label>
                      <input type="number" inputmode="numeric" name="ts_moba_chars_unlocked" value="${escapeAttr(getDraft('ts_moba_chars_unlocked'))}" data-action="refreshCreateNegDynamicUI" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800">
                    </div>
                  </div>
                ` : ''}

                ${gameType === 'battle_royale' ? `
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm text-gray-700 font-medium mb-2">Nível da conta *</label>
                      <input type="number" inputmode="numeric" name="ts_br_level" required value="${escapeAttr(getDraft('ts_br_level'))}" data-action="refreshCreateNegDynamicUI" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800">
                    </div>
                    <div class="space-y-2">
                      <div class="text-sm text-gray-700 font-medium">Participou de temporadas antigas? *</div>
                      ${[
                        { v: '1', l: 'Sim' },
                        { v: '0', l: 'Não' },
                      ].map((opt) => `
                        <label class="flex items-center gap-2 text-sm text-gray-700">
                          <input type="radio" name="ts_br_old_seasons" value="${opt.v}" ${String(getDraft('ts_br_old_seasons') || '').trim() === opt.v ? 'checked' : ''} data-action="refreshCreateNegDynamicUI">
                          ${opt.l}
                        </label>
                      `).join('')}
                    </div>
                  </div>
                  <div class="space-y-2">
                    <div class="text-sm text-gray-700 font-medium">Possui passes antigos completos? *</div>
                    ${[
                      { v: '1', l: 'Sim' },
                      { v: '0', l: 'Não' },
                    ].map((opt) => `
                      <label class="flex items-center gap-2 text-sm text-gray-700">
                        <input type="radio" name="ts_br_old_passes" value="${opt.v}" ${String(getDraft('ts_br_old_passes') || '').trim() === opt.v ? 'checked' : ''} data-action="refreshCreateNegDynamicUI">
                        ${opt.l}
                      </label>
                    `).join('')}
                  </div>
                ` : ''}

                ${gameType === 'mobile' ? `
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm text-gray-700 font-medium mb-2">Nível da conta *</label>
                      <input type="number" inputmode="numeric" name="ts_mobile_level" required value="${escapeAttr(getDraft('ts_mobile_level'))}" data-action="refreshCreateNegDynamicUI" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800">
                    </div>
                    <div>
                      <label class="block text-sm text-gray-700 font-medium mb-2">Rank competitivo</label>
                      <input type="text" name="ts_mobile_rank" value="${escapeAttr(getDraft('ts_mobile_rank'))}" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800">
                    </div>
                  </div>
                  <div>
                    <label class="block text-sm text-gray-700 font-medium mb-2">Vinculação da conta</label>
                    <select name="ts_mobile_link" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700">
                      <option value="" ${String(getDraft('ts_mobile_link') || '').trim() === '' ? 'selected' : ''}>Selecione</option>
                      <option value="google_play" ${String(getDraft('ts_mobile_link') || '').trim() === 'google_play' ? 'selected' : ''}>Google Play</option>
                      <option value="apple_id" ${String(getDraft('ts_mobile_link') || '').trim() === 'apple_id' ? 'selected' : ''}>Apple ID</option>
                      <option value="facebook" ${String(getDraft('ts_mobile_link') || '').trim() === 'facebook' ? 'selected' : ''}>Facebook</option>
                      <option value="other" ${String(getDraft('ts_mobile_link') || '').trim() === 'other' ? 'selected' : ''}>Outro</option>
                    </select>
                  </div>
                ` : ''}

                ${gameType === 'estrategia' ? `
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm text-gray-700 font-medium mb-2">Nível da base/cidade principal *</label>
                      <input type="number" inputmode="numeric" name="ts_strat_base_level" required value="${escapeAttr(getDraft('ts_strat_base_level'))}" data-action="refreshCreateNegDynamicUI" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800">
                    </div>
                    <div>
                      <label class="block text-sm text-gray-700 font-medium mb-2">Poder total da conta</label>
                      <input type="number" inputmode="numeric" name="ts_strat_power_total" value="${escapeAttr(getDraft('ts_strat_power_total'))}" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800">
                    </div>
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="space-y-2">
                      <div class="text-sm text-gray-700 font-medium">Participou de alianças relevantes? *</div>
                      ${[
                        { v: '1', l: 'Sim' },
                        { v: '0', l: 'Não' },
                      ].map((opt) => `
                        <label class="flex items-center gap-2 text-sm text-gray-700">
                          <input type="radio" name="ts_strat_alliances" value="${opt.v}" ${String(getDraft('ts_strat_alliances') || '').trim() === opt.v ? 'checked' : ''} data-action="refreshCreateNegDynamicUI">
                          ${opt.l}
                        </label>
                      `).join('')}
                    </div>
                    <div>
                      <label class="block text-sm text-gray-700 font-medium mb-2">Recursos acumulados relevantes</label>
                      <input type="text" name="ts_strat_resources" value="${escapeAttr(getDraft('ts_strat_resources'))}" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800">
                    </div>
                  </div>
                ` : ''}

                ${gameType === 'esporte' ? `
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm text-gray-700 font-medium mb-2">Nível da conta *</label>
                      <input type="number" inputmode="numeric" name="ts_sport_level" required value="${escapeAttr(getDraft('ts_sport_level'))}" data-action="refreshCreateNegDynamicUI" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800">
                    </div>
                    <div>
                      <label class="block text-sm text-gray-700 font-medium mb-2">Ranking online</label>
                      <input type="text" name="ts_sport_online_ranking" value="${escapeAttr(getDraft('ts_sport_online_ranking'))}" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800">
                    </div>
                  </div>
                  <div>
                    <label class="block text-sm text-gray-700 font-medium mb-2">Jogadores/cartas raras ou elenco relevante</label>
                    <textarea name="ts_sport_rare_cards" rows="3" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 resize-none">${escapeHtml(getDraft('ts_sport_rare_cards'))}</textarea>
                  </div>
                ` : ''}

                ${gameType === 'other' ? `
                  <div>
                    <label class="block text-sm text-gray-700 font-medium mb-2">Progressão geral *</label>
                    <textarea name="ts_other_progression_general" rows="3" required data-action="refreshCreateNegDynamicUI" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 resize-none">${escapeHtml(getDraft('ts_other_progression_general'))}</textarea>
                  </div>
                  <div>
                    <label class="block text-sm text-gray-700 font-medium mb-2">Conteúdo principal</label>
                    <textarea name="ts_other_main_content" rows="3" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 resize-none">${escapeHtml(getDraft('ts_other_main_content'))}</textarea>
                  </div>
                  <div class="space-y-2">
                    <div class="text-sm text-gray-700 font-medium">Possui competitivo? *</div>
                    ${[
                      { v: '1', l: 'Sim' },
                      { v: '0', l: 'Não' },
                    ].map((opt) => `
                      <label class="flex items-center gap-2 text-sm text-gray-700">
                          <input type="radio" name="ts_other_has_competitive" value="${opt.v}" ${String(getDraft('ts_other_has_competitive') || '').trim() === opt.v ? 'checked' : ''} data-action="refreshCreateNegDynamicUI">
                        ${opt.l}
                      </label>
                    `).join('')}
                  </div>
                ` : ''}

                ${!gameType ? `<div class="text-sm text-gray-600">Selecione o tipo do jogo para ver os campos específicos.</div>` : ''}
                ` : (canOpenSpecific ? `
                  <div class="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3">
                    Clique em <strong>Preencher agora</strong> para abrir esta camada.
                  </div>
                ` : `
                  <div class="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3">
                    Complete a Camada 4 para liberar esta.
                  </div>
                `)}
              </div>

              <div class="p-4 bg-white border border-gray-200 rounded-xl space-y-4" data-ga-layer="security" data-ga-security-layer>
                <div class="flex items-center justify-between gap-3">
                  <div class="flex items-center gap-2 text-gray-900 font-semibold">
                    <i class="fas fa-shield-alt text-primary-600"></i>
                    Camada 2 — Segurança da conta (por último)
                  </div>
                  <button type="button" class="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed" data-action="toggleGaLayer" data-key="security" ${canOpenSecurity ? '' : 'disabled'}>
                    ${canOpenSecurity ? ((activeKey === 'security' || uiOpen('security')) ? 'Ocultar' : 'Preencher agora') : 'Complete a Camada 5'}
                  </button>
                </div>

                ${(canOpenSecurity && (activeKey === 'security' || uiOpen('security'))) ? `
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="space-y-2">
                      <div class="text-sm text-gray-700 font-medium">Primeiro dono da conta *</div>
                      <label class="flex items-center gap-2 text-sm text-gray-700">
                        <input type="radio" name="game_account_first_owner" value="1" ${firstOwner === '1' ? 'checked' : ''}>
                        Sim
                      </label>
                      <label class="flex items-center gap-2 text-sm text-gray-700">
                        <input type="radio" name="game_account_first_owner" value="0" ${firstOwner === '0' ? 'checked' : ''}>
                        Não
                      </label>
                    </div>

                    <div class="space-y-2">
                      <div class="text-sm text-gray-700 font-medium">Possui acesso ao e-mail original *</div>
                      <label class="flex items-center gap-2 text-sm text-gray-700">
                        <input type="radio" name="game_account_has_original_email" value="1" ${hasOriginalEmail === '1' ? 'checked' : ''}>
                        Sim
                      </label>
                      <label class="flex items-center gap-2 text-sm text-gray-700">
                        <input type="radio" name="game_account_has_original_email" value="0" ${hasOriginalEmail === '0' ? 'checked' : ''}>
                        Não
                      </label>
                    </div>
                  </div>

                  <div>
                    <div class="text-sm text-gray-700 font-medium mb-2">Conta possui vinculações externas *</div>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      ${[
                        { id: 'google', label: 'Google' },
                        { id: 'facebook', label: 'Facebook' },
                        { id: 'steam', label: 'Steam' },
                        { id: 'apple', label: 'Apple' },
                        { id: 'riot', label: 'Riot' },
                        { id: 'activision', label: 'Activision' },
                        { id: 'epic', label: 'Epic Games' },
                        { id: 'none', label: 'Nenhuma' },
                      ].map((opt) => `
                        <label class="flex items-center gap-2 p-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700">
                          <input type="checkbox" name="game_account_linked_providers[]" value="${opt.id}" ${linkedProviders.includes(opt.id) ? 'checked' : ''}>
                          ${opt.label}
                        </label>
                      `).join('')}
                    </div>
                    <p class="text-xs text-gray-500 mt-2">Marque pelo menos 1 opção (use “Nenhuma” se não houver).</p>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="space-y-2">
                      <div class="text-sm text-gray-700 font-medium">Pode alterar e-mail e senha *</div>
                      ${[
                        { v: 'yes', l: 'Sim' },
                        { v: 'no', l: 'Não' },
                        { v: 'partial', l: 'Parcialmente' },
                      ].map((opt) => `
                        <label class="flex items-center gap-2 text-sm text-gray-700">
                          <input type="radio" name="game_account_can_change_credentials" value="${opt.v}" ${String(getDraft('game_account_can_change_credentials') || '').trim() === opt.v ? 'checked' : ''}>
                          ${opt.l}
                        </label>
                      `).join('')}
                    </div>

                    <div>
                      <label class="block text-sm text-gray-700 font-medium mb-2">Histórico de punições *</label>
                      <select name="game_account_punishment_history" required class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                        <option value="" ${String(getDraft('game_account_punishment_history') || '').trim() === '' ? 'selected' : ''}>Selecione</option>
                        <option value="none" ${String(getDraft('game_account_punishment_history') || '').trim() === 'none' ? 'selected' : ''}>Nenhuma</option>
                        <option value="warning" ${String(getDraft('game_account_punishment_history') || '').trim() === 'warning' ? 'selected' : ''}>Advertência</option>
                        <option value="temp_suspension" ${String(getDraft('game_account_punishment_history') || '').trim() === 'temp_suspension' ? 'selected' : ''}>Suspensão temporária</option>
                        <option value="permanent_ban" ${String(getDraft('game_account_punishment_history') || '').trim() === 'permanent_ban' ? 'selected' : ''}>Ban permanente</option>
                      </select>
                    </div>
                  </div>
                ` : (canOpenSecurity ? `
                  <div class="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3">
                    Clique em <strong>Preencher agora</strong> para abrir a segurança.
                  </div>
                ` : `
                  <div class="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3">
                    Para liberar a segurança da conta, complete a Camada 7 (Entrega).
                  </div>
                `)}
              </div>
            </div>
          ` : ''}

          ${useUniversalGameProductFlow ? `
            <div class="p-4 bg-white border border-gray-200 rounded-xl space-y-4">
              <div class="flex items-center gap-2 text-gray-900 font-semibold">
                <i class="fas fa-layer-group text-primary-600"></i>
                Dados universais (qualquer jogo)
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm text-gray-700 font-medium mb-2">Tipo do jogo *</label>
                  <select name="universal_game_type" required data-action="refreshCreateNegDynamicUI" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                    <option value="" ${uGameType ? '' : 'selected'}>Selecione</option>
                    ${UNIVERSAL_GAME_TYPES.map((t) => `<option value="${escapeAttr(t.v)}" ${uGameType === t.v ? 'selected' : ''}>${escapeHtml(t.l)}</option>`).join('')}
                  </select>
                </div>
                <div>
                  <label class="block text-sm text-gray-700 font-medium mb-2">Nome do jogo *</label>
                  <input type="text" name="universal_game_name" required maxlength="80" value="${escapeAttr(uGameName)}" placeholder="Ex: Fortnite" data-action="refreshCreateNegDynamicUI" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                </div>
              </div>

              <div>
                <label class="block text-sm text-gray-700 font-medium mb-2">Nome do produto *</label>
                <input type="text" name="universal_product_name" required maxlength="120" value="${escapeAttr(uProductName)}" placeholder="Ex: Skin rara / Item / Pacote" data-action="refreshCreateNegDynamicUI" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                <p class="text-xs text-gray-500 mt-1">O título e (quando necessário) a descrição são gerados automaticamente.</p>
              </div>

              <input type="hidden" name="title" value="${escapeAttr(titleComputed)}">
              ${(selectedCategory === CATEGORY_SKIN || selectedCategory === CATEGORY_ITEM) ? `<input type="hidden" name="game_title" value="${escapeAttr(uGameName)}">` : ''}
              ${selectedCategory === CATEGORY_ITEM ? `<input type="hidden" name="item_name" value="${escapeAttr(uProductName)}">\n<input type="hidden" name="item_general_info" value="${escapeAttr(uProductName)}">` : ''}
              ${selectedCategory === CATEGORY_SKIN ? `<input type="hidden" name="description" value="${escapeAttr(descComputed)}">` : ''}
            </div>
          ` : ''}

          ${(!useUniversalGameProductFlow && showSkinFields) ? `
            <div class="p-4 bg-white border border-gray-200 rounded-xl space-y-3">
              <div class="flex items-center gap-2 text-gray-900 font-semibold">
                <i class="fas fa-gamepad text-primary-600"></i>
                Dados do item (skin)
              </div>
              <div>
                <label class="block text-sm text-gray-700 font-medium mb-2">Nome do jogo *</label>
                <input type="text" name="game_title" required value="${escapeAttr(getDraft('game_title'))}" placeholder="Ex: Fortnite" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
              </div>
            </div>
          ` : ''}

          ${(!useUniversalGameProductFlow && showItemFields) ? `
            <div class="p-4 bg-white border border-gray-200 rounded-xl space-y-4">
              <div class="flex items-center gap-2 text-gray-900 font-semibold">
                <i class="fas fa-dice-d20 text-primary-600"></i>
                Dados do item (in-game)
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm text-gray-700 font-medium mb-2">Nome do jogo *</label>
                  <input type="text" name="game_title" required value="${escapeAttr(getDraft('game_title'))}" placeholder="Ex: Path of Exile" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                </div>
                <div>
                  <label class="block text-sm text-gray-700 font-medium mb-2">Nome do item *</label>
                  <input type="text" name="item_name" required value="${escapeAttr(getDraft('item_name'))}" placeholder="Ex: Espada Lendária" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                </div>
              </div>
              <div>
                <label class="block text-sm text-gray-700 font-medium mb-2">Informações gerais *</label>
                <textarea name="item_general_info" rows="2" required maxlength="1000" placeholder="Ex: nível do item, atributos, raridade, restrições de região/servidor." class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all resize-none">${escapeHtml(getDraft('item_general_info'))}</textarea>
              </div>
            </div>
          ` : ''}
        `;
      }

      if (description instanceof HTMLElement) {
        description.innerHTML = showDescription ? `
          <div>
            <label class="block text-sm text-gray-700 font-medium mb-2">${isPhysicalType ? 'Descrição detalhada *' : 'Descrição curta (o que será entregue?) *'}</label>
            <textarea name="description" rows="${isPhysicalType ? 6 : 2}" required maxlength="${isPhysicalType ? 2000 : 200}" placeholder="${isPhysicalType ? 'Ex: Notebook Samsung (modelo X), 8GB RAM/256GB SSD, usado, sem trincados, carregamento OK, som OK, nunca foi para assistência.' : 'Ex: Conta nível 80 com 3 skins lendárias'}" data-focus-key="create-neg-description" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all resize-none">${escapeHtml(getDraft('description'))}</textarea>
            <p class="text-xs text-gray-500 mt-1">${isPhysicalType ? 'Máx. 2000 caracteres.' : 'Máx. 200 caracteres. Evite dados sensíveis.'}</p>
            ${isPhysicalType ? `
              <div class="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div class="text-sm font-semibold text-gray-800 mb-1">Guia do que detalhar (produto físico)</div>
                <div class="text-xs text-gray-600">
                  Descreva exatamente a condição do produto para evitar complicações futuras na intermediação:
                  <ul class="list-disc pl-5 mt-2 space-y-1">
                    <li>Marca, modelo e especificações (memória/armazenamento, etc.)</li>
                    <li>Condição geral (riscos, amassados, trincados, manchas)</li>
                    <li>Se já foi para assistência e se alguma peça já foi trocada</li>
                    <li>Funcionamento: som, carregamento, tela, botões/entradas</li>
                    <li>Se a memória/armazenamento é a mesma informada</li>
                    <li>Acessórios inclusos (carregador, caixa, nota) e defeitos conhecidos</li>
                  </ul>
                </div>
              </div>
            ` : ''}
          </div>
        ` : '';
      }

      if (currency instanceof HTMLElement) {
        const sellerTimesDraft = getDraftArray('gold_seller_time_options');

        currency.innerHTML = showCurrencyFields ? `
          <div class="p-4 bg-white border border-gray-200 rounded-xl space-y-4">
            <div class="flex items-center gap-2 text-gray-900 font-semibold">
              <i class="fas fa-coins text-primary-600"></i>
              Dados da moeda (obrigatório)
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm text-gray-700 font-medium mb-2">Jogo *</label>
                <input type="text" name="digital_game" required value="${escapeAttr(getDraft('digital_game'))}" placeholder="Ex: World of Warcraft" data-action="updateNegFormField" data-field="digitalGame" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
              </div>
              <div>
                <label class="block text-sm text-gray-700 font-medium mb-2">Servidor *</label>
                <input type="text" name="digital_platform_server" required value="${escapeAttr(getDraft('digital_platform_server'))}" placeholder="Ex: Azralon" data-action="updateNegFormField" data-field="digitalPlatformServer" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm text-gray-700 font-medium mb-2">Quantidade da moeda *</label>
                <input type="text" name="digital_quantity" required inputmode="numeric" autocomplete="off" value="${escapeAttr(getDraft('digital_quantity') || getDraft('digitalQuantity'))}" placeholder="Ex: 1.000,00" data-action="updateNegFormField" data-field="digitalQuantity" data-focus-key="create-neg-digital-qty" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                <p class="text-xs text-gray-500 mt-1">Digite apenas números. Formato: 1.000,00</p>
              </div>
              <div>
                <label class="block text-sm text-gray-700 font-medium mb-2">Servidor *</label>
                <input type="text" name="digital_platform_server" required value="${escapeAttr(getDraft('digital_platform_server'))}" placeholder="Ex: Azralon" data-action="updateNegFormField" data-field="digitalPlatformServer" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
              </div>
            </div>

            <div>
              <label class="block text-sm text-gray-700 font-medium mb-2">Método de entrega *</label>
              <select name="digital_delivery_method" required data-action="updateNegFormField" data-field="digitalDeliveryMethod" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                <option value="" ${getDraft('digital_delivery_method') === '' ? 'selected' : ''}>Selecione</option>
                <option value="trade" ${getDraft('digital_delivery_method') === 'trade' ? 'selected' : ''}>Trade (troca/encontro no jogo)</option>
                <option value="mail" ${getDraft('digital_delivery_method') === 'mail' ? 'selected' : ''}>Correio do jogo (mail)</option>
                <option value="gift" ${getDraft('digital_delivery_method') === 'gift' ? 'selected' : ''}>Presente (gift)</option>
              </select>
              <p class="text-xs text-gray-500 mt-1">Escolha como o Gold/Coins será entregue dentro do jogo.</p>
            </div>

            <div>
              <label class="block text-sm text-gray-700 font-medium mb-2">Horários disponíveis para entrega (até 3) *</label>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                ${Array.from({ length: 3 }).map((_, idx) => `
                  <input type="time" name="gold_seller_time_options[]" value="${escapeAttr(sellerTimesDraft[idx] || '')}" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                `).join('')}
              </div>
              <p class="text-xs text-gray-500 mt-1">O comprador escolherá 1 opção clicando no horário preferido.</p>
            </div>
          </div>
        ` : '';
      }

      if (serviceSchedule instanceof HTMLElement) {
        const step = Math.max(1, Math.min(4, Number(state.createNegStep) || 1));
        const serviceDateDraft = normalizeDateOptions(getDraftArray('service_seller_start_date_options'), 3);
        const serviceRangesDraft = normalizeTimeRangeOptions(getDraftArray('service_seller_time_range_options'), 3);

        // Keep scheduling on Step 3 only (so Step 2 doesn't get too long)
        if (!showServiceScheduleFields || step !== 3) {
          serviceSchedule.innerHTML = '';
        } else {
          serviceSchedule.innerHTML = `
            <div class="p-4 bg-white border border-gray-200 rounded-xl space-y-4">
              <div class="flex items-center gap-2 text-gray-900 font-semibold">
                <i class="fas fa-calendar-alt text-primary-600"></i>
                Agendamento do serviço (obrigatório)
              </div>

              <div>
                <label class="block text-sm text-gray-700 font-medium mb-2">Datas de início (até 3) *</label>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  ${Array.from({ length: 3 }).map((_, idx) => `
                    <input type="date" name="service_seller_start_date_options[]" value="${escapeAttr(serviceDateDraft[idx] || '')}" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                  `).join('')}
                </div>
                <p class="text-xs text-gray-500 mt-1">O comprador vai escolher 1 data no convite.</p>
              </div>

              <div>
                <label class="block text-sm text-gray-700 font-medium mb-2">Intervalos de horário (início/fim) (até 3) *</label>
                <div class="space-y-2">
                  ${Array.from({ length: 3 }).map((_, idx) => {
                    const raw = String(serviceRangesDraft[idx] || '').trim();
                    const parts = raw.includes('-') ? raw.split('-') : [];
                    const start = parts[0] || '';
                    const end = parts[1] || '';
                    return `
                      <div class="grid grid-cols-2 gap-3">
                        <div>
                          <input type="time" name="service_seller_time_range_start[]" value="${escapeAttr(start)}" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" placeholder="Início">
                        </div>
                        <div>
                          <input type="time" name="service_seller_time_range_end[]" value="${escapeAttr(end)}" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" placeholder="Fim">
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
                <p class="text-xs text-gray-500 mt-1">Ex: 19:00–21:00. O fim deve ser maior que o início.</p>
              </div>
            </div>
          `;
        }
      }

      if (photos instanceof HTMLElement) {
        photos.innerHTML = showPhotos ? `
          <div class="space-y-2">
            <label class="block text-sm text-gray-700 font-medium">
              ${isPhysicalType ? `Imagens do produto (opcional) (até ${maxImages} imagens)` : `${selectedCategory === CATEGORY_GAME_ACCOUNT ? 'Imagens da conta' : 'Imagens do item/skin'} (até ${maxImages} imagens) *`}
            </label>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              ${photosHtml}
              ${productPhotos.length < maxImages ? `
                <label class="w-full h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition">
                  <i class="fas fa-camera text-gray-400 text-xl mb-1"></i>
                  <span class="text-xs text-gray-400">Adicionar</span>
                  <input type="file" accept="image/*" multiple class="hidden" data-action="addProductPhotos">
                </label>
              ` : ''}
            </div>
            ${state.createNegForm?.photoError ? `<p class="text-xs text-danger-500"><i class="fas fa-exclamation-circle mr-1"></i>${state.createNegForm.photoError}</p>` : ''}
            <p class="text-xs text-gray-400">${isPhysicalType ? 'Recomendado: fotos de frente/verso, laterais, tela ligada, acessórios e qualquer defeito.' : `Mínimo recomendado: ${minImages}.`} Formatos: JPG, PNG. Máx 5MB cada.</p>
          </div>
        ` : '';
      }

      if (deadline instanceof HTMLElement) {
        deadline.innerHTML = renderCreateNegotiationDeadlineField();
      }

      if (feeGuide instanceof HTMLElement) {
        feeGuide.innerHTML = state.showCreateFeeGuide ? `
          <div class="p-4 bg-white border border-gray-200 rounded-xl">
            <div class="flex items-center justify-between gap-3 mb-3">
              <h3 class="text-sm font-bold text-gray-900">Guia de taxas – Itens digitais</h3>
              <button type="button" class="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition" data-action="toggleCreateFeeGuide">Fechar</button>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-4 gap-2 text-sm">
              <div class="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <div class="font-semibold text-gray-900">Até R$ 50</div>
                <div class="text-gray-600">Taxa R$ 3,00</div>
              </div>
              <div class="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <div class="font-semibold text-gray-900">R$ 50,01 a R$ 150</div>
                <div class="text-gray-600">Taxa R$ 5,00</div>
              </div>
              <div class="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <div class="font-semibold text-gray-900">R$ 150,01 a R$ 350</div>
                <div class="text-gray-600">Taxa R$ 10,00</div>
              </div>
              <div class="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <div class="font-semibold text-gray-900">Acima de R$ 350</div>
                <div class="text-gray-600">Taxa R$ 15,00</div>
              </div>
            </div>
            <p class="text-xs text-gray-500 mt-3">📌 Taxa descontada automaticamente após a conclusão da venda.</p>
          </div>
        ` : '';
      }
    } catch {
      // ignore
    }
  }

  function updateCreateFeeSummaryUI() {
    try {
      if (!state.showCreateNegotiationModal) return;
      const root = document.getElementById('app');
      if (!root) return;
      const form = root.querySelector('form[data-action="createNegotiation"]');
      if (!(form instanceof HTMLFormElement)) return;

      const priceEl = form.querySelector('input[name="price"]');
      if (!(priceEl instanceof HTMLInputElement)) return;

      const feeEl = form.querySelector('[data-create-fee]');
      const netEl = form.querySelector('[data-create-net]');
      const totalEl = form.querySelector('[data-create-total]');
      const feeModeLabelEl = form.querySelector('[data-create-fee-mode-label]');

      const draftPrice = priceEl.value;
      const priceNum = Math.max(0, parsePtBrMoney(draftPrice));
      const fee = priceNum > 0 ? getDigitalFeeByPrice(priceNum) : 0;

      const feeModeChecked = form.querySelector('input[name="seller_fee_mode"]:checked');
      const feeMode = feeModeChecked instanceof HTMLInputElement ? String(feeModeChecked.value || 'deduct') : 'deduct';
      const deductFee = feeMode === 'deduct';

      const net = priceNum > 0 ? (deductFee ? Math.max(0, priceNum - fee) : priceNum) : 0;
      const feeText = `R$ ${(fee || 0).toFixed(2).replace('.', ',')}`;
      const netText = `R$ ${(net || 0).toFixed(2).replace('.', ',')}`;
      const totalText = `R$ ${(priceNum || 0).toFixed(2).replace('.', ',')}`;
      const feeModeText = deductFee ? 'descontada do valor recebido' : 'paga via Pix separado';

      if (feeEl) feeEl.textContent = feeText;
      if (netEl) netEl.textContent = netText;
      if (totalEl) totalEl.textContent = totalText;
      if (feeModeLabelEl) feeModeLabelEl.textContent = `(${feeModeText})`;
    } catch {
      // ignore
    }
  }

  function categoryRequiresImages(category) {
    const c = String(category || '').trim();
    return c === CATEGORY_GAME_ACCOUNT || c === CATEGORY_SKIN || c === CATEGORY_ITEM;
  }

  function isPhysicalCategory(category) {
    const c = String(category || '').trim();
    return PHYSICAL_PRODUCT_CATEGORIES.includes(c);
  }

  function categoryAllowsImages(category, negotiationType) {
    const type = String(negotiationType || '').trim();
    const c = String(category || '').trim();
    if (type === 'physical' && isPhysicalCategory(c)) return true;
    return categoryRequiresImages(c);
  }

  function categoryMinImages(category) {
    const c = String(category || '').trim();
    if (c === CATEGORY_GAME_ACCOUNT) return 1;
    if (c === CATEGORY_SKIN || c === CATEGORY_ITEM) return 1;
    return 0;
  }

  function categoryMaxImages(category) {
    const c = String(category || '').trim();
    if (c === CATEGORY_SKIN || c === CATEGORY_ITEM) return 5;
    if (c === CATEGORY_GAME_ACCOUNT) return 8;
    return 0;
  }

  function categoryMaxAllowedImages(category, negotiationType) {
    const type = String(negotiationType || '').trim();
    const c = String(category || '').trim();
    if (type === 'physical' && isPhysicalCategory(c)) return 8;
    return categoryMaxImages(c);
  }

  function getDigitalFeeByPrice(price) {
    const value = Math.max(0, Number(price) || 0);
    if (value <= 50) return 3;
    if (value <= 150) return 5;
    if (value <= 350) return 10;
    return 15;
  }

  function parsePtBrMoney(raw) {
    const s = String(raw ?? '').trim();
    if (!s) return 0;
    // Accept: 1000,00 | 1000.00 | 1.000,00 | 1000
    const normalized = s
      .replace(/\s/g, '')
      .replace(/\./g, '')
      .replace(/,/g, '.');
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  }

  function formatPtBrMoney(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '';
    return n.toFixed(2).replace('.', ',');
  }

  const INSPECTION_CHECKLIST = [
    { id: 'original', label: 'Autenticidade Verificada' },
    { id: 'functional', label: 'Funcionamento Operacional' },
    { id: 'condition_match', label: 'Estética conforme descrito' },
    { id: 'accessories', label: 'Todos acessórios presentes' },
    { id: 'no_damage', label: 'Livre de danos estruturais' },
    { id: 'packaging', label: 'Embalagem Segura' }
  ];

  let pendingPollingHandle = null;
  let pendingNoticesLoading = false;
  let pendingNoticesLoadedAt = 0;
  let pendingNoticesLastFilter = null;
  let presencePollingHandle = null;
  let presenceLastRefreshAt = 0;
  let confirmationIntervalHandle = null;
  let toastTimer = null;
  let saoPauloCitiesPromise = null;
  let deferredRenderHandle = null;
  let saoPauloCitiesLastAttemptAt = 0;

  document.addEventListener('DOMContentLoaded', () => {
    injectBaseStyles();
    attachGlobalHandlers();
    handleVerificationLink(); // Check for email verification link
    render();
    if (state.token && state.user) {
      bootstrapAuthenticated().catch((error) => handleError(error));
    }
  });

  // Handle email verification link from URL hash
  async function handleVerificationLink() {
    const hash = window.location.hash;
    const match = hash.match(/^#\/verify-email\/(\d+)\/([a-zA-Z0-9]+)$/);
    if (match) {
      const [, userId, token] = match;
      // Clear the hash to prevent re-processing
      window.location.hash = '';
      
      try {
        setState({ isLoading: true });
        const response = await apiCall(`/email/verify/${userId}/${token}`, { method: 'GET' });
        
        if (response.verified || response.already_verified) {
          notify({ type: 'success', message: response.message || 'Email verificado com sucesso!' });
          // Update user state if logged in
          if (state.user && state.user.id === parseInt(userId)) {
            setState({ user: { ...state.user, email_verified: true } });
          }
        }
      } catch (error) {
        notify({ type: 'error', message: error.message || 'Erro ao verificar email.' });
      } finally {
        setState({ isLoading: false });
      }
    }
  }

  async function bootstrapAuthenticated() {
    try {
      await Promise.all([
        loadNegotiations({ force: true }),
        isAdmin() ? loadAdminSnapshot({ force: true }) : Promise.resolve()
      ]);
    } finally {
      updatePendingPolling();
      updatePresencePolling();
    }
  }

  //#endregion Startup (DOMContentLoaded / Bootstrap)

  // CSS Complementar (Twind CSS é carregado via CDN no blade)
  function injectBaseStyles() {
    // Estilos complementares que não existem no Twind padrão
    if (!document.getElementById('app-critical-css')) {
      const criticalStyle = document.createElement('style');
      criticalStyle.id = 'app-critical-css';
      criticalStyle.textContent = `
        body { transition: background-color 180ms ease; }
        /* Pedido: branco = cor que era o cinza; cinza = mais escuro */
        body.app-theme-white { background-color: #e5e7eb; }
        body.app-theme-gray { background-color: #9ca3af; }
        body.app-theme-black { background-color: #0b0b0b; }

        /* Dark theme readability overrides (global, all pages) */
        body.app-theme-black { color-scheme: dark; }
        body.app-theme-black, body.app-theme-black #app { color: #e5e7eb; }

        /* Background utility overrides */
        body.app-theme-black .bg-white { background-color: #111827 !important; }
        body.app-theme-black .bg-gray-50 { background-color: #0f172a !important; }
        body.app-theme-black .bg-gray-100 { background-color: #111827 !important; }
        body.app-theme-black .bg-gray-200 { background-color: #1f2937 !important; }

        /* Border utility overrides */
        body.app-theme-black .border-gray-100,
        body.app-theme-black .border-gray-200,
        body.app-theme-black .border-gray-300 { border-color: rgba(148,163,184,.22) !important; }
        body.app-theme-black .border-gray-400 { border-color: rgba(148,163,184,.30) !important; }

        /* Text utility overrides */
        body.app-theme-black .text-gray-900,
        body.app-theme-black .text-gray-800,
        body.app-theme-black .text-gray-700,
        body.app-theme-black .text-gray-600 { color: #e5e7eb !important; }
        body.app-theme-black .text-gray-500,
        body.app-theme-black .text-gray-400 { color: #cbd5e1 !important; }
        body.app-theme-black .text-gray-300 { color: #e2e8f0 !important; }

        /* Links (avoid low-contrast default blues) */
        body.app-theme-black a { color: #93c5fd; }
        body.app-theme-black a:hover { color: #bfdbfe; }
        body.app-theme-black .text-blue-600,
        body.app-theme-black .text-blue-700 { color: #93c5fd !important; }

        /* Status palettes (success/warning/danger) tuned for dark backgrounds */
        body.app-theme-black .bg-success-50 { background-color: rgba(34,197,94,.12) !important; }
        body.app-theme-black .bg-success-100 { background-color: rgba(34,197,94,.18) !important; }
        body.app-theme-black .bg-success-200 { background-color: rgba(34,197,94,.25) !important; }
        body.app-theme-black .bg-success-500 { background-color: rgba(34,197,94,.70) !important; }
        body.app-theme-black .bg-success-600 { background-color: rgba(34,197,94,.80) !important; }
        body.app-theme-black .bg-success-700 { background-color: rgba(22,163,74,.85) !important; }
        body.app-theme-black .text-success-700,
        body.app-theme-black .text-success-600,
        body.app-theme-black .text-success-500 { color: #86efac !important; }
        body.app-theme-black .border-success-200,
        body.app-theme-black .border-success-300,
        body.app-theme-black .border-success-400 { border-color: rgba(34,197,94,.35) !important; }

        body.app-theme-black .bg-warning-50 { background-color: rgba(245,158,11,.12) !important; }
        body.app-theme-black .bg-warning-100 { background-color: rgba(245,158,11,.18) !important; }
        body.app-theme-black .bg-warning-200 { background-color: rgba(245,158,11,.25) !important; }
        body.app-theme-black .bg-warning-500 { background-color: rgba(245,158,11,.70) !important; }
        body.app-theme-black .bg-warning-600 { background-color: rgba(217,119,6,.82) !important; }
        body.app-theme-black .bg-warning-700 { background-color: rgba(180,83,9,.88) !important; }
        body.app-theme-black .text-warning-900,
        body.app-theme-black .text-warning-800,
        body.app-theme-black .text-warning-700,
        body.app-theme-black .text-warning-600,
        body.app-theme-black .text-warning-500,
        body.app-theme-black .text-warning-400 { color: #fbbf24 !important; }
        body.app-theme-black .border-warning-200,
        body.app-theme-black .border-warning-300,
        body.app-theme-black .border-warning-400 { border-color: rgba(245,158,11,.35) !important; }

        body.app-theme-black .bg-danger-50 { background-color: rgba(239,68,68,.12) !important; }
        body.app-theme-black .bg-danger-100 { background-color: rgba(239,68,68,.18) !important; }
        body.app-theme-black .bg-danger-200 { background-color: rgba(239,68,68,.25) !important; }
        body.app-theme-black .bg-danger-500 { background-color: rgba(239,68,68,.78) !important; }
        body.app-theme-black .bg-danger-600 { background-color: rgba(220,38,38,.86) !important; }
        body.app-theme-black .bg-danger-700 { background-color: rgba(185,28,28,.90) !important; }
        body.app-theme-black .text-danger-700,
        body.app-theme-black .text-danger-600,
        body.app-theme-black .text-danger-500,
        body.app-theme-black .text-danger-400 { color: #fca5a5 !important; }
        body.app-theme-black .border-danger-200,
        body.app-theme-black .border-danger-300,
        body.app-theme-black .border-danger-400 { border-color: rgba(239,68,68,.35) !important; }

        /* Inputs/selects/textareas */
        body.app-theme-black input,
        body.app-theme-black select,
        body.app-theme-black textarea {
          background-color: rgba(15,23,42,.92) !important;
          color: #e5e7eb !important;
          border-color: rgba(148,163,184,.22) !important;
        }
        body.app-theme-black input:disabled,
        body.app-theme-black select:disabled,
        body.app-theme-black textarea:disabled {
          background-color: rgba(31,41,55,.90) !important;
          color: rgba(229,231,235,.70) !important;
        }
        body.app-theme-black ::placeholder { color: rgba(203,213,225,.65) !important; }

        /* Card shadows (so they don't look like light-mode) */
        body.app-theme-black .shadow,
        body.app-theme-black .shadow-sm,
        body.app-theme-black .shadow-md,
        body.app-theme-black .shadow-lg {
          box-shadow: 0 10px 30px rgba(0,0,0,.45) !important;
        }

        .theme-switcher { position: fixed; right: 16px; bottom: 16px; z-index: 60; display:flex; flex-direction:column; align-items:flex-end; gap:8px; }

        /* Collapsed: only one dot. Expanded: show palette on hover/focus. */
        .theme-switcher-panel { display:none; align-items:center; gap:8px; padding:10px 12px; border-radius: 9999px; background: rgba(255,255,255,.86); border: 1px solid rgba(148,163,184,.55); backdrop-filter: blur(10px); box-shadow: 0 10px 25px rgba(0,0,0,.10); }
        .theme-switcher:hover .theme-switcher-panel,
        .theme-switcher:focus-within .theme-switcher-panel { display:flex; }
        body.app-theme-black .theme-switcher-panel { background: rgba(17,24,39,.75); border-color: rgba(148,163,184,.18); }

        .theme-switcher-fab { height: 42px; padding: 0 14px; border-radius: 9999px; border: 1px solid rgba(148,163,184,.55); background: rgba(255,255,255,.78); backdrop-filter: blur(10px); box-shadow: 0 10px 25px rgba(0,0,0,.10); display:flex; align-items:center; justify-content:center; font-weight: 700; font-size: 12px; letter-spacing: .02em; }
        body.app-theme-black .theme-switcher-fab { background: rgba(17,24,39,.70); border-color: rgba(148,163,184,.18); }
        body.app-theme-black .theme-switcher-fab { color: #e5e7eb; }

        .theme-dot { width: 18px; height: 18px; border-radius: 9999px; border: 1px solid rgba(100,116,139,.55); display:inline-block; }
        .theme-dot.white { background: #e5e7eb; }
        .theme-dot.gray { background: #9ca3af; }
        .theme-dot.black { background: #0b0b0b; border-color: rgba(148,163,184,.45); }

        .theme-dot.reset { background: transparent; position: relative; }
        .theme-dot.reset::after { content: ''; position:absolute; inset: 3px; border-radius: 9999px; border: 1px dashed rgba(100,116,139,.55); }
        .theme-dot.reset::before { content: ''; position:absolute; left: 3px; right: 3px; top: 50%; height: 2px; background: rgba(100,116,139,.55); transform: rotate(-35deg); transform-origin: center; }

        .theme-btn { display:flex; align-items:center; justify-content:center; width: 34px; height: 34px; border-radius: 9999px; border: 1px solid rgba(148,163,184,.55); background: transparent; }
        .theme-btn.active { box-shadow: 0 0 0 3px rgba(124,58,237,.18); border-color: rgba(124,58,237,.65); }

        /* Gradient utilities */
        .gradient-bg { background: linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%); }
        .gradient-text { background: linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        
        /* Button gradients */
        .btn-gradient { background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%); color: white; transition: all 0.3s ease; }
        .btn-gradient:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(124, 58, 237, 0.4); }
        .btn-gradient:active { transform: translateY(0); }
        
        /* Card hover effects */
        .card-hover { transition: all 0.3s ease; }
        .card-hover:hover { transform: translateY(-2px); box-shadow: 0 12px 24px -10px rgba(0, 0, 0, 0.15); }
        
        /* Form focus states */
        input:focus, select:focus, textarea:focus { outline: none; border-color: #7c3aed !important; box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1) !important; }
        
        /* Status badge animations */
        .status-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .7; } }
        
        /* Smooth page transitions */
        .fade-in { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        
        /* Filter panel animation */
        .filter-panel { max-height: 0; overflow: hidden; transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease; opacity: 0; }
        .filter-panel.expanded { max-height: 600px; opacity: 1; }
        .filter-toggle-icon { transition: transform 0.3s ease; }
        .filter-toggle-icon.rotated { transform: rotate(180deg); }
        
        /* Progress bar gradient */
        .progress-gradient { background: linear-gradient(90deg, #7c3aed 0%, #06b6d4 100%); }
        
        /* Timeline connector */
        .timeline-connector { position: relative; }
        .timeline-connector::before { content: ''; position: absolute; left: 1.25rem; top: 2.5rem; bottom: 0; width: 2px; background: #e2e8f0; }
        .timeline-connector:last-child::before { display: none; }
        
        /* Modal backdrop */
        .modal-backdrop { background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px); }
        
        /* Loading spinner */
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
        
        /* Toast notifications */
        .toast-enter { animation: slideInRight 0.3s ease-out; }
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

        /* Mobile admin cards (details/summary) */
        details > summary { list-style: none; }
        details > summary::-webkit-details-marker { display: none; }
        .admin-card-chevron { transition: transform 0.2s ease; }
        details[open] .admin-card-chevron { transform: rotate(180deg); }
      `;
      document.head.insertBefore(criticalStyle, document.head.firstChild);
    }
  }

  function applyTheme(theme) {
    const t = String(theme || '').trim().toLowerCase();
    const normalized = ['white', 'gray', 'black'].includes(t) ? t : 'default';
    try {
      const body = document.body;
      if (!body) return;

      // Default blade body has bg-gray-50. If the user selects a solid theme,
      // remove it so the theme color is actually visible.
      if (normalized === 'default') {
        body.classList.add('bg-gray-50');
      } else {
        body.classList.remove('bg-gray-50');
      }

      body.classList.remove('app-theme-white', 'app-theme-gray', 'app-theme-black');
      if (normalized !== 'default') {
        body.classList.add(`app-theme-${normalized}`);
      }
    } catch {
      // ignore
    }
  }

  function renderThemeSwitcher() {
    const theme = String(state.theme || 'default').trim().toLowerCase();
    const active = ['white', 'gray', 'black', 'default'].includes(theme) ? theme : 'default';

    const btn = (id, label) => {
      const isActive = active === id;
      return `
        <button type="button" class="theme-btn ${isActive ? 'active' : ''}" data-action="setTheme" data-theme="${id}" title="${escapeAttr(label)}" aria-label="${escapeAttr(label)}">
          <span class="theme-dot ${id}"></span>
        </button>
      `;
    };

    const resetBtn = `
      <button type="button" class="theme-btn ${active === 'default' ? 'active' : ''}" data-action="setTheme" data-theme="default" title="Padrão" aria-label="Padrão">
        <span class="theme-dot reset"></span>
      </button>
    `;

    return `
      <div class="theme-switcher" aria-label="Seletor de tema">
        <button type="button" class="theme-switcher-fab" aria-label="Abrir seletor de tema" title="Tema">Fundo</button>
        <div class="theme-switcher-panel" role="menu" aria-label="Cores">
          ${resetBtn}
          ${btn('white', 'Branco')}
          ${btn('gray', 'Cinza')}
          ${btn('black', 'Preto')}
        </div>
      </div>
    `;
  }

  function safeParse(raw) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.warn('Failed to parse JSON from storage', error);
      return null;
    }
  }

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && value.constructor === Object;
  }

  function shallowEqual(a, b) {
    if (a === b) return true;
    if (!a || !b) return false;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) => Object.is(a[key], b[key]));
  }

  function updateConfirmationCooldownUI(seconds) {
    try {
      const button = document.querySelector('[data-confirmation-resend]');
      if (!(button instanceof HTMLButtonElement)) return;
      const remaining = Math.max(0, Number(seconds) || 0);
      const label = button.querySelector('[data-confirmation-resend-label]');
      if (label) {
        label.innerHTML = remaining
          ? `<i class="fas fa-clock mr-2"></i>Aguarde ${remaining}s`
          : '<i class="fas fa-paper-plane mr-2"></i>Reenviar código';
      }
      button.disabled = remaining > 0;
    } catch {
      // ignore
    }
  }

  function updatePendingCountUI(count) {
    try {
      const next = Math.max(0, Number(count) || 0);

      // Header badge (admin nav)
      const badge = document.querySelector('[data-pending-count-badge]');
      const badgeValue = document.querySelector('[data-pending-count-value]');
      if (badge instanceof HTMLElement && badgeValue instanceof HTMLElement) {
        badgeValue.textContent = String(next);
        badge.style.display = next > 0 ? '' : 'none';
      }

      // Admin page button: "Pendências (X)"
      const inline = document.querySelector('[data-pending-count-inline]');
      if (inline instanceof HTMLElement) {
        inline.textContent = String(next);
      }
    } catch {
      // ignore
    }
  }

  function setInteractiveBackgroundEnabled(enabled) {
    try {
      const bg = document.getElementById('interactiveBg');
      if (!bg) return;
      bg.style.display = enabled ? '' : 'none';
    } catch {
      // ignore
    }
  }

  //#region Core State/Render (setState -> render -> hydrate)

  function setState(updater) {
    const updates = typeof updater === 'function' ? updater({ ...state }) : updater;
    if (!updates || typeof updates !== 'object') return;

    // Evita "piscar" no confirm-email: countdown é atualizado no DOM, sem re-render completo.
    const updateKeys = Object.keys(updates);
    if (
      updateKeys.length === 1 &&
      updateKeys[0] === 'confirmationCooldownRemaining' &&
      state.currentPage === 'confirm-email'
    ) {
      const next = Number(updates.confirmationCooldownRemaining) || 0;
      if (state.confirmationCooldownRemaining !== next) {
        state.confirmationCooldownRemaining = next;
        updateConfirmationCooldownUI(next);
      }
      return;
    }

    // Evita re-render pesado quando só o contador de pendências muda (polling).
    if (updateKeys.length === 1 && updateKeys[0] === 'pendingCount' && isAdmin()) {
      const next = Math.max(0, Number(updates.pendingCount) || 0);
      if (state.pendingCount !== next) {
        state.pendingCount = next;
        updatePendingCountUI(next);
      }
      return;
    }

    let changed = false;
    for (const [key, value] of Object.entries(updates)) {
      if (isPlainObject(value) && isPlainObject(state[key])) {
        const merged = { ...state[key], ...value };
        if (!shallowEqual(state[key], merged)) {
          state[key] = merged;
          changed = true;
        }
      } else if (state[key] !== value) {
        state[key] = value;
        changed = true;
      }
    }

    if (changed) {
      if (shouldDeferRender(updates)) {
        scheduleDeferredRender(state.showCreateNegotiationModal ? 250 : 160);
      } else {
        flushRender();
      }
    }
  }

  function flushRender() {
    if (deferredRenderHandle) {
      clearTimeout(deferredRenderHandle);
      deferredRenderHandle = null;
    }
    render();
    updatePendingPolling();
    updatePresencePolling();
  }

  function scheduleDeferredRender(delayMs = 160) {
    if (deferredRenderHandle) {
      clearTimeout(deferredRenderHandle);
    }
    deferredRenderHandle = setTimeout(() => {
      deferredRenderHandle = null;
      render();
      updatePendingPolling();
      updatePresencePolling();
    }, delayMs);
  }

  function shouldDeferRender(updates) {
    try {
      if (!updates || typeof updates !== 'object') return false;
      if (updates.currentPage) return false;

      // Create negotiation modal: typing in price/currency fields should not cause full re-render every keypress.
      if (state.showCreateNegotiationModal) {
        const active = document.activeElement;
        if (!active || !(active instanceof Element)) return false;
        const inCreateForm = Boolean(active.closest('form[data-action="createNegotiation"]'));
        if (!inCreateForm) return false;

        const keys = Object.keys(updates);
        const onlyCreateFormUi = keys.every((k) => ['createNegForm', 'showCreateFeeGuide'].includes(k));
        if (!onlyCreateFormUi) return false;

        // Category change should update conditional UI immediately.
        if (updates.createNegForm && typeof updates.createNegForm === 'object') {
          const nextCategory = String(updates.createNegForm.category ?? '').trim();
          const prevCategory = String(state.createNegForm?.category ?? '').trim();
          if (nextCategory && nextCategory !== prevCategory) return false;
        }

        return true;
      }

      if (state.currentPage !== 'register') return false;
      const active = document.activeElement;
      if (!active || !(active instanceof Element)) return false;
      const inRegisterForm = Boolean(active.closest('form[data-action="register"]'));
      if (!inRegisterForm) return false;

      const keys = Object.keys(updates);
      // Defere apenas atualizações que costumam ocorrer durante carregamento de cidades/feedback e derrubam o autofill.
      return keys.every((k) => [
        'saoPauloCities',
        'saoPauloCitiesLoading',
        'errorMessage',
        'successMessage',
        'toast'
      ].includes(k));
    } catch {
      return false;
    }
  }

  function getUncontrolledPreservationScope(root) {
    try {
      // When the create negotiation modal is open, preserve only its form;
      // this avoids scanning the whole app on every render while typing.
      if (state.showCreateNegotiationModal) {
        const form = root.querySelector('form[data-action="createNegotiation"]');
        if (form) return form;
      }

      const active = document.activeElement;
      if (active && active instanceof Element) {
        const form = active.closest('form');
        if (form) return form;
      }
    } catch {
      // ignore
    }
    return null;
  }

  function render() {
    const root = document.getElementById('app');
    if (!root) return;

    // Theme must affect the whole page (solid background). If a theme is selected,
    // disable the interactive background layer so it doesn't cover the body color.
    applyTheme(state.theme);

    const interactiveBgEnabled = state.currentPage !== 'login';
    const solidThemeActive = ['white', 'gray', 'black'].includes(String(state.theme || '').trim().toLowerCase());
    setInteractiveBackgroundEnabled(interactiveBgEnabled && !solidThemeActive);

    // Preserve scroll position inside the create negotiation modal form.
    let createModalScrollTop = null;
    try {
      if (state.showCreateNegotiationModal) {
        const createForm = root.querySelector('form[data-action="createNegotiation"]');
        if (createForm && typeof createForm.scrollTop === 'number') {
          createModalScrollTop = createForm.scrollTop;
        }
      }
    } catch {
      // ignore
    }

    const scope = getUncontrolledPreservationScope(root);
    const preservedValues = scope ? captureUncontrolledValues(scope) : [];
    let focusMeta = null;
    const activeElement = document.activeElement;
    if (activeElement && activeElement.dataset && activeElement.dataset.focusKey) {
      focusMeta = {
        key: activeElement.dataset.focusKey,
        selectionStart: typeof activeElement.selectionStart === 'number' ? activeElement.selectionStart : null,
        selectionEnd: typeof activeElement.selectionEnd === 'number' ? activeElement.selectionEnd : null
      };
    } else if (activeElement && (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement || activeElement instanceof HTMLSelectElement)) {
      const name = activeElement.getAttribute('name');
      if (name) {
        const form = activeElement.closest('form');
        const formAction = form && form.dataset ? form.dataset.action : null;
        focusMeta = {
          name,
          formAction,
          selectionStart: typeof activeElement.selectionStart === 'number' ? activeElement.selectionStart : null,
          selectionEnd: typeof activeElement.selectionEnd === 'number' ? activeElement.selectionEnd : null
        };
      }
    }
    const isAuthenticated = Boolean(state.token && state.user);
    const appBackgroundClass = 'bg-transparent';
    const content = `
      <div class="${appBackgroundClass} text-gray-900 overflow-x-hidden">
        ${renderHeader(isAuthenticated)}
        ${isAuthenticated ? renderProtectedView() : renderPublicLayout()}
        ${renderFooter()}
      </div>
      ${renderModals()}
      ${renderToast()}
      ${renderThemeSwitcher()}
    `;
    root.innerHTML = content;

    restoreUncontrolledValues(root, preservedValues);

    if (focusMeta) {
      let next = null;
      if (focusMeta.key) {
        next = root.querySelector(`[data-focus-key="${focusMeta.key}"]`);
      } else if (focusMeta.name) {
        const selector = focusMeta.formAction
          ? `form[data-action="${cssEscapeAttr(focusMeta.formAction)}"] [name="${cssEscapeAttr(focusMeta.name)}"]`
          : `[name="${cssEscapeAttr(focusMeta.name)}"]`;
        next = root.querySelector(selector);
      }
      if (next) {
        next.focus({ preventScroll: true });
        if (focusMeta.selectionStart !== null && typeof next.setSelectionRange === 'function') {
          const end = focusMeta.selectionEnd ?? focusMeta.selectionStart;
          next.setSelectionRange(focusMeta.selectionStart, end);
        }
      }
    }

    hydrateDynamicWidgets();

    // Restore scroll after re-render so the modal doesn't jump to the top.
    try {
      if (createModalScrollTop !== null && state.showCreateNegotiationModal) {
        const createForm = root.querySelector('form[data-action="createNegotiation"]');
        if (createForm && typeof createForm.scrollTop === 'number') {
          createForm.scrollTop = createModalScrollTop;
        }
      }
    } catch {
      // ignore
    }
  }

  function hydrateDynamicWidgets() {
    hydratePaymentQrCode();
  }

  function hydratePaymentQrCode() {
    if (state.currentPage !== 'negotiation-detail') return;
    const neg = state.currentNegotiation;
    if (!neg || neg.status !== 'waiting_payment') return;
    if (!isBuyer(neg)) return;

    const container = document.getElementById(`qrcode-${neg.id}`);
    if (!(container instanceof HTMLElement)) return;
    const pixCode = container.dataset ? container.dataset.pixCode : null;
    if (!pixCode) return;

    if (!window.QRCode || typeof window.QRCode !== 'function') return;
    if (container.dataset && container.dataset.qrRendered === '1') return;

    // qrcodejs renderiza dentro do container (img/canvas)
    container.innerHTML = '';
    // Some builds expose CorrectLevel; keep it optional.
    const level = window.QRCode?.CorrectLevel?.M;
    new window.QRCode(container, {
      text: pixCode,
      width: 192,
      height: 192,
      correctLevel: level
    });

    if (container.dataset) {
      container.dataset.qrRendered = '1';
    }
  }

  //#endregion Core State/Render (setState -> render -> hydrate)

  function cssEscapeAttr(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/\"/g, '\\"');
  }

  function captureUncontrolledValues(root) {
    const snapshot = [];
    const elements = root.querySelectorAll('input[name], textarea[name], select[name]');
    const seen = new Map();

    elements.forEach((el) => {
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) return;
      if (el instanceof HTMLInputElement && el.type === 'file') return;

      const name = el.getAttribute('name');
      if (!name) return;

      const form = el.closest('form');
      const formAction = form && form.dataset ? form.dataset.action : '';
      const bucketKey = `${formAction}::${name}`;
      const idx = (seen.get(bucketKey) || 0);
      seen.set(bucketKey, idx + 1);

      const hasExplicitValueAttr = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
        ? el.hasAttribute('value')
        : false;

      const item = { formAction, name, idx, kind: el.tagName, type: el instanceof HTMLInputElement ? el.type : null, hasExplicitValueAttr };

      if (el instanceof HTMLInputElement) {
        if (el.type === 'checkbox' || el.type === 'radio') {
          item.checked = el.checked;
        } else {
          item.value = el.value;
        }
      } else if (el instanceof HTMLTextAreaElement) {
        item.value = el.value;
      } else if (el instanceof HTMLSelectElement) {
        item.value = el.value;
      }

      snapshot.push(item);
    });

    return snapshot;
  }

  function restoreUncontrolledValues(root, snapshot) {
    if (!Array.isArray(snapshot) || !snapshot.length) return;

    const counters = new Map();
    for (const item of snapshot) {
      const formAction = item.formAction || '';
      const name = item.name;
      const selector = formAction
        ? `form[data-action="${cssEscapeAttr(formAction)}"] [name="${cssEscapeAttr(name)}"]`
        : `[name="${cssEscapeAttr(name)}"]`;
      const matches = root.querySelectorAll(selector);
      if (!matches || !matches.length) continue;

      const bucketKey = `${formAction}::${name}`;
      const idx = counters.get(bucketKey) || 0;
      counters.set(bucketKey, idx + 1);

      const el = matches[idx];
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) continue;
      if (el instanceof HTMLInputElement && el.type === 'file') continue;

      // Não sobrescreve campos que são controlados via template (value="...")
      if ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && el.hasAttribute('value')) {
        continue;
      }

      if (el instanceof HTMLInputElement) {
        if (el.type === 'checkbox' || el.type === 'radio') {
          el.checked = Boolean(item.checked);
        } else if (typeof item.value === 'string') {
          el.value = item.value;
        }
      } else if (el instanceof HTMLTextAreaElement) {
        if (typeof item.value === 'string') el.value = item.value;
      } else if (el instanceof HTMLSelectElement) {
        if (typeof item.value === 'string') el.value = item.value;
      }
    }
  }

  // Helper para obter iniciais do usuário
  function getUserInitials(name) {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  function getUserInviteTag(user) {
    const id = Number(user?.id);
    if (!Number.isFinite(id) || id <= 0) return '';
    const firstName = getFirstName(String(user?.name || 'usuario'));
    const cleaned = String(firstName || 'usuario').replace(/\s+/g, '').trim();
    const normalized = cleaned ? cleaned.toLocaleLowerCase('pt-BR') : 'usuario';
    return `${normalized}#${id}`;
  }

  function renderHeader(isAuthenticated) {
    const userName = state.user?.name || 'Visitante';
    const userRole = state.user?.role || 'user';
    const intermediatorCode = state.user?.intermediator_code;
    const isPrincipal = Boolean(state.user?.is_intermediator_principal);
    const roleLabel = userRole === 'admin'
      ? 'Administrador'
      : userRole === 'intermediator'
        ? `Intermediador${intermediatorCode ? ` #${intermediatorCode}` : ''}${isPrincipal ? ' (Principal)' : ''}`
        : userRole === 'seller'
          ? 'Vendedor'
          : userRole === 'buyer'
            ? 'Comprador'
            : 'Usuário';
    const myTag = isAuthenticated ? getUserInviteTag(state.user) : '';
    
    return `
      <header class="sticky top-0 z-50 bg-white shadow-md">
        <div class="container mx-auto px-4">
          <div class="flex items-center justify-between h-16">
            <!-- Logo -->
            <div class="flex items-center space-x-3 cursor-pointer" data-action="navigate" data-page="${isAuthenticated ? 'dashboard' : 'login'}">
              <div class="w-10 h-10 bg-gradient-to-br from-primary-600 to-secondary-500 rounded-xl flex items-center justify-center shadow-md">
                <i class="fas fa-handshake text-white text-lg"></i>
              </div>
              <div>
                <h1 class="text-xl font-bold text-gray-900">
                  Intermediação<span class="text-primary-600">Pro</span>
                </h1>
                <p class="text-xs text-gray-500">Sistema Seguro</p>
              </div>
            </div>

            ${isAuthenticated ? `
              <!-- Navegação Autenticada -->
              ${isIntermediator() ? `
                <nav class="hidden md:flex items-center space-x-1">
                  <button class="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${state.currentPage === 'intermediator' ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:text-primary-600 hover:bg-gray-50'}" data-action="navigate" data-page="intermediator">
                    <i class="fas fa-user-tie mr-2"></i> Intermediações
                  </button>
                </nav>
              ` : `
                <nav class="hidden md:flex items-center space-x-1">
                  ${state.currentPage === 'dashboard' ? '' : `
                    <button class="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 text-gray-600 hover:text-primary-600 hover:bg-gray-50" data-action="navigate" data-page="dashboard">
                      <i class="fas fa-th-large mr-2"></i> Dashboard
                    </button>
                  `}
                </nav>
              `}

              <!-- User Menu -->
              <div class="flex items-center space-x-4">
                <div class="flex items-center space-x-3">
                  <div class="w-9 h-9 bg-gradient-to-br from-primary-500 to-secondary-400 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    ${getUserInitials(userName)}
                  </div>
                  <div class="hidden md:block text-left">
                    <p class="text-sm font-medium text-gray-900">${escapeHtml(userName)}</p>
                    <div class="flex items-center gap-2">
                      <p class="text-xs text-gray-500">${roleLabel}</p>
                      ${myTag ? `
                        <span class="text-xs text-gray-400">•</span>
                        <button type="button" class="text-xs text-primary-700 hover:text-primary-800 font-semibold inline-flex items-center gap-1" data-action="copyMyTag" title="Copiar seu usuário">
                          <span class="font-mono">${escapeHtml(myTag)}</span>
                          <i class="fas fa-copy text-[11px]"></i>
                        </button>
                      ` : ''}
                    </div>
                  </div>
                </div>
                <button class="px-4 py-2 bg-gray-100 hover:bg-danger-50 text-gray-700 hover:text-danger-600 rounded-lg text-sm font-medium transition-all duration-200" data-action="logout">
                  <i class="fas fa-sign-out-alt mr-1"></i> Sair
                </button>
              </div>
            ` : `
              <!-- Navegação Pública -->
              <nav class="hidden md:flex items-center space-x-6">
                <a href="/como-funciona" class="text-gray-700 hover:text-primary-600 font-medium transition">Como Funciona</a>
                <a href="#" class="text-gray-700 hover:text-primary-600 font-medium transition">Segurança</a>
                <a href="#" class="text-gray-700 hover:text-primary-600 font-medium transition">Taxas</a>
              </nav>
              <div class="flex items-center space-x-3">
                <button class="bg-gradient-to-r from-primary-600 to-secondary-500 text-white px-5 py-2.5 rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200" data-action="navigate" data-page="login">Entrar</button>
              </div>
            `}
          </div>
        </div>
      </header>
    `;
  }

  function renderNotifications() {
    const banners = [];
    if (state.errorMessage) {
      banners.push(`<div class="px-4 py-3 bg-danger-100 border border-danger-300 text-danger-700 rounded-lg flex items-center gap-2"><i class="fas fa-exclamation-circle"></i> ${escapeHtml(state.errorMessage)}</div>`);
    }
    if (state.successMessage) {
      banners.push(`<div class="px-4 py-3 bg-success-100 border border-success-300 text-success-700 rounded-lg flex items-center gap-2"><i class="fas fa-check-circle"></i> ${escapeHtml(state.successMessage)}</div>`);
    }
    if (state.loadingMessage) {
      banners.push(`<div class="px-4 py-3 bg-secondary-100 border border-secondary-300 text-secondary-700 rounded-lg flex items-center gap-2"><i class="fas fa-spinner fa-spin"></i> ${escapeHtml(state.loadingMessage)}</div>`);
    }
    return banners.length ? `<section class="container mx-auto px-4 py-3 flex flex-col gap-2">${banners.join('')}</section>` : '';
  }

  function renderPublicLayout() {
    return `
      <main class="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-600 flex items-center justify-center p-4 sm:p-6">
        <div class="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
          <div class="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
          <div class="absolute -bottom-40 -left-40 w-80 h-80 bg-secondary-400/20 rounded-full blur-3xl"></div>
        </div>
        <div class="relative z-10">
          ${renderPublicPage()}
        </div>
      </main>
    `;
  }

  function renderPublicPage() {
    switch (state.currentPage) {
      case 'register':
        return renderRegisterPage();
      case 'forgot-password':
        return renderForgotPasswordPage();
      case 'reset-password':
        return renderResetPasswordPage();
      case 'confirm-email':
        return renderConfirmEmailPage();
      case 'login':
      default:
        return renderLoginPage();
    }
  }

  function renderLoginPage() {
    return `
      <section class="w-full max-w-md bg-white rounded-2xl p-4 sm:p-8 shadow-card-xl animate-slide-up">
        <div class="text-center mb-8">
          <div class="w-16 h-16 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <i class="fas fa-lock text-white text-2xl"></i>
          </div>
          <h1 class="text-2xl font-bold text-gray-900">Bem-vindo de volta</h1>
          <p class="text-gray-600 mt-2">Acesse sua conta para gerenciar negociações</p>
        </div>
        
        <form data-action="login" class="space-y-5">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">E-mail</label>
            <input 
              type="email" 
              name="email" 
              required 
              autocomplete="email" 
              placeholder="seu@email.com" 
              class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
            >
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Senha</label>
            <input 
              type="password" 
              name="password" 
              required 
              autocomplete="current-password" 
              minlength="8" 
              placeholder="••••••••"
              class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
            >
          </div>
          
          <button type="submit" class="w-full bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 text-white font-semibold py-3 rounded-lg transition-all duration-300 hover:shadow-lg">
            Entrar na Plataforma
          </button>
        </form>
        
        <div class="flex items-center justify-center mt-6 pt-6 border-t border-gray-200">
          <button class="text-sm text-primary-600 hover:text-primary-700 font-medium transition" data-action="navigate" data-page="forgot-password">
            Esqueci a senha
          </button>
        </div>
      </section>
    `;
  }

  function renderRegisterPage() {
    const saoPauloCities = Array.isArray(window.__SAO_PAULO_CITIES) ? window.__SAO_PAULO_CITIES : [];
    const cityOptions = saoPauloCities.length
      ? [
          '<option value="" selected disabled>Selecione a cidade</option>',
          ...saoPauloCities.map((city) => `<option value="${escapeAttr(city)}">${escapeHtml(city)}</option>`)
        ].join('')
      : '<option value="" selected disabled>Lista de cidades indisponível</option>';

    return `
      <section class="w-full max-w-2xl bg-white rounded-2xl p-4 sm:p-8 shadow-card-xl animate-slide-up">
        <div class="text-center mb-8">
          <div class="w-16 h-16 bg-gradient-to-br from-success-500 to-secondary-500 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <i class="fas fa-user-plus text-white text-2xl"></i>
          </div>
          <h1 class="text-2xl font-bold text-gray-900">Criar sua conta</h1>
          <p class="text-gray-600 mt-2">Cadastre-se para negociar com total segurança</p>
        </div>
        
        <form data-action="register" class="space-y-5">
          <div class="grid sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Nome completo *</label>
              <input type="text" name="name" required autocomplete="name" placeholder="Seu nome completo" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">E-mail *</label>
              <input type="email" name="email" required autocomplete="email" placeholder="seu@email.com" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
            </div>
          </div>

          <div class="grid sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Telefone celular</label>
              <input type="tel" name="phone" maxlength="15" placeholder="(11) 90000-0000" data-action="formatPhoneInput" inputmode="tel" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">CEP *</label>
              <input type="text" name="zip_code" required maxlength="9" placeholder="00000-000" data-action="formatCepInput" inputmode="numeric" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Endereço *</label>
            <input type="text" name="address" required placeholder="Rua, avenida ou travessa" autocomplete="address-line1" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
          </div>

          <div class="grid sm:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Número *</label>
              <input type="text" name="address_number" required inputmode="numeric" placeholder="123" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Complemento</label>
              <input type="text" name="address_complement" placeholder="Apto, bloco" autocomplete="address-line2" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Bairro *</label>
              <input type="text" name="district" required placeholder="Bairro" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
            </div>
          </div>

          <div class="grid sm:grid-cols-2 gap-4">
            <div class="space-y-3">
              <label class="block text-sm font-medium text-gray-700">Estado *</label>
              <select name="state" required class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                <option value="SP" selected>São Paulo (SP)</option>
              </select>
            </div>
            <div class="space-y-3">
              <label class="block text-sm font-medium text-gray-700">Cidade *</label>
              <select name="city" required class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                ${cityOptions}
              </select>
            </div>
          </div>

          <div class="grid sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Senha *</label>
              <input type="password" name="password" required minlength="8" pattern="(?=.*[A-Z])(?=.*\d).{8,}" title="Mínimo 8 caracteres, com 1 letra maiúscula e 1 número" autocomplete="new-password" placeholder="Mínimo 8, 1 maiúscula e 1 número" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Confirmar senha *</label>
              <input type="password" name="password_confirmation" required minlength="8" pattern="(?=.*[A-Z])(?=.*\d).{8,}" title="Mínimo 8 caracteres, com 1 letra maiúscula e 1 número" autocomplete="new-password" placeholder="Repita a senha" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
            </div>
          </div>

          <button type="submit" class="w-full bg-gradient-to-r from-success-600 to-secondary-500 hover:from-success-700 hover:to-secondary-600 text-white font-semibold py-3 rounded-lg transition-all duration-300 hover:shadow-lg">
            Criar Minha Conta
          </button>
        </form>
        
        <div class="text-center mt-6 pt-6 border-t border-gray-200">
          <button class="text-sm text-primary-600 hover:text-primary-700 font-medium transition" data-action="navigate" data-page="login">
            Já tenho uma conta
          </button>
        </div>
      </section>
    `;
  }

  function ensureSaoPauloCitiesLoaded() {
    // Cadastro agora usa cidade fixa (São Paulo). Mantido por compatibilidade.
    return;
    // Cache simples para evitar re-render tardio durante o preenchimento
    if (!Array.isArray(state.saoPauloCities) || !state.saoPauloCities.length) {
      const cached = safeParse(localStorage.getItem('spCitiesV1'));
      if (Array.isArray(cached) && cached.length) {
        setState({ saoPauloCities: cached });
        return;
      }
    }

    if (state.saoPauloCitiesLoading || (Array.isArray(state.saoPauloCities) && state.saoPauloCities.length) || saoPauloCitiesPromise) {
      return;
    }

    // Backoff: se falhou recentemente, não fica tentando toda hora (isso causa sensação de "atualizando")
    if (saoPauloCitiesLastAttemptAt && Date.now() - saoPauloCitiesLastAttemptAt < 30000) {
      return;
    }

    saoPauloCitiesLastAttemptAt = Date.now();
    setState({ saoPauloCitiesLoading: true });
    const endpoint = 'https://servicodados.ibge.gov.br/api/v1/localidades/estados/35/municipios';
    saoPauloCitiesPromise = fetch(endpoint)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Falha ao carregar cidades de São Paulo.');
        }
        return response.json();
      })
      .then((data) => {
        const cities = Array.isArray(data)
          ? data
              .map((item) => item?.nome)
              .filter(Boolean)
              .map((name) => String(name))
              .sort((a, b) => normalizeText(a).localeCompare(normalizeText(b)))
          : [];
        if (cities.length) {
          try {
            localStorage.setItem('spCitiesV1', JSON.stringify(cities));
          } catch {
            // ignore
          }
        }
        setState({ saoPauloCities: cities, saoPauloCitiesLoading: false });
      })
      .catch((error) => {
        console.error('Erro ao buscar cidades do estado de São Paulo', error);
        setState({ saoPauloCitiesLoading: false });
      })
      .finally(() => {
        saoPauloCitiesPromise = null;
      });
  }

  function renderForgotPasswordPage() {
    return `
      <section class="w-full max-w-md bg-white rounded-2xl p-4 sm:p-8 shadow-card-xl animate-slide-up">
        <div class="text-center mb-8">
          <div class="w-16 h-16 bg-gradient-to-br from-warning-500 to-danger-400 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <i class="fas fa-key text-white text-2xl"></i>
          </div>
          <h1 class="text-2xl font-bold text-gray-900">Recuperar acesso</h1>
          <p class="text-gray-600 mt-2">Informe o e-mail cadastrado para receber instruções</p>
        </div>
        
        <form data-action="forgotPassword" class="space-y-5">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">E-mail</label>
            <input type="email" name="email" required class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
          </div>
          
          <button type="submit" class="w-full bg-gradient-to-r from-warning-500 to-danger-400 hover:from-warning-600 hover:to-danger-500 text-white font-semibold py-3 rounded-lg transition-all duration-300 hover:shadow-lg">
            Enviar Link de Recuperação
          </button>
        </form>
        
        <div class="text-center mt-6 pt-6 border-t border-gray-200">
          <button class="text-sm text-primary-600 hover:text-primary-700 font-medium transition" data-action="navigate" data-page="login">
            <i class="fas fa-arrow-left mr-1"></i> Voltar para login
          </button>
        </div>
      </section>
    `;
  }

  function renderResetPasswordPage() {
    return `
      <section class="w-full max-w-md bg-white rounded-2xl p-4 sm:p-8 shadow-card-xl animate-slide-up">
        <div class="text-center mb-8">
          <div class="w-16 h-16 bg-gradient-to-br from-success-500 to-secondary-500 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <i class="fas fa-lock text-white text-2xl"></i>
          </div>
          <h1 class="text-2xl font-bold text-gray-900">Definir nova senha</h1>
          <p class="text-gray-600 mt-2">Escolha uma senha forte para proteger sua conta</p>
        </div>
        
        <form data-action="resetPassword" class="space-y-5">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Token de redefinição</label>
            <input type="text" name="token" required value="${escapeAttr(state.resetPasswordToken || '')}" placeholder="Cole o token recebido por email" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">E-mail</label>
            <input type="email" name="email" required value="${escapeAttr(state.resetPasswordEmail || '')}" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Nova senha</label>
            <input type="password" name="password" required minlength="8" pattern="(?=.*[A-Z])(?=.*\d).{8,}" title="Mínimo 8 caracteres, com 1 letra maiúscula e 1 número" autocomplete="new-password" placeholder="Mínimo 8, 1 maiúscula e 1 número" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Confirmar senha</label>
            <input type="password" name="password_confirmation" required minlength="8" pattern="(?=.*[A-Z])(?=.*\d).{8,}" title="Mínimo 8 caracteres, com 1 letra maiúscula e 1 número" autocomplete="new-password" placeholder="Repita a senha" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
          </div>
          
          <button type="submit" class="w-full bg-gradient-to-r from-success-600 to-secondary-500 hover:from-success-700 hover:to-secondary-600 text-white font-semibold py-3 rounded-lg transition-all duration-300 hover:shadow-lg">
            Atualizar Senha
          </button>
        </form>
        
        <div class="text-center mt-6 pt-6 border-t border-gray-200">
          <button class="text-sm text-primary-600 hover:text-primary-700 font-medium transition" data-action="navigate" data-page="login">
            <i class="fas fa-arrow-left mr-1"></i> Voltar para login
          </button>
        </div>
      </section>
    `;
  }

  function renderConfirmEmailPage() {
    return `
      <section class="w-full max-w-md bg-white rounded-2xl p-4 sm:p-8 shadow-card-xl animate-slide-up text-center">
        <div class="w-16 h-16 bg-gradient-to-br from-secondary-500 to-primary-500 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <i class="fas fa-envelope text-white text-2xl"></i>
        </div>
        <h1 class="text-2xl font-bold text-gray-900 mb-2">Confirme seu e-mail</h1>
        <p class="text-gray-600 mb-4">Enviamos um <strong>código de 6 dígitos</strong> para <span class="font-medium text-primary-600">${escapeHtml(state.confirmationEmail || 'seu e-mail')}</span></p>
        <p class="text-gray-500 text-sm mb-6">Digite o código abaixo. Se não recebeu, verifique a caixa de spam ou solicite um novo envio.</p>

        <form data-action="verifyEmailCode" class="space-y-3 mb-4">
          <input
            type="text"
            name="code"
            inputmode="numeric"
            minlength="6"
            maxlength="6"
            placeholder="Código (6 dígitos)"
            class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 text-center tracking-widest focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
            required
          >
          <button type="submit" class="w-full bg-gradient-to-r from-success-600 to-secondary-500 hover:from-success-700 hover:to-secondary-600 text-white font-semibold py-3 rounded-lg transition-all duration-300 hover:shadow-lg">
            <i class="fas fa-check mr-2"></i>Confirmar código
          </button>
        </form>
        
        <div class="space-y-3">
          <button class="w-full bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 text-white font-semibold py-3 rounded-lg transition-all duration-300 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed" data-action="resendEmailVerification" data-confirmation-resend ${state.confirmationCooldownRemaining ? 'disabled' : ''}>
            <span data-confirmation-resend-label>
              ${state.confirmationCooldownRemaining ? `<i class="fas fa-clock mr-2"></i>Aguarde ${state.confirmationCooldownRemaining}s` : '<i class="fas fa-paper-plane mr-2"></i>Reenviar código'}
            </span>
          </button>
          <button class="text-primary-600 hover:text-primary-700 font-medium transition text-sm" data-action="navigate" data-page="login">
            <i class="fas fa-arrow-left mr-1"></i> Voltar para login
          </button>
        </div>
      </section>
    `;
  }

  function renderProtectedView() {
    return `
      <main class="min-h-screen w-full p-4 sm:p-6 overflow-x-hidden">
        <div class="w-full max-w-6xl mx-auto">${renderProtectedPage()}</div>
      </main>
    `;
  }

  function renderProtectedPage() {
    if (state.currentPage === 'negotiation-detail') {
      return renderNegotiationDetailPage();
    }
    if (state.currentPage === 'admin') {
      return canManageUsers() ? renderAdminPage() : renderDashboardPage();
    }
    if (state.currentPage === 'intermediator' && isIntermediator()) {
      return renderIntermediatorPage();
    }
    return renderDashboardPage();
  }

  function renderDashboardPage() {
    const negotiations = getFilteredNegotiations();
    const pageSize = getDashboardPageSize();
    const totalPages = Math.max(1, Math.ceil(negotiations.length / pageSize));
    const currentPage = Math.min(Math.max(1, Number(state.dashboardPage) || 1), totalPages);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(negotiations.length, startIndex + pageSize);
    const pageItems = negotiations.slice(startIndex, endIndex);
    const pageMeta = {
      totalCount: negotiations.length,
      page: currentPage,
      pageSize,
      totalPages,
      startIndex,
      endIndex
    };
    return `
      <section>
        <!-- Header principal -->
      <header class="flex flex-wrap items-center justify-between gap-4 mb-8">
  <div>
    <h1 class="text-3xl font-extrabold text-gray-900 tracking-tight">Minhas Negociações</h1>
    <p class="text-base text-gray-500 mt-1">Gerencie cada etapa do processo de intermediação.</p>
  </div>
  <div class="flex gap-3 w-full sm:w-auto">
    <button class="flex-1 sm:flex-none justify-center px-6 py-3 bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 text-white font-semibold rounded-xl shadow-lg shadow-primary-500/30 transition duration-300 ease-in-out flex items-center gap-2" data-action="openCreateNegotiation">
      <i class="fas fa-plus"></i> Nova Negociação
    </button>
    <button class="w-12 h-12 bg-white border border-gray-200 hover:border-primary-500 rounded-xl text-gray-700 hover:text-primary-600 transition shadow-sm flex items-center justify-center" data-action="dashboardRefresh">
      <i class="fas fa-sync-alt"></i>
    </button>
    ${(isAdmin() || isIntermediatorPrincipal()) ? '<button class="w-12 h-12 bg-white border border-gray-200 hover:border-primary-500 rounded-xl text-gray-700 hover:text-primary-600 transition shadow-sm flex items-center justify-center" data-action="navigate" data-page="admin"><i class="fas fa-cog"></i></button>' : ''}
  </div>
</header>
        <!-- Layout com 2 colunas: Filtros à esquerda | Cards + Tabela à direita -->
        <div class="flex flex-col lg:flex-row gap-6 items-stretch lg:items-start">
          <!-- COLUNA ESQUERDA: Filtros -->
          ${renderFilterSidebar()}

          <!-- COLUNA DIREITA: Cards de resumo + Tabela -->
          <div class="flex-1 min-w-0 space-y-6">
            ${renderDashboardMobileFilterBar()}
            <div>
              ${renderNegotiationsCardsMobile(pageItems, pageMeta)}
            </div>
          </div>
        </div>
      </section>
      ${state.showCreateNegotiationModal ? renderCreateNegotiationModal() : ''}
    `;
  }

  function renderDashboardMobileFilterBar() {
    const { status, role, query } = state.negotiationFilters || {};
    const hasAnyFilter = (status && status !== 'all') || (role && role !== 'all') || Boolean(query);
    const summaryParts = [];
    if (status && status !== 'all') summaryParts.push(STATUS_LABELS[status] || status);
    if (role && role !== 'all') summaryParts.push(role === 'buyer' ? 'Como comprador' : 'Como vendedor');
    if (query) summaryParts.push(`Busca: "${query}"`);
    const summary = summaryParts.join(' • ');

    return `
      <div class="sm:hidden sticky top-20 z-10">
        <button
          type="button"
          class="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-white shadow-sm"
          data-action="openDashboardFiltersModal"
        >
          <span class="flex items-center gap-2 text-gray-900 font-semibold">
            <i class="fas fa-search text-primary-600"></i>
            Filtrar
          </span>
          <span class="min-w-0 text-xs text-gray-500 truncate">
            ${hasAnyFilter ? escapeHtml(summary) : 'Todos'}
          </span>
          <i class="fas fa-sliders-h text-gray-400"></i>
        </button>
      </div>
    `;
  }

  function getDashboardPageSize() {
    const isMobile = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(max-width: 639px)').matches
      : false;
    if (isMobile) return 3;
    const width = typeof window !== 'undefined' ? Number(window.innerWidth) || 0 : 0;
    return width >= 1900 ? 8 : 6;
  }

  function renderFilterSidebar() {
  const { status, query } = state.negotiationFilters;
  const counts = getDashboardStatusCounts();
  const deliveredCount = Number(counts.byStatus?.delivered) || 0;
  const cancelledCount = Number(counts.byStatus?.cancelled) || 0;
  const rejectedCount = Number(counts.byStatus?.rejected_by_admin) || 0;
  const expiredCount = Number(counts.byStatus?.expired) || 0;
  const activeCount = Math.max(0, (Number(counts.total) || 0) - deliveredCount - cancelledCount - rejectedCount - expiredCount);
  const pendingPaymentCount = Number(counts.byStatus?.waiting_payment) || 0;
  const statusOptions = [
    { key: 'all', label: 'Todos', icon: 'fa-th-list', color: 'text-gray-600' },
    { key: 'pending_acceptance', label: 'Convites pendentes', icon: 'fa-user-plus', color: 'text-secondary-600' },
    { key: 'awaiting_admin_approval', label: 'Aguardando revisão', icon: 'fa-hourglass-half', color: 'text-primary-600' },
    { key: 'waiting_payment', label: 'Pagamento pendente', icon: 'fa-credit-card', color: 'text-warning-600' },
    { key: 'waiting_digital_delivery', label: 'Entrega digital pendente', icon: 'fa-key', color: 'text-secondary-600' },
    { key: 'waiting_shipment', label: 'Aguardando envio', icon: 'fa-box', color: 'text-gray-600' },
    { key: 'shipped', label: 'Em trânsito', icon: 'fa-truck', color: 'text-secondary-600' },
    { key: 'at_intermediary', label: 'Na intermediadora', icon: 'fa-warehouse', color: 'text-secondary-500' },
    { key: 'approved', label: 'Inspeção aprovada', icon: 'fa-check-circle', color: 'text-success-600' },
    { key: 'delivered', label: 'Entregues', icon: 'fa-flag-checkered', color: 'text-success-500' },
    { key: 'cancelled', label: 'Canceladas', icon: 'fa-times-circle', color: 'text-danger-600' }
  ];
  const expanded = Boolean(state.filtersExpanded);
  const activeStatus = statusOptions.find((opt) => opt.key === status) || statusOptions[0];
  const activeLabel = activeStatus ? activeStatus.label : 'Todos';
  const filterPanelId = 'dashboard-filter-panel';

  const statusQuery = normalizeText(state.statusOptionsQuery || '');
  const filteredStatusOptions = statusQuery
    ? statusOptions.filter((opt) => normalizeText(opt.label).includes(statusQuery))
    : statusOptions;

  return `
    <aside class="hidden lg:block w-60 xl:w-64 2xl:w-72 flex-shrink-0 lg:sticky lg:top-28 self-start">
      <div class="bg-white border border-gray-100 rounded-2xl shadow-card p-4 lg:p-5 2xl:p-6">
        <!-- Variante compacta (tela menor): mantém sidebar, mas usa dropdowns -->
        <div class="2xl:hidden space-y-5">
          <div>
            <span class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Buscar negociações</span>
            <div class="relative">
              <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
              <input
                type="search"
                name="dashboard_query"
                placeholder="Filtrar por título, comprador ou vendedor"
                value="${escapeAttr(query)}"
                data-action="dashboardSearch"
                data-focus-key="dashboard-search"
                class="w-full pl-9 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-150"
              >
            </div>
          </div>

          <details class="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3" ${state.sidebarSummaryOpen ? 'open' : ''}>
            <summary class="cursor-pointer list-none flex items-center justify-between gap-3" data-action="toggleSidebarFilterDropdown" data-filter="summary">
              <span class="text-sm font-extrabold text-gray-900">Resumo</span>
              <i class="fas fa-chevron-down text-gray-400"></i>
            </summary>
            <div class="mt-3 text-sm text-gray-700">
              <div><span class="font-extrabold text-gray-900">${activeCount}</span> negociações ativas</div>
              <div><span class="font-extrabold ${pendingPaymentCount > 0 ? 'text-warning-700' : 'text-gray-900'}">${pendingPaymentCount}</span> pagamentos pendentes</div>
            </div>
          </details>

          <details class="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3" ${state.sidebarStatusOpen ? 'open' : ''}>
            <summary class="cursor-pointer list-none flex items-center justify-between gap-3" data-action="toggleSidebarFilterDropdown" data-filter="status">
              <span class="text-sm font-extrabold text-gray-900">Status</span>
              <span class="text-xs text-gray-500 truncate">${escapeHtml(activeLabel)}</span>
              <i class="fas fa-chevron-down text-gray-400"></i>
            </summary>

            <div class="mt-3 space-y-3">
              <div class="relative">
                <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                <input
                  type="search"
                  name="status_options_query"
                  placeholder="Buscar status"
                  value="${escapeAttr(state.statusOptionsQuery || '')}"
                  data-action="statusOptionsSearch"
                  class="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
                >
              </div>

              <div class="flex flex-col gap-1.5">
                ${filteredStatusOptions.map((opt) => {
                  const isActive = status === opt.key;
                  const count = opt.key === 'all' ? (Number(counts.total) || 0) : (Number(counts.byStatus?.[opt.key]) || 0);
                  const showCount = opt.key === 'all' || count > 0;
                  return `
                    <button
                      type="button"
                      class="w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl text-sm transition duration-150 ${isActive
                        ? 'bg-gradient-to-r from-primary-600 to-secondary-500 text-white font-semibold shadow-md'
                        : 'bg-white text-gray-700 hover:bg-primary-50 hover:text-primary-600 border border-transparent hover:border-primary-100'}"
                      data-action="dashboardStatusFilter"
                      data-status="${opt.key}"
                    >
                      <span class="flex items-center gap-3">
                        <i class="fas ${opt.icon} ${isActive ? 'text-white' : opt.color}"></i>
                        <span class="truncate">${escapeHtml(opt.label)}</span>
                      </span>
                      ${showCount ? `<span class="inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-full text-xs font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'}">${count}</span>` : ''}
                    </button>
                  `;
                }).join('')}
              </div>
            </div>
          </details>
        </div>

        <!-- Variante completa (tela bem grande): lista completa de status -->
        <div class="hidden 2xl:block">
          <button
            type="button"
            class="w-full flex lg:hidden items-center justify-between gap-3 px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 hover:border-primary-500 transition mb-4"
            data-action="toggleFilters"
            aria-expanded="${expanded}"
            aria-controls="${filterPanelId}"
          >
            <span class="flex items-center gap-2 text-base font-bold text-gray-800">
              <i class="fas fa-filter text-primary-600"></i>
              Filtros
            </span>
            <span class="flex-1 text-right text-sm text-gray-500 truncate">${escapeHtml(activeLabel)}</span>
            <i class="fas ${expanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-gray-400"></i>
          </button>

          <div id="${filterPanelId}" class="lg:block ${expanded ? 'block' : 'hidden'} space-y-6">
            <div>
              <span class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Buscar negociações</span>
              <div class="relative">
                <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                <input 
                  type="search" 
                  name="dashboard_query"
                  placeholder="Filtrar por título, comprador ou vendedor" 
                  value="${escapeAttr(query)}" 
                  data-action="dashboardSearch" 
                  data-focus-key="dashboard-search"
                  class="w-full pl-9 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-150"
                >
              </div>
            </div>

            <div class="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <div class="text-xs font-bold text-gray-500 uppercase tracking-wider">Resumo</div>
              <div class="mt-1 text-sm text-gray-700">
                <span class="font-extrabold text-gray-900">${activeCount}</span> negociações ativas •
                <span class="font-extrabold ${pendingPaymentCount > 0 ? 'text-warning-700' : 'text-gray-900'}">${pendingPaymentCount}</span> pagamentos pendentes
              </div>
            </div>

            <div class="space-y-2">
              <span class="block text-xs font-bold text-gray-500 uppercase tracking-wider">Status</span>
              <nav class="flex flex-col gap-1.5">
                ${statusOptions.map((opt) => {
                  const isActive = status === opt.key;
                  const count = opt.key === 'all' ? (Number(counts.total) || 0) : (Number(counts.byStatus?.[opt.key]) || 0);
                  const showCount = opt.key === 'all' || count > 0;
                  return `
                    <button
                      type="button"
                      class="w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl text-sm transition duration-150 ${isActive 
                        ? 'bg-gradient-to-r from-primary-600 to-secondary-500 text-white font-semibold shadow-md ring-2 ring-primary-400 ring-offset-2 ring-offset-white' 
                        : 'bg-white text-gray-700 hover:bg-primary-50 hover:text-primary-600 border border-transparent hover:border-primary-100'}"
                      data-action="dashboardStatusFilter"
                      data-status="${opt.key}"
                    >
                      <span class="flex items-center gap-3">
                        <i class="fas ${opt.icon} ${isActive ? 'text-white' : opt.color}"></i>
                        <span class="truncate">${escapeHtml(opt.label)}</span>
                      </span>
                      ${showCount ? `<span class="inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-full text-xs font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'}">${count}</span>` : ''}
                    </button>
                  `;
                }).join('')}
              </nav>
            </div>

          </div>
        </div>
      </div>
    </aside>
  `;
  }

  function renderCreateNegotiationModal() {
    const { buyerFound, buyerSearching, productPhotos, photoError } = state.createNegForm;
    const step = Math.max(1, Math.min(4, Number(state.createNegStep) || 1));
    const selectedCategory = String(state.createNegForm?.category || '').trim();
    const showCurrencyFields = selectedCategory === CATEGORY_CURRENCY;
    const showGameAccountFields = selectedCategory === CATEGORY_GAME_ACCOUNT;
    const showSkinFields = selectedCategory === CATEGORY_SKIN;
    const showItemFields = selectedCategory === CATEGORY_ITEM;
    const showServiceProductFlow = isServiceProductFlowCategory(selectedCategory);
    const negotiationType = getCreateNegotiationType();
    const isDigital = negotiationType === 'digital';
    const useUniversalGameProductFlow = isDigital && (selectedCategory === CATEGORY_SKIN || selectedCategory === CATEGORY_ITEM || selectedCategory === CATEGORY_OTHERS);
    const categoryOptions = negotiationType === 'digital'
      ? DIGITAL_PRODUCT_CATEGORIES
      : (negotiationType === 'physical' ? PHYSICAL_PRODUCT_CATEGORIES : []);
    const showDescription = true;
    const showPhotos = categoryRequiresImages(selectedCategory);
    const minImages = categoryMinImages(selectedCategory);
    const maxImages = categoryMaxImages(selectedCategory);

    const draftPrice = state.createNegForm?.price;
    const priceNum = Math.max(0, parsePtBrMoney(draftPrice));
    const fee = priceNum > 0 ? getDigitalFeeByPrice(priceNum) : 0;
    const feeMode = String(state.createNegForm?.sellerFeeMode || 'deduct');
    const deductFee = feeMode === 'deduct';
    const net = priceNum > 0 ? (deductFee ? Math.max(0, priceNum - fee) : priceNum) : 0;
    const photosHtml = productPhotos.map((photo, idx) => `
      <div class="relative group">
        <img src="${photo.preview}" alt="Foto ${idx + 1}" class="w-full h-24 object-cover rounded-lg border border-gray-200">
        <button type="button" class="absolute top-1 right-1 w-6 h-6 bg-danger-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition" data-action="removeProductPhoto" data-index="${idx}">✕</button>
      </div>
    `).join('');

    const feeSummaryHtml = `
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
        <div class="sm:col-span-2 p-3 bg-primary-50 border border-primary-100 rounded-lg text-primary-700 text-sm">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span>
              💼 Taxa de intermediação:
              <strong data-create-fee>R$ ${(fee || 0).toFixed(2).replace('.', ',')}</strong>
              <span class="text-xs text-gray-600" data-create-fee-mode-label>(${deductFee ? 'descontada do valor recebido' : 'paga via Pix separado'})</span>
            </span>
            <span>💰 Valor líquido que você receberá: <strong data-create-net>R$ ${(net || 0).toFixed(2).replace('.', ',')}</strong></span>
          </div>
          <div class="mt-2 text-xs text-gray-600">
            Total cobrado do comprador: <strong data-create-total>R$ ${(priceNum || 0).toFixed(2).replace('.', ',')}</strong>
          </div>
        </div>
        <div class="sm:col-span-1">
          <button type="button" class="w-full px-4 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-700 transition" data-action="toggleCreateFeeGuide">
            <i class="fas fa-info-circle mr-2"></i>Guia de valores
          </button>
        </div>
      </div>

      <div class="p-4 bg-white border border-gray-200 rounded-xl">
        <div class="text-sm font-semibold text-gray-900 mb-2">Como o vendedor vai pagar a taxa?</div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label class="flex items-start gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50 cursor-pointer">
            <input
              type="radio"
              name="seller_fee_mode"
              value="deduct"
              ${deductFee ? 'checked' : ''}
              data-action="updateNegFormField"
              data-field="sellerFeeMode"
              class="mt-1"
            >
            <div>
              <div class="text-sm font-medium text-gray-900">Descontar do valor recebido</div>
              <div class="text-xs text-gray-600">O valor líquido já aparece com desconto.</div>
            </div>
          </label>
          <label class="flex items-start gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50 cursor-pointer">
            <input
              type="radio"
              name="seller_fee_mode"
              value="pix"
              ${!deductFee ? 'checked' : ''}
              data-action="updateNegFormField"
              data-field="sellerFeeMode"
              class="mt-1"
            >
            <div>
              <div class="text-sm font-medium text-gray-900">Pagar via Pix (separado)</div>
              <div class="text-xs text-gray-600">O vendedor recebe o valor cheio e paga a taxa por Pix.</div>
            </div>
          </label>
        </div>
      </div>
    `;

    const termsAccepted = Boolean(state.createNegForm?.termsAccepted || state.createNegForm?.terms_accepted);
    const termsContentHtml = !isDigital ? `
      <div class="space-y-3 text-sm text-gray-700">
        <h3 class="text-base font-semibold text-gray-900">Envio físico</h3>
        <ul class="space-y-2 text-left">
          <li><strong>Prazo de envio:</strong> o vendedor tem até <strong>2 dias</strong> para postar o produto após a confirmação do pagamento/aprovação.</li>
          <li><strong>Código de rastreio:</strong> o vendedor deve informar o <strong>código de rastreio</strong>; ao informar o rastreio, fica confirmado que o envio foi realizado.</li>
          <li><strong>Condições do produto:</strong> o vendedor concorda em enviar o produto <strong>nas condições descritas</strong> no anúncio/negociação.</li>
          <li><strong>Divergência:</strong> se o produto não estiver conforme descrito, ele será <strong>devolvido</strong> e o vendedor <strong>perderá a taxa</strong> da plataforma.</li>
          <li><strong>Atraso:</strong> se o vendedor enviar <strong>após o prazo</strong>, ele <strong>perderá a taxa</strong> e terá o item <strong>devolvido</strong>.</li>
        </ul>
      </div>
    ` : `
      <div class="space-y-4 text-sm text-gray-700">
        <h3 class="text-base font-semibold text-gray-900">Entrega digital</h3>

        <div>
          <div class="font-semibold text-gray-900">1. Natureza do serviço</div>
          <p>A plataforma atua exclusivamente como intermediadora da negociação, não sendo proprietária, desenvolvedora ou operadora dos jogos, contas ou serviços anunciados.</p>
        </div>

        <div>
          <div class="font-semibold text-gray-900">2. Prazo de entrega</div>
          <p>O vendedor compromete-se a realizar a entrega do produto digital dentro do prazo informado no anúncio, contado a partir da confirmação do pagamento e aprovação da negociação pela plataforma.</p>
          <p class="mt-1">O descumprimento do prazo poderá resultar em cancelamento da negociação, a critério da plataforma.</p>
        </div>

        <div>
          <div class="font-semibold text-gray-900">3. Confirmação de entrega</div>
          <p>A entrega será considerada concluída quando ocorrer uma das seguintes situações:</p>
          <ul class="list-disc pl-5 mt-2 space-y-1">
            <li>o comprador confirmar o recebimento do produto dentro da plataforma; ou</li>
            <li>o prazo de confirmação expirar sem contestação por parte do comprador.</li>
          </ul>
          <p class="mt-2">Após a confirmação da entrega, o valor retido será liberado ao vendedor, descontadas as taxas aplicáveis.</p>
        </div>

        <div>
          <div class="font-semibold text-gray-900">4. Dados sensíveis</div>
          <p>É expressamente proibido inserir login, senha, códigos de verificação ou dados pessoais em campos públicos.</p>
          <p class="mt-1">A troca de informações sensíveis deverá ocorrer exclusivamente pelos canais autorizados da plataforma, quando solicitada durante a negociação.</p>
        </div>

        <div>
          <div class="font-semibold text-gray-900">5. Responsabilidade sobre contas e punições</div>
          <p>O vendedor declara ser responsável pela procedência, legitimidade e veracidade das informações do produto anunciado.</p>
          <p class="mt-1">A plataforma não garante:</p>
          <ul class="list-disc pl-5 mt-2 space-y-1">
            <li>a permanência da conta ou do produto após a entrega;</li>
            <li>a inexistência de punições, bloqueios ou sanções aplicadas pelos desenvolvedores do jogo;</li>
            <li>a continuidade do acesso após a confirmação da entrega.</li>
          </ul>
          <p class="mt-2">Punições aplicadas após a confirmação da entrega não são de responsabilidade da plataforma.</p>
        </div>

        <div>
          <div class="font-semibold text-gray-900">6. Disputas</div>
          <p>O comprador poderá abrir disputa dentro do prazo definido pela plataforma, caso identifique divergência entre o produto entregue e o anunciado.</p>
          <p class="mt-1">Na análise da disputa, a plataforma poderá considerar:</p>
          <ul class="list-disc pl-5 mt-2 space-y-1">
            <li>informações fornecidas no anúncio;</li>
            <li>registros internos da negociação;</li>
            <li>evidências apresentadas pelas partes.</li>
          </ul>
          <p class="mt-2">A decisão da plataforma será final e vinculante para fins da negociação.</p>
        </div>

        <div>
          <div class="font-semibold text-gray-900">7. Comunicação externa</div>
          <p>É proibida a realização de negociações, troca de dados sensíveis ou pagamentos fora da plataforma.</p>
          <p class="mt-1">O descumprimento poderá resultar em:</p>
          <ul class="list-disc pl-5 mt-2 space-y-1">
            <li>cancelamento da negociação;</li>
            <li>retenção de valores;</li>
            <li>suspensão ou encerramento da conta do usuário.</li>
          </ul>
        </div>

        <div>
          <div class="font-semibold text-gray-900">8. Taxa de intermediação</div>
          <p>Pela prestação do serviço de intermediação, será cobrada taxa variável, calculada com base no valor total do produto anunciado, conforme o Guia de Taxas – Itens Digitais vigente no momento da negociação.</p>
          <p class="mt-1">A taxa:</p>
          <ul class="list-disc pl-5 mt-2 space-y-1">
            <li>será informada de forma clara antes da confirmação da negociação;</li>
            <li>poderá variar conforme o valor do produto;</li>
            <li>poderá ser descontada automaticamente do valor a receber ou paga separadamente, conforme opção selecionada pelo vendedor.</li>
          </ul>
          <p class="mt-2">O valor líquido a ser recebido pelo vendedor será exibido antes da confirmação final.</p>
        </div>

        <div>
          <div class="font-semibold text-gray-900">9. Aceite</div>
          <p>Ao confirmar a negociação, o usuário declara que:</p>
          <ul class="list-disc pl-5 mt-2 space-y-1">
            <li>leu e compreendeu os termos;</li>
            <li>concorda integralmente com as condições descritas;</li>
            <li>reconhece o papel da plataforma como intermediadora.</li>
          </ul>
        </div>

        <div class="pt-2">
          <div class="font-semibold text-gray-900">💰 Guia de Taxas – Itens Digitais</div>
          <div class="mt-2 border border-gray-200 rounded-lg overflow-hidden">
            <div class="grid grid-cols-2 bg-gray-50 text-xs font-semibold text-gray-600">
              <div class="px-3 py-2">Faixa</div>
              <div class="px-3 py-2">Taxa</div>
            </div>
            <div class="grid grid-cols-2 text-sm">
              <div class="px-3 py-2 border-t border-gray-200">Até R$ 50,00</div>
              <div class="px-3 py-2 border-t border-gray-200">R$ 3,00</div>
              <div class="px-3 py-2 border-t border-gray-200">De R$ 50,01 até R$ 150,00</div>
              <div class="px-3 py-2 border-t border-gray-200">R$ 5,00</div>
              <div class="px-3 py-2 border-t border-gray-200">De R$ 150,01 até R$ 350,00</div>
              <div class="px-3 py-2 border-t border-gray-200">R$ 10,00</div>
              <div class="px-3 py-2 border-t border-gray-200">Acima de R$ 350,00</div>
              <div class="px-3 py-2 border-t border-gray-200">R$ 15,00</div>
            </div>
          </div>
        </div>

        <div>
          <div class="font-semibold text-gray-900">🔒 Transparência financeira</div>
          <p>O valor do produto, o valor da taxa e o valor líquido a ser recebido pelo vendedor serão sempre apresentados antes da confirmação da negociação.</p>
        </div>

        <div>
          <div class="font-semibold text-gray-900">✅ Confirmação</div>
          <p>☑ Confirmo que li e concordo com os termos e condições da negociação.</p>
        </div>
      </div>
    `;

    const termsModalHtml = `
      <div data-create-terms-modal class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4 ${state.showCreateTerms && step === 4 ? '' : 'hidden'}">
        <div class="bg-white rounded-2xl shadow-card-xl max-w-3xl w-full overflow-hidden animate-slide-up">
          <div class="h-1 bg-gradient-to-r from-primary-600 to-secondary-500"></div>
          <div class="p-4 sm:p-6 border-b border-gray-100">
            <h3 class="text-lg font-semibold text-gray-900">Termos de condição</h3>
            <p class="text-sm text-gray-500">Leia atentamente antes de continuar.</p>
          </div>
          <div class="p-4 sm:p-6 max-h-[60vh] overflow-y-auto">
            ${termsContentHtml}
          </div>
          <div class="p-4 sm:p-6 border-t border-gray-100 flex flex-col sm:flex-row gap-3 justify-end">
            <button type="button" class="px-5 py-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition" data-action="declineCreateTerms">Discordo</button>
            <button type="button" class="px-5 py-3 rounded-lg bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 text-white font-bold transition" data-action="acceptCreateTerms">Concordo</button>
          </div>
        </div>
      </div>
    `;

    return `
      <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div data-create-neg-modal class="bg-white rounded-2xl shadow-card-xl max-w-2xl w-full my-4 overflow-hidden animate-slide-up">
          <div class="h-1 bg-gradient-to-r from-primary-600 to-secondary-500"></div>
          <header class="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100">
            <div>
              <h2 class="text-xl font-bold text-gray-900">Nova Negociação</h2>
              <p class="text-gray-500 text-sm" data-create-step-title>${['Essencial', 'Detalhes', 'Comprador', 'Confirmar'][step - 1] || 'Preencha os dados'}</p>
            </div>
            <button class="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors" data-action="closeCreateNegotiation">✕</button>
          </header>

          <div class="px-4 sm:px-6 pt-4">
            <div class="grid grid-cols-4 gap-2">
              ${[1,2,3,4].map((n) => `
                <button
                  type="button"
                  class="px-3 py-2 rounded-lg text-xs font-bold text-center transition ${n <= step ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700'}"
                  data-create-step-indicator="${n}"
                  data-action="goToCreateNegStep"
                  data-step="${n}"
                  ${n <= step ? '' : 'disabled'}
                >
                  Etapa ${n}
                </button>
              `).join('')}
            </div>
          </div>
          
          <form data-action="createNegotiation" novalidate class="p-4 sm:p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            <!-- STEP 1: Essencial -->
            <section class="space-y-5 ${step === 1 ? '' : 'hidden'}" data-create-step="1">
              <div>
                <label class="block text-sm text-gray-700 font-medium mb-2">Tipo de negociação *</label>
                <select name="negotiation_type" required data-action="updateNegFormField" data-field="negotiationType" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                  <option value="" ${!negotiationType ? 'selected' : ''}>Selecione</option>
                  <option value="digital" ${negotiationType === 'digital' ? 'selected' : ''}>Digital</option>
                  <option value="physical" ${negotiationType === 'physical' ? 'selected' : ''}>Física</option>
                </select>
                <p class="text-xs text-gray-500 mt-1">O endereço só será solicitado se exigir envio físico.</p>
              </div>

              <div>
                <label class="block text-sm text-gray-700 font-medium mb-2">Categoria *</label>
                <select name="category" required data-focus-key="create-neg-category" data-action="updateNegFormField" data-field="category" ${!negotiationType ? 'disabled' : ''} class="w-full px-4 py-3 ${!negotiationType ? 'bg-gray-200 text-gray-600 cursor-not-allowed' : 'bg-gray-50 text-gray-700'} border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                  <option value="" ${!selectedCategory ? 'selected' : ''}>${!negotiationType ? 'Selecione o tipo primeiro' : 'Selecione uma categoria'}</option>
                  ${categoryOptions.map(cat => `<option value="${escapeAttr(cat)}" ${selectedCategory === cat ? 'selected' : ''}>${escapeHtml(cat)}</option>`).join('')}
                </select>
                ${negotiationType ? '' : '<p class="text-xs text-gray-500 mt-1"><i class="fas fa-info-circle mr-1"></i>Escolha o tipo para liberar as categorias.</p>'}
              </div>


              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm text-gray-700 font-medium mb-2">Valor (R$) *</label>
                  <input type="text" name="price" required inputmode="decimal" autocomplete="off" placeholder="0,00" data-action="updateNegFormField" data-field="price" data-focus-key="create-neg-price" value="${escapeAttr(state.createNegForm?.price || '')}" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                  <span class="text-xs text-gray-400 mt-1 block">Mínimo R$ 50,00 - Máximo R$ 100.000,00</span>
                </div>
                <div>
                  <div data-create-neg-deadline>
                    ${renderCreateNegotiationDeadlineField()}
                  </div>
                </div>
              </div>

              <div class="flex flex-col sm:flex-row gap-3 pt-2">
                <button type="button" class="flex-1 px-4 py-3 bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 rounded-lg text-white font-bold transition" data-action="nextCreateNegStep">
                  Continuar negociação
                </button>
              </div>
            </section>

            <!-- STEP 2: Detalhes -->
            <section class="space-y-5 ${step === 2 ? '' : 'hidden'}" data-create-step="2">
              ${showServiceProductFlow ? `
                <div class="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                  Para serviços, o título é gerado automaticamente pelo serviço + jogo.
                </div>
              ` : (useUniversalGameProductFlow ? `
                <div class="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                  Para este tipo de anúncio, o <strong>título</strong> (e quando necessário a <strong>descrição</strong>) é gerado automaticamente pelo <strong>nome do jogo + nome do produto</strong>.
                </div>
              ` : `
                <div>
                  <label class="block text-sm text-gray-700 font-medium mb-2">Título do produto *</label>
                  <input type="text" name="title" required maxlength="255" placeholder="Ex: Conta nível 80 com 3 skins" data-focus-key="create-neg-title" data-action="updateNegFormField" data-field="title" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                </div>
              `)}

              <div data-create-neg-service-product></div>

              <div data-create-neg-structured>
                
              </div>

              <div data-create-neg-currency>
                
              </div>

              <div data-create-neg-description>
                
              </div>

              <div data-create-neg-photos>
                
              </div>

              <div class="flex flex-col sm:flex-row gap-3 pt-2">
                <button type="button" class="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition" data-action="prevCreateNegStep">Voltar</button>
                <button type="button" class="flex-1 px-4 py-3 bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 rounded-lg text-white font-bold transition" data-action="nextCreateNegStep">Continuar</button>
              </div>
            </section>

            <!-- STEP 3: Comprador -->
            <section class="space-y-5 ${step === 3 ? '' : 'hidden'}" data-create-step="3">
              <div data-create-neg-service-schedule></div>

              <div class="space-y-2">
                <label class="block text-sm text-gray-700 font-medium">Usuário do comprador *</label>
                <p class="text-xs text-gray-500">Digite no formato <strong>nome#id</strong> (ex: <strong>henrique#15</strong>) e clique em <strong>Buscar</strong> para confirmar o cadastro.</p>
                <div class="flex flex-col sm:flex-row gap-2">
                  <input type="text" name="buyer_tag" required placeholder="henrique#15" class="flex-1 px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" data-action="updateNegFormField" data-field="buyerTag" data-focus-key="create-neg-buyer-tag">
                  <button type="button" class="w-full sm:w-auto px-4 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-700 transition" data-action="searchBuyer">
                    ${buyerSearching ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-search"></i>'}
                  </button>
                </div>
                <div class="p-3 bg-primary-50 border border-primary-100 rounded-lg text-primary-700 text-xs flex items-center gap-2">
                  <i class="fas fa-info-circle"></i>
                  <span>O endereço só será solicitado se a negociação exigir <strong>envio físico</strong>.</span>
                </div>
                ${buyerFound === false ? `
                  <div class="p-3 bg-danger-50 border border-danger-200 rounded-lg text-danger-700 text-sm">
                    <i class="fas fa-exclamation-circle mr-2"></i>Comprador não encontrado. Verifique a tag (nome#id) ou peça para se cadastrar.
                  </div>
                ` : ''}
                ${buyerFound ? `
                  <div class="p-3 bg-success-50 border border-success-200 rounded-lg text-success-700 text-sm flex items-center gap-3">
                    <i class="fas fa-check-circle text-lg"></i>
                    <div>
                      <strong>${escapeHtml(buyerFound.short_name || buyerFound.shortName || buyerFound.name)}</strong>
                    </div>
                  </div>
                ` : ''}
              </div>

              <div class="flex flex-col sm:flex-row gap-3 pt-2">
                <button type="button" class="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition" data-action="prevCreateNegStep">Voltar</button>
                <button type="button" class="flex-1 px-4 py-3 bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 rounded-lg text-white font-bold transition" data-action="nextCreateNegStep" ${!buyerFound ? 'disabled' : ''}>
                  Continuar
                </button>
              </div>
            </section>

            <!-- STEP 4: Confirmar -->
            <section class="space-y-5 ${step === 4 ? '' : 'hidden'}" data-create-step="4">
              <div class="p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 space-y-2">
                <div class="font-semibold text-gray-900">Resumo</div>
                <div><strong>Categoria:</strong> ${escapeHtml(selectedCategory || '-')}</div>
                <div><strong>Tipo:</strong> ${isDigital ? 'Digital' : 'Física'}</div>
                <div><strong>Valor:</strong> R$ ${(priceNum || 0).toFixed(2).replace('.', ',')}</div>
                <div><strong>Prazo:</strong> ${getCreateNegotiationDeadlineCopy().kind === 'selectable_days'
                  ? `até ${getCreateNegotiationDeadlineCopy().days} dia${getCreateNegotiationDeadlineCopy().days === 1 ? '' : 's'}`
                  : `até ${DIGITAL_DELIVERY_DEADLINE_BUSINESS_DAYS} dias úteis`
                }</div>
              </div>

              <div class="p-4 bg-white border border-warning-200 rounded-xl shadow-sm">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <div class="flex items-center gap-2 text-warning-700 font-semibold">
                      <i class="fas fa-file-contract"></i>
                      Termos de condição
                    </div>
                    <p class="text-xs text-gray-600 mt-1">
                      ${termsAccepted ? 'Você já concordou com os termos desta negociação.' : 'Leia os termos completos e escolha concordar ou discordar.'}
                    </p>
                  </div>
                  <button type="button" class="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition" data-action="openCreateTerms">
                    Ver termos
                  </button>
                </div>
              </div>

              <input type="hidden" name="terms_accepted" value="${termsAccepted ? '1' : ''}">

              ${feeSummaryHtml}
              <div data-create-fee-guide></div>

              <div class="p-4 bg-white border border-warning-200 rounded-xl shadow-sm">
                <div class="flex items-center gap-2 text-warning-700 font-semibold mb-2">
                  <i class="fas fa-shield-alt"></i>
                  Transparência e próximos passos
                </div>
                <ul class="text-sm text-gray-600 space-y-2 text-left">
                  <li>🔒 O dinheiro fica retido até a confirmação de entrega.</li>
                  <li>📌 O vendedor deve cumprir o prazo informado após aprovação/pagamento.</li>
                </ul>
              </div>

              <div class="flex flex-col sm:flex-row gap-3 pt-2">
                <button type="button" class="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition" data-action="prevCreateNegStep">Voltar</button>
                <button type="submit" class="flex-1 px-4 py-3 bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 rounded-lg text-white font-bold transition disabled:opacity-50 disabled:cursor-not-allowed" ${!buyerFound ? 'disabled' : ''}>
                  <i class="fas fa-paper-plane mr-2"></i>Criar negociação
                </button>
              </div>
            </section>
          </form>
        </div>
      </div>
      ${termsModalHtml}
    `;
  }

  function renderDashboardSummary() {
    const list = Array.isArray(state.negotiations) ? state.negotiations : [];
    if (!list.length) {
      return `
        <div class="text-center py-12 text-gray-500">
          <div class="w-16 h-16 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <i class="fas fa-folder-open text-white text-2xl"></i>
          </div>
          <p class="mb-4 text-gray-600">Sem negociações carregadas ainda.</p>
          <button class="px-6 py-3 bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 rounded-lg text-white font-bold transition" data-action="dashboardRefresh">Atualizar agora</button>
        </div>
      `;
    }
    const total = list.length;
    const active = list.filter((item) => !['delivered', 'cancelled', 'rejected_by_admin', 'expired'].includes(item?.status)).length;
    const awaiting = list.filter((item) => item?.status === 'awaiting_admin_approval').length;
    const delivered = list.filter((item) => item?.status === 'delivered').length;

    const metric = (label, value, iconClass, valueClass) => `
      <div class="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
        <div class="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-600">
          <i class="fas ${iconClass}"></i>
        </div>
        <div class="min-w-0">
          <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide truncate">${escapeHtml(label)}</div>
          <div class="text-lg font-extrabold ${valueClass}">${Number(value) || 0}</div>
        </div>
      </div>
    `;

    return `
      <article class="sm:hidden bg-white rounded-2xl p-4 shadow-card border border-gray-100">
        <div class="grid grid-cols-1 gap-3">
          <div class="grid grid-cols-2 gap-3">
            ${metric('Total', total, 'fa-chart-bar', 'text-gray-800')}
            ${metric('Em andamento', active, 'fa-clock', 'text-gray-800')}
          </div>
          <div class="grid grid-cols-2 gap-3">
            ${metric('Aguardando aprovação', awaiting, 'fa-hourglass-half', 'text-gray-800')}
            ${metric('Entregues', delivered, 'fa-check-circle', 'text-gray-800')}
          </div>
        </div>
      </article>

      <section class="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        ${renderSummaryCard('Total', total, 'fa-chart-bar', 'Resumo de negociações registradas', 'from-primary-500 to-secondary-500')}
        ${renderSummaryCard('Em andamento', active, 'fa-clock', 'Negociações ainda não finalizadas', 'from-warning-500 to-danger-400')}
        ${renderSummaryCard('Aguardando aprovação', awaiting, 'fa-hourglass-half', 'Necessitam análise da intermediadora', 'from-secondary-500 to-primary-500')}
        ${renderSummaryCard('Entregues', delivered, 'fa-check-circle', 'Finalizadas com sucesso', 'from-success-500 to-secondary-500')}
      </section>
    `;
  }

  function renderSummaryCard(label, value, icon, description, gradient) {
    return `
      <article class="bg-white rounded-xl p-5 shadow-card border border-gray-100 hover:shadow-card-lg transition-all duration-300">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} text-white flex items-center justify-center shadow-lg">
            <i class="fas ${icon} text-lg"></i>
          </div>
          <div>
            <span class="text-xs font-medium text-gray-500 uppercase tracking-wide">${escapeHtml(label)}</span>
            <div class="text-2xl font-bold text-gray-800">${Number(value) || 0}</div>
          </div>
        </div>
        <p class="text-xs text-gray-500 leading-snug">${escapeHtml(description)}</p>
      </article>
    `;
  }

  function renderNegotiationsTable(negotiations, meta = null) {
    if (!negotiations.length) {
      return `
        <div class="bg-white rounded-2xl border border-gray-100 shadow-card p-12 text-center">
          <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-inbox text-gray-400 text-2xl"></i>
          </div>
          <p class="text-gray-500 mb-4">Nenhuma negociação encontrada.</p>
          <button class="px-4 py-2 bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 rounded-lg text-white text-sm font-medium transition" data-action="dashboardRefresh">
            <i class="fas fa-sync-alt mr-2"></i>Atualizar
          </button>
        </div>
      `;
    }
    const rows = negotiations.map((neg) => renderNegotiationRow(neg)).join('');
    const totalCount = meta && typeof meta.totalCount === 'number' ? meta.totalCount : negotiations.length;
    const totalLabel = totalCount === 1 ? '1 negociação' : `${totalCount} negociações`;
    const totalPages = meta && typeof meta.totalPages === 'number' ? meta.totalPages : 1;
    const page = meta && typeof meta.page === 'number' ? meta.page : 1;
    const showingLabel = meta && typeof meta.startIndex === 'number' && typeof meta.endIndex === 'number'
      ? `Mostrando ${meta.startIndex + 1}–${meta.endIndex} de ${totalCount}`
      : '';
    return `
      <div class="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <div class="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <h2 class="text-base font-bold text-gray-900">Negociações</h2>
          <span class="text-xs text-gray-500">${totalLabel}</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-white">
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">#</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Produto</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Comprador</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Vendedor</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Atualizado</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 bg-white">
              ${rows}
            </tbody>
          </table>
        </div>
        <div class="px-5 py-4 border-t border-gray-100 bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div class="text-xs text-gray-500">${escapeHtml(showingLabel || totalLabel)}${totalPages > 1 ? ` • Página ${page}/${totalPages}` : ''}</div>
          ${totalPages > 1 ? `
            <div class="flex items-center gap-3">
              <button type="button" class="px-4 py-2 bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 rounded-lg text-white text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed" data-action="dashboardPrevPage" ${page <= 1 ? 'disabled' : ''}>
                Anterior
              </button>
              <button type="button" class="px-4 py-2 bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 rounded-lg text-white text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed" data-action="dashboardNextPage" ${page >= totalPages ? 'disabled' : ''}>
                Próxima
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  function maskEmail(email) {
    if (!email) return '—';
    const raw = String(email).trim();
    const at = raw.indexOf('@');
    if (at <= 0) return '—';
    const local = raw.slice(0, at);
    const domain = raw.slice(at + 1);
    const prefix = local.length <= 3 ? local.slice(0, 1) : local.slice(0, 3);
    return `${prefix}****@${domain}`;
  }

  function getRelevantCounterparty(neg) {
    const buyer = neg?.buyer || {};
    const seller = neg?.seller || {};
    if (isBuyer(neg)) {
      return { label: 'Vendedor', name: seller.name || '—', email: maskEmail(seller.email) };
    }
    if (isSeller(neg)) {
      return { label: 'Comprador', name: buyer.name || '—', email: maskEmail(buyer.email) };
    }
    // Fallback: quando não dá pra identificar o papel
    const buyerLine = buyer.name ? `${buyer.name} (${maskEmail(buyer.email)})` : '—';
    const sellerLine = seller.name ? `${seller.name} (${maskEmail(seller.email)})` : '—';
    return { label: 'Participantes', name: `${buyerLine} • ${sellerLine}`, email: '' };
  }

  function getMobilePrimaryCta(neg) {
    const status = neg?.status || 'unknown';
    if (status === 'waiting_payment') {
      return { label: 'Pagar agora', icon: 'fa-credit-card', variant: 'urgent' };
    }
    if (status === 'pending_acceptance') {
      return { label: 'Responder convite', icon: 'fa-reply', variant: 'primary' };
    }
    if (status === 'waiting_shipment') {
      return { label: 'Ver instruções', icon: 'fa-box' };
    }
    if (['shipped', 'at_intermediary', 'approved', 'awaiting_admin_approval'].includes(status)) {
      return { label: 'Acompanhar', icon: 'fa-stream' };
    }
    return { label: 'Ver detalhes', icon: 'fa-chevron-right' };
  }

  function renderNegotiationsCardsMobile(negotiations, meta = null) {
    if (!negotiations.length) {
      return `
        <div class="bg-white rounded-2xl border border-gray-100 shadow-card p-6 text-center">
          <div class="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <i class="fas fa-inbox text-gray-400 text-xl"></i>
          </div>
          <p class="text-gray-600 font-medium">Nenhuma negociação encontrada.</p>
          <p class="text-xs text-gray-500 mt-1">Ajuste os filtros ou atualize.</p>
          <button class="mt-4 w-full px-4 py-3 bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 rounded-xl text-white font-semibold transition" data-action="dashboardRefresh">
            <i class="fas fa-sync-alt mr-2"></i>Atualizar
          </button>
        </div>
      `;
    }

    const totalCount = meta && typeof meta.totalCount === 'number' ? meta.totalCount : negotiations.length;
    const totalPages = meta && typeof meta.totalPages === 'number' ? meta.totalPages : 1;
    const page = meta && typeof meta.page === 'number' ? meta.page : 1;
    const showingLabel = meta && typeof meta.startIndex === 'number' && typeof meta.endIndex === 'number'
      ? `Mostrando ${meta.startIndex + 1}–${meta.endIndex} de ${totalCount}`
      : (totalCount === 1 ? '1 negociação' : `${totalCount} negociações`);

    const itemsHtml = negotiations.map((neg) => {
      const productTitle = neg?.product_title || neg?.product_name || neg?.title || 'Produto';
      const status = neg?.status || 'unknown';
      const displayStatus = getNegotiationDisplayStatus(neg, state.user?.role);
      const idLabel = neg?.id != null ? `#${neg.id}` : '—';
      const updatedRaw = neg?.updated_at || neg?.created_at;
      const updatedShort = updatedRaw ? formatShortDate(updatedRaw) : '—';
      const priority = getStatusPriority(status, neg);
      const needsAction = priority <= 2;
      const cta = getMobilePrimaryCta(neg);
      const buyerNameFull = neg?.buyer?.name || '—';
      const buyerName = getFirstName(buyerNameFull);

      const ctaVariant = cta?.variant || 'primary';
      const ctaButtonClass = ctaVariant === 'urgent'
        ? 'bg-warning-600 hover:bg-warning-700'
        : 'bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600';
      const ctaLeadingIcon = ctaVariant === 'urgent' ? '<i class="fas fa-exclamation-triangle"></i>' : '';


      return `
        <article
          class="bg-white rounded-2xl border border-gray-100 shadow-card p-4 hover:shadow-card-lg transition cursor-pointer"
          data-action="openNegotiation"
          data-id="${neg?.id}"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="text-xs text-gray-500 font-semibold">Negociação ${escapeHtml(idLabel)}</div>
              <h3 class="text-lg font-extrabold text-gray-900 mt-0.5 overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
                ${escapeHtml(productTitle)}
              </h3>
            </div>
            <div class="flex-shrink-0">${renderStatusBadgeEnhanced(displayStatus)}</div>
          </div>

          <div class="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div class="min-w-0">
              <div class="text-xs text-gray-500">Comprador</div>
              <div class="text-sm font-medium text-gray-700 truncate">${escapeHtml(buyerName)}</div>
              <div class="text-xs text-gray-500 truncate hidden sm:block">Atualizado ${escapeHtml(updatedShort)}</div>
            </div>

            <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:flex-shrink-0">
              ${needsAction ? `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold"><i class="fas fa-exclamation-triangle"></i>Ação</span>` : ''}
              <button
                type="button"
                class="w-full sm:w-auto justify-center px-3 py-2 rounded-lg ${ctaButtonClass} text-white text-sm font-semibold shadow-sm transition flex items-center gap-2"
                data-action="openNegotiation"
                data-id="${neg?.id}"
              >
                ${ctaLeadingIcon}
                <i class="fas ${cta.icon}"></i>
                ${escapeHtml(cta.label)}
              </button>
              <div class="text-[11px] text-gray-500 sm:hidden">Atualizado ${escapeHtml(updatedShort)}</div>
            </div>
          </div>

        </article>
      `;
    }).join('');

    return `
      <div class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          ${itemsHtml}
        </div>

        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div class="text-xs text-gray-500">${escapeHtml(showingLabel)}${totalPages > 1 ? ` • Página ${page}/${totalPages}` : ''}</div>
          ${totalPages > 1 ? `
            <div class="flex items-center gap-3">
              <button type="button" class="flex-1 sm:flex-none px-4 py-3 bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 rounded-xl text-white text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed" data-action="dashboardPrevPage" ${page <= 1 ? 'disabled' : ''}>
                Anterior
              </button>
              <button type="button" class="flex-1 sm:flex-none px-4 py-3 bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 rounded-xl text-white text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed" data-action="dashboardNextPage" ${page >= totalPages ? 'disabled' : ''}>
                Próxima
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  function renderNegotiationRow(neg) {
    const buyerName = neg?.buyer?.name || '—';
    const sellerName = neg?.seller?.name || '—';
    const productTitle = neg?.product_title || neg?.product_name || neg?.title || 'Produto';
    const status = neg?.status || 'unknown';
    const displayStatus = getNegotiationDisplayStatus(neg, state.user?.role);
    const priority = getStatusPriority(status, neg);
    const needsAction = priority <= 2;
    const idLabel = neg?.id != null ? `#${neg.id}` : '—';
    const updatedRaw = neg?.updated_at || neg?.created_at;
    const updatedRelative = formatRelativeTime(updatedRaw);
    const updatedAbsolute = updatedRaw ? formatDateTime(updatedRaw) : '';
    const actionBadge = needsAction
      ? `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-200"><i class="fas fa-exclamation-triangle"></i>Ação necessária</span>`
      : '';

    
    return `
      <tr class="hover:bg-gray-50 transition cursor-pointer ${needsAction ? 'bg-orange-50' : ''}" data-action="openNegotiation" data-id="${neg?.id}">
        <td class="px-4 py-3">
          <div class="w-12 h-12 rounded-lg bg-gray-100 text-gray-600 font-semibold flex items-center justify-center">${escapeHtml(idLabel)}</div>
        </td>
        <td class="px-4 py-3">
          <div class="font-semibold text-gray-800">${escapeHtml(productTitle)}</div>
          ${actionBadge ? `<div class="mt-2">${actionBadge}</div>` : ''}
        </td>
        <td class="px-4 py-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-gray-100 text-gray-600 font-semibold flex items-center justify-center uppercase">${escapeHtml(getInitials(buyerName))}</div>
            <div>
              <div class="font-medium text-gray-800">${escapeHtml(buyerName)}</div>
              <span class="text-xs text-gray-500">Comprador</span>
            </div>
          </div>
        </td>
        <td class="px-4 py-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-gray-100 text-gray-600 font-semibold flex items-center justify-center uppercase">${escapeHtml(getInitials(sellerName))}</div>
            <div>
              <div class="font-medium text-gray-800">${escapeHtml(sellerName)}</div>
              <span class="text-xs text-gray-500">Vendedor</span>
            </div>
          </div>
        </td>
        <td class="px-4 py-3">
          ${renderStatusBadgeEnhanced(displayStatus)}
        </td>
        <td class="px-4 py-3">
          <div class="flex items-center gap-2 text-sm text-gray-600">
            <i class="fas fa-clock text-gray-400"></i>
            <span${updatedAbsolute ? ` title="${escapeAttr(updatedAbsolute)}"` : ''}>${escapeHtml(updatedRelative)}</span>
          </div>
        </td>
      </tr>
    `;
  }

  function renderStatusBadge(status) {
    const label = STATUS_LABELS[status] || status || '—';
    const colorClass = STATUS_BADGE_COLORS[status] || 'bg-gray-600';
    return `<span class="inline-block px-2 py-1 rounded-full text-xs font-medium ${colorClass}">${escapeHtml(label)}</span>`;
  }

  function getNegotiationDisplayStatus(neg, role) {
    const status = String(neg?.status || '').trim() || '—';
    const r = String(role || state.user?.role || '').trim();
    if (r !== 'seller') return status;

    // After seller confirms sending/delivery, show a clearer status to the seller.
    // UI-only: backend status stays the same.
    // We rely on explicit "seller sent"/"info sent" timestamps where possible.
    const category = String(neg?.category || '').trim();
    const isGold = category === CATEGORY_CURRENCY;

    if (isGold) {
      const sellerSent = Boolean(neg?.gold_delivery?.seller_sent_confirmed_at);
      const buyerReceived = Boolean(neg?.gold_delivery?.buyer_received_confirmed_at);
      if (sellerSent && !buyerReceived) return 'pending_receipt';
      return status;
    }

    const buyerConfirmed = Boolean(neg?.buyer_confirmed_at);
    const sellerSentDigitalInfo = Boolean(neg?.digital_delivery?.seller_info_sent_at)
      || Boolean(neg?.game_account?.seller_info_sent_at);
    if (sellerSentDigitalInfo && !buyerConfirmed) return 'pending_receipt';

    // Physical shipments: once seller posted to the intermediary, wait for receipt confirmation.
    const sellerShipped = Boolean(neg?.sent_to_intermediary_at) || Boolean(neg?.shipped_at);
    if (sellerShipped && !buyerConfirmed) return 'pending_receipt';

    return status;
  }

  function renderStatusBadgeEnhanced(status) {
    const label = STATUS_LABELS[status] || status || '—';
    const statusConfig = {
      awaiting_admin_approval: { bg: 'bg-primary-100', text: 'text-primary-700', border: 'border-primary-200', icon: 'fa-hourglass-half' },
      pending_acceptance: { bg: 'bg-secondary-100', text: 'text-secondary-700', border: 'border-secondary-200', icon: 'fa-user-plus' },
      waiting_payment: { bg: 'bg-warning-100', text: 'text-warning-700', border: 'border-warning-200', icon: 'fa-credit-card' },
      waiting_shipment: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200', icon: 'fa-box' },
      shipped: { bg: 'bg-secondary-100', text: 'text-secondary-700', border: 'border-secondary-200', icon: 'fa-truck' },
      at_intermediary: { bg: 'bg-secondary-100', text: 'text-secondary-700', border: 'border-secondary-200', icon: 'fa-warehouse' },
      pending_receipt: { bg: 'bg-warning-50', text: 'text-warning-800', border: 'border-warning-200', icon: 'fa-hourglass' },
      approved: { bg: 'bg-success-100', text: 'text-success-700', border: 'border-success-200', icon: 'fa-check-circle' },
      delivered: { bg: 'bg-success-100', text: 'text-success-700', border: 'border-success-200', icon: 'fa-flag-checkered' },
      rejected_by_admin: { bg: 'bg-danger-100', text: 'text-danger-700', border: 'border-danger-200', icon: 'fa-times-circle' },
      cancelled: { bg: 'bg-danger-100', text: 'text-danger-700', border: 'border-danger-200', icon: 'fa-ban' },
      expired: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200', icon: 'fa-clock' }
    };
    const config = statusConfig[status] || { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200', icon: 'fa-question' };
    return `
      <div class="flex flex-col gap-1">
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${config.bg} ${config.text} border ${config.border}">
          <i class="fas ${config.icon}"></i>
          <span class="truncate">${escapeHtml(label)}</span>
        </span>
      </div>
    `;
  }

  function getInitials(name) {
    if (!name) {
      return '?';
    }
    const normalized = String(name).trim();
    if (!normalized || normalized === '—') {
      return '?';
    }
    const parts = normalized.split(/\s+/).filter(Boolean);
    if (!parts.length) {
      return '?';
    }
    return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
  }

  function getFirstName(name) {
    if (!name) return '—';
    const normalized = String(name).trim();
    if (!normalized || normalized === '—') return '—';
    const parts = normalized.split(/\s+/).filter(Boolean);
    return parts.length ? parts[0] : '—';
  }

  function renderNegotiationDetailPage() {
    const negotiation = state.currentNegotiation;
    if (!negotiation) {
      return `
        <section class="space-y-6">
          <header>
            <h1 class="text-2xl font-bold text-gray-900">Negociação</h1>
            <p class="text-gray-500">Carregando detalhes...</p>
          </header>
        </section>
      `;
    }

    const buyer = negotiation.buyer || negotiation.buyer_user || negotiation.buyerUser || {};
    const seller = negotiation.seller || negotiation.seller_user || negotiation.sellerUser || {};
    const intermediatorAssigned = negotiation.intermediator || null;
    const intermediatorCode = intermediatorAssigned?.code ?? intermediatorAssigned?.intermediator_code ?? null;
    const intermediatorIsPrincipal = Boolean(intermediatorAssigned?.is_principal ?? intermediatorAssigned?.is_intermediator_principal);
    const intermediatorAssignedId = intermediatorAssigned?.id ? Number(intermediatorAssigned.id) : null;
    const intermediatorBadgeText = `Intermediador${intermediatorAssignedId ? ` #${intermediatorAssignedId}` : (intermediatorCode ? ` #${intermediatorCode}` : '')}`;
    const intermediatorDisplayName = intermediatorAssigned
      ? `${intermediatorAssigned?.name || 'Intermediador'}${intermediatorIsPrincipal ? ' (Principal)' : ''}`
      : 'Não atribuído';
    const intermediatorStatusText = intermediatorAssigned ? 'Atribuído' : 'Livre';
    const isSelfIntermediatorAssigned = Boolean(isIntermediator() && intermediatorAssigned?.id && Number(state.user?.id) === Number(intermediatorAssigned.id));
    const productTitle = negotiation.product_title || negotiation.product_name || negotiation.title || 'Produto';
    const isBuyerRole = isBuyer(negotiation);
    const isSellerRole = isSeller(negotiation);
    const isIntermediaryRole = isAdmin() || isIntermediator();
    const status = negotiation.status || '—';
    const displayStatus = getNegotiationDisplayStatus(negotiation, state.user?.role);

    const isCurrencyCategory = String(negotiation?.category || '').trim() === CATEGORY_CURRENCY;
    const isServiceCategory = (() => {
      const c = String(negotiation?.category || '').trim();
      return isServiceTaxonomyCategory(c) || c === CATEGORY_SERVICE;
    })();
    const isServiceExchangeCategory = String(negotiation?.category || '').trim() === CATEGORY_SERVICE_EXCHANGE;
    const serviceInfo = negotiation?.service || null;
    const goldDelivery = negotiation?.gold_delivery || null;
    const goldSellerTimes = Array.isArray(goldDelivery?.seller?.time_options) ? goldDelivery.seller.time_options : [];
    const goldBuyerTimes = Array.isArray(goldDelivery?.buyer?.time_options) ? goldDelivery.buyer.time_options : [];
    const goldSelectedTime = String(goldDelivery?.buyer_selected_time || '').trim();
    const goldScheduleConfirmedAt = String(goldDelivery?.schedule_confirmed_at || '').trim();
    const goldBuyerReceivedAt = String(goldDelivery?.buyer_received_confirmed_at || '').trim();
    const goldSellerSentAt = String(goldDelivery?.seller_sent_confirmed_at || '').trim();
    const goldBuyerCharacter = String(goldDelivery?.buyer?.character_name || '').trim();
    const goldBuyerServer = String(goldDelivery?.buyer?.server || '').trim();
    const goldBuyerFaction = String(goldDelivery?.buyer?.faction || '').trim();
    const goldBuyerNotes = String(goldDelivery?.buyer?.notes || '').trim();

    const serviceDelivery = negotiation?.service_delivery || null;
    const serviceSellerStartDates = Array.isArray(serviceDelivery?.seller?.start_date_options) ? serviceDelivery.seller.start_date_options : [];
    const serviceSellerTimeRanges = Array.isArray(serviceDelivery?.seller?.time_range_options) ? serviceDelivery.seller.time_range_options : [];
    const serviceSelectedStartDate = String(serviceDelivery?.buyer_selected_start_date || '').trim();
    const serviceSelectedTimeRange = String(serviceDelivery?.buyer_selected_time_range || '').trim();
    const serviceScheduleConfirmedAt = String(serviceDelivery?.schedule_confirmed_at || '').trim();

    const serviceEstimatedEndDate = (() => {
      const days = Number(negotiation?.delivery_days || 0);
      if (!serviceSelectedStartDate || !days || days < 1) return '';
      const start = new Date(`${serviceSelectedStartDate}T00:00:00`);
      if (Number.isNaN(start.getTime())) return '';
      const end = new Date(start);
      end.setDate(end.getDate() + days);
      return end.toISOString();
    })();

    const productPhotos = Array.isArray(negotiation?.product_photos || negotiation?.photos)
      ? (negotiation.product_photos || negotiation.photos)
      : [];
    const hasProductPhotos = productPhotos.length > 0;

    const intermediaryChecklist = negotiation?.inspection_report?.checklist ?? negotiation?.intermediary_checklist ?? null;
    const hasChecklist = Boolean(intermediaryChecklist) && (
      Array.isArray(intermediaryChecklist)
        ? intermediaryChecklist.length
        : Object.keys(intermediaryChecklist || {}).length
    );
    const hasIntermediaryReportData = Boolean(
      negotiation?.inspection_report
      || (Array.isArray(negotiation?.intermediary_photos) && negotiation.intermediary_photos.length)
      || hasChecklist
      || (negotiation?.intermediary_notes && String(negotiation.intermediary_notes).trim())
    );

    const productAmount = Number(negotiation?.product_price ?? negotiation?.price ?? 0) || 0;
    const buyerFee = getDigitalFeeByPrice(productAmount);
    const buyerTotal = productAmount + buyerFee;
    const description = negotiation.product_description || negotiation.description || '';

    const paymentProofUrl = negotiation?.buyer_payment_proof_url || null;
    const paymentProofUploadedAt = negotiation?.buyer_payment_proof_uploaded_at || null;

    const productImageButton = `
      <button
        type="button"
        class="px-4 py-2 rounded-lg text-sm font-semibold transition shadow-sm bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        data-action="openGallery"
        data-id="${negotiation.id}"
        data-index="0"
        data-type="product"
        ${hasProductPhotos ? '' : 'disabled'}
        title="${hasProductPhotos ? 'Ver fotos do produto' : 'Este produto não tem fotos'}"
      >
        Imagem do produto
      </button>
    `;

    return `
      <section class="space-y-6">
        <header class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <button class="text-primary-600 hover:text-primary-700 font-medium transition mb-2 flex items-center gap-2" data-action="navigate" data-page="${isAdmin() ? 'admin' : (isIntermediator() ? 'intermediator' : 'dashboard')}"><i class="fas fa-arrow-left"></i> Voltar</button>
            <h1 class="text-3xl font-bold text-gray-900">Negociação #${negotiation.id}</h1>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="px-4 py-2 rounded-lg text-sm font-semibold transition shadow-sm bg-white border border-gray-200 hover:border-secondary-400 text-gray-700 hover:text-secondary-600 flex items-center gap-2"
              data-action="openTimeline"
              data-id="${negotiation.id}"
              title="Ver linha do tempo"
            >
              <i class="fas fa-stream"></i>
              Linha do tempo
            </button>
            ${renderStatusBadgeEnhanced(displayStatus)}
          </div>
        </header>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          ${isCurrencyCategory ? `
            <article class="bg-white rounded-2xl p-6 shadow-card border border-gray-100">
              <div class="flex items-start justify-between gap-3 mb-4">
                <div class="min-w-0">
                  <h2 class="text-lg font-semibold text-gray-800 flex items-center gap-2"><i class="fas fa-receipt text-primary-500"></i> Resumo</h2>
                  <div class="mt-1 text-sm text-gray-600 font-medium">${escapeHtml(productTitle)}</div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  ${productImageButton}
                  ${hasIntermediaryReportData ? `
                    <button
                      type="button"
                      class="px-4 py-2 rounded-lg text-sm font-semibold transition shadow-sm bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 text-white"
                      data-action="openIntermediaryReport"
                    >
                      Relatório do intermediador
                    </button>
                  ` : ''}
                </div>
              </div>

              <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <dt class="text-gray-500">Valor do produto</dt>
                  <dd class="text-gray-700">${formatCurrency(productAmount)}</dd>
                </div>
                <div>
                  <dt class="text-gray-500">Taxa (comprador)</dt>
                  <dd class="text-gray-700">${formatCurrency(buyerFee)}</dd>
                </div>
                <div class="sm:col-span-2">
                  <dt class="text-gray-500">Total (comprador)</dt>
                  <dd class="text-gray-700">${formatCurrency(buyerTotal)}</dd>
                </div>
                <div>
                  <dt class="text-gray-500">Entrega combinada</dt>
                  <dd class="text-gray-700">${negotiation.delivery_days ? `${negotiation.delivery_days} dias` : '—'}</dd>
                </div>
                <div>
                  <dt class="text-gray-500">Quantidade (Gold/Moeda)</dt>
                  <dd class="text-gray-700">${escapeHtml(negotiation?.digital_quantity ? formatPtBrMoney(Number(negotiation.digital_quantity) || 0) : '—')}</dd>
                </div>
                <div>
                  <dt class="text-gray-500">Servidor</dt>
                  <dd class="text-gray-700">${escapeHtml(negotiation?.digital_platform_server || '—')}</dd>
                </div>
                <div class="sm:col-span-2">
                  <dt class="text-gray-500">Método de entrega</dt>
                  <dd class="text-gray-700">${escapeHtml((() => {
                    const v = String(goldDelivery?.seller?.delivery_method || negotiation?.digital_delivery_method || '').trim();
                    if (v === 'trade') return 'Trade (troca/encontro no jogo)';
                    if (v === 'mail') return 'Correio do jogo (mail)';
                    if (v === 'gift') return 'Presente (gift)';
                    return '—';
                  })())}</dd>
                </div>
              </dl>

              ${isSellerRole && displayStatus === 'pending_receipt' ? `
                <div class="mt-4 p-4 rounded-xl border border-warning-200 bg-warning-50">
                  <div class="text-sm font-semibold text-warning-800">Recebimento pendente</div>
                  <p class="text-sm text-warning-700 mt-1">Você irá receber seu dinheiro assim que o intermediador confirmar que o usuário recebeu o produto. Isso pode levar de 1h a 12hrs. Caso algum problema, entraremos em contato direto com você.</p>
                </div>
              ` : ''}
            </article>

            <article class="bg-white rounded-2xl p-6 shadow-card border border-gray-100">
              <h2 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-truck text-secondary-500"></i> Informações para entrega</h2>

              <section class="mt-6 pt-4 border-t border-gray-100">
                <h3 class="text-sm font-medium text-gray-600 mb-2">Entrega de Gold</h3>
                <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <dt class="text-gray-500">Horário escolhido</dt>
                    <dd class="text-gray-700">${escapeHtml(goldSelectedTime || '—')}</dd>
                  </div>
                  <div>
                    <dt class="text-gray-500">Agendamento confirmado</dt>
                    <dd class="text-gray-700">${escapeHtml(goldScheduleConfirmedAt ? formatDateTime(goldScheduleConfirmedAt) : '—')}</dd>
                  </div>
                  <div>
                    <dt class="text-gray-500">Horários do vendedor</dt>
                    <dd class="text-gray-700">${escapeHtml(goldSellerTimes.length ? goldSellerTimes.join(' | ') : '—')}</dd>
                  </div>
                  <div>
                    <dt class="text-gray-500">Personagem (comprador)</dt>
                    <dd class="text-gray-700">${escapeHtml(goldBuyerCharacter || '—')}</dd>
                  </div>
                  <div>
                    <dt class="text-gray-500">Servidor (comprador)</dt>
                    <dd class="text-gray-700">${escapeHtml(goldBuyerServer || '—')}</dd>
                  </div>
                  <div>
                    <dt class="text-gray-500">Facção (comprador)</dt>
                    <dd class="text-gray-700">${escapeHtml(goldBuyerFaction || '—')}</dd>
                  </div>
                  <div>
                    <dt class="text-gray-500">Horários do comprador</dt>
                    <dd class="text-gray-700">${escapeHtml(goldBuyerTimes.length ? goldBuyerTimes.join(' | ') : '—')}</dd>
                  </div>
                  <div class="sm:col-span-2">
                    <dt class="text-gray-500">Obs</dt>
                    <dd class="text-gray-700">${escapeHtml(goldBuyerNotes || '—')}</dd>
                  </div>
                </dl>

                ${isBuyerRole ? (() => {
                  const canAct = status === 'waiting_digital_delivery';
                  const canConfirmTrade = canAct && Boolean(goldScheduleConfirmedAt) && !goldBuyerReceivedAt;
                  const canSendNewTime = canAct;
                  const showForm = Boolean(state.showBuyerGoldRescheduleForm);
                  return `
                    <div class="mt-4 pt-4 border-t border-gray-100 space-y-3">
                      <div>
                        <button
                          type="button"
                          class="px-4 py-2 rounded-lg text-sm font-semibold transition shadow-sm bg-white border border-gray-200 hover:border-secondary-400 text-gray-700 hover:text-secondary-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          data-action="toggleBuyerGoldRescheduleForm"
                          data-id="${negotiation.id}"
                          ${canSendNewTime ? '' : 'disabled'}
                        >
                          Mandar novo horário
                        </button>
                        ${!canAct ? `<p class="text-xs text-gray-500 mt-1">Disponível apenas após o pagamento confirmado.</p>` : ''}
                      </div>

                      ${showForm ? `
                        <form class="p-4 rounded-xl border border-gray-200 bg-gray-50 space-y-3" data-action="submitBuyerGoldReschedule" data-id="${negotiation.id}">
                          <div>
                            <label class="block text-sm text-gray-700 font-medium mb-2">Novo horário (apenas 1) *</label>
                            <input type="time" name="gold_buyer_new_time" required class="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-success-500 focus:border-success-500 transition-all">
                            <p class="text-xs text-gray-600 mt-2">No horário informado, entrem no jogo e realizem a troca (moedas/itens) conforme combinado.</p>
                          </div>
                          <div class="flex flex-wrap gap-3">
                            <button type="submit" class="px-5 py-2.5 bg-secondary-600 hover:bg-secondary-700 rounded-lg text-white font-semibold transition flex items-center gap-2">
                              <i class="fas fa-paper-plane"></i> Enviar novo horário
                            </button>
                            <button type="button" class="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition" data-action="toggleBuyerGoldRescheduleForm" data-id="${negotiation.id}">
                              Cancelar
                            </button>
                          </div>
                        </form>
                      ` : ''}

                      <div>
                        ${goldBuyerReceivedAt ? `
                          <div class="p-4 rounded-xl border border-gray-200 bg-gray-50">
                            <p class="text-sm text-gray-700 font-semibold">Aguardando pagamento da intermediadora</p>
                            <p class="text-sm text-gray-500 mt-1">Você já confirmou o recebimento. Agora a intermediadora fará o repasse ao vendedor.</p>
                          </div>
                        ` : `
                          <button
                            type="button"
                            class="w-full px-5 py-3 bg-success-600 hover:bg-success-700 rounded-lg text-white font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                            data-action="buyerConfirmGoldReceived"
                            data-id="${negotiation.id}"
                            ${canConfirmTrade ? '' : 'disabled'}
                          >
                            Confirmar que recebi
                          </button>
                          ${!goldScheduleConfirmedAt ? `<p class="text-xs text-gray-500 mt-2">Confirme um horário antes de confirmar o recebimento.</p>` : ''}
                        `}
                      </div>
                    </div>
                  `;
                })() : ''}

                ${isSellerRole ? (() => {
                  const canAct = status === 'waiting_digital_delivery';
                  const canConfirmDelivery = canAct && Boolean(goldScheduleConfirmedAt) && !goldSellerSentAt;
                  const showForm = Boolean(state.showSellerGoldScheduleForm);

                  const methodValue = String(goldDelivery?.seller?.delivery_method || negotiation?.digital_delivery_method || '').trim();
                  const safeMethod = (methodValue === 'trade' || methodValue === 'mail' || methodValue === 'gift') ? methodValue : 'trade';

                  return `
                    <div class="mt-4 pt-4 border-t border-gray-100 space-y-3">
                      <div class="flex flex-wrap gap-3">
                        <button
                          type="button"
                          class="px-4 py-2 rounded-lg text-sm font-semibold transition shadow-sm bg-white border border-gray-200 hover:border-secondary-400 text-gray-700 hover:text-secondary-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          data-action="toggleSellerGoldScheduleForm"
                          data-id="${negotiation.id}"
                          ${canAct ? '' : 'disabled'}
                        >
                          Alterar horário da entrega
                        </button>
                        ${!canAct ? `<p class="text-xs text-gray-500 mt-1">Disponível apenas após o pagamento confirmado.</p>` : ''}
                      </div>

                      ${showForm ? `
                        <form class="p-4 rounded-xl border border-gray-200 bg-gray-50 space-y-3" data-action="submitSellerGoldSchedule" data-id="${negotiation.id}">
                          <div>
                            <div class="text-sm text-gray-700 font-medium mb-2">Seus horários disponíveis (até 3) *</div>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              ${Array.from({ length: 3 }).map(() => `
                                <input type="time" name="gold_seller_time_options[]" class="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all">
                              `).join('')}
                            </div>
                            <p class="text-xs text-gray-500 mt-1">Preencha pelo menos 1 horário.</p>
                          </div>
            <div>
              <div class="text-sm text-gray-700 font-medium mb-2">Escolha 1 horário do vendedor (ou sugira outro nos seus horários) *</div>
                            <label class="block text-sm text-gray-700 font-medium mb-2">Método de entrega *</label>
                            <select name="gold_seller_delivery_method" required class="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all">
                              <option value="trade" ${safeMethod === 'trade' ? 'selected' : ''}>Trade (troca/encontro no jogo)</option>
                              <option value="mail" ${safeMethod === 'mail' ? 'selected' : ''}>Correio do jogo (mail)</option>
                              <option value="gift" ${safeMethod === 'gift' ? 'selected' : ''}>Presente (gift)</option>
                            </select>
                          </div>

                          <div class="flex flex-wrap gap-3">
                            <button type="submit" class="px-5 py-2.5 bg-secondary-600 hover:bg-secondary-700 rounded-lg text-white font-semibold transition flex items-center gap-2">
                              <i class="fas fa-save"></i> Salvar horário
                            </button>
                            <button type="button" class="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition" data-action="toggleSellerGoldScheduleForm" data-id="${negotiation.id}">
                              Cancelar
                            </button>
                          </div>
                        </form>
                      ` : ''}

                      <div>
                        <button
                          type="button"
                          class="w-full px-5 py-3 bg-success-600 hover:bg-success-700 rounded-lg text-white font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                          data-action="sellerConfirmGoldSent"
                          data-id="${negotiation.id}"
                          ${canConfirmDelivery ? '' : 'disabled'}
                        >
                          Confirmar entrega
                        </button>
                        ${goldSellerSentAt ? `<p class="text-xs text-gray-500 mt-2">Você já confirmou a entrega.</p>` : (!goldScheduleConfirmedAt ? `<p class="text-xs text-gray-500 mt-2">Confirme um horário antes de confirmar a entrega.</p>` : '')}
                      </div>
                    </div>
                  `;
                })() : ''}
              </section>

              ${isIntermediaryRole ? `
                <section class="mt-6 pt-4 border-t border-gray-100">
                  <h3 class="text-sm font-medium text-gray-600 mb-2">Comprovante do pagamento (comprador)</h3>
                  ${paymentProofUrl ? `
                    <div class="flex items-center justify-between gap-3">
                      <p class="text-sm text-gray-600">Enviado${paymentProofUploadedAt ? ` em <strong>${escapeHtml(formatDateTime(paymentProofUploadedAt))}</strong>` : ''}.</p>
                      <a class="px-4 py-2 bg-white border border-gray-200 hover:border-secondary-400 text-gray-700 hover:text-secondary-600 rounded-lg text-sm font-semibold transition" href="${escapeAttr(paymentProofUrl)}" target="_blank" rel="noopener">Abrir comprovante</a>
                    </div>
                  ` : `
                    <p class="text-sm text-gray-500">Nenhum comprovante enviado.</p>
                  `}
                </section>
              ` : ''}

              ${description ? `
                <section class="mt-6 pt-4 border-t border-gray-100">
                  <h3 class="text-sm font-medium text-gray-600 mb-2">Descrição enviada pelo vendedor</h3>
                  <p class="text-gray-500">${escapeHtml(description)}</p>
                </section>
              ` : ''}
            </article>
          ` : `
            <article class="bg-white rounded-2xl p-6 shadow-card border border-gray-100">
              <div class="flex items-start justify-between gap-3 mb-4">
                <div class="min-w-0">
                  <h2 class="text-lg font-semibold text-gray-800 flex items-center gap-2"><i class="fas fa-receipt text-primary-500"></i> Resumo</h2>
                  <div class="mt-1 text-sm text-gray-600 font-medium">${escapeHtml(productTitle)}</div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  ${productImageButton}
                  ${hasIntermediaryReportData ? `
                    <button
                      type="button"
                      class="px-4 py-2 rounded-lg text-sm font-semibold transition shadow-sm bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 text-white"
                      data-action="openIntermediaryReport"
                    >
                      Relatório do intermediador
                    </button>
                  ` : ''}
                </div>
              </div>

              <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <dt class="text-gray-500">Valor do produto</dt>
                  <dd class="text-gray-700">${formatCurrency(productAmount)}</dd>
                </div>
                <div>
                  <dt class="text-gray-500">Taxa (comprador)</dt>
                  <dd class="text-gray-700">${formatCurrency(buyerFee)}</dd>
                </div>
                <div>
                  <dt class="text-gray-500">Total (comprador)</dt>
                  <dd class="text-gray-700">${formatCurrency(buyerTotal)}</dd>
                </div>
                <div>
                  <dt class="text-gray-500">Entrega combinada</dt>
                  <dd class="text-gray-700">${negotiation.delivery_days ? `${negotiation.delivery_days} dias` : '—'}</dd>
                </div>
              </dl>

              ${serviceInfo && (isServiceCategory || isServiceExchangeCategory) ? `
                <section class="mt-6 pt-4 border-t border-gray-100">
                  <h3 class="text-sm font-medium text-gray-600 mb-2">Produto do serviço</h3>
                  <div class="text-sm text-gray-800 font-semibold mb-3">${escapeHtml(String(serviceInfo?.service_label || 'Serviço'))} — ${escapeHtml(String(serviceInfo?.game_label || 'Jogo'))}</div>
                  ${Array.isArray(serviceInfo?.fields) && serviceInfo.fields.length ? `
                    <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      ${serviceInfo.fields.map((f) => `
                        <div>
                          <dt class="text-gray-500">${escapeHtml(String(f?.label || f?.field_id || 'Campo'))}</dt>
                          <dd class="text-gray-700">${escapeHtml(String(f?.value || '—'))}</dd>
                        </div>
                      `).join('')}
                    </dl>
                  ` : `
                    <p class="text-sm text-gray-500">Sem informações adicionais.</p>
                  `}
                </section>
              ` : ''}

              ${isServiceCategory ? `
                <section class="mt-6 pt-4 border-t border-gray-100">
                  <h3 class="text-sm font-medium text-gray-600 mb-2">Agendamento do serviço</h3>
                  <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <dt class="text-gray-500">Data escolhida</dt>
                      <dd class="text-gray-700">${escapeHtml(serviceSelectedStartDate ? formatDate(serviceSelectedStartDate) : '—')}</dd>
                    </div>
                    <div>
                      <dt class="text-gray-500">Horário (início/fim)</dt>
                      <dd class="text-gray-700">${escapeHtml(serviceSelectedTimeRange || '—')}</dd>
                    </div>
                    <div>
                      <dt class="text-gray-500">Datas sugeridas</dt>
                      <dd class="text-gray-700">${escapeHtml(serviceSellerStartDates.length ? serviceSellerStartDates.map((d) => formatShortDate(d)).join(' | ') : '—')}</dd>
                    </div>
                    <div>
                      <dt class="text-gray-500">Horários sugeridos</dt>
                      <dd class="text-gray-700">${escapeHtml(serviceSellerTimeRanges.length ? serviceSellerTimeRanges.join(' | ') : '—')}</dd>
                    </div>
                    <div>
                      <dt class="text-gray-500">Prazo estimado de fim</dt>
                      <dd class="text-gray-700">${escapeHtml(serviceEstimatedEndDate ? formatDate(serviceEstimatedEndDate) : '—')}</dd>
                    </div>
                    <div>
                      <dt class="text-gray-500">Agendamento confirmado</dt>
                      <dd class="text-gray-700">${escapeHtml(serviceScheduleConfirmedAt ? formatDateTime(serviceScheduleConfirmedAt) : '—')}</dd>
                    </div>
                  </dl>
                </section>
              ` : ''}

              ${description ? `
                <section class="mt-6 pt-4 border-t border-gray-100">
                  <h3 class="text-sm font-medium text-gray-600 mb-2">Descrição enviada pelo vendedor</h3>
                  <p class="text-gray-500">${escapeHtml(description)}</p>
                </section>
              ` : ''}
            </article>
          `}

          <article class="bg-white rounded-2xl p-6 shadow-card border border-gray-100">
            <h2 class="text-lg font-semibold text-gray-800 mb-4 flex items-center justify-between gap-2">
              <span class="inline-flex items-center gap-2"><i class="fas fa-users text-secondary-500"></i> Participantes</span>
              ${(() => {
                const total = 3;
                const rated = [negotiation?.seller_rating, negotiation?.buyer_rating, negotiation?.intermediary_rating]
                  .filter((v) => {
                    const n = Number(v);
                    return Number.isFinite(n) && n >= 1 && n <= 10;
                  }).length;
                return `<span class="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full font-semibold">Avaliados: ${rated}/${total}</span>`;
              })()}
            </h2>
            <div class="grid grid-cols-1 gap-4">
              ${renderParticipantDropdown({
                badgeText: 'Vendedor',
                badgeClass: 'bg-warning-500',
                isSelf: isSellerRole,
                statusBadgeText: (() => {
                  const base = getOnlineStatus(seller?.last_seen_at);
                  const category = String(negotiation?.category || '').trim();
                  if (category !== CATEGORY_GAME_ACCOUNT) return base.label;
                  const sellerInfo = negotiation?.game_account?.seller_info;
                  const markedOnlineAt = extractLineValue(sellerInfo, 'Online agora');
                  const extra = markedOnlineAt ? 'Disponível p/ confirmar' : '';
                  return extra ? `${base.label} • ${extra}` : base.label;
                })(),
                statusBadgeClass: (() => getOnlineStatus(seller?.last_seen_at).className)(),
                name: seller.name,
                showEmail: false,
                phone: seller.phone,
                ratingLabel: null,
                ratingValue: null,
                addressEntity: seller
              })}
              ${renderParticipantDropdown({
                badgeText: 'Comprador',
                badgeClass: 'bg-secondary-500',
                isSelf: isBuyerRole,
                statusBadgeText: (() => {
                  const base = getOnlineStatus(buyer?.last_seen_at);
                  const category = String(negotiation?.category || '').trim();
                  if (category !== CATEGORY_GAME_ACCOUNT) return base.label;
                  const changeRequest = negotiation?.game_account?.buyer_change_request;
                  const at = extractLineValue(changeRequest, 'Disponível para confirmar e-mail agora') || extractLineValue(changeRequest, 'Disponível agora');
                  const extra = at ? 'Disponível p/ confirmar' : '';
                  return extra ? `${base.label} • ${extra}` : base.label;
                })(),
                statusBadgeClass: (() => getOnlineStatus(buyer?.last_seen_at).className)(),
                name: buyer.name,
                showEmail: false,
                phone: buyer.phone,
                ratingLabel: null,
                ratingValue: null,
                addressEntity: buyer
              })}
              ${renderParticipantDropdown({
                badgeText: intermediatorBadgeText,
                badgeClass: 'bg-success-500',
                isSelf: isSelfIntermediatorAssigned,
                statusBadgeText: intermediatorStatusText,
                statusBadgeClass: intermediatorAssigned ? 'bg-success-600' : 'bg-gray-600',
                name: intermediatorDisplayName,
                showEmail: false,
                phone: null,
                ratingLabel: null,
                ratingValue: null,
                addressEntity: null,
                emptyAddressMessage: 'Endereço não informado.'
              })}
            </div>
          </article>
        </div>

        ${renderParticipantActions(negotiation, { isBuyer: isBuyerRole, isSeller: isSellerRole, isIntermediary: isIntermediaryRole })}

        ${renderBuyerAcceptSection(negotiation, { isBuyer: isBuyerRole, isSeller: isSellerRole })}
        ${renderPaymentSection(negotiation, { isBuyer: isBuyerRole, isSeller: isSellerRole })}
        ${renderGameAccountBuyerSellerInfoSection(negotiation, { isBuyer: isBuyerRole })}
        ${renderGameAccountBuyerChangeRequestSection(negotiation, { isBuyer: isBuyerRole })}
        ${renderGameAccountSellerInfoSection(negotiation, { isSeller: isSellerRole })}
        ${renderDigitalDeliveryBuyerInfoSection(negotiation, { isBuyer: isBuyerRole })}
        ${renderDigitalDeliverySellerInfoSection(negotiation, { isSeller: isSellerRole })}
        ${renderSellerGuideEntry(negotiation, { isSeller: isSellerRole })}
        ${renderLogisticsSection(negotiation, { isBuyer: isBuyerRole, isSeller: isSellerRole })}
        ${renderPaymentsSection(negotiation)}
        ${renderAdminActionsSection(negotiation)}
        ${renderInspectionReportSection(negotiation)}
        ${renderAttachmentSection(negotiation)}
        ${renderRatingsSummary(negotiation)}
        ${renderNegotiationLogs(negotiation)}
      </section>
      ${renderBuyerRejectModal()}
    `;
  }

  function renderRatingsSummary(neg) {
    const items = [
      {
        label: 'Feedback do comprador',
        value: neg?.buyer_rating,
        note: neg?.buyer_rating_note
      },
      {
        label: 'Feedback do vendedor',
        value: neg?.seller_rating,
        note: neg?.seller_rating_note
      },
      {
        label: 'Feedback da intermediadora',
        value: neg?.intermediary_rating,
        note: neg?.intermediary_rating_note
      }
    ];

    const hasAny = items.some((i) => {
      const rating10 = Number(i.value);
      return Number.isFinite(rating10) && rating10 >= 1 && rating10 <= 10;
    });

    if (!hasAny) {
      return '';
    }

    return `
      <article class="bg-white rounded-2xl p-6 shadow-card border border-gray-100">
        <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-star text-warning-500"></i> Avaliações</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          ${items.map((item) => `
            <div class="p-4 rounded-xl border border-gray-100 bg-gray-50">
              <div class="text-sm font-semibold text-gray-800 mb-2">${escapeHtml(item.label)}</div>
              <div class="flex items-center gap-2">${renderStarsInline(item.value)}<span class="text-xs text-gray-600">${Number.isFinite(Number(item.value)) ? escapeHtml(String(item.value)) + '/10' : ''}</span></div>
              ${item.note && String(item.note).trim() ? `<div class="text-xs text-gray-600 mt-2">${escapeHtml(String(item.note))}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </article>
    `;
  }

  function renderSellerGuideEntry(neg, { isSeller }) {
    if (!isSeller) return '';

    const paymentConfirmed = Boolean(neg?.paid_at || neg?.product_paid_at);
    const canShow = paymentConfirmed && neg?.status === 'waiting_shipment';
    if (!canShow) return '';

    return `
      <article class="bg-white rounded-2xl p-6 shadow-card border border-warning-200">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="text-lg font-semibold text-gray-900 flex items-center gap-2"><i class="fas fa-list-check text-warning-600"></i> Instruções</h2>
            <p class="text-sm text-gray-600 mt-1">Guia do vendedor após o pagamento confirmado. Disponível apenas enquanto estiver em <strong>Aguardando envio</strong>.</p>
          </div>
          <button
            type="button"
            class="px-4 py-2 rounded-lg text-sm font-semibold transition shadow-sm bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 text-white"
            data-action="openSellerGuide"
            data-id="${neg.id}"
          >
            Abrir
          </button>
        </div>
      </article>
    `;
  }

  function renderRatingInline(label, value) {
    if (!label) return '';
    const rating10 = Number(value);
    const has = Number.isFinite(rating10) && rating10 >= 1 && rating10 <= 10;
    // Regra solicitada: começa em 0 estrelas e vai subindo conforme recebe nota.
    const stars = has ? Math.max(1, Math.min(5, Math.round(rating10 / 2))) : 0;
    const starsHtml = Array.from({ length: 5 }).map((_, i) => {
      const filled = i < stars;
      return `<i class="fas fa-star ${filled ? 'text-warning-400' : 'text-gray-300'}"></i>`;
    }).join('');

    return `
      <div class="mt-3">
        <div class="text-xs text-gray-500">${escapeHtml(label)}</div>
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-1">${starsHtml}</div>
          <div class="text-xs text-gray-600">${escapeHtml(String(stars))}/5</div>
        </div>
      </div>
    `;
  }

  function renderStarsInline(value) {
    const rating10 = Number(value);
    const has = Number.isFinite(rating10) && rating10 >= 1 && rating10 <= 10;
    if (!has) {
      return `<span class="text-xs text-gray-600">Sem avaliação</span>`;
    }

    const stars = Math.max(1, Math.min(5, Math.round(rating10 / 2)));
    const starsHtml = Array.from({ length: 5 }).map((_, i) => {
      const filled = i < stars;
      return `<i class="fas fa-star ${filled ? 'text-warning-400' : 'text-gray-300'}"></i>`;
    }).join('');
    return `<span class="inline-flex items-center gap-1">${starsHtml}</span>`;
  }

  function renderOnlineBadge(lastSeenAtIso) {
    const s = getOnlineStatus(lastSeenAtIso);
    return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold text-white ${s.className}"><i class="fas fa-circle text-[9px]"></i>${escapeHtml(s.label)}</span>`;
  }

  function renderParticipantDropdown({
    badgeText,
    badgeClass,
    isSelf,
    statusBadgeText,
    statusBadgeClass,
    name,
    email,
    showEmail,
    phone,
    ratingLabel,
    ratingValue,
    addressEntity,
    emptyAddressMessage
  }) {
    const safeBadgeText = badgeText ? String(badgeText) : '';
    const displayName = name ? String(name) : '—';
    const displayEmail = email ? String(email) : '';
    const displayPhone = formatPhone(phone);
    const addressHtml = renderAddressDetails(addressEntity, emptyAddressMessage || 'Endereço não informado.');

    return `
      <div class="p-4 rounded-xl border border-gray-100 bg-gray-50">
        <header class="flex items-center gap-2 mb-2">
          <span class="px-2 py-0.5 ${badgeClass || 'bg-gray-700'} text-white text-xs rounded-full font-medium">${escapeHtml(safeBadgeText)}</span>
          ${isSelf ? '<span class="px-2 py-0.5 bg-gray-900 text-white text-xs rounded-full font-medium">Você</span>' : ''}
          ${statusBadgeText ? `<span class="px-2 py-0.5 ${statusBadgeClass || 'bg-success-600'} text-white text-xs rounded-full font-medium">${escapeHtml(String(statusBadgeText))}</span>` : ''}
        </header>
        <strong class="block text-gray-800">${escapeHtml(displayName)}</strong>
        ${renderRatingInline(ratingLabel, ratingValue)}
        <details class="mt-3">
          <summary class="cursor-pointer text-sm text-primary-600 hover:text-primary-700 font-medium select-none">Detalhes</summary>
          <div class="mt-3 space-y-2">
            ${showEmail ? `
              <div>
                <div class="text-xs text-gray-500">E-mail</div>
                <div class="text-sm text-gray-700 break-all">${escapeHtml(displayEmail || '—')}</div>
              </div>
            ` : ''}
            <div>
              <div class="text-xs text-gray-500">Telefone</div>
              <div class="text-sm text-gray-700">${escapeHtml(displayPhone)}</div>
            </div>
            ${addressHtml}
          </div>
        </details>
      </div>
    `;
  }

  function renderLogisticsSection(neg, { isBuyer, isSeller }) {
    if (isDigitalDeliveryCategory(neg?.category)) return '';

    const trackSeller = neg.tracking_to_intermediary || neg.tracking_code || '';
    const trackBuyer = neg.tracking_to_buyer || neg.buyer_tracking_code || '';
    const hasBuyerTracking = Boolean(trackBuyer);

    return `
      <article class="bg-white rounded-2xl p-6 shadow-card border border-gray-100">
        <h2 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-truck text-success-500"></i> Rastreio</h2>
        <div class="grid grid-cols-1 ${hasBuyerTracking ? '' : 'md:grid-cols-2'} gap-4">
          ${hasBuyerTracking ? `
            <div class="p-4 rounded-xl border border-gray-100 bg-gray-50">
              <h3 class="text-sm font-medium text-gray-700 mb-1">Rastreio para comprador</h3>
              <p class="text-sm text-gray-800 font-medium">${escapeHtml(trackBuyer)}</p>
              ${neg.sent_to_buyer_at ? `<small class="text-xs text-gray-500">Despachado em ${formatDateTime(neg.sent_to_buyer_at)}</small>` : ''}
            </div>
          ` : `
            <div class="p-4 rounded-xl border border-gray-100 bg-gray-50">
              <h3 class="text-sm font-medium text-gray-700 mb-1">Rastreio para intermediadora</h3>
              <p class="text-sm text-gray-800 font-medium">${trackSeller ? escapeHtml(trackSeller) : 'Não informado'}</p>
              ${neg.sent_to_intermediary_at || neg.shipped_at ? `<small class="text-xs text-gray-500">Postado em ${formatDateTime(neg.sent_to_intermediary_at || neg.shipped_at)}</small>` : ''}
            </div>
            <div class="p-4 rounded-xl border border-gray-100 bg-gray-50">
              <h3 class="text-sm font-medium text-gray-700 mb-1">Rastreio para comprador</h3>
              <p class="text-sm text-gray-800 font-medium">${trackBuyer ? escapeHtml(trackBuyer) : 'Não informado'}</p>
              ${neg.sent_to_buyer_at ? `<small class="text-xs text-gray-500">Despachado em ${formatDateTime(neg.sent_to_buyer_at)}</small>` : ''}
            </div>
          `}
        </div>
        ${renderTrackingForms(neg, { isBuyer, isSeller })}
      </article>
    `;
  }

  function renderBuyerAcceptSection(neg, { isBuyer, isSeller }) {
    // Mostra apenas se o status for pending_acceptance e o usuário for comprador válido ou um interessado que não seja o vendedor
    const hasBuyerAssigned = Boolean(neg.buyer && neg.buyer.id);
    const canAcceptPendingBuyer = neg.status === 'pending_acceptance' && hasBuyerAssigned && isBuyer;
    const canAcceptAsInterested = neg.status === 'pending_acceptance' && !hasBuyerAssigned && !isSeller && !isAdmin() && state.user?.role === 'buyer';
    const canAccept = canAcceptPendingBuyer || canAcceptAsInterested;
    if (!canAccept) return '';

    const category = String(neg?.category || '').trim();
    const isCurrency = category === CATEGORY_CURRENCY;
    const isService = isServiceTaxonomyCategory(category) || category === CATEGORY_SERVICE;
    const isServiceSchedule = isServiceScheduleCategory(category);
    const isServiceExchange = category === CATEGORY_SERVICE_EXCHANGE;
    const isAccount = category === CATEGORY_GAME_ACCOUNT;
    const isKeyDlc = category === CATEGORY_KEY_DLC;
    const isBoostRank = category === CATEGORY_BOOST_RANK;
    const isCarryPve = category === CATEGORY_CARRY_PVE;
    const isLeveling = category === CATEGORY_LEVELING;
    const isCollectibles = category === CATEGORY_COLLECTIBLES;
    const isSeasonal = category === CATEGORY_SEASONAL;
    const isCustomService = category === CATEGORY_CUSTOM_SERVICE;
    const gold = neg?.gold_delivery || null;
    const sellerTimeOptions = Array.isArray(gold?.seller?.time_options) ? gold.seller.time_options : [];

    const service = neg?.service_delivery || null;
    const serviceStartDates = Array.isArray(service?.seller?.start_date_options) ? service.seller.start_date_options : [];
    const serviceTimeRanges = Array.isArray(service?.seller?.time_range_options) ? service.seller.time_range_options : [];
    const serviceInfo = neg?.service || null;
    const hasDesc = Boolean(neg?.description && String(neg.description).trim());
    const methodLabel = (m) => {
      const v = String(m || '').trim();
      if (v === 'trade') return 'Trade (troca/encontro no jogo)';
      if (v === 'mail') return 'Correio do jogo (mail)';
      if (v === 'gift') return 'Presente (gift)';
      return '—';
    };
    const qtyLabel = isCurrency && neg?.digital_quantity ? formatPtBrMoney(Number(neg.digital_quantity) || 0) : '';
    const deadlineDays = Number(neg?.delivery_days) > 0 ? Number(neg.delivery_days) : DIGITAL_DELIVERY_DEADLINE_BUSINESS_DAYS;
    const productTitle = String(neg?.product_title || neg?.product_name || neg?.title || 'Negociação').trim();
    const productAmount = Number(neg?.amount || neg?.product_amount || 0);

    const buyerInviteSummary = `
      <div class="p-4 rounded-xl border border-gray-100 bg-gray-50 mb-4">
        <h3 class="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <i class="fas fa-clipboard-list text-secondary-500"></i> Resumo do anúncio
        </h3>
        <dl class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt class="text-gray-500">Anúncio</dt>
            <dd class="text-gray-800 font-medium">${escapeHtml(productTitle || '—')}</dd>
          </div>
          <div>
            <dt class="text-gray-500">Categoria</dt>
            <dd class="text-gray-800 font-medium">${escapeHtml(category || '—')}</dd>
          </div>
          <div>
            <dt class="text-gray-500">Valor</dt>
            <dd class="text-gray-800 font-medium">${productAmount ? formatCurrency(productAmount) : '—'}</dd>
          </div>
          <div>
            <dt class="text-gray-500">Prazo combinado</dt>
            <dd class="text-gray-800 font-medium">${deadlineDays} ${deadlineDays === 1 ? 'dia' : 'dias'}</dd>
          </div>
          ${isCurrency ? `
            <div>
              <dt class="text-gray-500">Jogo</dt>
              <dd class="text-gray-800 font-medium">${escapeHtml(neg?.digital_game || '—')}</dd>
            </div>
            <div>
              <dt class="text-gray-500">Quantidade</dt>
              <dd class="text-gray-800 font-medium">${escapeHtml(qtyLabel || '—')}</dd>
            </div>
          ` : ''}
          ${serviceInfo ? `
            <div class="sm:col-span-2">
              <dt class="text-gray-500">Serviço</dt>
              <dd class="text-gray-800 font-medium">${escapeHtml(String(serviceInfo?.service_label || 'Serviço'))} — ${escapeHtml(String(serviceInfo?.game_label || 'Jogo'))}</dd>
            </div>
          ` : ''}
        </dl>
      </div>
    `;

    const buyerInviteInputs = (() => {
      if (isBoostRank) {
        return `
          <div class="p-4 rounded-xl border border-gray-100 bg-white mb-4 space-y-4">
            <h3 class="text-sm font-semibold text-gray-700 flex items-center gap-2"><i class="fas fa-signal text-success-600"></i> Dados do rank</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-sm text-gray-700 font-medium mb-2">Rank atual *</label>
                <input type="text" name="buyer_invite_inputs[rank_current_confirmed]" required maxlength="120" placeholder="Ex: Ouro IV" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-success-500 focus:border-success-500 transition-all">
              </div>
              <div>
                <label class="block text-sm text-gray-700 font-medium mb-2">Classe/Personagem *</label>
                <input type="text" name="buyer_invite_inputs[class_character]" required maxlength="120" placeholder="Ex: Mago / Assassino" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-success-500 focus:border-success-500 transition-all">
              </div>
            </div>
            <div>
              <label class="block text-sm text-gray-700 font-medium mb-2">Disponibilidade *</label>
              <textarea name="buyer_invite_inputs[availability]" required rows="2" maxlength="500" placeholder="Ex: Seg-Sex 20h-23h" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-success-500 focus:border-success-500 transition-all resize-none"></textarea>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-sm text-gray-700 font-medium mb-2">Rank desejado (opcional)</label>
                <input type="text" name="buyer_invite_inputs[rank_goal]" maxlength="120" placeholder="Ex: Diamante IV" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-success-500 focus:border-success-500 transition-all">
              </div>
              <div>
                <label class="block text-sm text-gray-700 font-medium mb-2">Jogar junto?</label>
                <select name="buyer_invite_inputs[wants_play_together]" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-success-500 focus:border-success-500 transition-all">
                  <option value="">Selecione</option>
                  <option value="Sim">Sim</option>
                  <option value="Não">Não</option>
                </select>
              </div>
            </div>
          </div>
        `;
      }

      if (isCarryPve) {
        return `
          <div class="p-4 rounded-xl border border-gray-100 bg-white mb-4 space-y-4">
            <h3 class="text-sm font-semibold text-gray-700 flex items-center gap-2"><i class="fas fa-dungeon text-success-600"></i> Dados do conteúdo</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-sm text-gray-700 font-medium mb-2">Classe/Role *</label>
                <input type="text" name="buyer_invite_inputs[class_role]" required maxlength="120" placeholder="Ex: Tank / Curandeiro" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-success-500 focus:border-success-500 transition-all">
              </div>
              <div>
                <label class="block text-sm text-gray-700 font-medium mb-2">Nível do personagem *</label>
                <input type="text" name="buyer_invite_inputs[character_level]" required maxlength="120" placeholder="Ex: 70" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-success-500 focus:border-success-500 transition-all">
              </div>
            </div>
            <div>
              <label class="block text-sm text-gray-700 font-medium mb-2">Experiência no conteúdo *</label>
              <select name="buyer_invite_inputs[experience]" required class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-success-500 focus:border-success-500 transition-all">
                <option value="">Selecione</option>
                <option value="Iniciante">Iniciante</option>
                <option value="Intermediário">Intermediário</option>
                <option value="Avançado">Avançado</option>
              </select>
            </div>
            <div>
              <label class="block text-sm text-gray-700 font-medium mb-2">Disponibilidade *</label>
              <textarea name="buyer_invite_inputs[availability]" required rows="2" maxlength="500" placeholder="Ex: Sab/Dom 14h-18h" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-success-500 focus:border-success-500 transition-all resize-none"></textarea>
            </div>
          </div>
        `;
      }

      if (isLeveling) {
        return `
          <div class="p-4 rounded-xl border border-gray-100 bg-white mb-4 space-y-4">
            <h3 class="text-sm font-semibold text-gray-700 flex items-center gap-2"><i class="fas fa-level-up-alt text-success-600"></i> Dados do leveling</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-sm text-gray-700 font-medium mb-2">Classe/Personagem *</label>
                <input type="text" name="buyer_invite_inputs[class_character]" required maxlength="120" placeholder="Ex: Guerreiro" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-success-500 focus:border-success-500 transition-all">
              </div>
              <div>
                <label class="block text-sm text-gray-700 font-medium mb-2">Nível atual (opcional)</label>
                <input type="text" name="buyer_invite_inputs[level_current]" maxlength="120" placeholder="Ex: 35" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-success-500 focus:border-success-500 transition-all">
              </div>
            </div>
            <div>
              <label class="block text-sm text-gray-700 font-medium mb-2">Disponibilidade *</label>
              <textarea name="buyer_invite_inputs[availability]" required rows="2" maxlength="500" placeholder="Ex: Seg-Sex 18h-22h" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-success-500 focus:border-success-500 transition-all resize-none"></textarea>
            </div>
          </div>
        `;
      }

      if (isCollectibles) {
        return `
          <div class="p-4 rounded-xl border border-gray-100 bg-white mb-4 space-y-4">
            <h3 class="text-sm font-semibold text-gray-700 flex items-center gap-2"><i class="fas fa-trophy text-success-600"></i> Dados das conquistas</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-sm text-gray-700 font-medium mb-2">O que você já possui *</label>
                <input type="text" name="buyer_invite_inputs[already_have]" required maxlength="200" placeholder="Ex: 2 títulos, 1 montaria" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-success-500 focus:border-success-500 transition-all">
              </div>
              <div>
                <label class="block text-sm text-gray-700 font-medium mb-2">Personagem usado *</label>
                <input type="text" name="buyer_invite_inputs[character_used]" required maxlength="120" placeholder="Ex: Druida" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-success-500 focus:border-success-500 transition-all">
              </div>
            </div>
            <div>
              <label class="block text-sm text-gray-700 font-medium mb-2">Disponibilidade *</label>
              <textarea name="buyer_invite_inputs[availability]" required rows="2" maxlength="500" placeholder="Ex: Ter/Qui 20h-23h" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-success-500 focus:border-success-500 transition-all resize-none"></textarea>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-sm text-gray-700 font-medium mb-2">Há chance de RNG?</label>
                <select name="buyer_invite_inputs[rng_has_chance]" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-success-500 focus:border-success-500 transition-all">
                  <option value="">Selecione</option>
                  <option value="Sim">Sim</option>
                  <option value="Não">Não</option>
                </select>
              </div>
              <div>
                <label class="block text-sm text-gray-700 font-medium mb-2">Tentativas (se RNG)</label>
                <input type="text" name="buyer_invite_inputs[rng_attempts]" maxlength="120" placeholder="Ex: 10 runs" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-success-500 focus:border-success-500 transition-all">
              </div>
            </div>
            <div>
              <label class="block text-sm text-gray-700 font-medium mb-2">Política caso não drope (se RNG)</label>
              <input type="text" name="buyer_invite_inputs[rng_policy]" maxlength="200" placeholder="Ex: Reagendar mais 2 runs" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-success-500 focus:border-success-500 transition-all">
            </div>
          </div>
        `;
      }

      if (isSeasonal) {
        return `
          <div class="p-4 rounded-xl border border-gray-100 bg-white mb-4 space-y-4">
            <h3 class="text-sm font-semibold text-gray-700 flex items-center gap-2"><i class="fas fa-snowflake text-success-600"></i> Metas da temporada</h3>
            <div>
              <label class="block text-sm text-gray-700 font-medium mb-2">Metas desejadas *</label>
              <textarea name="buyer_invite_inputs[goals]" required rows="2" maxlength="500" placeholder="Ex: concluir passe, fechar ranking" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-success-500 focus:border-success-500 transition-all resize-none"></textarea>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-sm text-gray-700 font-medium mb-2">Progresso atual (opcional)</label>
                <input type="text" name="buyer_invite_inputs[progress_current]" maxlength="120" placeholder="Ex: Tier 30" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-success-500 focus:border-success-500 transition-all">
              </div>
              <div>
                <label class="block text-sm text-gray-700 font-medium mb-2">Frequência de jogo *</label>
                <select name="buyer_invite_inputs[frequency]" required class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-success-500 focus:border-success-500 transition-all">
                  <option value="">Selecione</option>
                  <option value="Diário">Diário</option>
                  <option value="3-4x por semana">3-4x por semana</option>
                  <option value="1-2x por semana">1-2x por semana</option>
                </select>
              </div>
            </div>
          </div>
        `;
      }

      if (isCustomService) {
        return `
          <div class="p-4 rounded-xl border border-gray-100 bg-white mb-4 space-y-4">
            <h3 class="text-sm font-semibold text-gray-700 flex items-center gap-2"><i class="fas fa-pen-nib text-success-600"></i> Objetivo personalizado</h3>
            <div>
              <label class="block text-sm text-gray-700 font-medium mb-2">Descreva o objetivo *</label>
              <textarea name="buyer_invite_inputs[objective_detail]" required rows="3" maxlength="700" placeholder="Explique o que precisa, metas e limites" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-success-500 focus:border-success-500 transition-all resize-none"></textarea>
            </div>
            <div>
              <label class="block text-sm text-gray-700 font-medium mb-2">Disponibilidade *</label>
              <textarea name="buyer_invite_inputs[availability]" required rows="2" maxlength="500" placeholder="Ex: Seg-Sex 19h-22h" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-success-500 focus:border-success-500 transition-all resize-none"></textarea>
            </div>
            <div>
              <label class="block text-sm text-gray-700 font-medium mb-2">Referências (opcional)</label>
              <input type="text" name="buyer_invite_inputs[references]" maxlength="200" placeholder="Links, prints, ou informações úteis" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-success-500 focus:border-success-500 transition-all">
            </div>
          </div>
        `;
      }

      if (isServiceExchange) {
        return `
          <div class="p-4 rounded-xl border border-gray-100 bg-white mb-4 space-y-4">
            <h3 class="text-sm font-semibold text-gray-700 flex items-center gap-2"><i class="fas fa-exchange-alt text-success-600"></i> Serviço oferecido</h3>
            <div>
              <label class="block text-sm text-gray-700 font-medium mb-2">Qual serviço você oferece? *</label>
              <textarea name="buyer_invite_inputs[offered_service]" required rows="2" maxlength="500" placeholder="Descreva seu serviço, escopo e nível" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-success-500 focus:border-success-500 transition-all resize-none"></textarea>
            </div>
            <div>
              <label class="block text-sm text-gray-700 font-medium mb-2">Disponibilidade *</label>
              <textarea name="buyer_invite_inputs[availability]" required rows="2" maxlength="500" placeholder="Ex: Finais de semana à noite" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-success-500 focus:border-success-500 transition-all resize-none"></textarea>
            </div>
            <div>
              <label class="block text-sm text-gray-700 font-medium mb-2">Restrições (opcional)</label>
              <input type="text" name="buyer_invite_inputs[constraints]" maxlength="200" placeholder="Ex: Sem login em conta principal" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-success-500 focus:border-success-500 transition-all">
            </div>
          </div>
        `;
      }

      if (isCurrency) {
        return `
          <div class="p-4 rounded-xl border border-gray-100 bg-white mb-4 space-y-4">
            <h3 class="text-sm font-semibold text-gray-700 flex items-center gap-2"><i class="fas fa-coins text-success-600"></i> Preferências da troca</h3>
            <div>
              <label class="block text-sm text-gray-700 font-medium mb-2">Método preferido (opcional)</label>
              <select name="buyer_invite_inputs[currency_preferred_method]" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-success-500 focus:border-success-500 transition-all">
                <option value="">Selecione</option>
                <option value="trade">Trade (troca/encontro no jogo)</option>
                <option value="mail">Correio do jogo (mail)</option>
                <option value="gift">Presente (gift)</option>
              </select>
            </div>
          </div>
        `;
      }

      if (isAccount || isKeyDlc) {
        return `
          <div class="p-4 rounded-xl border border-gray-100 bg-white mb-4">
            <h3 class="text-sm font-semibold text-gray-700 flex items-center gap-2"><i class="fas fa-shield-alt text-success-600"></i> Preferências do comprador</h3>
            <label class="block text-sm text-gray-700 font-medium mb-2">Observações (opcional)</label>
            <textarea name="buyer_invite_inputs[buyer_preferences]" rows="2" maxlength="500" placeholder="Ex: receber por e-mail, horário para validação" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-success-500 focus:border-success-500 transition-all resize-none"></textarea>
          </div>
        `;
      }

      return '';
    })();

    const buyerInviteConfirmations = `
      <div class="p-4 rounded-xl border border-gray-100 bg-gray-50 mb-4 space-y-3">
        <h3 class="text-sm font-semibold text-gray-700 flex items-center gap-2"><i class="fas fa-check-circle text-success-600"></i> Confirmações obrigatórias</h3>
        <label class="flex items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" name="buyer_invite_confirmations[scope]" required>
          <span>Li e concordo com o escopo apresentado pelo vendedor.</span>
        </label>
        <label class="flex items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" name="buyer_invite_confirmations[deadline]" required>
          <span>Estou ciente do prazo informado para entrega/conclusão.</span>
        </label>
        <label class="flex items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" name="buyer_invite_confirmations[terms]" required>
          <span>Concordo com os termos da plataforma e política de disputa.</span>
        </label>
        ${isAccount ? `
          <label class="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" name="buyer_invite_confirmations[account_recovery]" required>
            <span>Entendo a política de recuperação de conta e segurança do acesso.</span>
          </label>
          <label class="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" name="buyer_invite_confirmations[description]" required>
            <span>Li toda a descrição do anúncio e estou ciente do que será entregue.</span>
          </label>
          <label class="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" name="buyer_invite_confirmations[proofs]" required>
            <span>Revisei as provas anexadas pelo vendedor.</span>
          </label>
        ` : ''}
        ${isKeyDlc ? `
          <label class="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" name="buyer_invite_confirmations[platform_compatible]" required>
            <span>Confirmei que a chave/DLC é compatível com minha plataforma.</span>
          </label>
          <label class="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" name="buyer_invite_confirmations[region_compatible]" required>
            <span>Confirmei que a região é compatível com minha conta.</span>
          </label>
        ` : ''}
        ${isCollectibles ? `
          <label class="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" name="buyer_invite_confirmations[rng]">
            <span>Estou ciente de que pode haver RNG e aceito a política informada.</span>
          </label>
        ` : ''}
      </div>
    `;

    const buyerInviteNotes = `
      <div class="p-4 rounded-xl border border-gray-100 bg-white mb-4">
        <label class="block text-sm text-gray-700 font-medium mb-2">Observações finais (opcional)</label>
        <textarea name="buyer_invite_notes" rows="2" maxlength="800" placeholder="Detalhes adicionais para o vendedor/intermediador" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-success-500 focus:border-success-500 transition-all resize-none"></textarea>
      </div>
    `;

    const buyerInviteFormFields = `${buyerInviteInputs}${buyerInviteConfirmations}${buyerInviteNotes}`;

    return `
      <article class="bg-white rounded-2xl p-6 shadow-card border border-success-200">
        <h2 class="text-lg font-semibold text-success-700 mb-3 flex items-center gap-2"><i class="fas fa-handshake text-success-600"></i> Aceite da negociação</h2>
        <p class="text-sm text-gray-600 mb-4">Esta negociação está aguardando o aceite do comprador. Revise os detalhes acima e confirme sua participação.</p>
        
        <!-- Endereço de envio informativo -->
        <div class="p-4 rounded-xl border border-gray-100 bg-gray-50 mb-4">
          <h3 class="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <i class="fas fa-info-circle text-secondary-500"></i> Informações importantes
          </h3>
          <p class="text-sm text-gray-600 mb-2">${isCurrency
            ? 'Para moedas/gold, após você aceitar e pagar, vocês devem confirmar um horário para realizar a troca dentro do jogo.'
            : (isService
              ? 'Para serviços, você escolhe a data de início e o intervalo de horário sugeridos pelo vendedor.'
            : (isDigitalDeliveryCategory(neg?.category)
              ? `O vendedor deve concluir a entrega digital em até <strong>${deadlineDays} ${deadlineDays === 1 ? 'dia' : 'dias'}</strong> após você aceitar.`
              : 'O vendedor deve postar o produto após você aceitar.'
            ))
          }</p>
          <p class="text-sm text-gray-600">Após o aceite, você receberá as instruções de pagamento.</p>
        </div>

        ${buyerInviteSummary}

        ${isCurrency ? `
          <div class="p-4 rounded-xl border border-gray-100 bg-gray-50 mb-4">
            <h3 class="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <i class="fas fa-coins text-secondary-500"></i> Detalhes da moeda
            </h3>
            <dl class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <dt class="text-gray-500">Jogo</dt>
                <dd class="text-gray-800 font-medium">${escapeHtml(neg?.digital_game || '—')}</dd>
              </div>
              <div>
                <dt class="text-gray-500">Quantidade</dt>
                <dd class="text-gray-800 font-medium">${escapeHtml(qtyLabel || '—')}</dd>
              </div>
              <div>
                <dt class="text-gray-500">Servidor</dt>
                <dd class="text-gray-800 font-medium">${escapeHtml(neg?.digital_platform_server || '—')}</dd>
              </div>
              <div class="sm:col-span-2">
                <dt class="text-gray-500">Método de entrega</dt>
                <dd class="text-gray-800 font-medium">${escapeHtml(methodLabel(neg?.digital_delivery_method))}</dd>
              </div>
              ${hasDesc ? `
                <div class="sm:col-span-2">
                  <dt class="text-gray-500">Descrição</dt>
                  <dd class="text-gray-800">${escapeHtml(String(neg.description))}</dd>
                </div>
              ` : ''}
            </dl>
          </div>
        ` : ''}

        ${isCurrency ? `
          <form class="p-4 rounded-xl border border-success-200 bg-white mb-4 space-y-4" data-action="acceptNegotiation" data-id="${neg.id}">
            <div class="flex items-center gap-2 text-gray-900 font-semibold">
              <i class="fas fa-clock text-success-600"></i>
              Horário e dados do comprador
            </div>

            <div>
              <div class="text-sm text-gray-700 font-medium mb-2">Escolha 1 horário do vendedor *</div>
              ${sellerTimeOptions.length ? `
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  ${sellerTimeOptions.map((opt) => `
                    <label class="flex items-center gap-2 p-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 cursor-pointer">
                      <input type="radio" name="gold_buyer_selected_time" value="${escapeAttr(opt)}">
                      <span class="text-sm text-gray-800 font-medium">${escapeHtml(opt)}</span>
                    </label>
                  `).join('')}
                </div>
              ` : `
                <div class="text-sm text-gray-600">O vendedor ainda não informou horários.</div>
              `}
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block text-sm text-gray-700 font-medium mb-2">Nome do personagem *</label>
                <input type="text" name="gold_buyer_character_name" required maxlength="100" placeholder="Ex: Arthas" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-success-500 focus:border-success-500 transition-all">
              </div>
              <div>
                <label class="block text-sm text-gray-700 font-medium mb-2">Servidor *</label>
                <input type="text" name="gold_buyer_server" required maxlength="100" placeholder="Ex: Azralon" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-success-500 focus:border-success-500 transition-all">
              </div>
              <div>
                <label class="block text-sm text-gray-700 font-medium mb-2">Facção *</label>
                <input type="text" name="gold_buyer_faction" required maxlength="100" placeholder="Ex: Horda / Aliança" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-success-500 focus:border-success-500 transition-all">
              </div>
            </div>

            <div>
              <label class="block text-sm text-gray-700 font-medium mb-2">Seus horários disponíveis no dia (até 3) *</label>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                ${Array.from({ length: 3 }).map(() => `
                  <input type="time" name="gold_buyer_time_options[]" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-success-500 focus:border-success-500 transition-all">
                `).join('')}
              </div>
              <p class="text-xs text-gray-500 mt-1">Preencha pelo menos 1 horário.</p>
            </div>

            <div>
              <label class="block text-sm text-gray-700 font-medium mb-2">Obs (opcional)</label>
              <textarea name="gold_buyer_notes" rows="2" maxlength="1000" placeholder="Ex: Chego 5 min antes, posso esperar até 10 min." class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-success-500 focus:border-success-500 transition-all resize-none"></textarea>
            </div>

            ${buyerInviteFormFields}

            <div class="flex flex-wrap gap-3">
              <button type="submit" class="px-5 py-2.5 bg-success-600 hover:bg-success-700 rounded-lg text-white font-semibold transition flex items-center gap-2">
                <i class="fas fa-check"></i> Aceitar e participar
              </button>
              <button type="button" class="px-5 py-2.5 bg-danger-100 hover:bg-danger-200 text-danger-700 rounded-lg font-medium transition flex items-center gap-2" data-action="openRejectModal" data-id="${neg.id}">
                <i class="fas fa-times"></i> Recusar
              </button>
            </div>
          </form>
        ` : ''}

        ${isService && isServiceSchedule ? `
          <form class="p-4 rounded-xl border border-success-200 bg-white mb-4 space-y-4" data-action="acceptNegotiation" data-id="${neg.id}">
            <div class="flex items-center gap-2 text-gray-900 font-semibold">
              <i class="fas fa-calendar-check text-success-600"></i>
              Agendamento do serviço
            </div>

            <div>
              <div class="text-sm text-gray-700 font-medium mb-2">Escolha 1 data de início *</div>
              ${serviceStartDates.length ? `
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  ${serviceStartDates.map((opt) => `
                    <label class="flex items-center gap-2 p-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 cursor-pointer">
                      <input type="radio" name="service_buyer_selected_start_date" value="${escapeAttr(opt)}" required>
                      <span class="text-sm text-gray-800 font-medium">${escapeHtml(formatDate(opt))}</span>
                    </label>
                  `).join('')}
                </div>
              ` : `
                <div class="text-sm text-gray-600">O vendedor ainda não informou datas.</div>
              `}
            </div>

            <div>
              <div class="text-sm text-gray-700 font-medium mb-2">Escolha 1 intervalo de horário (início/fim) *</div>
              ${serviceTimeRanges.length ? `
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  ${serviceTimeRanges.map((opt) => `
                    <label class="flex items-center gap-2 p-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 cursor-pointer">
                      <input type="radio" name="service_buyer_selected_time_range" value="${escapeAttr(opt)}" required>
                      <span class="text-sm text-gray-800 font-medium">${escapeHtml(opt)}</span>
                    </label>
                  `).join('')}
                </div>
              ` : `
                <div class="text-sm text-gray-600">O vendedor ainda não informou horários.</div>
              `}
            </div>

            <div class="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700">
              <div class="font-semibold mb-1">Prazo do serviço</div>
              <div>Prazo combinado: <strong>${escapeHtml(String(neg?.delivery_days || deadlineDays))} dia(s)</strong>. A data estimada de fim é calculada após a data de início escolhida.</div>
            </div>

            <div class="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700">
              <div class="font-semibold mb-1">Contato</div>
              <div>Comprador: <strong>${escapeHtml(formatPhone(neg?.buyer?.phone || '') || '—')}</strong></div>
              <div>Vendedor: <strong>${escapeHtml(formatPhone(neg?.seller?.phone || '') || '—')}</strong></div>
            </div>

            ${buyerInviteFormFields}

            <div class="flex flex-wrap gap-3">
              <button type="submit" class="px-5 py-2.5 bg-success-600 hover:bg-success-700 rounded-lg text-white font-semibold transition flex items-center gap-2" ${(serviceStartDates.length && serviceTimeRanges.length) ? '' : 'disabled'}>
                <i class="fas fa-check"></i> Aceitar e participar
              </button>
              <button type="button" class="px-5 py-2.5 bg-danger-100 hover:bg-danger-200 text-danger-700 rounded-lg font-medium transition flex items-center gap-2" data-action="openRejectModal" data-id="${neg.id}">
                <i class="fas fa-times"></i> Recusar
              </button>
            </div>
          </form>
        ` : ''}

        ${(isCurrency || (isService && isServiceSchedule)) ? '' : `
          <form class="p-4 rounded-xl border border-success-200 bg-white mb-4 space-y-4" data-action="acceptNegotiation" data-id="${neg.id}">
            ${buyerInviteFormFields}
            <div class="flex flex-wrap gap-3">
              <button type="submit" class="px-5 py-2.5 bg-success-600 hover:bg-success-700 rounded-lg text-white font-semibold transition flex items-center gap-2">
                <i class="fas fa-check"></i> Aceitar e participar
              </button>
              <button type="button" class="px-5 py-2.5 bg-danger-100 hover:bg-danger-200 text-danger-700 rounded-lg font-medium transition flex items-center gap-2" data-action="openRejectModal" data-id="${neg.id}">
                <i class="fas fa-times"></i> Recusar
              </button>
            </div>
          </form>
        `}
      </article>
    `;
  }

  function renderPaymentSection(neg, { isBuyer, isSeller } = {}) {
    // Mostra Pix quando o status for waiting_payment e o usuário for comprador ou vendedor
    if (neg.status !== 'waiting_payment' || (!isBuyer && !isSeller)) return '';

    const role = isSeller ? 'seller' : 'buyer';
    const { amount, fee, total, pixKey, pixCode } = getPixPaymentInfo(neg, { role });

    const sellerDeductsFee = Boolean(neg?.seller_fee_deduct_from_payout);

    if (role === 'seller') {
      if (sellerDeductsFee) {
        return `
          <article class="bg-white rounded-2xl p-6 shadow-card border border-gray-100">
            <h2 class="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2"><i class="fas fa-hourglass-half text-secondary-600"></i> Pagamento</h2>
            <p class="text-sm text-gray-600">Você escolheu <strong>descontar a taxa do valor do repasse</strong>. Não há Pix para você pagar agora.</p>
            <div class="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div class="text-sm text-gray-700 font-semibold">Aguardando comprador realizar o pagamento</div>
              <div class="text-xs text-gray-500 mt-1">Assim que o pagamento do comprador for confirmado, a entrega digital será liberada.</div>
            </div>
          </article>
        `;
      }
      return `
        <article class="bg-white rounded-2xl p-6 shadow-card border border-gray-100">
          <h2 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-qrcode text-secondary-600"></i> Pagamento via Pix</h2>

          <div class="space-y-3 mb-4">
            <div class="p-3 bg-white rounded-lg border border-secondary-200">
              <span class="text-xs text-gray-500 block mb-1">Pix copia e cola</span>
              <div class="flex items-start gap-2">
                <code class="text-xs text-gray-800 flex-1 break-all leading-relaxed">${escapeHtml(pixCode)}</code>
                <button class="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs text-gray-600" data-action="copyText" data-value="${escapeAttr(pixCode)}">
                  <i class="fas fa-copy"></i>
                </button>
              </div>
            </div>

            <div class="p-3 bg-white rounded-lg border border-secondary-200">
              <span class="text-xs text-gray-500 block mb-1">Chave Pix (E-mail)</span>
              <div class="flex items-center gap-2">
                <code class="text-sm text-gray-800 flex-1">${escapeHtml(pixKey)}</code>
                <button class="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs text-gray-600" data-action="copyText" data-value="${escapeAttr(pixKey)}">
                  <i class="fas fa-copy"></i>
                </button>
              </div>
            </div>
          </div>

          <div class="bg-gray-50 p-4 rounded-xl border border-gray-100">
            <h3 class="text-sm font-medium text-gray-700 mb-3">Taxa do vendedor</h3>
            <div class="flex justify-between text-sm text-gray-700">
              <span class="text-gray-600">Valor</span>
              <span class="text-secondary-600 font-bold text-lg">${formatCurrency(fee)}</span>
            </div>
          </div>
        </article>
      `;
    }

    return `
      <article class="bg-white rounded-2xl p-6 shadow-card border border-gray-100">
        <h2 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-qrcode text-secondary-600"></i> Pagamento via Pix</h2>
        
        <div class="grid md:grid-cols-2 gap-4">
          <div>
            <div class="space-y-3 mb-4">
              <div class="p-3 bg-white rounded-lg border border-secondary-200">
                <span class="text-xs text-gray-500 block mb-1">Pix copia e cola</span>
                <div class="flex items-start gap-2">
                  <code class="text-xs text-gray-800 flex-1 break-all leading-relaxed">${escapeHtml(pixCode)}</code>
                  <button class="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs text-gray-600" data-action="copyText" data-value="${escapeAttr(pixCode)}">
                    <i class="fas fa-copy"></i>
                  </button>
                </div>
              </div>

              <div class="p-3 bg-white rounded-lg border border-secondary-200">
                <span class="text-xs text-gray-500 block mb-1">Chave Pix (E-mail)</span>
                <div class="flex items-center gap-2">
                  <code class="text-sm text-gray-800 flex-1">${escapeHtml(pixKey)}</code>
                  <button class="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs text-gray-600" data-action="copyText" data-value="${escapeAttr(pixKey)}">
                    <i class="fas fa-copy"></i>
                  </button>
                </div>
              </div>
            </div>

            <div class="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-4">
              <h3 class="text-sm font-medium text-gray-700 mb-3">Resumo do pagamento</h3>
              <div class="space-y-2 text-sm text-gray-700">
                <div class="flex justify-between">
                  <span class="text-gray-600">Valor do produto</span>
                  <span class="text-gray-800 font-medium">${formatCurrency(amount)}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">Taxa do comprador</span>
                  <span class="text-gray-800 font-medium">${formatCurrency(fee)}</span>
                </div>
                <div class="flex justify-between pt-2 border-t border-gray-200">
                  <span class="text-gray-800 font-bold">Total a pagar</span>
                  <span class="text-secondary-600 font-bold text-lg">${formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            <div class="space-y-3">
              ${state.confirmPaymentProofForId === neg.id ? `
                <form data-action="confirmPaymentWithProof" data-id="${neg.id}" class="space-y-3">
                  <label class="block">
                    <span class="text-sm text-gray-700 font-medium">Comprovante do Pix (opcional na simulação)</span>
                    <input type="file" name="payment_proof" accept="image/*,application/pdf" class="mt-2 w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-700">
                    <p class="text-xs text-gray-500 mt-1">Apenas o intermediador verá este comprovante nos detalhes.</p>
                  </label>
                  <button type="submit" class="w-full px-4 py-3 bg-gradient-to-r from-success-500 to-success-600 hover:from-success-600 hover:to-success-700 rounded-lg text-white font-bold transition shadow-md">
                    <i class="fas fa-check mr-2"></i>Enviar e confirmar pagamento
                  </button>
                  <button type="button" class="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-semibold transition" data-action="cancelConfirmPaymentProof">
                    Cancelar
                  </button>
                </form>
              ` : `
                <button class="w-full px-4 py-3 bg-gradient-to-r from-success-500 to-success-600 hover:from-success-600 hover:to-success-700 rounded-lg text-white font-bold transition shadow-md" data-action="openConfirmPaymentProof" data-id="${neg.id}">
                  <i class="fas fa-check mr-2"></i>Já realizei o pagamento
                </button>
                <p class="text-xs text-gray-500 text-center">Pagamento confirmado em até 1 hora útil.</p>
              `}
            </div>
          </div>
          
          <div class="flex flex-col items-center justify-center">
            <div class="bg-white p-4 rounded-xl border border-secondary-200">
              <div class="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center mb-3" id="qrcode-container">
                <!-- QR Code gerado via JS -->
                <div id="qrcode-${neg.id}" class="w-full h-full" data-pix-code="${escapeAttr(pixCode)}" data-qr-rendered="0"></div>
              </div>
              <p class="text-xs text-center text-gray-500">Escaneie com o app do seu banco</p>
            </div>
          </div>
        </div>
        
        <p class="text-xs text-blue-600 mt-4 flex items-center gap-2">
          <i class="fas fa-shield-alt"></i>
          Seu pagamento está protegido. O vendedor só receberá após você confirmar o recebimento do produto.
        </p>
      </article>
    `;
  }

  function renderGameAccountBuyerChangeRequestSection(neg, { isBuyer } = {}) {
    if (!isBuyer) return '';
    if (String(neg?.category || '').trim() !== 'Conta de jogo') return '';

    if (neg.status !== 'waiting_digital_delivery') return '';

    const changeRequest = neg?.game_account?.buyer_change_request;
    const changeRequestedAt = neg?.game_account?.buyer_change_requested_at;
    const hasRequest = Boolean(changeRequest && String(changeRequest).trim());

    return `
      <article class="bg-white rounded-2xl p-6 shadow-card border border-gray-100">
        <h2 class="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2"><i class="fas fa-user-edit text-secondary-600"></i> Dados para alteração da conta</h2>
        <p class="text-sm text-gray-600 mb-4">Pagamento confirmado. Informe os dados para a intermediadora finalizar a troca. Você receberá uma <strong>senha aleatória</strong> e deverá alterar depois.</p>

        ${hasRequest ? `
          <div class="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div class="text-xs text-gray-500 mb-2">Enviado${changeRequestedAt ? ` em ${escapeHtml(formatDateTime(changeRequestedAt))}` : ''}</div>
            <pre class="whitespace-pre-wrap text-sm text-gray-800">${escapeHtml(String(changeRequest))}</pre>
          </div>
        ` : `
          <form data-action="submitGameAccountChangeRequest" data-id="${neg.id}" class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label class="flex flex-col gap-2">
                <span class="text-sm text-gray-700 font-medium">E-mail (novo) *</span>
                <input name="buyer_new_email" type="email" required placeholder="novo@email.com" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all" />
              </label>
              <label class="flex flex-col gap-2">
                <span class="text-sm text-gray-700 font-medium">Contato direto (WhatsApp) *</span>
                <input name="buyer_contact_phone" type="tel" required placeholder="19-99999-9999" inputmode="numeric" autocomplete="tel" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all" />
              </label>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label class="flex flex-col gap-2">
                <span class="text-sm text-gray-700 font-medium">Disponível pelos próximos</span>
                <select name="buyer_availability_minutes" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all">
                  <option value="">Selecione</option>
                  <option value="10">10 minutos</option>
                  <option value="20">20 minutos</option>
                  <option value="30">30 minutos</option>
                </select>
              </label>

              <div class="flex flex-col gap-2">
                <span class="text-sm text-gray-700 font-medium">Estou disponível para confirmar e-mail agora</span>
                <input type="hidden" name="buyer_availability_now" value="" />
                <button type="button" class="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-800 font-semibold transition" data-action="setBuyerAvailabilityNow">
                  Marcar disponibilidade agora
                </button>
                <p class="text-xs text-gray-500" data-availability-preview>Não marcado.</p>
              </div>
            </div>

            <label class="flex flex-col gap-2">
              <span class="text-sm text-gray-700 font-medium">Observações (opcional)</span>
              <textarea name="buyer_notes" rows="4" maxlength="2000" placeholder="Ex: posso confirmar código na hora, melhor horário, observações..." class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all resize-none"></textarea>
            </label>
            <button type="submit" class="px-4 py-2 bg-gradient-to-r from-secondary-500 to-secondary-600 hover:from-secondary-600 hover:to-secondary-700 rounded-lg text-white font-semibold transition shadow-sm">
              <i class="fas fa-paper-plane mr-2"></i>Enviar dados
            </button>
          </form>
        `}
      </article>
    `;
  }

  function renderGameAccountBuyerSellerInfoSection(neg, { isBuyer } = {}) {
    if (!isBuyer) return '';
    if (String(neg?.category || '').trim() !== CATEGORY_GAME_ACCOUNT) return '';
    if (neg.status !== 'waiting_digital_delivery') return '';

    const sellerInfo = neg?.game_account?.seller_info;
    const sentAt = neg?.game_account?.seller_info_sent_at;
    const viewedAt = neg?.game_account?.seller_info_viewed_by_buyer_at;
    const hasSellerInfo = Boolean(sellerInfo && String(sellerInfo).trim());

    return `
      <article class="bg-white rounded-2xl p-6 shadow-card border border-gray-100">
        <h2 class="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2"><i class="fas fa-eye text-secondary-600"></i> Dados enviados pelo vendedor</h2>
        ${hasSellerInfo ? `
          <p class="text-sm text-gray-600 mb-4">${sentAt ? `Enviado em <strong>${escapeHtml(formatDateTime(sentAt))}</strong>.` : 'Enviado.'} ${viewedAt ? `Visualizado em <strong>${escapeHtml(formatDateTime(viewedAt))}</strong>.` : ''}</p>
          <details class="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <summary class="cursor-pointer text-sm text-secondary-700 font-semibold select-none">Visualizar dados</summary>
            <div class="mt-3">
              <pre class="whitespace-pre-wrap text-sm text-gray-800">${escapeHtml(String(sellerInfo))}</pre>
            </div>
          </details>
        ` : `
          <p class="text-sm text-gray-600">Aguardando o vendedor enviar os dados de acesso para a intermediadora.</p>
        `}
      </article>
    `;
  }

  function renderGameAccountSellerInfoSection(neg, { isSeller } = {}) {
    if (!isSeller) return '';
    if (String(neg?.category || '').trim() !== 'Conta de jogo') return '';
    if (neg.status !== 'waiting_digital_delivery') return '';

    const sentAt = neg?.game_account?.seller_info_sent_at;
    const hasSellerInfo = Boolean(sentAt);

    return `
      <article class="bg-white rounded-2xl p-6 shadow-card border border-gray-100">
        <h2 class="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2"><i class="fas fa-key text-warning-600"></i> Dados da conta (para a intermediadora)</h2>
        <p class="text-sm text-gray-600 mb-4">Pagamento confirmado. Envie agora o login e demais dados de acesso. Esses dados ficam disponíveis para <strong>comprador</strong> e <strong>intermediadora</strong>.</p>

        ${hasSellerInfo ? `
          <div class="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div class="text-xs text-gray-500 mb-2">Enviado${sentAt ? ` em ${escapeHtml(formatDateTime(sentAt))}` : ''}</div>
            <p class="text-sm text-gray-700">Dados enviados com sucesso. Por segurança, não exibimos o conteúdo após o envio.</p>
          </div>
        ` : `
          <form data-action="submitGameAccountSellerInfo" data-id="${neg.id}" class="space-y-4">
            <div class="p-4 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-700">
              <div class="font-semibold">Taxa da intermediação</div>
              <div class="mt-1">
                ${neg?.seller_fee_deduct_from_payout
                  ? 'Modo selecionado: <strong>descontar do repasse</strong> (não exige Pix do vendedor).'
                  : 'Modo selecionado: <strong>Pix do vendedor</strong> (se aplicável no fluxo).'}
              </div>
              <input type="hidden" name="seller_fee_deduct_from_payout" value="${neg?.seller_fee_deduct_from_payout ? '1' : '0'}" />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label class="flex flex-col gap-2">
                <span class="text-sm text-gray-700 font-medium">Login *</span>
                <input name="seller_account_login" type="text" required class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-warning-500 focus:border-warning-500 transition-all" />
              </label>
              <label class="flex flex-col gap-2">
                <span class="text-sm text-gray-700 font-medium">Senha *</span>
                <input name="seller_account_password" type="password" required autocomplete="new-password" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-warning-500 focus:border-warning-500 transition-all" />
              </label>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label class="flex flex-col gap-2">
                <span class="text-sm text-gray-700 font-medium">E-mail vinculado (se houver)</span>
                <input name="seller_account_email" type="email" autocomplete="email" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-warning-500 focus:border-warning-500 transition-all" />
              </label>
              <label class="flex flex-col gap-2">
                <span class="text-sm text-gray-700 font-medium">Senha do e-mail (se houver)</span>
                <input name="seller_email_password" type="password" autocomplete="new-password" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-warning-500 focus:border-warning-500 transition-all" />
              </label>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label class="flex flex-col gap-2">
                <span class="text-sm text-gray-700 font-medium">Dupla autenticação (2FA)</span>
                <select name="seller_2fa_removed" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-warning-500 focus:border-warning-500 transition-all">
                  <option value="">Selecione</option>
                  <option value="removed">Removi / desativei</option>
                  <option value="not_removed">Não removi</option>
                  <option value="unknown">Não sei</option>
                </select>
              </label>
              <label class="flex flex-col gap-2">
                <span class="text-sm text-gray-700 font-medium">Contato direto (WhatsApp) *</span>
                <input name="seller_contact_phone" type="tel" required placeholder="19-99999-9999" inputmode="numeric" autocomplete="tel" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-warning-500 focus:border-warning-500 transition-all" />
              </label>
            </div>

            <div class="flex flex-col gap-2">
              <span class="text-sm text-gray-700 font-medium">Estou online para confirmar códigos</span>
              <input type="hidden" name="seller_online_now" value="" />
              <button type="button" class="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-800 font-semibold transition" data-action="setSellerOnlineNow">
                Marcar como online agora
              </button>
              <p class="text-xs text-gray-500" data-seller-online-preview>Não marcado.</p>
            </div>

            <label class="flex flex-col gap-2">
              <span class="text-sm text-gray-700 font-medium">Observações (opcional)</span>
              <textarea name="seller_notes" rows="4" maxlength="2000" placeholder="Ex: observações..." class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-warning-500 focus:border-warning-500 transition-all resize-none"></textarea>
            </label>

            <button type="submit" class="px-4 py-2 bg-gradient-to-r from-warning-500 to-orange-500 hover:from-warning-600 hover:to-orange-600 rounded-lg text-white font-semibold transition shadow-sm">
              <i class="fas fa-paper-plane mr-2"></i>Enviar dados
            </button>
          </form>
        `}
      </article>
    `;
  }

  function renderDigitalDeliverySellerInfoSection(neg, { isSeller } = {}) {
    if (!isSeller) return '';
    const category = String(neg?.category || '').trim();
    // Moedas / Gold / Créditos tem fluxo próprio (gold_*). Não usa entrega digital genérica.
    if (category === CATEGORY_CURRENCY) return '';
    if (!isDigitalDeliveryCategory(category) || category === CATEGORY_GAME_ACCOUNT) return '';
    if (neg.status !== 'waiting_digital_delivery') return '';

    const sentAt = neg?.digital_delivery?.seller_info_sent_at;
    const hasSent = Boolean(sentAt);

    const deadlineDays = Number(neg?.delivery_days) > 0 ? Number(neg.delivery_days) : DIGITAL_DELIVERY_DEADLINE_BUSINESS_DAYS;

    return `
      <article class="bg-white rounded-2xl p-6 shadow-card border border-gray-100">
        <h2 class="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2"><i class="fas fa-key text-warning-600"></i> Entrega digital (para a intermediadora)</h2>
        <div class="p-4 rounded-xl border border-warning-200 bg-warning-50 mb-4">
          <div class="text-sm font-semibold text-warning-800">Pagamento confirmado — ação necessária</div>
          <p class="text-sm text-warning-700 mt-1">Você tem <strong>${deadlineDays} ${deadlineDays === 1 ? 'dia' : 'dias'}</strong> para concluir a entrega digital. Se não concluir dentro do prazo, o comprador poderá ser reembolsado.</p>
          <p class="text-xs text-warning-700 mt-2">Após a intermediadora finalizar a etapa, o <strong>comprador deverá confirmar o recebimento</strong> para encerrar a negociação.</p>
        </div>
        <p class="text-sm text-gray-600 mb-4">Pagamento confirmado. Envie as informações necessárias para concluir a entrega (ex.: código/chave, instruções, identificadores). Esses dados ficam disponíveis para <strong>comprador</strong> e <strong>intermediadora</strong>.</p>

        ${hasSent ? `
          <div class="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div class="text-xs text-gray-500 mb-2">Enviado${sentAt ? ` em ${escapeHtml(formatDateTime(sentAt))}` : ''}</div>
            <p class="text-sm text-gray-700">Dados enviados com sucesso. Por segurança, não exibimos o conteúdo após o envio.</p>
          </div>
        ` : `
          <form data-action="submitDigitalDeliveryInfo" data-id="${neg.id}" class="space-y-4">
            <label class="flex flex-col gap-2">
              <span class="text-sm text-gray-700 font-medium">Dados da entrega *</span>
              <textarea name="digital_delivery_info" rows="5" minlength="5" maxlength="5000" required placeholder="Ex: Código: ...\nInstruções: ...\nServidor/Região: ...\nObservações: ..." class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-warning-500 focus:border-warning-500 transition-all resize-none"></textarea>
            </label>
            <button type="submit" class="px-4 py-2 bg-gradient-to-r from-warning-500 to-orange-500 hover:from-warning-600 hover:to-orange-600 rounded-lg text-white font-semibold transition shadow-sm">
              <i class="fas fa-paper-plane mr-2"></i>Enviar dados
            </button>
          </form>
        `}
      </article>
    `;
  }

  function renderDigitalDeliveryBuyerInfoSection(neg, { isBuyer } = {}) {
    if (!isBuyer) return '';
    const category = String(neg?.category || '').trim();
    // Moedas / Gold / Créditos tem fluxo próprio (gold_*). Não usa entrega digital genérica.
    if (category === CATEGORY_CURRENCY) return '';
    if (!isDigitalDeliveryCategory(category) || category === CATEGORY_GAME_ACCOUNT) return '';
    if (!['waiting_digital_delivery', 'approved'].includes(neg.status)) return '';

    const info = neg?.digital_delivery?.seller_info;
    const sentAt = neg?.digital_delivery?.seller_info_sent_at;
    const viewedAt = neg?.digital_delivery?.seller_info_viewed_by_buyer_at;
    const hasInfo = Boolean(info && String(info).trim());

    return `
      <article class="bg-white rounded-2xl p-6 shadow-card border border-gray-100">
        <h2 class="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2"><i class="fas fa-eye text-secondary-600"></i> Dados enviados pelo vendedor</h2>
        ${hasInfo ? `
          <p class="text-sm text-gray-600 mb-4">${sentAt ? `Enviado em <strong>${escapeHtml(formatDateTime(sentAt))}</strong>.` : 'Enviado.'} ${viewedAt ? `Visualizado em <strong>${escapeHtml(formatDateTime(viewedAt))}</strong>.` : ''}</p>
          <details class="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <summary class="cursor-pointer text-sm text-secondary-700 font-semibold select-none">Visualizar dados</summary>
            <div class="mt-3">
              <pre class="whitespace-pre-wrap text-sm text-gray-800">${escapeHtml(String(info))}</pre>
            </div>
          </details>
        ` : `
          <p class="text-sm text-gray-600">Aguardando o vendedor enviar os dados da entrega digital para a intermediadora.</p>
        `}
      </article>
    `;
  }

  function renderBuyerRejectModal() {
    if (!state.showBuyerRejectModal) return '';
    
    return `
      <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-2xl shadow-card-xl max-w-md w-full overflow-hidden animate-slide-up">
          <div class="h-1 bg-gradient-to-r from-danger-500 to-danger-400"></div>
          <header class="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100">
            <div>
              <h2 class="text-xl font-bold text-gray-900">Recusar Negociação</h2>
              <p class="text-gray-500 text-sm">Informe o motivo da recusa</p>
            </div>
            <button class="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors" data-action="closeRejectModal">✕</button>
          </header>
          <form data-action="rejectNegotiationBuyer" class="p-4 sm:p-6 space-y-4">
            <input type="hidden" name="negotiation_id" value="${state.rejectNegotiationId || ''}">
            <label class="flex flex-col gap-1">
              <span class="text-sm text-gray-700 font-medium">Motivo da recusa *</span>
              <select name="reject_reason_type" required class="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-danger-500 focus:border-danger-500 transition-all">
                <option value="">Selecione um motivo</option>
                <option value="price">Preço muito alto</option>
                <option value="description">Descrição não corresponde</option>
                <option value="photos">Fotos não satisfatórias</option>
                <option value="seller">Problemas com o vendedor</option>
                <option value="changed_mind">Mudei de ideia</option>
                <option value="other">Outro motivo</option>
              </select>
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm text-gray-700 font-medium">Detalhes (opcional)</span>
              <textarea name="reject_details" rows="3" maxlength="500" placeholder="Explique melhor o motivo..." class="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-danger-500 focus:border-danger-500 transition-all resize-none"></textarea>
            </label>
            <div class="flex gap-3 pt-4">
              <button type="button" class="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition" data-action="closeRejectModal">Cancelar</button>
              <button type="submit" class="flex-1 px-4 py-3 bg-gradient-to-r from-danger-500 to-danger-600 hover:from-danger-600 hover:to-danger-700 rounded-lg text-white font-bold transition-all">
                <i class="fas fa-times mr-2"></i>Confirmar recusa
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  function renderTrackingForms(neg, { isBuyer, isSeller }) {
    const admin = isAdmin();
    const trackSeller = neg.tracking_to_intermediary || neg.tracking_code || '';
    const trackBuyer = neg.tracking_to_buyer || neg.buyer_tracking_code || '';

    const hideSellerTrackingForUser = Boolean(trackBuyer) && !admin;
    
    // O backend aceita envio do vendedor somente em `waiting_shipment`.
    const sellerTrackingStatuses = ['waiting_shipment'];
    
    // Vendedor pode adicionar código apenas UMA VEZ (se ainda não tem código)
    // Admin pode sempre editar
    const sellerCanAddCode = isSeller && !trackSeller && sellerTrackingStatuses.includes(neg.status);
    const adminCanEditSellerCode = admin;
    
    // Apenas Admin pode editar código para comprador
    const adminCanEditBuyerCode = admin;
    
    const sections = [];

    // Seção de rastreio para intermediadora (vendedor → intermediadora)
    if (!hideSellerTrackingForUser && (trackSeller || sellerCanAddCode || adminCanEditSellerCode)) {
      if (sellerCanAddCode) {
        // Vendedor pode adicionar código pela primeira vez
        sections.push(`
          <form class="flex flex-wrap items-end gap-3 mt-4" data-action="updateTracking" data-id="${neg.id}" data-type="seller">
            <label class="flex flex-col gap-1 flex-1 min-w-0 sm:min-w-[200px]">
              <span class="text-sm text-gray-600 font-medium"><i class="fas fa-truck mr-1"></i>Código de rastreio para intermediadora</span>
              <input type="text" name="tracking_code" placeholder="Ex: BR123456789" required class="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
            </label>
            <button type="submit" class="px-4 py-3 bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 rounded-lg text-white font-medium transition">Salvar</button>
          </form>
        `);
      } else if (adminCanEditSellerCode) {
        // Admin pode editar
        sections.push(`
          <form class="flex flex-wrap items-end gap-3 mt-4" data-action="updateTracking" data-id="${neg.id}" data-type="seller">
            <label class="flex flex-col gap-1 flex-1 min-w-0 sm:min-w-[200px]">
              <span class="text-sm text-gray-600 font-medium"><i class="fas fa-truck mr-1"></i>Rastreio para intermediadora (Admin)</span>
              <input type="text" name="tracking_code" placeholder="Ex: BR123456789" value="${escapeAttr(trackSeller)}" required class="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
            </label>
            <button type="submit" class="px-4 py-3 bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 rounded-lg text-white font-medium transition">Atualizar</button>
          </form>
        `);
      } else if (trackSeller) {
        // Apenas visualização para vendedor (já preenchido) e comprador
        sections.push(`
          <div class="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
            <span class="text-sm text-gray-600 font-medium"><i class="fas fa-truck mr-1"></i>Rastreio para intermediadora</span>
            <div class="mt-1 flex flex-col sm:flex-row sm:items-center items-start gap-2">
              <code class="px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-800 font-mono break-all">${escapeHtml(trackSeller)}</code>
              <a href="https://www.google.com/search?q=${encodeURIComponent(trackSeller + ' rastreio')}" target="_blank" class="text-primary-600 hover:text-primary-700 text-sm"><i class="fas fa-external-link-alt"></i> Rastrear</a>
            </div>
          </div>
        `);
      }
    }

    // Seção de rastreio para comprador (intermediadora → comprador)
    if (trackBuyer || adminCanEditBuyerCode) {
      if (adminCanEditBuyerCode) {
        // Admin pode editar
        sections.push(`
          <form class="flex flex-wrap items-end gap-3 mt-4" data-action="updateTracking" data-id="${neg.id}" data-type="buyer">
            <label class="flex flex-col gap-1 flex-1 min-w-0 sm:min-w-[200px]">
              <span class="text-sm text-gray-600 font-medium"><i class="fas fa-shipping-fast mr-1"></i>Rastreio para comprador (Admin)</span>
              <input type="text" name="tracking_code" placeholder="Ex: BR987654321" value="${escapeAttr(trackBuyer)}" required class="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
            </label>
            <button type="submit" class="px-4 py-3 bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 rounded-lg text-white font-medium transition">Atualizar</button>
          </form>
        `);
      } else if (trackBuyer) {
        // Apenas visualização para comprador e vendedor
        sections.push(`
          <div class="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
            <span class="text-sm text-gray-600 font-medium"><i class="fas fa-shipping-fast mr-1"></i>Rastreio para comprador</span>
            <div class="mt-1 flex flex-col sm:flex-row sm:items-center items-start gap-2">
              <code class="px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-800 font-mono break-all">${escapeHtml(trackBuyer)}</code>
              <a href="https://www.google.com/search?q=${encodeURIComponent(trackBuyer + ' rastreio')}" target="_blank" class="text-primary-600 hover:text-primary-700 text-sm"><i class="fas fa-external-link-alt"></i> Rastrear</a>
            </div>
          </div>
        `);
      }
    }

    if (!sections.length) return '';
    return `<div class="mt-4 pt-4 border-t border-gray-100">${sections.join('')}</div>`;
  }

  function renderPaymentsSection(neg) {
    const payments = Array.isArray(neg.payments) ? neg.payments : [];
    if (!payments.length) return '';
    const rows = payments.map((payment) => {
      const label = payment.description || ({
        release: 'Liberação de pagamento',
        buyer_fee: 'Taxa do comprador',
        seller_fee: 'Taxa do vendedor'
      }[payment.type] || 'Pagamento');
      // Alguns payloads marcam a confirmação no nível da negociação, mas não replicam
      // para cada linha em `payments`. Evita mostrar "Pendente" quando já foi confirmado.
      const confirmedFallback = (() => {
        const type = String(payment?.type || '').trim();
        if (type === 'buyer_fee') return neg?.buyer_fee_paid_at || null;
        if (type === 'seller_fee') return neg?.seller_fee_paid_at || null;
        if (type === 'release' || type === 'product') return neg?.product_paid_at || neg?.paid_at || null;
        return null;
      })();

      const confirmedAt = payment.confirmed_at || confirmedFallback;
      const status = confirmedAt ? `Confirmado em ${formatDate(confirmedAt)}` : 'Pendente';
      return `
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 py-2 border-b border-slate-700 last:border-b-0">
          <span class="text-white">${escapeHtml(label)}</span>
          <span class="text-success-600 font-bold">${formatCurrency(payment.amount)}</span>
          <span class="text-gray-500">${escapeHtml(status)}</span>
        </div>
      `;
    }).join('');
    return `
      <article class="bg-white rounded-2xl p-6 shadow-card border border-gray-100 hover:shadow-card-lg transition-all duration-200">
        <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-credit-card text-primary-500"></i> Pagamentos</h2>
        <div>
          ${rows}
        </div>
      </article>
    `;
  }

  function renderAdminActionsSection(neg) {
    if (!isAdmin()) return '';
    const category = String(neg?.category || '').trim();
    const currencyCategory = category === CATEGORY_CURRENCY;
    const awaitingAdmin = neg.status === 'awaiting_admin_approval';
    const atIntermediary = neg.status === 'at_intermediary';
    const waitingPayment = neg.status === 'waiting_payment';
    const showApproveReject = awaitingAdmin;
    const showInspectionForm = atIntermediary && Boolean(neg.inspection_saved_at) && !neg.intermediary_approval_confirmed_at;
    const showFinalize = neg.status === 'delivered';
    const showMarkReceived = neg.status === 'shipped' && !neg.intermediary_received_status;
    const showDigitalDelivery = neg.status === 'waiting_digital_delivery' && isDigitalDeliveryCategory(category) && !currencyCategory;

    const goldBuyerReceivedAt = neg?.gold_delivery?.buyer_received_confirmed_at;
    const goldSellerSentAt = neg?.gold_delivery?.seller_sent_confirmed_at;
    const showUrgentSellerPayout = currencyCategory && Boolean(goldBuyerReceivedAt) && Boolean(goldSellerSentAt);

    const sections = [];

    if (showApproveReject) {
      sections.push({ priority: 100, html: `
        <section class="pt-4 border-t border-gray-200 first:border-t-0 first:pt-0">
          <h3 class="text-sm font-bold text-primary-700 mb-3">Prioridade: aprovação inicial</h3>
          <div class="flex flex-wrap gap-3">
            <button class="px-4 py-2 bg-gradient-to-r from-success-500 to-success-600 hover:from-success-600 hover:to-success-700 rounded-lg text-white font-medium transition shadow-md" data-action="adminApproveNegotiation" data-id="${neg.id}"><i class="fas fa-check mr-2"></i>Aprovar negociação</button>
            <button class="px-4 py-2 bg-gradient-to-r from-danger-500 to-danger-600 hover:from-danger-600 hover:to-danger-700 rounded-lg text-white font-medium transition shadow-md" data-action="adminRejectNegotiation" data-id="${neg.id}"><i class="fas fa-times mr-2"></i>Reprovar</button>
          </div>
        </section>
      ` });
    }

    if (waitingPayment) {
      const nextStepLabel = isDigitalDeliveryCategory(neg?.category) ? 'Entrega digital pendente' : 'Aguardando envio';
      sections.push({ priority: 10, html: `
        <section class="pt-4 border-t border-gray-100 first:border-t-0 first:pt-0">
          <h3 class="text-sm font-medium text-gray-700 mb-3">Pagamento (simulação)</h3>
          <p class="text-sm text-gray-500 mb-3">Use apenas para testes. Isso avança a negociação para <strong>${escapeHtml(nextStepLabel)}</strong>.</p>
          <button class="px-4 py-2 bg-gradient-to-r from-warning-500 to-orange-500 hover:from-warning-600 hover:to-orange-600 rounded-lg text-white font-bold transition shadow-md" data-action="adminSimulatePayment" data-id="${neg.id}">
            <i class="fas fa-bolt mr-2"></i>Simular confirmação de pagamento
          </button>
        </section>
      ` });
    }

    if (showDigitalDelivery) {
      sections.push({ priority: 20, html: `
        <section class="pt-4 border-t border-gray-100 first:border-t-0 first:pt-0">
          <h3 class="text-sm font-medium text-gray-700 mb-3">Entrega digital</h3>
          <p class="text-sm text-gray-500 mb-3">Quando a transferência estiver concluída, marque como entregue para finalizar.</p>
          <button class="px-4 py-2 bg-gradient-to-r from-secondary-500 to-secondary-600 hover:from-secondary-600 hover:to-secondary-700 rounded-lg text-white font-bold transition shadow-md" data-action="adminMarkDigitalDelivered" data-id="${neg.id}">
            <i class="fas fa-check mr-2"></i>Marcar entrega digital
          </button>
        </section>
      ` });
    }

    if (showInspectionForm) {
      sections.push({ priority: 90, html: `
        <section class="pt-4 border-t border-gray-100">
          <h3 class="text-sm font-bold text-primary-700 mb-3">Prioridade: envio ao comprador</h3>
          <form data-action="approveProduct" data-id="${neg.id}" class="space-y-4">
            <div>
              <label class="block text-sm text-gray-600 font-medium mb-2">Rastreio para o comprador</label>
              <input type="text" name="tracking_to_buyer" required placeholder="Código de rastreio" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
            </div>
            <div>
              <label class="block text-sm text-gray-600 font-medium mb-2">Observações</label>
              <textarea name="intermediary_notes" rows="3" placeholder="Observações sobre estado do produto" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all resize-none"></textarea>
            </div>
            <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" name="seller_transferred" checked class="w-4 h-4 rounded bg-gray-50 border-gray-300 text-primary-600 focus:ring-primary-500">
              <span>Transferir valor ao vendedor imediatamente</span>
            </label>
            <div class="flex flex-wrap gap-3">
              <button type="submit" class="px-4 py-2 bg-gradient-to-r from-success-500 to-success-600 hover:from-success-600 hover:to-success-700 rounded-lg text-white font-medium transition shadow-md"><i class="fas fa-paper-plane mr-2"></i>Aprovar e enviar</button>
              <button type="button" class="px-4 py-2 bg-gradient-to-r from-danger-500 to-danger-600 hover:from-danger-600 hover:to-danger-700 rounded-lg text-white font-medium transition shadow-md" data-action="rejectProduct" data-id="${neg.id}"><i class="fas fa-times mr-2"></i>Reprovar</button>
            </div>
          </form>
        </section>
      ` });
    }

    if (showMarkReceived) {
      sections.push({ priority: 50, html: `
        <section class="pt-4 border-t border-gray-100">
          <h3 class="text-sm font-medium text-gray-700 mb-3">Confirmação de chegada na intermediadora</h3>
          <button class="px-4 py-2 bg-gradient-to-r from-secondary-500 to-secondary-600 hover:from-secondary-600 hover:to-secondary-700 rounded-lg text-white font-medium transition shadow-md" data-action="markIntermediaryReceived" data-id="${neg.id}"><i class="fas fa-box-open mr-2"></i>Marcar como recebido</button>
        </section>
      ` });
    }

    if (showUrgentSellerPayout) {
      sections.push({ priority: 95, html: `
        <section class="pt-4 border-t border-gray-100">
          <div class="p-4 rounded-xl border border-warning-200 bg-warning-50">
            <h3 class="text-sm font-bold text-warning-700 mb-2"><i class="fas fa-exclamation-triangle mr-2"></i>URGENTE: fazer o pagamento ao vendedor</h3>
            <p class="text-sm text-warning-700">Comprador e vendedor já confirmaram a entrega/recebimento do Gold. Faça o repasse ao vendedor agora.</p>
          </div>
        </section>
      ` });
    }

    if (showFinalize) {
      sections.push({ priority: 80, html: `
        <section class="pt-4 border-t border-gray-100">
          <h3 class="text-sm font-bold text-primary-700 mb-3">Prioridade: finalização</h3>
          <button class="px-4 py-2 bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 rounded-lg text-white font-bold transition shadow-md" data-action="finalizeNegotiation" data-id="${neg.id}"><i class="fas fa-flag-checkered mr-2"></i>Finalizar negociação</button>
        </section>
      ` });
    }

    if (!sections.length) return '';

    const orderedSections = sections
      .slice()
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))
      .map((item) => item.html);

    return `
      <article class="bg-white rounded-2xl p-6 shadow-card border border-gray-100">
        <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-shield-alt text-primary-500"></i> Ações da intermediadora</h2>
        <div class="space-y-4">
          ${orderedSections.join('')}
        </div>
      </article>
    `;
  }

  function renderInspectionReportSection(neg) {
    if (!isAdmin()) return '';
    if (!['at_intermediary', 'approved', 'delivered'].includes(neg.status)) return '';

    const report = neg.inspection_report || state.inspectionReport;
    const existingReport = neg.inspection_report;
    const isEditing = state.inspectionReport.editing;
    const reportPhotos = report.photos || [];
    const checklist = report.checklist || {};

    // Se já existe relatório e não está editando, mostrar visualização
    if (existingReport && !isEditing) {
      return `
        <article class="bg-white rounded-2xl p-6 shadow-card border border-gray-100 hover:shadow-card-lg transition-all duration-200">
          <header class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-bold text-gray-800 flex items-center gap-2">
              <i class="fas fa-clipboard-check text-secondary-500"></i> Relatório de Inspeção
            </h2>
            <button class="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 text-sm transition" data-action="editInspectionReport" data-id="${neg.id}">
              <i class="fas fa-edit mr-1"></i>Editar
            </button>
          </header>
          
          <div class="space-y-4">
            <!-- Checklist -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              ${INSPECTION_CHECKLIST.map(item => `
                <div class="flex items-center gap-2 text-sm ${checklist[item.id] ? 'text-success-600' : 'text-danger-500'}">
                  <i class="fas ${checklist[item.id] ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                  ${escapeHtml(item.label)}
                </div>
              `).join('')}
            </div>
            
            <!-- Notas -->
            ${report.notes ? `
              <div class="p-3 bg-gray-50 rounded-lg">
                <h4 class="text-sm font-medium text-gray-700 mb-1">Observações:</h4>
                <p class="text-gray-600 text-sm">${escapeHtml(report.notes)}</p>
              </div>
            ` : ''}
            
            <!-- Fotos -->
            ${reportPhotos.length ? `
              <div>
                <h4 class="text-sm font-medium text-gray-700 mb-2">Fotos da inspeção:</h4>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  ${reportPhotos.map((url, idx) => `
                    <img src="${escapeAttr(resolvePhotoUrl(url))}" alt="Foto ${idx + 1}" class="w-full h-20 object-cover rounded-lg">
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        </article>
      `;
    }

    // Formulário de criação/edição
    const currentPhotos = state.inspectionReport.photos || [];
    
    return `
      <article class="bg-white rounded-2xl p-6 shadow-card border border-gray-100 hover:shadow-card-lg transition-all duration-200">
        <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <i class="fas fa-clipboard-check text-secondary-500"></i> ${existingReport ? 'Editar' : 'Criar'} Relatório de Inspeção
        </h2>
        
        <form data-action="saveInspectionReport" data-id="${neg.id}" class="space-y-5">
          <!-- Checklist -->
          <div>
            <h3 class="text-sm font-medium text-gray-700 mb-3">Checklist de verificação</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              ${INSPECTION_CHECKLIST.map(item => `
                <label class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
                  <input type="checkbox" name="checklist_${item.id}" ${state.inspectionReport.checklist[item.id] ? 'checked' : ''} class="w-5 h-5 rounded border-gray-300 text-secondary-600 focus:ring-secondary-500">
                  <span class="text-sm text-gray-700">${escapeHtml(item.label)}</span>
                </label>
              `).join('')}
            </div>
          </div>
          
          <!-- Upload de fotos -->
          <div>
            <h3 class="text-sm font-medium text-gray-700 mb-2">Fotos da inspeção (até 3)</h3>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              ${currentPhotos.map((photo, idx) => `
                <div class="relative group">
                  <img src="${photo.preview || resolvePhotoUrl(photo)}" alt="Foto ${idx + 1}" class="w-full h-20 object-cover rounded-lg border border-gray-200">
                  <button type="button" class="absolute top-1 right-1 w-5 h-5 bg-danger-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition" data-action="removeInspectionPhoto" data-index="${idx}">✕</button>
                </div>
              `).join('')}
              ${currentPhotos.length < 3 ? `
                <label class="w-full h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-secondary-400 hover:bg-secondary-50 transition">
                  <i class="fas fa-camera text-gray-400"></i>
                  <span class="text-xs text-gray-400">Adicionar</span>
                  <input type="file" accept="image/*" class="hidden" data-action="addInspectionPhoto">
                </label>
              ` : ''}
            </div>
          </div>
          
          <!-- Observações -->
          <label class="flex flex-col gap-1">
            <span class="text-sm text-gray-700 font-medium">Observações do inspetor</span>
            <textarea name="inspection_notes" rows="3" placeholder="Descreva o estado do produto, problemas encontrados, etc." class="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all resize-none">${escapeHtml(state.inspectionReport.notes || '')}</textarea>
          </label>
          
          <div class="flex gap-3">
            ${existingReport ? `
              <button type="button" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition" data-action="cancelEditInspectionReport">Cancelar</button>
            ` : ''}
            <button type="submit" class="flex-1 px-4 py-2 bg-gradient-to-r from-secondary-500 to-secondary-600 hover:from-secondary-600 hover:to-secondary-700 rounded-lg text-white font-medium transition shadow-md">
              <i class="fas fa-save mr-2"></i>${existingReport ? 'Atualizar' : 'Salvar'} relatório
            </button>
          </div>
        </form>
      </article>
    `;
  }

  function renderNegotiationLogs(neg) {
    if (!isAdmin()) return '';
    
    const logs = neg.logs || state.negotiationLogs || [];
    
    return `
      <article class="bg-white rounded-2xl p-6 shadow-card border border-gray-100 hover:shadow-card-lg transition-all duration-200">
        <header class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold text-gray-800 flex items-center gap-2">
            <i class="fas fa-history text-gray-500"></i> Logs da Negociação
          </h2>
          <button class="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 text-sm transition" data-action="addInternalLog" data-id="${neg.id}">
            <i class="fas fa-plus mr-1"></i>Adicionar nota
          </button>
        </header>
        
        <div class="space-y-3 max-h-80 overflow-y-auto">
          ${logs.length ? logs.map(log => `
            <div class="p-3 bg-gray-50 rounded-lg border-l-4 ${getLogBorderColor(log.type)}">
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs font-medium ${getLogTextColor(log.type)}">${escapeHtml(getLogTypeLabel(log.type))}</span>
                <span class="text-xs text-gray-400">${formatDateTime(log.created_at)}</span>
              </div>
              <p class="text-sm text-gray-700">${escapeHtml(log.message)}</p>
              ${log.user ? `<span class="text-xs text-gray-400 mt-1 block">Por: ${escapeHtml(log.user.name || 'Sistema')}</span>` : ''}
            </div>
          `).join('') : `
            <p class="text-gray-400 text-center py-4">Nenhum log registrado.</p>
          `}
        </div>
        
        <!-- Formulário de nova nota interna -->
        <form data-action="submitInternalLog" data-id="${neg.id}" class="mt-4 pt-4 border-t border-gray-100">
          <div class="flex gap-2">
            <input type="text" name="log_message" placeholder="Adicionar nota interna..." class="flex-1 px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all text-sm">
            <select name="log_type" class="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
              <option value="note">Nota</option>
              <option value="warning">Alerta</option>
              <option value="action">Ação</option>
              <option value="system">Sistema</option>
            </select>
            <button type="submit" class="px-4 py-2 bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 rounded-lg text-white text-sm font-medium transition">
              <i class="fas fa-plus"></i>
            </button>
          </div>
        </form>
      </article>
    `;
  }

  function getLogBorderColor(type) {
    const colors = {
      note: 'border-secondary-400',
      warning: 'border-warning-400',
      action: 'border-success-400',
      system: 'border-gray-400',
      error: 'border-danger-400'
    };
    return colors[type] || colors.note;
  }

  function getLogTextColor(type) {
    const colors = {
      note: 'text-secondary-600',
      warning: 'text-warning-600',
      action: 'text-success-600',
      system: 'text-gray-600',
      error: 'text-danger-600'
    };
    return colors[type] || colors.note;
  }

  function getLogTypeLabel(type) {
    const labels = {
      note: 'Nota',
      warning: 'Alerta',
      action: 'Ação',
      system: 'Sistema',
      error: 'Erro'
    };
    return labels[type] || 'Nota';
  }

  function renderParticipantActions(neg, { isBuyer, isSeller, isIntermediary } = {}) {
    const sections = [];

    if (isBuyer && neg.status === 'approved' && !neg.buyer_confirmed_at) {
      sections.push(`
        <section class="pt-4 border-t border-gray-100 first:border-t-0 first:pt-0">
          <h3 class="text-sm font-medium text-gray-700 mb-2">Confirmação de recebimento</h3>
          <p class="text-gray-500 text-sm mb-3">Ao confirmar, a negociação avança para etapa final.</p>
          <button class="px-4 py-2 bg-gradient-to-r from-success-500 to-success-600 hover:from-success-600 hover:to-success-700 rounded-lg text-white font-medium transition shadow-md" data-action="buyerConfirmDelivery" data-id="${neg.id}"><i class="fas fa-check mr-2"></i>Confirmar recebimento</button>
        </section>
      `);

      sections.push(`
        <section class="pt-4 border-t border-gray-100">
          <h3 class="text-sm font-medium text-gray-700 mb-3">Avaliação da experiência</h3>
          <form data-action="submitBuyerFeedback" data-id="${neg.id}" class="space-y-4">
            <div>
              <label class="block text-sm text-gray-600 font-medium mb-2">Nota (1 a 10)</label>
              <input type="number" name="buyer_rating" min="1" max="10" value="${neg.buyer_rating ?? 10}" required class="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all w-24">
            </div>
            <div>
              <label class="block text-sm text-gray-600 font-medium mb-2">Comentário (opcional)</label>
              <textarea name="buyer_rating_comment" rows="3" maxlength="500" placeholder="Conte como foi sua experiência" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all resize-none"></textarea>
            </div>
            <button type="submit" class="px-4 py-2 bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 rounded-lg text-white font-medium transition"><i class="fas fa-paper-plane mr-2"></i>Enviar feedback</button>
          </form>
        </section>
      `);
    }

    if (isBuyer && neg.buyer_confirmed_at) {
      sections.push(`
        <section class="pt-4 border-t border-gray-100 first:border-t-0 first:pt-0">
          <h3 class="text-sm font-medium text-gray-700 mb-2">Pagamento da intermediadora</h3>
          <div class="p-4 rounded-xl border border-gray-200 bg-gray-50">
            <p class="text-sm text-gray-700 font-semibold">Aguardando pagamento da intermediadora</p>
            <p class="text-sm text-gray-500 mt-1">Você já confirmou o recebimento. A intermediadora fará o repasse ao vendedor e finalizará a negociação.</p>
          </div>
        </section>
      `);
    }

    if (isSeller && neg.status === 'delivered' && !neg.seller_rating) {
      sections.push(`
        <section class="pt-4 border-t border-gray-100 first:border-t-0 first:pt-0">
          <h3 class="text-sm font-medium text-gray-700 mb-3">Avaliação da experiência</h3>
          <form data-action="submitSellerFeedback" data-id="${neg.id}" class="space-y-4">
            <div>
              <label class="block text-sm text-gray-600 font-medium mb-2">Nota (1 a 10)</label>
              <input type="number" name="seller_rating" min="1" max="10" value="${neg.seller_rating ?? 10}" required class="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all w-24">
            </div>
            <div>
              <label class="block text-sm text-gray-600 font-medium mb-2">Comentário (opcional)</label>
              <textarea name="seller_rating_comment" rows="3" maxlength="500" placeholder="Conte como foi sua experiência" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all resize-none"></textarea>
            </div>
            <button type="submit" class="px-4 py-2 bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 rounded-lg text-white font-medium transition"><i class="fas fa-paper-plane mr-2"></i>Enviar feedback</button>
          </form>
        </section>
      `);
    }

    if (isIntermediary && neg.status === 'delivered' && !neg.intermediary_rating) {
      sections.push(`
        <section class="pt-4 border-t border-gray-100 first:border-t-0 first:pt-0">
          <h3 class="text-sm font-medium text-gray-700 mb-3">Avaliação da experiência (intermediadora)</h3>
          <form data-action="submitIntermediaryFeedback" data-id="${neg.id}" class="space-y-4">
            <div>
              <label class="block text-sm text-gray-600 font-medium mb-2">Nota (1 a 10)</label>
              <input type="number" name="intermediary_rating" min="1" max="10" value="${neg.intermediary_rating ?? 10}" required class="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all w-24">
            </div>
            <div>
              <label class="block text-sm text-gray-600 font-medium mb-2">Comentário (opcional)</label>
              <textarea name="intermediary_rating_comment" rows="3" maxlength="500" placeholder="Conte como foi sua experiência" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all resize-none"></textarea>
            </div>
            <button type="submit" class="px-4 py-2 bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 rounded-lg text-white font-medium transition"><i class="fas fa-paper-plane mr-2"></i>Enviar feedback</button>
          </form>
        </section>
      `);
    }

    if (!sections.length) return '';

    return `
      <article class="bg-white rounded-2xl p-6 shadow-card border border-gray-100">
        <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-user-check text-secondary-500"></i> Ações do participante</h2>
        <div class="space-y-4">
          ${sections.join('')}
        </div>
      </article>
    `;
  }

  function renderAttachmentSection(neg) {
    const photos = Array.isArray(neg.intermediary_photos) ? neg.intermediary_photos : [];
    const report = neg.intermediary_damage_report;
    const canPurgeImages = isAdmin() && neg.status === 'delivered' && photos.length;
    
    if (!photos.length && !report) return '';
    
    return `
      <article class="bg-white rounded-2xl p-6 shadow-card border border-gray-100">
        <div class="flex items-start justify-between gap-3 mb-4">
          <h2 class="text-lg font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-images text-danger-400"></i> Fotos e Relatórios</h2>
          ${canPurgeImages ? `
            <button class="px-3 py-2 bg-danger-50 hover:bg-danger-100 border border-danger-200 rounded-lg text-danger-700 text-sm font-medium transition" data-action="purgeNegotiationImages" data-id="${neg.id}">
              <i class="fas fa-trash-alt mr-2"></i>Apagar imagens
            </button>
          ` : ''}
        </div>
        
        ${report ? `
          <section class="mb-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
            <h3 class="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"><i class="fas fa-file-alt text-amber-500"></i> Relatório da Intermediadora</h3>
            <p class="text-gray-600">${escapeHtml(report.summary || report.description || report)}</p>
          </section>
        ` : ''}
        
      </article>
    `;
  }

  // =============================================
  // INTERMEDIATOR PAGES
  // =============================================

  const INTERMEDIATOR_PAGE_SIZE = 12;

  function paginateIntermediatorList(list) {
    const safeList = Array.isArray(list) ? list : [];
    const pageSize = INTERMEDIATOR_PAGE_SIZE;
    const totalPages = Math.max(1, Math.ceil(safeList.length / pageSize));
    const page = Math.min(Math.max(1, Number(state.intermediatorPage) || 1), totalPages);
    const startIndex = (page - 1) * pageSize;
    const endIndex = Math.min(safeList.length, startIndex + pageSize);
    const pageItems = safeList.slice(startIndex, endIndex);
    return {
      pageItems,
      meta: {
        page,
        pageSize,
        totalPages,
        startIndex,
        endIndex,
        totalCount: safeList.length
      }
    };
  }

  function renderIntermediatorPagination(meta) {
    if (!meta || meta.totalPages <= 1) return '';
    return `
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-white rounded-xl p-3 shadow-card border border-gray-100">
        <div class="text-sm text-gray-600">
          Mostrando <strong class="text-gray-900">${meta.startIndex + 1}-${meta.endIndex}</strong> de <strong class="text-gray-900">${meta.totalCount}</strong>
          <span class="text-gray-400">•</span>
          Página <strong class="text-gray-900">${meta.page}</strong> de <strong class="text-gray-900">${meta.totalPages}</strong>
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            class="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-700 text-sm font-medium transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            data-action="intermediatorPrevPage"
            ${meta.page <= 1 ? 'disabled' : ''}
          >
            <i class="fas fa-chevron-left mr-2"></i>Anterior
          </button>
          <button
            type="button"
            class="px-3 py-1.5 bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 rounded-lg text-white text-sm font-medium transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            data-action="intermediatorNextPage"
            ${meta.page >= meta.totalPages ? 'disabled' : ''}
          >
            Próxima<i class="fas fa-chevron-right ml-2"></i>
          </button>
        </div>
      </div>
    `;
  }

  function renderIntermediatorPage() {
    return `
      <section class="space-y-6">
        <header class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">Painel do Intermediador</h1>
            <p class="text-gray-500">Veja todas, assuma disponíveis e acompanhe as suas.</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button class="justify-center px-4 py-2 bg-white border border-gray-200 hover:border-primary-400 rounded-lg text-gray-700 font-medium transition shadow-sm flex items-center gap-2" data-action="intermediatorRefresh"><i class="fas fa-sync-alt"></i> Atualizar</button>
            ${canManageUsers() ? `<button class="justify-center px-4 py-2 bg-white border border-gray-200 hover:border-primary-400 rounded-lg text-gray-700 font-medium transition shadow-sm flex items-center gap-2" data-action="navigate" data-page="admin"><i class="fas fa-cog"></i> Administração</button>` : ''}
          </div>
        </header>
        ${renderIntermediatorTabs()}
        ${renderIntermediatorContent()}
      </section>
    `;
  }

  function renderIntermediatorTabs() {
    const tabs = [
      { key: 'all', label: 'Todas', icon: 'fa-layer-group' },
      { key: 'mine', label: 'Minhas Intermediações', icon: 'fa-clipboard-check' },
      { key: 'available', label: 'Disponíveis', icon: 'fa-clipboard-list' }
    ];
    return `
      <nav class="flex flex-col sm:flex-row gap-2 bg-white rounded-xl p-2 shadow-card">
        ${tabs.map((tab) => `
          <button class="flex-1 px-4 py-3 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${state.intermediatorTab === tab.key ? 'bg-gradient-to-r from-primary-600 to-secondary-500 text-white' : 'text-gray-600 hover:text-primary-600 hover:bg-primary-50'}" data-action="intermediatorSelectTab" data-tab="${tab.key}">
            <i class="fas ${tab.icon}"></i> ${tab.label}
            ${tab.key === 'all' && state.intermediatorAll?.length > 0 ? `<span class="bg-white/20 px-2 py-0.5 rounded-full text-xs">${state.intermediatorAll.length}</span>` : ''}
            ${tab.key === 'mine' && state.intermediatorMine.length > 0 ? `<span class="bg-white/20 px-2 py-0.5 rounded-full text-xs">${state.intermediatorMine.length}</span>` : ''}
            ${tab.key === 'available' && state.intermediatorAvailable.length > 0 ? `<span class="bg-white/20 px-2 py-0.5 rounded-full text-xs">${state.intermediatorAvailable.length}</span>` : ''}
          </button>
        `).join('')}
      </nav>
    `;
  }

  function renderIntermediatorContent() {
    switch (state.intermediatorTab) {
      case 'available':
        return renderIntermediatorAvailable();
      case 'all':
        return renderIntermediatorAll();
      case 'mine':
      default:
        return renderIntermediatorMine();
    }
  }

  function renderIntermediatorAll() {
    const list = Array.isArray(state.intermediatorAll) ? state.intermediatorAll : [];
    if (state.intermediatorIsLoading) {
      return `
        <div class="text-center py-12">
          <i class="fas fa-spinner fa-spin text-4xl text-primary-500 mb-4"></i>
          <p class="text-gray-500">Carregando todas as intermediações...</p>
        </div>
      `;
    }
    if (!list.length) {
      return `
        <div class="text-center py-12">
          <div class="w-16 h-16 bg-gradient-to-r from-gray-300 to-gray-400 rounded-xl flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-layer-group text-white text-2xl"></i>
          </div>
          <p class="text-gray-500">Nenhuma intermediação encontrada.</p>
        </div>
      `;
    }

    const myId = state.user?.id;
    const { pageItems, meta } = paginateIntermediatorList(list);
    return `
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        ${pageItems.map(neg => renderIntermediatorCard(neg, { mode: 'all', myId })).join('')}
      </div>
      ${renderIntermediatorPagination(meta)}
    `;
  }

  function renderIntermediatorMine() {
    const list = Array.isArray(state.intermediatorMine) ? state.intermediatorMine : [];
    if (state.intermediatorIsLoading) {
      return `
        <div class="text-center py-12">
          <i class="fas fa-spinner fa-spin text-4xl text-primary-500 mb-4"></i>
          <p class="text-gray-500">Carregando suas intermediações...</p>
        </div>
      `;
    }
    if (!list.length) {
      return `
        <div class="text-center py-12">
          <div class="w-16 h-16 bg-gradient-to-r from-gray-300 to-gray-400 rounded-xl flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-inbox text-white text-2xl"></i>
          </div>
          <p class="mb-4 text-gray-500">Você não está intermediando nenhuma negociação no momento.</p>
          <button class="px-6 py-3 bg-gradient-to-r from-primary-600 to-secondary-500 text-white rounded-lg font-medium transition shadow-sm" data-action="intermediatorSelectTab" data-tab="available">Ver Disponíveis</button>
        </div>
      `;
    }

    const { pageItems, meta } = paginateIntermediatorList(list);
    return `
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        ${pageItems.map(neg => renderIntermediatorCard(neg, { mode: 'mine' })).join('')}
      </div>
      ${renderIntermediatorPagination(meta)}
    `;
  }

  function renderIntermediatorAvailable() {
    const list = Array.isArray(state.intermediatorAvailable) ? state.intermediatorAvailable : [];
    if (state.intermediatorIsLoading) {
      return `
        <div class="text-center py-12">
          <i class="fas fa-spinner fa-spin text-4xl text-primary-500 mb-4"></i>
          <p class="text-gray-500">Carregando negociações disponíveis...</p>
        </div>
      `;
    }

    if (!list.length) {
      return `
        <div class="text-center py-12">
          <div class="w-16 h-16 bg-gradient-to-r from-success-400 to-success-500 rounded-xl flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-check text-white text-2xl"></i>
          </div>
          <p class="text-gray-500">Não há negociações disponíveis para intermediação no momento.</p>
        </div>
      `;
    }

    const { pageItems, meta } = paginateIntermediatorList(list);
    return `
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        ${pageItems.map(neg => renderIntermediatorCard(neg, { mode: 'available' })).join('')}
      </div>
      ${renderIntermediatorPagination(meta)}
    `;
  }

  function renderIntermediatorCard(neg, { mode = 'mine', myId = null } = {}) {
    const statusDisplay = getNegotiationDisplayStatus(neg, 'intermediator');
    const title = neg.title || 'Sem título';
    const priceFormatted = neg.price_formatted || formatCurrency(neg.price || 0);
    const sellerName = neg.seller?.name || 'Vendedor';
    const buyerName = neg.buyer?.name || 'Comprador';
    const category = neg.category || 'Sem categoria';
    const createdAt = neg.created_at ? formatRelativeTime(neg.created_at) : '';
    const paidAt = neg.paid_at ? formatRelativeTime(neg.paid_at) : '';

    const assignedName = neg.intermediator?.name || null;
    const assignedCode = neg.intermediator?.code ?? neg.intermediator?.intermediator_code ?? null;
    const assignedIsPrincipal = Boolean(neg.intermediator?.is_principal ?? neg.intermediator?.is_intermediator_principal);
    const assignedLabel = assignedName
      ? `${assignedCode ? `#${assignedCode} ` : ''}${assignedName}${assignedIsPrincipal ? ' (Principal)' : ''}`
      : null;
    const assignedAt = neg.intermediator_assigned_at ? formatRelativeTime(neg.intermediator_assigned_at) : '';
    const isMine = mode === 'mine' || (mode === 'all' && myId && Number(neg.intermediator?.id) === Number(myId));
    const isAvailable = mode !== 'mine' && !neg.intermediator;
    const isTakenByOther = mode === 'all' && !!neg.intermediator && !isMine;

    return `
      <article class="bg-white rounded-2xl p-5 shadow-card border border-gray-100 hover:shadow-lg transition">
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-2">
              ${renderStatusBadge(statusDisplay)}
              <span class="text-xs text-gray-400">#${neg.id}</span>
            </div>
            <h3 class="font-semibold text-gray-900 truncate">${escapeHtml(title)}</h3>
            <p class="text-sm text-gray-500 mt-1">${escapeHtml(category)}</p>
            <div class="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-600">
              <span><i class="fas fa-user-tag mr-1 text-primary-500"></i> ${escapeHtml(sellerName)} → ${escapeHtml(buyerName)}</span>
              <span class="font-semibold text-primary-600">${priceFormatted}</span>
            </div>
            ${paidAt ? `<p class="text-xs text-gray-400 mt-2">Pago ${paidAt}</p>` : `<p class="text-xs text-gray-400 mt-2">Criado ${createdAt}</p>`}
            <p class="text-xs mt-1 ${assignedName ? 'text-success-700' : 'text-gray-500'}">
              <i class="fas fa-user-tie mr-1"></i>
              Intermediador: ${assignedLabel ? escapeHtml(assignedLabel) : 'Livre'}
              ${assignedName && assignedAt ? `<span class="text-gray-400"> · atribuído ${assignedAt}</span>` : ''}
            </p>
          </div>
          <div class="flex flex-col gap-2 sm:items-end">
            ${isMine ? `
              <button class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition" data-action="navigate" data-page="negotiation-detail" data-negotiation-id="${neg.id}">
                <i class="fas fa-eye mr-1"></i> Ver Detalhes
              </button>
              <button class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition" data-action="intermediatorUnassign" data-id="${neg.id}">
                <i class="fas fa-times mr-1"></i> Deixar
              </button>
            ` : isTakenByOther ? `
              <button class="px-4 py-2 bg-gray-100 text-gray-400 rounded-lg text-sm font-medium cursor-not-allowed" disabled>
                <i class="fas fa-lock mr-1"></i> Em andamento
              </button>
              <button class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition" data-action="navigate" data-page="negotiation-detail" data-negotiation-id="${neg.id}">
                <i class="fas fa-eye mr-1"></i> Ver Detalhes
              </button>
            ` : `
              ${isAvailable ? `
                <button class="px-4 py-2 bg-gradient-to-r from-success-500 to-success-600 hover:from-success-600 hover:to-success-700 text-white rounded-lg text-sm font-medium transition" data-action="intermediatorAssign" data-id="${neg.id}">
                  <i class="fas fa-hand-paper mr-1"></i> Assumir
                </button>
              ` : ''}
              <button class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition" data-action="navigate" data-page="negotiation-detail" data-negotiation-id="${neg.id}">
                <i class="fas fa-eye mr-1"></i> Ver Detalhes
              </button>
            `}
          </div>
        </div>
      </article>
    `;
  }

  function renderAdminPage() {
    return `
      <section class="space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <button class="px-4 py-2 bg-white border border-gray-200 hover:border-primary-400 rounded-lg text-gray-700 font-medium transition shadow-sm flex items-center gap-2" data-action="navigate" data-page="intermediator">
            <i class="fas fa-arrow-left"></i> Intermediações
          </button>
        </div>
        <header class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 class="text-3xl font-bold text-gray-900">Painel administrativo</h1>
            <p class="text-gray-500">Gerencie usuários e consulte concluídos.</p>
          </div>
          <div class="flex flex-wrap gap-3">
            <button class="w-full sm:w-auto justify-center px-4 py-2 bg-white border border-gray-200 hover:border-primary-400 rounded-lg text-gray-700 font-medium transition shadow-sm flex items-center gap-2" data-action="adminRefresh"><i class="fas fa-sync-alt"></i> Atualizar</button>
          </div>
        </header>
        ${renderAdminTabs()}
        ${renderAdminContent()}
        ${isAdmin() ? `
          <section class="bg-white rounded-2xl p-4 sm:p-6 shadow-card border border-gray-100">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 class="text-lg font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-bell text-primary-500"></i> Pendências</h2>
                <p class="text-sm text-gray-500">Negociações aguardando ação da intermediadora.</p>
              </div>
              <button class="w-full sm:w-auto justify-center px-4 py-2 bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 rounded-lg text-white font-medium flex items-center gap-2 transition" data-action="openPendingModal">
                <i class="fas fa-bell"></i> Abrir pendências (<span data-pending-count-inline>${state.pendingCount}</span>)
              </button>
            </div>
          </section>
        ` : ''}
      </section>
    `;
  }

  function renderAdminTabs() {
    const tabs = isAdmin()
      ? [
          { key: 'users', label: 'Usuários', icon: 'fa-users' },
          { key: 'concluded', label: 'Concluídos', icon: 'fa-check-circle' }
        ]
      : [
          { key: 'users', label: 'Usuários', icon: 'fa-users' }
        ];
    return `
      <nav class="flex flex-col sm:flex-row gap-2 bg-white rounded-xl p-2 shadow-card">
        ${tabs.map((tab) => `
          <button class="flex-1 px-4 py-3 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${state.adminTab === tab.key ? 'bg-gradient-to-r from-primary-600 to-secondary-500 text-white' : 'text-gray-600 hover:text-primary-600 hover:bg-primary-50'}" data-action="adminSelectTab" data-tab="${tab.key}">
            <i class="fas ${tab.icon}"></i> ${tab.label}
          </button>
        `).join('')}
      </nav>
    `;
  }

  function renderAdminContent() {
    const effectiveTab = isAdmin() ? state.adminTab : 'users';
    switch (effectiveTab) {
      case 'users':
        return renderAdminUsers();
      case 'concluded':
        return renderAdminConcluded();
      default:
        return isAdmin() ? renderAdminConcluded() : renderAdminUsers();
    }
  }

  function renderAdminConcluded() {
    const list = Array.isArray(state.adminNegotiations) ? state.adminNegotiations : [];
    if (!list.length) {
      return `
        <div class="text-center py-12">
          <div class="w-16 h-16 bg-gradient-to-r from-gray-300 to-gray-400 rounded-xl flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-inbox text-white text-2xl"></i>
          </div>
          <p class="mb-4 text-gray-500">Ainda não carregamos negociações administrativas.</p>
          <button class="px-6 py-3 bg-white border border-gray-200 hover:border-primary-400 rounded-lg text-gray-700 font-medium transition shadow-sm" data-action="adminRefresh">Recarregar</button>
        </div>
      `;
    }

    const { concluded } = splitAdminNegotiations(list);
    if (!concluded.length) {
      return `
        <div class="text-center py-12">
          <div class="w-16 h-16 bg-gradient-to-r from-success-400 to-success-500 rounded-xl flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-check text-white text-2xl"></i>
          </div>
          <p class="text-gray-500">Nenhuma negociação concluída no momento.</p>
        </div>
      `;
    }

    const pageSize = Math.max(1, Number(state.adminNegotiationsPageSize) || 10);
    const totalPages = Math.max(1, Math.ceil(concluded.length / pageSize));
    const currentPage = Math.min(Math.max(1, Number(state.adminNegotiationsPage) || 1), totalPages);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(concluded.length, startIndex + pageSize);
    const pageItems = concluded.slice(startIndex, endIndex);
    const pageMeta = {
      totalCount: concluded.length,
      page: currentPage,
      pageSize,
      totalPages,
      startIndex,
      endIndex
    };

    return `
      <section class="space-y-4">
        ${renderAdminNegotiationsCardsMobile(pageItems)}
        ${renderAdminNegotiationsPagination(pageMeta)}
      </section>
    `;
  }

  function renderAdminOverview() {
    const overview = state.adminOverview || buildAdminOverview(state.adminNegotiations);
    if (!overview) {
      return `<div class="text-center py-12 text-gray-500"><p>Nenhum dado carregado ainda.</p></div>`;
    }
    const statusCards = Object.entries(overview.byStatus || {}).map(([status, count]) => `
      <div class="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:shadow-md transition">
        <span>${renderStatusBadge(getNegotiationDisplayStatus(neg, state.user?.role))}</span>
        <strong class="text-gray-800 text-xl font-bold">${count}</strong>
      </div>
    `).join('');
    return `
      <section class="space-y-6">
        <article class="bg-white rounded-2xl p-6 shadow-card border border-gray-100">
          <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-chart-bar text-primary-500"></i> Resumo geral</h2>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
            ${renderSummaryCard('Negociações', overview.total, 'fa-box', 'from-primary-500 to-primary-600', 'Total de registros')}
            ${renderSummaryCard('Pendentes', overview.awaiting, 'fa-hourglass-half', 'from-warning-500 to-orange-500', 'Necessitam análise')}
            ${renderSummaryCard('Usuários', state.adminUsers.length, 'fa-users', 'from-secondary-500 to-blue-500', 'Usuários registrados')}
          </div>
        </article>
        <article class="bg-white rounded-2xl p-6 shadow-card border border-gray-100">
          <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-chart-pie text-secondary-500"></i> Distribuição por status</h2>
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            ${statusCards}
          </div>
        </article>
      </section>
    `;
  }

  const ADMIN_CONCLUDED_STATUSES = new Set(['delivered', 'rejected_by_admin', 'cancelled', 'expired']);

  function isAdminConcludedStatus(status) {
    return ADMIN_CONCLUDED_STATUSES.has(status);
  }

  function splitAdminNegotiations(list) {
    const safeList = Array.isArray(list) ? list : [];
    const active = [];
    const concluded = [];
    for (const item of safeList) {
      if (isAdminConcludedStatus(item?.status)) concluded.push(item);
      else active.push(item);
    }
    return { active, concluded };
  }

  function renderAdminNegotiationsPagination(meta) {
    if (!meta || meta.totalPages <= 1) return '';
    return `
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white rounded-xl p-4 shadow-card border border-gray-100">
        <div class="text-sm text-gray-600">
          Mostrando <strong class="text-gray-900">${meta.startIndex + 1}-${meta.endIndex}</strong> de <strong class="text-gray-900">${meta.totalCount}</strong>
          <span class="text-gray-400">•</span>
          Página <strong class="text-gray-900">${meta.page}</strong> de <strong class="text-gray-900">${meta.totalPages}</strong>
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            class="px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 font-medium transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            data-action="adminNegotiationsPrevPage"
            ${meta.page <= 1 ? 'disabled' : ''}
          >
            <i class="fas fa-chevron-left mr-2"></i>Anterior
          </button>
          <button
            type="button"
            class="px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 font-medium transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            data-action="adminNegotiationsNextPage"
            ${meta.page >= meta.totalPages ? 'disabled' : ''}
          >
            Próxima<i class="fas fa-chevron-right ml-2"></i>
          </button>
        </div>
      </div>
    `;
  }

  function renderAdminNegotiations() {
    const list = Array.isArray(state.adminNegotiations) ? state.adminNegotiations : [];
    if (!list.length) {
      return `
        <div class="text-center py-12">
          <div class="w-16 h-16 bg-gradient-to-r from-gray-300 to-gray-400 rounded-xl flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-inbox text-white text-2xl"></i>
          </div>
          <p class="mb-4 text-gray-500">Ainda não carregamos negociações administrativas.</p>
          <button class="px-6 py-3 bg-white border border-gray-200 hover:border-primary-400 rounded-lg text-gray-700 font-medium transition shadow-sm" data-action="adminRefresh">Recarregar</button>
        </div>
      `;
    }

    const { active, concluded } = splitAdminNegotiations(list);
    const view = state.adminNegotiationsView === 'concluded' ? 'concluded' : 'active';
    const viewList = view === 'concluded' ? concluded : active;
    const pageSize = Math.max(1, Number(state.adminNegotiationsPageSize) || 10);
    const totalPages = Math.max(1, Math.ceil(viewList.length / pageSize));
    const currentPage = Math.min(Math.max(1, Number(state.adminNegotiationsPage) || 1), totalPages);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(viewList.length, startIndex + pageSize);
    const pageItems = viewList.slice(startIndex, endIndex);
    const pageMeta = {
      totalCount: viewList.length,
      page: currentPage,
      pageSize,
      totalPages,
      startIndex,
      endIndex
    };

    const viewTabs = `
      <nav class="flex flex-col sm:flex-row gap-2 bg-white rounded-xl p-2 shadow-card border border-gray-100">
        <button
          class="flex-1 px-4 py-3 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${view === 'active' ? 'bg-gradient-to-r from-primary-600 to-secondary-500 text-white' : 'text-gray-600 hover:text-primary-600 hover:bg-primary-50'}"
          data-action="adminSelectNegotiationsView"
          data-view="active"
        >
          <i class="fas fa-list"></i> Em andamento (${active.length})
        </button>
        <button
          class="flex-1 px-4 py-3 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${view === 'concluded' ? 'bg-gradient-to-r from-primary-600 to-secondary-500 text-white' : 'text-gray-600 hover:text-primary-600 hover:bg-primary-50'}"
          data-action="adminSelectNegotiationsView"
          data-view="concluded"
        >
          <i class="fas fa-check-circle"></i> Concluídas (${concluded.length})
        </button>
      </nav>
    `;

    const helperNote = `
      <p class="text-xs text-gray-500 px-1">
        Concluídas não aparecem em <strong>Em andamento</strong> nem em <strong>Pendências</strong>.
      </p>
    `;

    const desktopRows = pageItems.map((neg) => {
      const canApprove = neg.status === 'awaiting_admin_approval';
      const productTitle = neg.product_title || neg.product_name || neg.title || 'Produto';
      const buyerName = neg.buyer?.name || '—';
      const sellerName = neg.seller?.name || '—';
      return `
      <div class="grid grid-cols-7 gap-4 px-6 py-4 border-t border-gray-100 items-center hover:bg-primary-50 transition">
        <span class="text-gray-500 font-medium">#${neg.id}</span>
        <span class="min-w-0">
          <div class="truncate text-gray-800 font-medium">${escapeHtml(productTitle)}</div>
          <div class="text-xs text-gray-400">Negociação ID: #${neg.id}</div>
        </span>
        <span class="min-w-0">
          <div class="truncate text-gray-600">${escapeHtml(buyerName)}</div>
        </span>
        <span class="min-w-0">
          <div class="truncate text-gray-600">${escapeHtml(sellerName)}</div>
        </span>
        <span>${renderStatusBadge(getNegotiationDisplayStatus(neg, state.user?.role))}</span>
        <span class="text-gray-500 text-sm">${formatDateTime(neg.updated_at)}</span>
        <span class="flex flex-wrap gap-1">
          <button class="px-3 py-1 bg-gradient-to-r from-primary-600 to-secondary-500 rounded text-xs text-white font-medium" data-action="adminOpenNegotiation" data-id="${neg.id}">Detalhes</button>
          ${canApprove ? `
            <button class="px-3 py-1 bg-gradient-to-r from-success-500 to-success-600 rounded text-xs text-white font-medium" data-action="adminApproveNegotiation" data-id="${neg.id}">Aprovar</button>
            <button class="px-3 py-1 bg-gradient-to-r from-danger-500 to-danger-600 rounded text-xs text-white font-medium" data-action="adminRejectNegotiation" data-id="${neg.id}">Reprovar</button>
          ` : ''}
          <button class="px-3 py-1 bg-gradient-to-r from-danger-500 to-danger-600 rounded text-xs text-white font-medium" data-action="adminDeleteNegotiation" data-id="${neg.id}">Remover</button>
        </span>
      </div>
    `;
    }).join('');

    return `
      <section class="space-y-4">
        ${viewTabs}
        ${helperNote}
        <div class="sm:hidden">
          ${renderAdminNegotiationsCardsMobile(pageItems)}
        </div>
        <div class="hidden sm:block">
          <section class="bg-white rounded-2xl shadow-card overflow-x-auto border border-gray-100">
            <div class="min-w-[860px]">
              <div class="grid grid-cols-7 gap-4 px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <span>ID</span>
                <span>Produto</span>
                <span>Comprador</span>
                <span>Vendedor</span>
                <span>Status</span>
                <span>Atualizado</span>
                <span></span>
              </div>
              ${desktopRows}
            </div>
          </section>
        </div>
        ${renderAdminNegotiationsPagination(pageMeta)}
      </section>
    `;
  }

  function renderAdminNegotiationsCardsMobile(list) {
    const items = list.map((neg) => {
      const canApprove = neg?.status === 'awaiting_admin_approval';
      const productTitle = neg?.product_title || neg?.product_name || neg?.title || 'Produto';
      const buyerName = neg?.buyer?.name || '—';
      const sellerName = neg?.seller?.name || '—';
      const updated = neg?.updated_at ? formatDateTime(neg.updated_at) : '—';

      return `
        <details class="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
          <summary class="cursor-pointer p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-xs text-gray-500 font-semibold">Negociação #${escapeHtml(String(neg?.id ?? '—'))}</div>
                <h3 class="text-base font-extrabold text-gray-900 mt-0.5 truncate">${escapeHtml(productTitle)}</h3>
                <div class="text-xs text-gray-500 mt-2">Atualizado: ${escapeHtml(updated)}</div>
              </div>
              <div class="flex flex-col items-end gap-2 flex-shrink-0">
                ${renderStatusBadge(getNegotiationDisplayStatus(neg, state.user?.role))}
                <i class="fas fa-chevron-down text-gray-400 admin-card-chevron"></i>
              </div>
            </div>
            <div class="mt-3 text-xs text-gray-500">Toque para ver informações</div>
          </summary>

          <div class="px-4 pb-4 pt-0 border-t border-gray-100 bg-gray-50">
            <div class="pt-4 space-y-3">
              <div class="p-3 rounded-xl bg-white border border-gray-100">
                <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Comprador</div>
                <div class="text-sm font-semibold text-gray-900">${escapeHtml(buyerName)}</div>
              </div>
              <div class="p-3 rounded-xl bg-white border border-gray-100">
                <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Vendedor</div>
                <div class="text-sm font-semibold text-gray-900">${escapeHtml(sellerName)}</div>
              </div>
            </div>

            <div class="mt-4 flex flex-col gap-2">
              <button class="w-full px-4 py-3 bg-gradient-to-r from-primary-600 to-secondary-500 rounded-xl text-sm text-white font-semibold" data-action="adminOpenNegotiation" data-id="${neg?.id}">Ver detalhes</button>
              ${canApprove ? `
                <div class="grid grid-cols-2 gap-2">
                  <button class="px-4 py-3 bg-gradient-to-r from-success-500 to-success-600 rounded-xl text-sm text-white font-semibold" data-action="adminApproveNegotiation" data-id="${neg?.id}">Aprovar</button>
                  <button class="px-4 py-3 bg-gradient-to-r from-danger-500 to-danger-600 rounded-xl text-sm text-white font-semibold" data-action="adminRejectNegotiation" data-id="${neg?.id}">Reprovar</button>
                </div>
              ` : ''}
              <button class="w-full px-4 py-3 bg-gradient-to-r from-danger-500 to-danger-600 rounded-xl text-sm text-white font-semibold" data-action="adminDeleteNegotiation" data-id="${neg?.id}">Remover</button>
            </div>
          </div>
        </details>
      `;
    }).join('');

    return `
      <section class="space-y-4">
        ${items}
      </section>
    `;
  }

  function renderAdminUsers() {
    const users = Array.isArray(state.adminUsers) ? state.adminUsers : [];
    const canManage = isAdmin() || isIntermediatorPrincipal();
    return `
      <section class="bg-white rounded-2xl p-4 sm:p-6 shadow-card border border-gray-100">
        <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-user-plus text-success-500"></i> Gerenciar Usuários</h2>
        ${canManage ? `
          <form class="flex flex-wrap gap-3 mb-6" data-action="adminCreateInvitation">
            <input type="text" name="name" placeholder="Nome completo" required class="w-full sm:flex-1 sm:min-w-[160px] px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
            <input type="email" name="email" placeholder="email@exemplo.com" required class="w-full sm:flex-1 sm:min-w-[180px] px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
            <select name="role" class="w-full sm:w-auto sm:min-w-[140px] px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
              ${isAdmin() ? `
                <option value="buyer">Comprador</option>
                <option value="seller">Vendedor</option>
                <option value="admin">Administrador</option>
                <option value="intermediator">Intermediador</option>
              ` : `
                <option value="intermediator">Intermediador</option>
              `}
            </select>
            <button type="submit" class="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 rounded-lg text-white font-bold transition"><i class="fas fa-plus mr-2"></i>Criar usuário</button>
          </form>
        ` : ''}
        <div class="space-y-2 mt-4">
          ${users.length ? users.map((user) => `
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-4 items-center py-4 px-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100 hover:shadow-md transition">
              <span class="text-gray-800 font-medium">${escapeHtml(user.name || user.email || 'Usuário')} <span class="text-xs text-gray-400 font-semibold">#${escapeHtml(user.id ?? '—')}</span></span>
              <span>
                <div class="text-gray-500 break-all">${escapeHtml(user.email || '—')}</div>
                <div class="text-gray-400 text-xs">${escapeHtml(user.address_city || '—')} / ${escapeHtml(user.address_state || '—')}</div>
              </span>
              <span class="px-2 py-1 bg-primary-100 text-primary-700 rounded-full text-xs font-medium inline-block w-fit">${(() => {
                const role = String(user.role || '').trim();
                if (role === 'intermediator') {
                  const code = user.intermediator_code;
                  const principal = Boolean(user.is_intermediator_principal);
                  return `Intermediador${code ? ` #${escapeHtml(String(code))}` : ''}${principal ? ' (Principal)' : ''}`;
                }
                return ROLE_LABELS[user.role] || user.role || '—';
              })()}</span>
              <span class="text-gray-400 text-sm">${formatDate(user.created_at)}</span>
              <div class="flex gap-2 justify-end">
                <button class="px-3 py-2 bg-gradient-to-r from-primary-600 to-secondary-500 rounded-lg text-sm text-white font-medium transition" data-action="adminOpenUserDetails" data-id="${user.id}"><i class="fas fa-id-card mr-1"></i>Detalhes</button>
                <button class="px-3 py-2 bg-gradient-to-r from-danger-500 to-danger-600 rounded-lg text-sm text-white font-medium transition" data-action="adminDeleteUser" data-id="${user.id}"><i class="fas fa-trash mr-1"></i>Remover</button>
              </div>
            </div>
          `).join('') : '<p class="text-gray-400 text-center py-4">Sem usuários cadastrados.</p>'}
        </div>
      </section>
    `;
  }

  function renderAdminUserDetailsModal() {
    if (!state.showAdminUserDetailsModal || !(isAdmin() || isIntermediatorPrincipal())) return '';
    const user = state.adminUserDetails;
    if (!user) return '';

    const roleLabel = ROLE_LABELS[user.role] || user.role || '—';
    const addressHtml = renderAddressDetails(user, 'Endereço não informado.');

    return `
      <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-card-xl overflow-hidden animate-slide-up">
          <div class="h-1 bg-gradient-to-r from-primary-500 to-secondary-500"></div>
          <header class="flex items-start justify-between p-4 sm:p-6 border-b border-gray-100">
            <div>
              <h2 class="text-xl font-bold text-gray-900 flex items-center gap-2"><i class="fas fa-id-card text-primary-500"></i> Cadastro do usuário</h2>
              <p class="text-gray-500 text-sm">Usuário #${escapeHtml(String(user.id ?? '—'))}</p>
            </div>
            <button class="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition" data-action="closeAdminUserDetails">✕</button>
          </header>
          <section class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            <div class="p-4 rounded-xl border border-gray-100 bg-gray-50">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div class="text-xs text-gray-500">Nome</div>
                  <div class="text-sm text-gray-800 font-semibold">${escapeHtml(user.name || '—')}</div>
                </div>
                <div>
                  <div class="text-xs text-gray-500">Papel</div>
                  <div class="text-sm text-gray-800 font-semibold">${escapeHtml(roleLabel)}</div>
                </div>
                <div class="sm:col-span-2">
                  <div class="text-xs text-gray-500">E-mail</div>
                  <div class="text-sm text-gray-700 break-all">${escapeHtml(user.email || '—')}</div>
                </div>
                <div>
                  <div class="text-xs text-gray-500">Telefone</div>
                  <div class="text-sm text-gray-700">${escapeHtml(formatPhone(user.phone))}</div>
                </div>
                <div>
                  <div class="text-xs text-gray-500">E-mail verificado</div>
                  <div class="text-sm text-gray-700">${user.email_verified_at ? escapeHtml(formatDateTime(user.email_verified_at)) : '—'}</div>
                </div>
                <div>
                  <div class="text-xs text-gray-500">Criado em</div>
                  <div class="text-sm text-gray-700">${escapeHtml(formatDateTime(user.created_at))}</div>
                </div>
                <div>
                  <div class="text-xs text-gray-500">Último login</div>
                  <div class="text-sm text-gray-700">${user.last_login_at ? escapeHtml(formatDateTime(user.last_login_at)) : '—'}</div>
                </div>
              </div>
              ${addressHtml}
            </div>
          </section>
        </div>
      </div>
    `;
  }

  function renderPendingModal() {
    const notices = Array.isArray(state.pendingNotices) ? state.pendingNotices : [];
    const options = buildMonthOptions();
    const cards = notices.length
      ? notices.map((neg) => renderPendingNoticeCard(neg)).join('')
      : '<p class="text-slate-400 text-center py-8">Nenhuma negociação pendente.</p>';

    return `
      <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-card-xl overflow-hidden animate-slide-up">
          <div class="h-1 bg-gradient-to-r from-primary-500 to-secondary-500"></div>
          <header class="flex items-start justify-between p-4 sm:p-6 border-b border-gray-100">
            <div>
              <h2 class="text-xl font-bold text-gray-900 flex items-center gap-2"><i class="fas fa-bell text-primary-500"></i> Pendências</h2>
              <p class="text-gray-500 text-sm">Negociações aguardando ação da intermediadora. (Concluídas não aparecem aqui.)</p>
            </div>
            <button class="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition" data-action="closePendingModal">✕</button>
          </header>
          <section class="flex-1 overflow-y-auto p-4 sm:p-6">
            <label class="flex flex-col sm:flex-row sm:items-center items-start gap-3 mb-4">
              <span class="text-gray-700 text-sm font-medium">Filtrar por mês</span>
              <select data-action="selectPendingFilter" class="w-full sm:w-auto px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                ${options.map((opt) => `<option value="${opt.value}" ${opt.value === state.pendingFilter ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`).join('')}
              </select>
            </label>
            <div class="space-y-4">
              ${cards}
            </div>
          </section>
        </div>
      </div>
    `;
  }

  function renderPendingNoticeCard(neg) {
    const buyer = neg?.buyer?.name || '—';
    const seller = neg?.seller?.name || '—';
    const product = neg?.product_title || neg?.product_name || neg?.title || 'Produto';
    return `
      <article class="bg-gradient-to-r from-primary-50 to-secondary-50 rounded-xl p-4 border border-primary-200 hover:shadow-card transition-all duration-200">
        <header class="flex items-center justify-between mb-3">
          <span class="px-2 py-0.5 bg-gradient-to-r from-primary-600 to-secondary-500 text-white text-xs rounded-full font-medium">#${neg.id}</span>
          <span class="text-gray-500 text-sm">${formatRelativeTime(neg.created_at)}</span>
        </header>
        <div class="space-y-2 mb-4">
          <strong class="block text-gray-800">${escapeHtml(product)} <span class="text-xs text-gray-400 font-semibold">(#${neg.id})</span></strong>
          <div class="flex flex-wrap gap-4 text-sm text-gray-500">
            <span><i class="fas fa-shopping-cart mr-1"></i> ${escapeHtml(buyer)}</span>
            <span><i class="fas fa-store mr-1"></i> ${escapeHtml(seller)}</span>
          </div>
          <div>Status: ${renderStatusBadge(getNegotiationDisplayStatus(neg, state.user?.role))}</div>
        </div>
        <footer class="flex flex-wrap gap-2">
          <button class="px-3 py-2 bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 rounded-lg text-sm text-white font-medium transition-all" data-action="adminOpenNegotiation" data-id="${neg.id}"><i class="fas fa-eye mr-1"></i>Ver detalhes</button>
          <button class="px-3 py-2 bg-gradient-to-r from-success-500 to-success-600 hover:from-success-600 hover:to-success-700 rounded-lg text-sm text-white font-medium transition-all" data-action="adminApproveNegotiation" data-id="${neg.id}"><i class="fas fa-check mr-1"></i>Aprovar</button>
          <button class="px-3 py-2 bg-gradient-to-r from-danger-500 to-danger-600 hover:from-danger-600 hover:to-danger-700 rounded-lg text-sm text-white font-medium transition-all" data-action="adminRejectNegotiation" data-id="${neg.id}"><i class="fas fa-times mr-1"></i>Reprovar</button>
          <button class="px-3 py-2 bg-gradient-to-r from-danger-500 to-danger-600 hover:from-danger-600 hover:to-danger-700 rounded-lg text-sm text-white font-medium transition-all" data-action="adminDeleteNegotiation" data-id="${neg.id}"><i class="fas fa-trash mr-1"></i>Remover</button>
        </footer>
      </article>
    `;
  }

  function renderTimelineModal() {
    const timeline = Array.isArray(state.timelineData) ? state.timelineData : [];
    return `
      <div class="fixed inset-0 z-50 p-4 flex items-center justify-center">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" data-action="closeTimeline"></div>
        <div class="relative bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-card-xl overflow-hidden animate-slide-up" data-action="noop">
          <div class="h-1 bg-gradient-to-r from-secondary-500 to-primary-500"></div>
          <header class="flex items-start justify-between p-4 sm:p-6 border-b border-gray-100">
            <div>
              <h2 class="text-xl font-bold text-gray-900 flex items-center gap-2"><i class="fas fa-stream text-secondary-500"></i> Linha do tempo</h2>
              <p class="text-gray-500 text-sm mt-1">Acompanhamento dos eventos da negociação.</p>
            </div>
            <button class="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors" data-action="closeTimeline">✕</button>
          </header>
          <section class="p-4 sm:p-6 overflow-y-auto flex-1 space-y-2">
            ${timeline.length ? timeline.map((item, index) => renderTimelineItem(item, index, timeline.length)).join('') : '<p class="text-gray-400 text-center py-8">Sem eventos registrados.</p>'}
          </section>
        </div>
      </div>
    `;
  }

  function renderTimelineItem(item, index, total) {
    const done = Boolean(item && item.date);
    const isLast = index === total - 1;
    const dotClass = done ? 'bg-success-500 ring-success-100' : 'bg-gray-300 ring-gray-100';
    const lineClass = done ? 'bg-success-200' : 'bg-gray-200';

    return `
      <div class="relative pl-10">
        <div class="absolute left-1 top-1">
          <div class="w-4 h-4 rounded-full ${dotClass} ring-4"></div>
        </div>
        ${!isLast ? `<div class="absolute left-[9px] top-6 bottom-0 w-px ${lineClass}"></div>` : ''}

        <div class="bg-gray-50 border border-gray-100 rounded-xl p-4">
          <div class="flex items-start justify-between gap-3">
            <strong class="text-gray-900">${escapeHtml(item.label)}</strong>
            <span class="shrink-0 text-[11px] px-2 py-1 rounded-full border ${done ? 'bg-success-50 text-success-700 border-success-200' : 'bg-white text-gray-500 border-gray-200'}">
              ${done ? escapeHtml(formatDateTime(item.date)) : 'Pendente'}
            </span>
          </div>
          ${item.description ? `<p class="text-gray-600 text-sm mt-2">${escapeHtml(item.description)}</p>` : ''}
        </div>
      </div>
    `;
  }

  function renderSellerGuideModal() {
    const id = Number(state.sellerGuideNegotiationId);
    const neg = state.currentNegotiation;
    if (!id || !neg || Number(neg.id) !== id) return '';
    if (!isSeller(neg)) return '';
    if (neg.status !== 'waiting_shipment') return '';
    if (!(neg.paid_at || neg.product_paid_at)) return '';

    const address = INTERMEDIARY_ADDRESS;
    const addressLine = [address.street, address.number].filter(Boolean).join(', ');
    const cityLine = [address.city, address.state].filter(Boolean).join(' - ');

    return `
      <div class="fixed inset-0 z-50 p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" data-action="closeSellerGuide"></div>
        <div class="relative w-full max-w-2xl max-h-[90vh] mx-auto bg-white rounded-2xl shadow-card-xl overflow-hidden animate-slide-up" data-action="noop">
          <div class="h-1 bg-gradient-to-r from-warning-500 to-orange-500"></div>
          <header class="flex items-start justify-between p-4 sm:p-6 border-b border-gray-100">
            <div>
              <h2 class="text-xl font-bold text-gray-900 flex items-center gap-2"><i class="fas fa-list-check text-warning-600"></i> Instruções do vendedor</h2>
              <p class="text-gray-500 text-sm mt-1">Pagamento confirmado em ${escapeHtml(formatDateTime(neg.paid_at || neg.product_paid_at))}. Conclua a entrega digital no prazo.</p>
            </div>
            <button class="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors" data-action="closeSellerGuide">✕</button>
          </header>

          <section class="p-4 sm:p-6 overflow-y-auto max-h-[70vh] space-y-4">
            <div class="p-4 bg-warning-50 border border-warning-200 rounded-xl text-warning-900 text-sm">
              <div class="font-semibold mb-2">O que fazer agora</div>
              <ol class="list-decimal ml-5 space-y-2">
                <li><strong>Prazo digital:</strong> conclua a entrega em até <strong>${DIGITAL_DELIVERY_DEADLINE_BUSINESS_DAYS} dias úteis</strong> após a aprovação do pagamento.</li>
                <li>Siga o fluxo dentro do sistema até a confirmação de entrega.</li>
              </ol>
            </div>

            <div class="p-4 bg-danger-50 border border-danger-200 rounded-xl text-danger-800 text-sm">
              <div class="font-semibold mb-2">Se não entregar no prazo</div>
              <ul class="list-disc ml-5 space-y-1">
                <li>Perda da taxa de intermediação.</li>
                <li>Devolução integral ao comprador (valor + taxa).</li>
                <li>Cancelamento da negociação.</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    `;
  }

  function renderGalleryModal() {
    const gallery = state.gallery;
    if (!gallery) return '';
    const photos = Array.isArray(gallery.photos) ? gallery.photos : [];
    const current = photos[gallery.index] || null;
    return `
      <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-2xl shadow-card-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-slide-up">
          <div class="h-1 bg-gradient-to-r from-primary-600 to-secondary-500"></div>
          <header class="flex items-start justify-between p-4 border-b border-gray-100">
            <div>
              <h2 class="text-xl font-bold text-gray-900">Imagens</h2>
              <p class="text-gray-500 text-sm">${gallery.index + 1} de ${photos.length}</p>
            </div>
            <button class="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors" data-action="closeGallery">✕</button>
          </header>
          <div class="flex-1 flex items-center justify-center p-4 min-h-[300px] bg-gray-50">
            ${current ? `<img src="${escapeAttr(resolvePhotoUrl(current))}" alt="Foto da inspeção" class="max-w-full max-h-[60vh] object-contain rounded-lg shadow-lg">` : '<p class="text-gray-500">Foto indisponível.</p>'}
          </div>
          <footer class="flex items-center justify-center gap-3 p-4 border-t border-gray-100 bg-white">
            <button class="w-12 h-12 rounded-xl bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 flex items-center justify-center transition-colors" data-action="galleryPrev" ${gallery.index === 0 ? 'disabled' : ''} aria-label="Imagem anterior">
              <i class="fas fa-chevron-left"></i>
            </button>
            <button class="w-12 h-12 rounded-xl bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 flex items-center justify-center transition-colors" data-action="galleryNext" ${gallery.index >= photos.length - 1 ? 'disabled' : ''} aria-label="Próxima imagem">
              <i class="fas fa-chevron-right"></i>
            </button>
            ${current ? `<a class="px-4 py-2 bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 text-white rounded-lg transition-colors" href="${escapeAttr(resolvePhotoUrl(current))}" target="_blank" rel="noopener">Abrir em nova guia</a>` : ''}
          </footer>
        </div>
      </div>
    `;
  }

  function renderIntermediaryReportModal() {
    if (!state.showIntermediaryReportModal) return '';
    const neg = state.currentNegotiation;
    if (!neg) return '';

    const report = neg.inspection_report || {};
    const checklist = report.checklist || neg.intermediary_checklist || {};
    const notes = (report.notes ?? neg.intermediary_notes ?? '').toString().trim();
    const savedAt = report.saved_at || neg.inspection_saved_at || null;

    const galleryPhotos = Array.isArray(neg.intermediary_photos) ? neg.intermediary_photos : (Array.isArray(report.photos) ? report.photos : []);

    const hasChecklist = checklist && (Array.isArray(checklist) ? checklist.length : Object.keys(checklist).length);
    const hasNotes = Boolean(notes);
    const hasPhotos = Array.isArray(galleryPhotos) && galleryPhotos.length;

    const isChecked = (id) => {
      if (!checklist) return false;
      if (Array.isArray(checklist)) return checklist.includes(id);
      return Boolean(checklist[id]);
    };

    return `
      <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div class="absolute inset-0" data-action="closeIntermediaryReport"></div>
        <div class="relative bg-white rounded-2xl shadow-card-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-slide-up">
          <div class="h-1 bg-gradient-to-r from-secondary-500 to-primary-500"></div>
          <header class="flex items-start justify-between p-4 sm:p-6 border-b border-gray-100">
            <div>
              <h2 class="text-xl font-bold text-gray-900 flex items-center gap-2"><i class="fas fa-clipboard-check text-secondary-500"></i> Relatório do intermediador</h2>
              <p class="text-gray-500 text-sm mt-1">${savedAt ? `Enviado em ${formatDateTime(savedAt)}` : 'Confira os dados da avaliação.'}</p>
            </div>
            <button class="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors" data-action="closeIntermediaryReport">✕</button>
          </header>

          <section class="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
            ${hasChecklist ? `
              <div>
                <h3 class="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">Checklist</h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  ${INSPECTION_CHECKLIST.map((item) => `
                    <div class="flex items-center gap-2 text-sm ${isChecked(item.id) ? 'text-success-600' : 'text-danger-600'}">
                      <i class="fas ${isChecked(item.id) ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                      <span class="text-gray-700">${escapeHtml(item.label)}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            ${hasNotes ? `
              <div>
                <h3 class="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">Observações</h3>
                <div class="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <p class="text-gray-700 text-sm whitespace-pre-line">${escapeHtml(notes)}</p>
                </div>
              </div>
            ` : ''}

            ${hasPhotos ? `
              <div>
                <h3 class="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">Fotos da inspeção</h3>
                <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  ${galleryPhotos.map((url, index) => `
                    <button class="aspect-square rounded-xl overflow-hidden bg-gray-100 hover:ring-2 hover:ring-primary-500 transition shadow-md" data-action="openGallery" data-id="${neg.id}" data-index="${index}">
                      <img src="${escapeAttr(resolvePhotoUrl(url))}" alt="Foto ${index + 1}" class="w-full h-full object-cover">
                    </button>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            ${(!hasChecklist && !hasNotes && !hasPhotos) ? `
              <div class="text-center py-10 text-gray-500">
                <div class="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <i class="fas fa-file-alt text-gray-400 text-xl"></i>
                </div>
                <p>Nenhum relatório foi enviado ainda.</p>
              </div>
            ` : ''}
          </section>
        </div>
      </div>
    `;
  }

  function renderFooter() {
    return `
      <footer class="bg-gray-900 text-white py-4">
        <div class="container mx-auto px-4">
          <!-- Grid de 3 colunas -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
            <!-- Coluna 1: Logo e descrição -->
            <div class="space-y-3">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                  <i class="fas fa-handshake text-white text-lg"></i>
                </div>
                <span class="text-lg font-bold">Intermediação<span class="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-secondary-400">Pro</span></span>
              </div>
              <p class="text-gray-400 text-xs leading-relaxed">Conectando pessoas e oportunidades com segurança e eficiência.</p>
              <div class="flex gap-2 pt-1">
                <a href="#" class="w-8 h-8 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-lg"><i class="fab fa-facebook-f text-xs"></i></a>
                <a href="#" class="w-8 h-8 bg-gradient-to-br from-secondary-400 to-primary-400 rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-lg"><i class="fab fa-twitter text-xs"></i></a>
                <a href="#" class="w-8 h-8 bg-gradient-to-br from-danger-400 to-warning-400 rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-lg"><i class="fab fa-instagram text-xs"></i></a>
              </div>
            </div>

            <!-- Coluna 2: Links -->
            <div class="grid grid-cols-2 gap-6">
              <div>
                <h4 class="text-sm font-bold text-white uppercase tracking-wider mb-3">Navegação</h4>
                <ul class="space-y-1.5">
                  <li><a href="#" class="text-gray-400 hover:text-secondary-400 transition text-xs">Início</a></li>
                  <li><a href="#" class="text-gray-400 hover:text-secondary-400 transition text-xs">Serviços</a></li>
                  <li><a href="#" class="text-gray-400 hover:text-secondary-400 transition text-xs">Como Funciona</a></li>
                </ul>
              </div>
              <div>
                <h4 class="text-sm font-bold text-white uppercase tracking-wider mb-3">Legal</h4>
                <ul class="space-y-1.5">
                  <li><a href="#" class="text-gray-400 hover:text-secondary-400 transition text-xs">Termos de Uso</a></li>
                  <li><a href="#" class="text-gray-400 hover:text-secondary-400 transition text-xs">Privacidade</a></li>
                  <li><a href="#" class="text-gray-400 hover:text-secondary-400 transition text-xs">FAQ</a></li>
                </ul>
              </div>
            </div>

            <!-- Coluna 3: Contato -->
            <div>
              <h4 class="text-sm font-bold text-white uppercase tracking-wider mb-3">Contato</h4>
              <ul class="space-y-3">
                <li class="flex items-center gap-3 text-gray-400 text-xs">
                  <div class="w-8 h-8 rounded-lg bg-gray-700/50 flex items-center justify-center flex-shrink-0">
                    <i class="fas fa-envelope text-primary-400 text-xs"></i>
                  </div>
                  <span>contato@intermediacaopro.com</span>
                </li>
                <li class="flex items-center gap-3 text-gray-400 text-xs">
                  <div class="w-8 h-8 rounded-lg bg-gray-700/50 flex items-center justify-center flex-shrink-0">
                    <i class="fas fa-phone text-primary-400 text-xs"></i>
                  </div>
                  <span>(11) 99999-9999</span>
                </li>
                <li class="flex items-center gap-3 text-gray-400 text-xs">
                  <div class="w-8 h-8 rounded-lg bg-gray-700/50 flex items-center justify-center flex-shrink-0">
                    <i class="fas fa-map-marker-alt text-primary-400 text-xs"></i>
                  </div>
                  <span>São Paulo, SP</span>
                </li>
              </ul>
            </div>
          </div>

          <!-- Linha divisória e copyright -->
          <div class="border-t border-gray-700/50 mt-5 pt-4 flex flex-col md:flex-row items-center justify-between gap-3">
            <p class="text-gray-500 text-xs">© ${new Date().getFullYear()} IntermediaçãoPro. Todos os direitos reservados.</p>
            <p class="text-gray-600 text-xs">Feito com <i class="fas fa-heart text-danger-400"></i> no Brasil</p>
          </div>
        </div>
      </footer>
    `;
  }

  function renderModals() {
    const parts = [];
    if (state.showPendingModal && isAdmin()) {
      parts.push(renderPendingModal());
    }
    if (state.showAdminUserDetailsModal && isAdmin()) {
      parts.push(renderAdminUserDetailsModal());
    }
    if (state.currentPage === 'dashboard' && state.showDashboardFiltersModal) {
      parts.push(renderDashboardFiltersModal());
    }
    if (state.timelineNegotiationId) {
      parts.push(renderTimelineModal());
    }
    if (state.sellerGuideNegotiationId) {
      parts.push(renderSellerGuideModal());
    }
    if (state.showIntermediaryReportModal) {
      parts.push(renderIntermediaryReportModal());
    }
    if (state.gallery) {
      parts.push(renderGalleryModal());
    }
    return parts.join('');
  }

  function renderDashboardFiltersModal() {
    const draft = state.dashboardFiltersDraft || state.negotiationFilters || {};
    const status = draft.status || 'all';
    const role = draft.role || 'all';
    const query = draft.query || '';

    const counts = getDashboardStatusCounts({ role, query });

    const statusOptions = [
      { key: 'all', label: 'Todos' },
      { key: 'pending_acceptance', label: 'Convites pendentes' },
      { key: 'awaiting_admin_approval', label: 'Aguardando revisão' },
      { key: 'waiting_payment', label: 'Pagamento pendente' },
      { key: 'waiting_shipment', label: 'Aguardando envio' },
      { key: 'shipped', label: 'Em trânsito' },
      { key: 'at_intermediary', label: 'Na intermediadora' },
      { key: 'approved', label: 'Inspeção aprovada' },
      { key: 'delivered', label: 'Entregues' },
      { key: 'cancelled', label: 'Canceladas' }
    ];

    return `
      <div class="fixed inset-0 z-50 sm:hidden">
        <div class="absolute inset-0 bg-black/60" data-action="closeDashboardFiltersModal"></div>
        <div class="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-card-xl p-4" data-action="noop">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-extrabold text-gray-900">Filtrar negociações</h3>
            <button type="button" class="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700" data-action="closeDashboardFiltersModal">✕</button>
          </div>

          <div class="mt-4 space-y-4">
            <div>
              <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Status</label>
              <div class="flex flex-col gap-2">
                ${statusOptions.map((opt) => {
                  const isActive = opt.key === status;
                  const count = opt.key === 'all' ? (Number(counts.total) || 0) : (Number(counts.byStatus?.[opt.key]) || 0);
                  const showCount = opt.key === 'all' || count > 0;
                  return `
                    <button
                      type="button"
                      class="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm transition ${isActive
                        ? 'bg-gradient-to-r from-primary-600 to-secondary-500 text-white font-semibold shadow-md'
                        : 'bg-gray-50 border border-gray-200 text-gray-800 hover:border-primary-400'}"
                      data-action="selectDashboardDraftStatus"
                      data-status="${escapeAttr(opt.key)}"
                    >
                      <span class="flex items-center gap-3 min-w-0">
                        <span class="truncate">${escapeHtml(opt.label)}</span>
                      </span>
                      ${showCount ? `<span class="inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-full text-xs font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'}">${count}</span>` : ''}
                    </button>
                  `;
                }).join('')}
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Papel</label>
              <select class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800" data-action="updateDashboardFiltersDraft" data-field="role">
                <option value="all" ${role === 'all' ? 'selected' : ''}>Todos</option>
                <option value="buyer" ${role === 'buyer' ? 'selected' : ''}>Como comprador</option>
                <option value="seller" ${role === 'seller' ? 'selected' : ''}>Como vendedor</option>
              </select>
              <p class="text-xs text-gray-500 mt-1">Mostra apenas negociações em que você é comprador/vendedor.</p>
            </div>

            <div>
              <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Buscar</label>
              <div class="relative">
                <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                <input
                  type="search"
                  name="dashboard_filters_query"
                  class="w-full pl-9 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400"
                  placeholder="Título, participante ou #id"
                  value="${escapeAttr(query)}"
                  data-action="updateDashboardFiltersDraft"
                  data-field="query"
                  data-focus-key="dashboard-filters-search"
                >
              </div>
            </div>
          </div>

          <div class="mt-5 flex gap-3">
            <button type="button" class="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 font-semibold" data-action="clearDashboardFiltersModal">
              Limpar
            </button>
            <button type="button" class="flex-1 px-4 py-3 bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 rounded-xl text-white font-semibold" data-action="applyDashboardFiltersModal">
              Aplicar
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderToast() {
    const toast = state.toast;
    if (!toast || !toast.message) return '';
    const typeColors = {
      success: 'bg-success-600 text-white',
      error: 'bg-danger-600 text-white',
      warning: 'bg-warning-500 text-gray-900',
      info: 'bg-secondary-600 text-white'
    };
    const colorClass = typeColors[toast.type] || typeColors.info;
    return `<div class="fixed bottom-6 right-6 px-6 py-3 rounded-xl shadow-card-lg ${colorClass} z-50 animate-slide-up">${escapeHtml(toast.message)}</div>`;
  }

  //#region Global Event Delegation (submit/click/input)

  function attachGlobalHandlers() {
    if (window.__intermediacaoGlobalHandlersAttached) {
      return;
    }
    window.__intermediacaoGlobalHandlersAttached = true;

    document.addEventListener('submit', handleSubmit, true);
    document.addEventListener('click', handleClick);
    document.addEventListener('input', handleInput);
    document.addEventListener('change', handleInput);
    document.addEventListener('keydown', handleKeydown, true);
  }

  function handleKeydown(event) {
    if (!event) return;
    if (event.isComposing) return;
    if (event.key !== 'Enter') return;

    const target = event.target;
    if (!(target instanceof Element)) return;

    // Se estiver dentro de um form, o fluxo nativo já vira submit (e a SPA intercepta)
    if (target.closest('form')) return;

    // Busca do dashboard (sidebar desktop)
    if (target.matches('[data-action="dashboardSearch"]')) {
      event.preventDefault();
      event.stopPropagation();
      const value = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ? target.value : '';
      Promise.resolve(actions.dashboardSearch({ element: target, value, dataset: { ...target.dataset }, event }))
        .catch((error) => handleError(error));
      return;
    }

    // Modal de filtros (mobile): Enter aplica
    if (target.matches('[data-action="updateDashboardFiltersDraft"][data-field="query"]')) {
      event.preventDefault();
      event.stopPropagation();
      Promise.resolve(actions.applyDashboardFiltersModal({ element: target, dataset: {}, event }))
        .catch((error) => handleError(error));
    }
  }

  function handleSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    // SPA: nunca permitir submit nativo (evita "recarregar" a pagina, inclusive ao apertar Enter)
    event.preventDefault();
    event.stopPropagation();

    const actionName = form.dataset.action;
    if (!actionName) {
      return;
    }
    const handler = actions[actionName];
    if (typeof handler !== 'function') return;
    const payload = extractFormPayload(form);
    const dataset = { ...form.dataset };
    Promise.resolve(handler({ form, dataset, ...payload })).catch((error) => handleError(error));
  }

  function extractFormPayload(form) {
    const formData = new FormData(form);
    const values = {};
    for (const [key, value] of formData.entries()) {
      if (values[key] !== undefined) {
        if (!Array.isArray(values[key])) {
          values[key] = [values[key]];
        }
        values[key].push(value);
      } else {
        values[key] = value;
      }
    }
    return { formData, values };
  }

  function handleClick(event) {
    let target = event.target;
    if (!(target instanceof Element)) {
      // Some environments can report a Text node as the target (e.g., clicking on button label text).
      target = target && target.parentElement ? target.parentElement : null;
    }
    if (!(target instanceof Element)) return;
    const actionEl = target.closest('[data-action]');
    if (!actionEl) return;
    if (actionEl instanceof HTMLFormElement) {
      return;
    }
    // Inputs/selects devem disparar via input/change, não via click.
    // Caso contrário, clicar para abrir o dropdown (select) dispara re-render e fecha o menu.
    if (actionEl instanceof HTMLSelectElement) {
      return;
    }
    const actionName = actionEl.dataset.action;
    if (!actionName) return;
    const handler = actions[actionName];
    if (typeof handler !== 'function') return;

    if (actionEl.tagName === 'A' || actionEl.matches('button')) {
      event.preventDefault();
    }

    const dataset = { ...actionEl.dataset };
    Promise.resolve(handler({ element: actionEl, dataset, event })).catch((error) => handleError(error));
  }

  function handleInput(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;

    // Input masks / normalization (always run, even without data-action)
    if (target instanceof HTMLInputElement) {
      const name = String(target.name || '');
      if (name === 'buyer_contact_phone' || name === 'seller_contact_phone') {
        const next = formatPhoneDd9(target.value);
        if (target.value !== next) target.value = next;
      }
      if (name === 'game_account_game_other' || name === 'game_account_level' || name === 'game_account_rank') {
        const next = capitalizeFirstPtBrLive(target.value);
        if (target.value !== next) {
          const start = typeof target.selectionStart === 'number' ? target.selectionStart : null;
          const end = typeof target.selectionEnd === 'number' ? target.selectionEnd : null;
          target.value = next;
          if (start != null && end != null) {
            try { target.setSelectionRange(start, end); } catch { /* ignore */ }
          }
        }
      }

      if (name === 'universal_game_name' || name === 'universal_product_name') {
        const next = capitalizeFirstPtBrLive(target.value);
        if (target.value !== next) {
          const start = typeof target.selectionStart === 'number' ? target.selectionStart : null;
          const end = typeof target.selectionEnd === 'number' ? target.selectionEnd : null;
          target.value = next;
          if (start != null && end != null) {
            try { target.setSelectionRange(start, end); } catch { /* ignore */ }
          }
        }
      }

      // Exclusive items: capitalize first letter for typed fields
      if (String(target.dataset.action || '') === 'updateExclusiveItemField') {
        const field = String(target.dataset.field || '').trim();
        if (field === 'name' || field === 'description') {
          const next = capitalizeFirstPtBrLive(target.value);
          if (target.value !== next) {
            const start = typeof target.selectionStart === 'number' ? target.selectionStart : null;
            const end = typeof target.selectionEnd === 'number' ? target.selectionEnd : null;
            target.value = next;
            if (start != null && end != null) {
              try { target.setSelectionRange(start, end); } catch { /* ignore */ }
            }
          }
        }
      }
    }

    const actionName = target.dataset.action;
    if (!actionName) return;
    const handler = actions[actionName];
    if (typeof handler !== 'function') return;
    const dataset = { ...target.dataset };
    handler({ element: target, value: target.value, dataset, event });
  }

  //#endregion Global Event Delegation (submit/click/input)

  //#endregion PART 2/3: Render, UI e Handlers

  