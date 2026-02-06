'use strict';

//#region PART 3/3: Actions e Integração API

  async function withLoader(task, message = null) {
    setState({ isLoading: true, loadingMessage: message, errorMessage: null });
    try {
      return await task();
    } finally {
      setState({ isLoading: false, loadingMessage: null });
    }
  }

  function notify({ type = 'info', message }) {
    if (!message) return;
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    const payload = { toast: { type, message } };
    if (type === 'success') {
      payload.successMessage = message;
      payload.errorMessage = null;
    } else if (type === 'error') {
      payload.errorMessage = message;
      payload.successMessage = null;
    }
    setState(payload);
    const timeout = type === 'error' ? 3500 : 4000;
    toastTimer = setTimeout(() => {
      setState({ toast: null, successMessage: null, errorMessage: null });
      toastTimer = null;
    }, timeout);
  }

  function handleError(error, fallbackMessage = 'Ocorreu um erro. Tente novamente.') {
    console.error(error);
    const message = extractErrorMessage(error, fallbackMessage);
    notify({ type: 'error', message });
    return message;
  }

  function extractErrorMessage(error, fallback) {
    if (!error) return fallback;
    if (typeof error === 'string') return error;
    if (error.message) return error.message;
    if (error.data && error.data.message) return error.data.message;
    if (error.response && error.response.message) return error.response.message;
    return fallback;
  }

  function isPasswordStrong(value) {
    const password = String(value || '');
    if (password.length < 8) return false;
    if (!/[A-Z]/.test(password)) return false;
    if (!/[0-9]/.test(password)) return false;
    return true;
  }

  async function apiCall(path, { method = 'GET', body = null, headers = {}, raw = false } = {}) {
    const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
    const config = {
      method,
      headers: {
        Accept: 'application/json',
        ...headers
      },
      credentials: 'include'
    };

    if (state.token) {
      config.headers.Authorization = `Bearer ${state.token}`;
    }

    if (body instanceof FormData) {
      config.body = body;
    } else if (body !== null && body !== undefined) {
      config.headers['Content-Type'] = 'application/json';
      config.body = JSON.stringify(body);
    }

    const response = await fetch(url, config);
    if (response.status === 401) {
      logout(true);
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    if (raw) return response;

    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (error) {
        console.warn('Resposta não JSON recebida de', url);
        data = text;
      }
    }

    if (!response.ok) {
      const message = data?.message || data?.error || `Erro ${response.status}`;
      const err = new Error(message);
      err.status = response.status;
      err.data = data;
      throw err;
    }

    return data;
  }

  async function ensureServiceFormsConfigLoaded({ force = false } = {}) {
    if (state.serviceFormsLoading) return;
    if (!force && state.serviceFormsConfig) return;
    if (!state.token) return;

    try {
      state.serviceFormsLoading = true;
      const resp = await apiCall('/service-forms/config', { method: 'GET' });
      const cfg = resp?.data || resp;
      state.serviceFormsConfig = cfg && typeof cfg === 'object' ? cfg : null;
    } catch (e) {
      console.warn('Falha ao carregar service-forms config:', e);
      state.serviceFormsConfig = null;
    } finally {
      state.serviceFormsLoading = false;
      // If create modal is open, refresh dynamic UI.
      if (state.showCreateNegotiationModal) {
        try { updateCreateNegotiationModalDynamicUI(); } catch { /* ignore */ }
      }
    }
  }

  async function loadNegotiations({ force = false, silent = false } = {}) {
    if (!state.token) return;
    if (!force && Date.now() - state.negotiationsLoadedAt < 15000) return;

    const task = async () => {
      const data = await apiCall('/intermediation');
      const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      setState({
        negotiations: list,
        negotiationsLoadedAt: Date.now()
      });
      if (state.currentNegotiation) {
        const updated = list.find((item) => item.id === state.currentNegotiation.id);
        if (updated) {
          setState({ currentNegotiation: updated });
        }
      }
    };

    if (silent || state.isLoading) {
      return task();
    }

    await withLoader(task, state.negotiations.length ? null : 'Carregando negociações...');
  }

  async function loadNegotiation(id, { silent = false } = {}) {
    if (!id) return;

    const task = async () => {
      const data = await apiCall(`/intermediation/${id}`);
      const negotiation = data?.data || data;
      setState({
        currentNegotiation: negotiation,
        currentPage: 'negotiation-detail'
      });
    };

    if (silent || state.isLoading) {
      return task();
    }

    await withLoader(task, 'Carregando negociação...');
  }

  async function loadAdminSnapshot({ force = false } = {}) {
    if (!canManageUsers() || state.adminIsLoading) return;
    setState({ adminIsLoading: true });
    try {
      const shouldLoadNegotiations = isAdmin();
      const [negotiations, users] = await Promise.all([
        shouldLoadNegotiations ? apiCall('/intermediation/admin/all').catch(() => []) : Promise.resolve({ data: [] }),
        apiCall('/admin/users').catch(() => [])
      ]);
      const negotiationsList = shouldLoadNegotiations
        ? (Array.isArray(negotiations?.data) ? negotiations.data : negotiations || [])
        : [];
      setState({
        adminNegotiations: negotiationsList,
        adminUsers: Array.isArray(users?.data) ? users.data : users || [],
        adminOverview: shouldLoadNegotiations ? buildAdminOverview(negotiationsList) : null,
        adminNegotiationsPage: 1
      });
    } catch (error) {
      handleError(error, 'Não foi possível carregar dados administrativos.');
    } finally {
      setState({ adminIsLoading: false });
    }
  }

  // =============================================
  // INTERMEDIATOR FUNCTIONS
  // =============================================

  async function loadIntermediatorData({ force = false } = {}) {
    if (!isIntermediator() || state.intermediatorIsLoading) return;
    setState({ intermediatorIsLoading: true });
    try {
      const [available, mine, all] = await Promise.all([
        apiCall('/intermediation/intermediator/available').catch(() => ({ data: [] })),
        apiCall('/intermediation/intermediator/mine').catch(() => ({ data: [] })),
        apiCall('/intermediation/intermediator/all').catch(() => ({ data: [] }))
      ]);
      const nextAvailable = Array.isArray(available?.data) ? available.data : [];
      const nextMine = Array.isArray(mine?.data) ? mine.data : [];
      const nextAll = Array.isArray(all?.data) ? all.data : [];
      const tab = state.intermediatorTab || 'mine';
      const activeList = tab === 'available' ? nextAvailable : (tab === 'all' ? nextAll : nextMine);
      const totalPages = Math.max(1, Math.ceil(activeList.length / 12));
      const currentPage = Math.min(Math.max(1, Number(state.intermediatorPage) || 1), totalPages);

      setState({
        intermediatorAvailable: nextAvailable,
        intermediatorMine: nextMine,
        intermediatorAll: nextAll,
        intermediatorPage: currentPage
      });
    } catch (error) {
      handleError(error, 'Não foi possível carregar as intermediações.');
    } finally {
      setState({ intermediatorIsLoading: false });
    }
  }

  async function intermediatorAssign(negotiationId) {
    if (!isIntermediator()) return;
    try {
      const result = await apiCall(`/intermediation/${negotiationId}/intermediator/assign`, {
        method: 'POST'
      });
      if (result?.success) {
        setState({
          successMessage: result.message || 'Você assumiu esta intermediação.',
          intermediatorTab: 'mine',
          intermediatorPage: 1
        });
        await loadIntermediatorData({ force: true });
      }
    } catch (error) {
      handleError(error, 'Não foi possível assumir esta intermediação.');
    }
  }

  async function intermediatorUnassign(negotiationId) {
    if (!isIntermediator()) return;
    if (!confirm('Tem certeza que deseja deixar de intermediar esta negociação?')) return;
    try {
      const result = await apiCall(`/intermediation/${negotiationId}/intermediator/unassign`, {
        method: 'POST'
      });
      if (result?.success) {
        setState({ successMessage: result.message || 'Você deixou de intermediar esta negociação.' });
        await loadIntermediatorData({ force: true });
      }
    } catch (error) {
      handleError(error, 'Não foi possível deixar de intermediar esta negociação.');
    }
  }

  function buildAdminOverview(list) {
    if (!Array.isArray(list)) return null;
    const total = list.length;
    const byStatus = {};
    for (const status of STATUS_ORDER) {
      byStatus[status] = 0;
    }
    let awaiting = 0;
    list.forEach((item) => {
      if (item?.status) {
        byStatus[item.status] = (byStatus[item.status] || 0) + 1;
      }
      if (item?.status === 'awaiting_admin_approval') awaiting += 1;
    });
    return { total, awaiting, byStatus };
  }

  function togglePendingModal(visible) {
    if (visible && !isAdmin()) return;
    setState({ showPendingModal: visible });
    if (visible) {
      // Evita re-render automático (polling) enquanto o modal está aberto
      // para não "resetar" o dropdown/seleção do usuário.
      stopPendingPolling();
      loadPendingNotices({ filter: state.pendingFilter, force: true });
    } else {
      updatePendingPolling();
    }
  }

  async function loadPendingNotices({ filter = 'today', force = false } = {}) {
    if (!isAdmin()) return;

    if (pendingNoticesLoading) return;
    if (!force && pendingNoticesLastFilter === filter && Date.now() - pendingNoticesLoadedAt < 15000) {
      return;
    }

    pendingNoticesLoading = true;
    const params = buildPendingParams(filter);
    try {
      const data = await apiCall(`/intermediation/admin/pending?${params}`);
      const notices = Array.isArray(data?.data) ? data.data : data || [];
      const filtered = notices.filter((item) => !isAdminConcludedStatus(item?.status));
      setState({ pendingFilter: filter, pendingNotices: filtered });
      await apiCall('/intermediation/admin/pending/opened', { method: 'POST', body: {} }).catch(() => null);
      pendingNoticesLastFilter = filter;
      pendingNoticesLoadedAt = Date.now();
    } catch (error) {
      handleError(error, 'Não foi possível carregar pendências.');
    } finally {
      pendingNoticesLoading = false;
    }
  }

  function buildPendingParams(filter) {
    if (!filter) return 'filter=today';
    if (filter.includes('-') && filter.length === 7) {
      const [yearStr, monthStr] = filter.split('-');
      const year = Number(yearStr);
      const monthIndex = Number(monthStr) - 1;
      const start = new Date(year, monthIndex, 1);
      const end = new Date(year, monthIndex + 1, 0);
      return `filter=custom&start_date=${formatISODate(start)}&end_date=${formatISODate(end)}`;
    }
    return `filter=${encodeURIComponent(filter)}`;
  }

  function startPendingPolling() {
    if (!isAdmin() || pendingPollingHandle) return;
    const run = async () => {
      try {
        const data = await apiCall('/intermediation/admin/pending/count');
        const count = Number(data?.count) || 0;
        if (count !== state.pendingCount) {
          setState({ pendingCount: count });
        }
      } catch (error) {
        console.debug('Falha ao atualizar pendências', error);
      }
    };
    run();
    pendingPollingHandle = setInterval(run, 10000);
  }

  function stopPendingPolling() {
    if (pendingPollingHandle) {
      clearInterval(pendingPollingHandle);
      pendingPollingHandle = null;
    }
  }

  function startPresencePolling() {
    if (presencePollingHandle) return;
    const run = async () => {
      if (!state.token) return;

      // Evita re-render enquanto modais sensíveis estiverem abertos.
      if (state.showPendingModal || state.showCreateNegotiationModal) return;

      // Force re-render so online/offline flips as time passes.
      setState({ presenceTick: Date.now() });

      // Refresh last_seen_at periodically.
      const now = Date.now();
      if (now - presenceLastRefreshAt < 60000) return;

      presenceLastRefreshAt = now;
      try {
        await loadNegotiations({ force: true, silent: true });
      } catch {
        // ignore
      }

      try {
        if (state.currentPage === 'negotiation-detail' && state.currentNegotiation?.id) {
          await loadNegotiation(state.currentNegotiation.id, { silent: true });
        }
      } catch {
        // ignore
      }
    };
    presencePollingHandle = setInterval(() => {
      run().catch(() => null);
    }, 30000);
    run().catch(() => null);
  }

  function stopPresencePolling() {
    if (presencePollingHandle) {
      clearInterval(presencePollingHandle);
      presencePollingHandle = null;
    }
  }

  function updatePresencePolling() {
    if (!state.token) {
      stopPresencePolling();
      return;
    }
    startPresencePolling();
  }

  function updatePendingPolling() {
    // Não reinicia o polling enquanto o modal estiver aberto;
    // caso contrário, qualquer render volta a ligar o timer e atrapalha o select.
    if (state.showPendingModal || state.showCreateNegotiationModal) {
      stopPendingPolling();
      return;
    }
    if (state.token && isAdmin()) {
      startPendingPolling();
    } else {
      stopPendingPolling();
    }
  }

  function isAdmin() {
    return state.user && state.user.role === 'admin';
  }

  function isIntermediator() {
    return state.user && (state.user.role === 'intermediator' || state.user.role === 'admin');
  }

  function isIntermediatorPrincipal() {
    return Boolean(state.user && state.user.role === 'intermediator' && state.user.is_intermediator_principal);
  }

  function canManageUsers() {
    return isAdmin() || isIntermediatorPrincipal();
  }

  function isBuyer(negotiation) {
    if (!state.user || !negotiation) return false;
    const apiRole = negotiation?.my_role;
    if (apiRole === 'buyer') return true;
    if (apiRole === 'seller') return false;
    const userId = Number(state.user.id);
    const buyerId = negotiation?.buyer?.id ?? negotiation?.buyer_id;
    return Number(buyerId) === userId;
  }

  function isSeller(negotiation) {
    if (!state.user || !negotiation) return false;
    const apiRole = negotiation?.my_role;
    if (apiRole === 'seller') return true;
    if (apiRole === 'buyer') return false;
    const userId = Number(state.user.id);
    const sellerId = negotiation?.seller?.id ?? negotiation?.seller_id;
    return Number(sellerId) === userId;
  }

  function getPixPaymentInfo(neg, options = {}) {
    const pixKey = 'pix@intermediacao.com.br';
    const productAmount = Number(neg?.product_price ?? neg?.price ?? 0) || 0;
    const feeByPrice = getDigitalFeeByPrice(productAmount);

    const inferredRole = options.role || (isBuyer(neg) ? 'buyer' : (isSeller(neg) ? 'seller' : null));
    const role = inferredRole === 'seller' ? 'seller' : 'buyer';

    const fee = feeByPrice;
    const amount = role === 'seller' ? 0 : productAmount;
    const total = amount + fee;

    const fallbackPixCode = `00020126580014br.gov.bcb.pix0136${pixKey}5204000053039865406${total.toFixed(2)}5802BR5925INTERMEDIACAO PRO LTDA6009SAO PAULO62070503***6304`;
    // A API atualmente expõe apenas pix_code (assumimos que é o Pix do comprador). Para o vendedor, simulamos sempre.
    const pixCode = role === 'buyer'
      ? String(neg?.pix_code || fallbackPixCode)
      : String(fallbackPixCode);

    return { role, amount, fee, total, pixKey, pixCode };
  }

  function formatCurrency(value, currency = 'BRL') {
    if (value === null || value === undefined || value === '') return '—';
    const number = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(number)) return '—';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(number);
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatShortDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    const diffMs = Date.now() - date.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    if (hours < 24) return `${Math.max(0, hours)} h atrás`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} d atrás`;
    return formatDate(value);
  }

  function formatPhone(phone) {
    if (!phone) return '—';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return phone;
  }

  function formatCep(value) {
    const digits = onlyDigits(value);
    if (digits.length === 8) {
      return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    }
    return value || '—';
  }

  function onlyDigits(value) {
    return value ? String(value).replace(/\D/g, '') : '';
  }

  function findCaretPositionByDigitCount(formattedValue, digitsBeforeCaret) {
    const target = Math.max(0, Number(digitsBeforeCaret) || 0);
    if (!target) return 0;
    let count = 0;
    for (let i = 0; i < formattedValue.length; i++) {
      if (/\d/.test(formattedValue[i])) {
        count += 1;
        if (count >= target) {
          return i + 1;
        }
      }
    }
    return formattedValue.length;
  }

  function applyFormattedValuePreservingCaret(element, formattedValue, digitsBeforeCaretCount) {
    if (!(element instanceof HTMLInputElement)) return;
    if (element.value === formattedValue) return;
    element.value = formattedValue;
    try {
      const caret = findCaretPositionByDigitCount(formattedValue, digitsBeforeCaretCount);
      element.setSelectionRange(caret, caret);
    } catch {
      // ignore (some inputs/browsers may block selection)
    }
  }

  function formatPhoneDigits(digits) {
    const cleaned = String(digits || '').replace(/\D/g, '').slice(0, 11);
    if (!cleaned) return '';
    if (cleaned.length >= 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
    }
    if (cleaned.length >= 7) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    }
    if (cleaned.length > 2) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
    }
    return `(${cleaned}`;
  }

  function formatCepDigits(digits) {
    const cleaned = String(digits || '').replace(/\D/g, '').slice(0, 8);
    if (!cleaned) return '';
    if (cleaned.length > 5) {
      return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
    }
    return cleaned;
  }

  function normalizeText(value) {
    if (!value) return '';
    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function renderAddressDetails(entity, emptyMessage = 'Endereço não informado.') {
    if (!entity) {
      return `<p class="text-xs text-gray-500 mt-3">${escapeHtml(emptyMessage)}</p>`;
    }
    const street = entity.address_street || entity.address || entity.street || '';
    const number = entity.address_number || entity.number || '';
    const complement = entity.address_complement || entity.complement || '';
    const district = entity.address_neighborhood || entity.district || entity.neighborhood || '';
    const city = entity.address_city || entity.city || entity.city_name || '';
    const stateValue = entity.address_state || entity.state || entity.state_code || '';
    const zip = entity.address_zipcode || entity.zip_code || entity.cep || entity.postal_code || '';
    const lines = [];
    const streetLine = [street, number].filter(Boolean).join(', ');
    if (streetLine) {
      lines.push(streetLine);
    }
    if (complement) {
      lines.push(`Complemento: ${complement}`);
    }
    if (district) {
      lines.push(`Bairro: ${district}`);
    }
    const cityLine = [city, stateValue].filter(Boolean).join(' - ');
    if (cityLine) {
      lines.push(`Cidade: ${cityLine}`);
    }
    if (zip) {
      lines.push(`CEP: ${formatCep(zip)}`);
    }
    if (!lines.length) {
      return `<p class="text-xs text-gray-500 mt-3">${escapeHtml(emptyMessage)}</p>`;
    }
    return `
      <ul class="mt-3 space-y-1 text-xs text-gray-500">
        ${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}
      </ul>
    `;
  }

  function formatISODate(date) {
    return date.toISOString().split('T')[0];
  }

  function resolvePhotoUrl(path) {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `/storage/${path.replace(/^\/+/g, '')}`;
  }

  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function buildMonthOptions(total = 12) {
    const result = [];
    const now = new Date();
    for (let i = 0; i < total; i += 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      result.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
    return result;
  }

  function negotiationRequiresUserAction(neg) {
    const status = neg?.status;
    const userId = state.user?.id;
    const isBuyerUser = Boolean(userId && neg?.buyer?.id === userId);
    const isSellerUser = Boolean(userId && neg?.seller?.id === userId);

    if (isAdmin()) {
      // Intermediadora/Admin: precisa aprovar ou atuar quando o produto está com a intermediadora
      return status === 'awaiting_admin_approval' || status === 'at_intermediary';
    }

    if (isBuyerUser) {
      // Comprador: aceitar convite / pagar / confirmar recebimento após aprovação
      if (status === 'pending_acceptance') return true;
      if (status === 'waiting_payment') return true;
      if (status === 'approved' && !neg?.buyer_confirmed_at) return true;
      return false;
    }

    if (isSellerUser) {
      // Vendedor: enviar (inserir rastreio) quando aguardando envio
      if (status === 'waiting_shipment') return true;
      return false;
    }

    return false;
  }

  function getStatusPriority(status, neg) {
    // 0) Sempre primeiro: convites pendentes
    if (status === 'pending_acceptance') return 0;

    // 1..2) Depois: prioridade do que requer ação do usuário
    if (isAdmin()) {
      if (status === 'awaiting_admin_approval') return 1;
      if (status === 'at_intermediary') return 2;
    } else if (negotiationRequiresUserAction(neg)) {
      if (status === 'waiting_payment') return 1;
      if (status === 'waiting_shipment') return 1;
      return 2;
    }

    // 9) Finalizados/cancelados vão pro fim
    if (['delivered', 'cancelled', 'rejected_by_admin', 'expired'].includes(status)) return 9;

    // 5) Demais ativos
    return 5;
  }

  function getFilteredNegotiations() {
    const list = Array.isArray(state.negotiations) ? state.negotiations : [];
    const { status, role, query } = state.negotiationFilters;
    const tokens = tokenizeSearchQuery(query);

    const filtered = list.filter((item) => {
      if (status && status !== 'all') {
        if (status === 'pending_receipt') {
          if (typeof getNegotiationDisplayStatus === 'function') {
            if (getNegotiationDisplayStatus(item, state.user?.role) !== 'pending_receipt') return false;
          } else {
            return false;
          }
        } else {
          if (item?.status !== status) return false;
        }
      }

      if (!isAdmin() && role && role !== 'all') {
        if (role === 'buyer' && !isBuyer(item)) return false;
        if (role === 'seller' && !isSeller(item)) return false;
      }

      if (tokens.length) {
        return matchesNegotiationTokens(item, tokens);
      }

      return true;
    });

    return filtered
      .map((item) => {
        const priority = getStatusPriority(item?.status, item);
        const date = new Date(item?.updated_at || item?.created_at || 0).getTime();
        const score = tokens.length ? getNegotiationSearchScore(item, tokens) : 0;
        return { item, priority, score, date };
      })
      .sort((a, b) => {
        // 1) Prioridade por status/ação
        if (a.priority !== b.priority) return a.priority - b.priority;

        // 2) Se estiver buscando, prioriza melhor match (ex: "henrique" primeiro)
        if (tokens.length && a.score !== b.score) return b.score - a.score;

        // 3) Mais recente primeiro
        return b.date - a.date;
      })
      .map((row) => row.item);
  }

  function normalizeSearchText(value) {
    const raw = (value ?? '').toString().toLowerCase();
    try {
      // remove acentos/diacríticos (ex: "Henríque" -> "henrique")
      return raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    } catch {
      return raw;
    }
  }

  function tokenizeSearchQuery(query) {
    const normalized = normalizeSearchText(query).trim();
    if (!normalized) return [];
    return normalized.split(/\s+/g).map((t) => t.trim()).filter(Boolean);
  }

  function getNegotiationSearchFields(item) {
    const buyerName = (item?.buyer && typeof item.buyer === 'object')
      ? (item.buyer.name ?? item.buyer.full_name ?? '')
      : (typeof item?.buyer === 'string' ? item.buyer : '');
    const sellerName = (item?.seller && typeof item.seller === 'object')
      ? (item.seller.name ?? item.seller.full_name ?? '')
      : (typeof item?.seller === 'string' ? item.seller : '');

    const flatBuyerName = item?.buyer_name ?? item?.buyerName ?? item?.buyer_full_name ?? '';
    const flatSellerName = item?.seller_name ?? item?.sellerName ?? item?.seller_full_name ?? '';

    const participantFields = [];
    const participants = Array.isArray(item?.participants) ? item.participants : [];
    for (const p of participants) {
      if (!p) continue;
      if (typeof p === 'string') {
        participantFields.push(p);
        continue;
      }
      if (typeof p === 'object') {
        if (p.name) participantFields.push(p.name);
        if (p.full_name) participantFields.push(p.full_name);
      }
    }

    return [
      item?.product_title,
      item?.product_name,
      item?.title,
      buyerName,
      sellerName,
      flatBuyerName,
      flatSellerName,
      item?.id ? `#${item.id}` : '',
      ...participantFields
    ].map((value) => normalizeSearchText(value));
  }

  function matchesNegotiationTokens(item, tokens) {
    if (!tokens || !tokens.length) return true;
    const fields = getNegotiationSearchFields(item);
    const joined = fields.join(' ');
    return tokens.every((token) => joined.includes(token));
  }

  function scoreTokenAgainstField(token, fieldText, weight) {
    if (!token || !fieldText) return 0;
    if (!fieldText.includes(token)) return 0;

    // id (#123) tende a ser intenção bem específica
    if (token.startsWith('#') && fieldText.includes(token)) {
      return 80 * weight;
    }

    const words = fieldText.split(/[^a-z0-9#]+/g).filter(Boolean);
    if (words.some((w) => w === token)) return 60 * weight;
    if (words.some((w) => w.startsWith(token))) return 35 * weight;
    return 15 * weight;
  }

  function getNegotiationSearchScore(item, tokens) {
    const [
      productTitle,
      productName,
      buyerName,
      sellerName,
      idField
    ] = getNegotiationSearchFields(item);

    const weightedFields = [
      { text: buyerName, weight: 6 },
      { text: sellerName, weight: 6 },
      { text: productTitle, weight: 5 },
      { text: productName, weight: 4 },
      { text: idField, weight: 7 }
    ];

    let total = 0;
    for (const token of tokens) {
      let best = 0;
      for (const field of weightedFields) {
        const score = scoreTokenAgainstField(token, field.text, field.weight);
        if (score > best) best = score;
      }
      total += best;
    }
    return total;
  }

  function getDashboardStatusCounts(filters = null) {
    const list = Array.isArray(state.negotiations) ? state.negotiations : [];
    const role = filters && typeof filters.role === 'string' ? filters.role : state.negotiationFilters?.role;
    const query = filters && typeof filters.query === 'string' ? filters.query : state.negotiationFilters?.query;
    const tokens = tokenizeSearchQuery(query);

    const scoped = list.filter((item) => {
      if (!isAdmin() && role && role !== 'all') {
        if (role === 'buyer' && !isBuyer(item)) return false;
        if (role === 'seller' && !isSeller(item)) return false;
      }

      if (tokens.length && !matchesNegotiationTokens(item, tokens)) return false;
      return true;
    });

    const byStatus = {};
    for (const item of scoped) {
      const status = item?.status || 'unknown';
      byStatus[status] = (byStatus[status] || 0) + 1;
    }
    return { total: scoped.length, byStatus };
  }

  function storeAuth(token, user) {
    localStorage.setItem(STORAGE_KEYS.token, token);
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
    const targetPage = (user?.role === 'admin' || user?.role === 'intermediator') ? 'intermediator' : 'dashboard';
    setState({ token, user, currentPage: targetPage });
  }

  function logout(silent = false) {
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.user);
    stopPendingPolling();
    stopPresencePolling();
    if (confirmationIntervalHandle) {
      clearInterval(confirmationIntervalHandle);
      confirmationIntervalHandle = null;
    }
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    setState({
      token: null,
      user: null,
      currentPage: 'login',
      negotiations: [],
      currentNegotiation: null,
      pendingCount: 0,
      adminNegotiations: [],
      adminUsers: [],
      adminOverview: null,
      showPendingModal: false,
      timelineNegotiationId: null,
      gallery: null,
      showIntermediaryReportModal: false,
      sellerGuideNegotiationId: null,
      confirmationEmail: null,
      confirmationCooldownRemaining: 0,
      successMessage: silent ? null : 'Sessão finalizada.'
    });
  }

  function navigate(page, payload = {}) {
    if (!AUTH_PAGES.has(page) && !state.token) {
      page = 'login';
    }
    if (page === 'admin') {
      if (!canManageUsers()) {
        page = 'dashboard';
      } else {
        const desiredTab = isAdmin() ? 'users' : 'users';
        if (state.adminTab !== desiredTab) {
          setState({ adminTab: desiredTab });
        }
      }
    }
    if (page === 'intermediator' && !isIntermediator()) {
      page = 'dashboard';
    }

    // Admin/Intermediador usa o painel de intermediações como home.
    if (isAdmin() && page === 'dashboard') {
      page = 'intermediator';
    }

    // Intermediador vai para painel próprio
    if (isIntermediator() && page === 'dashboard') {
      page = 'intermediator';
    }

    setState({
      currentPage: page,
      errorMessage: null,
      successMessage: null,
      showDashboardFiltersModal: false,
      showIntermediaryReportModal: false,
      sellerGuideNegotiationId: null,
      filtersExpanded: false
    });

    if (page === 'dashboard') {
      if (!state.negotiations.length) {
        loadNegotiations({ force: true });
      } else {
        loadNegotiations({ force: true, silent: true }).catch(() => null);
      }
    } else if (page === 'intermediator') {
      loadIntermediatorData();
    } else if (page === 'admin') {
      loadAdminSnapshot();
    } else if (page === 'negotiation-detail') {
      const { negotiationId } = payload;
      if (negotiationId) {
        loadNegotiation(negotiationId);
      }
    }
  }

  function startConfirmationCooldown(seconds = 60) {
    if (confirmationIntervalHandle) {
      clearInterval(confirmationIntervalHandle);
      confirmationIntervalHandle = null;
    }

    const initial = Math.max(0, Number(seconds) || 0);
    // Renderiza uma vez (pra desabilitar o botão e montar a tela), e depois só atualiza o DOM.
    setState({ confirmationCooldownRemaining: initial });
    updateConfirmationCooldownUI(initial);

    let remaining = initial;
    confirmationIntervalHandle = setInterval(() => {
      if (state.currentPage !== 'confirm-email') {
        clearInterval(confirmationIntervalHandle);
        confirmationIntervalHandle = null;
        return;
      }

      remaining = Math.max(0, remaining - 1);
      state.confirmationCooldownRemaining = remaining;
      updateConfirmationCooldownUI(remaining);

      if (remaining <= 0) {
        clearInterval(confirmationIntervalHandle);
        confirmationIntervalHandle = null;
      }
    }, 1000);
  }

  function openTimeline(negId) {
    const id = Number(negId);
    if (!id) return;
    setState({ timelineNegotiationId: id, timelineData: null });
    buildTimelineData(id);
  }

  function closeTimeline() {
    setState({ timelineNegotiationId: null, timelineData: null });
  }

  function openIntermediaryReport() {
    setState({ showIntermediaryReportModal: true });
  }

  function closeIntermediaryReport() {
    setState({ showIntermediaryReportModal: false });
  }

  function openSellerGuide(negId) {
    const id = Number(negId);
    if (!id) return;
    setState({ sellerGuideNegotiationId: id });
  }

  function closeSellerGuide() {
    setState({ sellerGuideNegotiationId: null });
  }

  function buildTimelineData(negId) {
    const id = Number(negId);
    const negotiation = state.currentNegotiation && state.currentNegotiation.id === id
      ? state.currentNegotiation
      : state.negotiations.find((item) => item.id === id);
    if (!negotiation) {
      loadNegotiation(id).then(() => buildTimelineData(id));
      return;
    }
    const timeline = createTimelineFromNegotiation(negotiation);
    setState({ timelineData: timeline });
  }

  function createTimelineFromNegotiation(neg) {
    const trackSeller = neg.tracking_to_intermediary || neg.tracking_code || '';
    const trackBuyer = neg.tracking_to_buyer || neg.buyer_tracking_code || '';
    const steps = [
      { key: 'created', label: 'Convite criado', date: neg.created_at, description: `${neg.seller?.name || 'Vendedor'} iniciou a negociação.` },
      { key: 'buyer_accept', label: 'Comprador aceitou', date: neg.buyer_accepted_at, description: `${neg.buyer?.name || 'Comprador'} aceitou participar.` },
      { key: 'payment', label: 'Pagamento confirmado', date: neg.product_paid_at || neg.buyer_fee_paid_at, description: 'Pagamento registrado.' },
      { key: 'sent_to_intermediary', label: 'Envio à intermediadora', date: neg.sent_to_intermediary_at, description: trackSeller ? `Produto enviado para análise. Rastreio: ${trackSeller}` : 'Produto enviado para análise.' },
      { key: 'received', label: 'Produto recebido', date: neg.intermediary_received_at, description: 'Intermediadora confirmou recebimento.' },
      { key: 'approved', label: 'Aprovado pela intermediadora', date: neg.intermediary_approval_confirmed_at || neg.admin_approved_at, description: 'Produto pronto para envio.' },
      { key: 'sent_to_buyer', label: 'Envio ao comprador', date: neg.sent_to_buyer_at, description: trackBuyer ? `Produto a caminho do comprador. Rastreio: ${trackBuyer}` : 'Produto a caminho do comprador.' },
      { key: 'buyer_confirmed', label: 'Entrega confirmada', date: neg.buyer_confirmed_at, description: 'Comprador confirmou recebimento.' },
      { key: 'finalized', label: 'Finalizado', date: neg.finalized_at || (neg.status === 'delivered' ? neg.updated_at : null), description: 'Negociação finalizada.' }
    ];
    return steps.filter((step) => step.date || step.key === 'created');
  }

  function openGallery(negId, index, type) {
    const negotiation = state.currentNegotiation;
    if (!negotiation || negotiation.id !== Number(negId)) return;
    const photoType = String(type || '').toLowerCase();
    const photos = photoType === 'product'
      ? (Array.isArray(negotiation.product_photos || negotiation.photos) ? (negotiation.product_photos || negotiation.photos) : [])
      : (Array.isArray(negotiation.intermediary_photos) ? negotiation.intermediary_photos : []);
    if (!photos.length) return;
    const nextIndex = Math.max(0, Math.min(Number(index) || 0, photos.length - 1));
    setState({ gallery: { negotiationId: negotiation.id, photos, index: nextIndex } });
  }

  function shiftGallery(delta) {
    const gallery = state.gallery;
    if (!gallery) return;
    const nextIndex = Math.max(0, Math.min(gallery.index + delta, gallery.photos.length - 1));
    if (nextIndex === gallery.index) return;
    setState({ gallery: { ...gallery, index: nextIndex } });
  }

  async function copyText(value) {
    if (!navigator.clipboard) {
      notify({ type: 'error', message: 'Clipboard não suportado.' });
      return;
    }
    try {
      await navigator.clipboard.writeText(value || '');
      notify({ type: 'success', message: 'Copiado para a área de transferência.' });
    } catch (error) {
      handleError(error, 'Não foi possível copiar.');
    }
  }

  function openResetPage(token, email) {
    setState({
      resetPasswordToken: token || '',
      resetPasswordEmail: email || '',
      currentPage: 'reset-password'
    });
  }

  async function adminApprove(negId) {
    const id = Number(negId);
    if (!id) return;
    await withLoader(async () => {
      await apiCall(`/intermediation/${id}/admin-approve`, { method: 'POST', body: {} });
      notify({ type: 'success', message: 'Negociação aprovada.' });
      await Promise.all([loadNegotiations({ force: true }), loadAdminSnapshot({ force: true })]);
      if (state.currentNegotiation?.id === id) {
        await loadNegotiation(id);
      }
    }, 'Aprovando...');
  }

  async function adminReject(negId) {
    const id = Number(negId);
    if (!id) return;
    const reason = prompt('Informe o motivo da reprovação (mínimo 10 caracteres):');
    if (!reason || reason.trim().length < 10) {
      notify({ type: 'error', message: 'Motivo inválido.' });
      return;
    }
    await withLoader(async () => {
      await apiCall(`/intermediation/${id}/admin-reject`, { method: 'POST', body: { reason: reason.trim() } });
      notify({ type: 'success', message: 'Negociação reprovada.' });
      await Promise.all([loadNegotiations({ force: true }), loadAdminSnapshot({ force: true })]);
      if (state.currentNegotiation?.id === id) {
        await loadNegotiation(id);
      }
    }, 'Reprovando...');
  }

  async function adminDeleteNegotiation(negId) {
    const id = Number(negId);
    if (!id) return;
    if (!isAdmin()) {
      notify({ type: 'error', message: 'Apenas administrador pode remover.' });
      return;
    }
    if (!confirm(`Remover a negociação #${id}? (Ação de teste)`)) return;

    await withLoader(async () => {
      await apiCall(`/intermediation/admin/${id}`, { method: 'DELETE' });
      notify({ type: 'success', message: 'Negociação removida.' });

      // Se estava aberta, fecha.
      if (state.currentNegotiation?.id === id) {
        setState({ currentNegotiation: null, currentPage: 'admin' });
      }

      await Promise.all([
        loadAdminSnapshot({ force: true }),
        loadNegotiations({ force: true }),
      ]);

      if (state.showPendingModal) {
        await loadPendingNotices({ filter: state.pendingFilter, force: true });
      }
    }, 'Removendo negociação...');
  }

  function openNegotiationDetail(negId) {
    const id = Number(negId);
    if (!id) return;
    togglePendingModal(false);
    navigate('negotiation-detail', { negotiationId: id });
  }

  async function rejectProductFlow(negId) {
    const id = Number(negId);
    if (!id) return;
    const reason = prompt('Explique o motivo da reprovação:');
    if (!reason || reason.trim().length < 5) {
      notify({ type: 'error', message: 'Informe um motivo válido.' });
      return;
    }
    await withLoader(async () => {
      await apiCall(`/intermediation/${id}/approve`, {
        method: 'POST',
        body: {
          approved: false,
          notes: reason.trim(),
          seller_transferred: false
        }
      });
      notify({ type: 'success', message: 'Reprovação registrada.' });
      await loadNegotiation(id);
    }, 'Registrando reprovação...');
  }

  async function markProductReceived(negId) {
    const id = Number(negId);
    if (!id) return;
    if (!confirm('Confirmar recebimento na intermediadora?')) return;
    await withLoader(async () => {
      await apiCall(`/intermediation/${id}/mark-received`, { method: 'POST', body: {} });
      notify({ type: 'success', message: 'Recebimento confirmado.' });
      await loadNegotiation(id);
    }, 'Atualizando status...');
  }

  async function buyerConfirm(negId) {
    const id = Number(negId);
    if (!id) return;
    if (!confirm('Confirmar recebimento do produto?')) return;
    await withLoader(async () => {
      await apiCall(`/intermediation/${id}/buyer-confirm`, { method: 'POST', body: { rating: 10 } });
      notify({ type: 'success', message: 'Recebimento confirmado.' });
      await loadNegotiation(id);
    }, 'Confirmando entrega...');
  }

  async function finalizeNegotiation(negId) {
    const id = Number(negId);
    if (!id) return;
    if (!isAdmin()) {
      notify({ type: 'error', message: 'Apenas a intermediadora pode finalizar.' });
      return;
    }
    if (!confirm('Finalizar a negociação?')) return;
    await withLoader(async () => {
      await apiCall(`/intermediation/${id}/approve`, { method: 'POST', body: {} });
      notify({ type: 'success', message: 'Negociação finalizada.' });
      await loadNegotiation(id);
      await loadNegotiations({ force: true });
    }, 'Finalizando negociação...');
  }

  const actions = {
    //#region Actions: Navegação e Máscaras
    setTheme({ dataset }) {
      const next = String(dataset?.theme || dataset?.value || '').trim().toLowerCase();
      if (!['white', 'gray', 'black', 'default'].includes(next)) return;
      try {
        if (next === 'default') {
          localStorage.removeItem(STORAGE_KEYS.theme);
        } else {
          localStorage.setItem(STORAGE_KEYS.theme, next);
        }
      } catch { /* ignore */ }
      setState({ theme: next });
    },
    navigate({ dataset }) {
      if (!dataset || !dataset.page) return;
      navigate(dataset.page, dataset);
    },
    openSellerGuide({ dataset }) {
      openSellerGuide(dataset?.id);
    },
    closeSellerGuide() {
      closeSellerGuide();
    },
    noop() {},
    formatPhoneInput({ element, event }) {
      if (!(element instanceof HTMLInputElement)) return;
      if (event && event.isComposing) return;
      const raw = String(element.value || '');
      const caret = typeof element.selectionStart === 'number' ? element.selectionStart : raw.length;
      const digitsBeforeCaret = onlyDigits(raw.slice(0, caret)).length;
      const digits = onlyDigits(raw).slice(0, 11);
      const formatted = formatPhoneDigits(digits);
      applyFormattedValuePreservingCaret(element, formatted, digitsBeforeCaret);
    },
    formatCepInput({ element, event }) {
      if (!(element instanceof HTMLInputElement)) return;
      if (event && event.isComposing) return;
      const raw = String(element.value || '');
      const caret = typeof element.selectionStart === 'number' ? element.selectionStart : raw.length;
      const digitsBeforeCaret = onlyDigits(raw.slice(0, caret)).length;
      const digits = onlyDigits(raw).slice(0, 8);
      const formatted = formatCepDigits(digits);
      applyFormattedValuePreservingCaret(element, formatted, digitsBeforeCaret);
    },
    //#endregion Actions: Navegação e Máscaras

    //#region Actions: Registro (cidade/estado)
    filterRegisterCity({ value }) {
      setState({ registerCityFilter: value || '' });
    },
    selectRegisterCity({ value }) {
      setState({ registerSelectedCity: value || '' });
    },
    //#endregion Actions: Registro (cidade/estado)

    //#region Actions: Autenticação
    logout() {
      logout();
    },
    async copyMyTag() {
      const tag = getUserInviteTag(state.user);
      if (!tag) {
        notify({ type: 'error', message: 'Não foi possível obter seu usuário.' });
        return;
      }
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(tag);
        } else {
          const el = document.createElement('textarea');
          el.value = tag;
          el.setAttribute('readonly', '');
          el.style.position = 'fixed';
          el.style.top = '-1000px';
          el.style.left = '-1000px';
          document.body.appendChild(el);
          el.select();
          document.execCommand('copy');
          document.body.removeChild(el);
        }
        notify({ type: 'success', message: `Copiado: ${tag}` });
      } catch {
        notify({ type: 'error', message: `Copie manualmente: ${tag}` });
      }
    },
    async login({ values }) {
      if (!values.email || !values.password) {
        handleError(new Error('Informe e-mail e senha.'));
        return;
      }
      await withLoader(async () => {
        const response = await apiCall('/login', {
          method: 'POST',
          body: {
            email: values.email,
            password: values.password
          }
        });
        const token = response?.token || response?.data?.token;
        const user = response?.user || response?.data?.user;
        if (!token || !user) throw new Error('Resposta inesperada do servidor.');
        storeAuth(token, user);
        await bootstrapAuthenticated();
        notify({ type: 'success', message: 'Bem-vindo de volta!' });
      }, 'Entrando...');
    },
    async register({ values }) {
      if (!isPasswordStrong(values.password)) {
        handleError(new Error('A senha deve ter no mínimo 8 caracteres, 1 letra maiúscula e 1 número.'));
        return;
      }
      if (values.password !== values.password_confirmation) {
        handleError(new Error('As senhas não coincidem.'));
        return;
      }
      const sanitize = (value) => (value ? String(value).trim() : '');
      const phoneDigits = onlyDigits(values.phone);
      const zipDigits = onlyDigits(values.zip_code);
      const payload = {
        name: sanitize(values.name),
        email: sanitize(values.email),
        phone: phoneDigits || null,
        zip_code: zipDigits || null,
        address: sanitize(values.address) || null,
        address_number: sanitize(values.address_number) || null,
        address_complement: sanitize(values.address_complement) || null,
        district: sanitize(values.district) || null,
        city: sanitize(values.city) || null,
        state: sanitize(values.state) || 'SP',
        password: values.password,
        password_confirmation: values.password_confirmation
      };
      await withLoader(async () => {
        const result = await apiCall('/register', {
          method: 'POST',
          body: payload
        });
        const smsSent = Boolean(result?.data?.sms_sent ?? result?.sms_sent);
        const verificationSent = Boolean(result?.data?.verification_email_sent ?? result?.verification_email_sent);
        const baseMessage = verificationSent
          ? 'Conta criada! Enviamos um código de confirmação para o seu e-mail.'
          : 'Conta criada! Não conseguimos enviar o código, mas você pode solicitar o reenvio.';
        const extraMessage = smsSent ? ' Também enviamos um SMS com o código de verificação.' : '';
        notify({ type: 'success', message: `${baseMessage}${extraMessage}`.trim() });
        setState({
          currentPage: 'confirm-email',
          confirmationEmail: values.email,
          registerCityFilter: '',
          registerSelectedCity: ''
        });
        if (verificationSent) {
          startConfirmationCooldown(120);
        } else {
          if (confirmationIntervalHandle) {
            clearInterval(confirmationIntervalHandle);
            confirmationIntervalHandle = null;
          }
          setState({ confirmationCooldownRemaining: 0 });
        }
      }, 'Criando conta...');
    },
    //#endregion Actions: Autenticação

    async verifyEmailCode({ values }) {
      const code = String(values.code || '').replace(/\D+/g, '').slice(0, 6);
      if (!state.confirmationEmail) {
        throw new Error('Informe o e-mail para confirmar.');
      }
      if (code.length !== 6) {
        throw new Error('Informe o código de 6 dígitos.');
      }

      await withLoader(async () => {
        const result = await apiCall('/email/verify-code', {
          method: 'POST',
          body: { email: state.confirmationEmail, code }
        });
        notify({ type: 'success', message: result.message || 'Email verificado com sucesso!' });
        setState({ currentPage: 'login' });
      }, 'Confirmando código...');
    },
    async forgotPassword({ values }) {
      await withLoader(async () => {
        await apiCall('/forgot-password', { method: 'POST', body: { email: values.email } });
        notify({ type: 'success', message: 'Se existir uma conta, enviaremos instruções por e-mail.' });
        setState({ currentPage: 'confirm-email', confirmationEmail: values.email, confirmationCooldownRemaining: 60 });
        startConfirmationCooldown(60);
      }, 'Enviando e-mail...');
    },
    async resetPassword({ values }) {
      await withLoader(async () => {
        if (!isPasswordStrong(values.password)) {
          handleError(new Error('A senha deve ter no mínimo 8 caracteres, 1 letra maiúscula e 1 número.'));
          return;
        }
        await apiCall('/reset-password', {
          method: 'POST',
          body: {
            token: values.token,
            email: values.email,
            password: values.password,
            password_confirmation: values.password_confirmation
          }
        });
        notify({ type: 'success', message: 'Senha atualizada. Faça login.' });
        setState({
          currentPage: 'login',
          resetPasswordToken: null,
          resetPasswordEmail: values.email
        });
      }, 'Atualizando senha...');
    },
    async resendConfirmation() {
      // Legacy handler - redirects to new one
      await actions.resendEmailVerification();
    },
    async resendEmailVerification() {
      if (state.confirmationCooldownRemaining) return;
      await withLoader(async () => {
        let result;
        if (state.token && state.user) {
          result = await apiCall('/email/send-verification', { method: 'POST' });
        } else if (state.confirmationEmail) {
          result = await apiCall('/email/resend-link', {
            method: 'POST',
            body: { email: state.confirmationEmail }
          });
        } else {
          throw new Error('Informe o e-mail para reenviar.');
        }

        notify({ type: 'success', message: result.message || 'Código enviado!' });
        const retryAfter = Number(result?.retry_after) || 120;
        startConfirmationCooldown(retryAfter);
      }, 'Reenviando código...');
    },
    dashboardRefresh() {
      loadNegotiations({ force: true });
    },
    dashboardStatusFilter({ dataset }) {
      if (!dataset || dataset.status === undefined) return;
      const shouldCollapse = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 1023px)').matches;
      setState({
        negotiationFilters: { ...state.negotiationFilters, status: dataset.status },
        dashboardPage: 1,
        ...(shouldCollapse ? { filtersExpanded: false } : {})
      });
    },
    dashboardSearch({ value }) {
      setState({ negotiationFilters: { ...state.negotiationFilters, query: value || '' }, dashboardPage: 1 });
    },
    toggleSidebarFilterDropdown({ dataset, event }) {
      const filter = dataset?.filter;
      if (!filter) return;
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      if (filter === 'summary') {
        setState({ sidebarSummaryOpen: !state.sidebarSummaryOpen });
        return;
      }
      if (filter === 'status') {
        setState({ sidebarStatusOpen: !state.sidebarStatusOpen });
      }
    },
    statusOptionsSearch({ value }) {
      setState({ statusOptionsQuery: value || '' });
    },
    dashboardPrevPage() {
      const next = Math.max(1, (Number(state.dashboardPage) || 1) - 1);
      if (next !== state.dashboardPage) setState({ dashboardPage: next });
    },
    dashboardNextPage() {
      const total = getFilteredNegotiations().length;
      const size = getDashboardPageSize();
      const totalPages = Math.max(1, Math.ceil(total / size));
      const next = Math.min(totalPages, (Number(state.dashboardPage) || 1) + 1);
      if (next !== state.dashboardPage) setState({ dashboardPage: next });
    },
    toggleFilters() {
      setState({ filtersExpanded: !state.filtersExpanded });
    },
    openDashboardFiltersModal() {
      setState({
        showDashboardFiltersModal: true,
        dashboardFiltersDraft: { ...state.negotiationFilters },
        filtersExpanded: false
      });
    },
    closeDashboardFiltersModal() {
      setState({ showDashboardFiltersModal: false });
    },
    updateDashboardFiltersDraft({ dataset, value }) {
      const field = dataset?.field;
      if (!field) return;
      setState({ dashboardFiltersDraft: { ...(state.dashboardFiltersDraft || {}), [field]: value ?? '' } });
    },
    selectDashboardDraftStatus({ dataset }) {
      const nextStatus = dataset?.status;
      if (!nextStatus) return;
      setState({ dashboardFiltersDraft: { ...(state.dashboardFiltersDraft || {}), status: nextStatus } });
    },
    clearDashboardFiltersModal() {
      setState({ dashboardFiltersDraft: { status: 'all', role: 'all', query: '' } });
    },
    applyDashboardFiltersModal() {
      const draft = state.dashboardFiltersDraft || {};
      setState({
        negotiationFilters: {
          status: draft.status || 'all',
          role: draft.role || 'all',
          query: draft.query || ''
        },
        dashboardPage: 1,
        showDashboardFiltersModal: false
      });
    },
    openCreateNegotiation() {
      setState({ 
        showCreateNegotiationModal: true,
        showCreateTerms: false,
        showCreateFeeGuide: false,
        createNegStep: 1,
        createNegForm: { 
          buyerFound: null, 
          buyerSearching: false, 
          productPhotos: [], 
          photoError: null,
          termsAccepted: false,
          serviceId: '',
          gameId: '',
          serviceFields: {},
          title: '',
          category: '',
          negotiationType: '',
          sellerFeeMode: 'deduct',
          deliveryDays: '',
          digitalGame: '',
          digitalQuantity: '',
          digitalPlatformServer: '',
          digitalDeliveryMethod: '',
          description: '',
          price: '',
          buyerTag: ''
        }
      });
    },
    closeCreateNegotiation() {
      try {
        const currentPhotos = Array.isArray(state.createNegForm?.productPhotos) ? state.createNegForm.productPhotos : [];
        currentPhotos.forEach((p) => {
          if (p?.preview) {
            try { URL.revokeObjectURL(p.preview); } catch { /* ignore */ }
          }
        });
      } catch {
        // ignore
      }
      setState({ 
        showCreateNegotiationModal: false,
        showCreateTerms: false,
        showCreateFeeGuide: false,
        createNegStep: 1,
        createNegForm: { 
          buyerFound: null, 
          buyerSearching: false, 
          productPhotos: [], 
          photoError: null,
          termsAccepted: false,
          serviceId: '',
          gameId: '',
          serviceFields: {},
          title: '',
          category: '',
          negotiationType: '',
          sellerFeeMode: 'deduct',
          deliveryDays: '',
          digitalGame: '',
          digitalQuantity: '',
          digitalPlatformServer: '',
          digitalDeliveryMethod: '',
          description: '',
          price: '',
          buyerTag: ''
        }
      });
    },

    prevCreateNegStep() {
      try {
        const form = document.querySelector('form[data-action="createNegotiation"]');
        if (form instanceof HTMLFormElement) {
          persistCreateNegotiationDraftFromDOM(form);
        }
      } catch {
        // ignore
      }
      const next = Math.max(1, (Number(state.createNegStep) || 1) - 1);
      state.createNegStep = next;
      state.showCreateTerms = false;
      updateCreateNegotiationStepUI();
    },

    goToCreateNegStep({ dataset }) {
      const target = Math.max(1, Math.min(4, Number(dataset?.step) || 1));
      const current = Math.max(1, Math.min(4, Number(state.createNegStep) || 1));
      if (target > current) return;
      try {
        const form = document.querySelector('form[data-action="createNegotiation"]');
        if (form instanceof HTMLFormElement) {
          persistCreateNegotiationDraftFromDOM(form);
        }
      } catch {
        // ignore
      }
      state.createNegStep = target;
      if (target !== 4) {
        state.showCreateTerms = false;
      }
      updateCreateNegotiationStepUI();
      // When returning to step 2, refresh dynamic sections from draft.
      if (target === 2) {
        updateCreateNegotiationModalDynamicUI();
      }
    },

    nextCreateNegStep() {
      const step = Math.max(1, Math.min(4, Number(state.createNegStep) || 1));

      try {
        const form = document.querySelector('form[data-action="createNegotiation"]');
        if (form instanceof HTMLFormElement) {
          persistCreateNegotiationDraftFromDOM(form);
        }
      } catch {
        // ignore
      }

      // Step 1 validation: category, type, price, deadline (if digital)
      if (step === 1) {
        const form = document.querySelector('form[data-action="createNegotiation"]');
        if (form instanceof HTMLFormElement) {
          const categoryEl = form.querySelector('select[name="category"]');
          const typeEl = form.querySelector('select[name="negotiation_type"]');
          const priceEl = form.querySelector('input[name="price"]');
          const daysEl = form.querySelector('select[name="delivery_days"]');

          const category = categoryEl instanceof HTMLSelectElement ? String(categoryEl.value || '').trim() : '';
          const type = typeEl instanceof HTMLSelectElement ? String(typeEl.value || '').trim() : '';
          const price = priceEl instanceof HTMLInputElement ? parsePtBrMoney(priceEl.value || '0') : 0;

          if (!type) {
            notify({ type: 'error', message: 'Selecione o tipo de negociação.' });
            return;
          }
          if (!category) {
            notify({ type: 'error', message: 'Selecione uma categoria.' });
            return;
          }

          if (isServiceTaxonomyCategory(category) || category === CATEGORY_SERVICE) {
            const serviceId = String(state.createNegForm?.serviceId || state.createNegForm?.service_id || '').trim();
            if (!serviceId) {
              notify({ type: 'error', message: 'Selecione o serviço antes de continuar.' });
              return;
            }
          }

          const allowed = type === 'digital' ? DIGITAL_PRODUCT_CATEGORIES : (type === 'physical' ? PHYSICAL_PRODUCT_CATEGORIES : []);
          if (allowed.length && !allowed.includes(category)) {
            notify({ type: 'error', message: 'Categoria inválida para o tipo selecionado.' });
            return;
          }
          if (!price || price < 50 || price > 100000) {
            notify({ type: 'error', message: 'Informe um valor válido (R$ 50 a R$ 100.000).' });
            return;
          }
          if (type === 'digital') {
            const deadline = getCreateNegotiationDeadlineCopy();
            if (deadline.kind === 'selectable_days') {
              const days = daysEl instanceof HTMLSelectElement ? parseInt(daysEl.value || '', 10) : NaN;
              const maxDays = deadline.maxDays;
              if (!days || days < 1 || days > maxDays) {
                notify({ type: 'error', message: `Selecione um prazo de 1 a ${maxDays} dias.` });
                return;
              }
            }
          }

          // Sync state for dynamic UI pieces without full render.
          state.createNegForm = {
            ...state.createNegForm,
            category,
            negotiationType: type,
            price: priceEl instanceof HTMLInputElement ? priceEl.value : state.createNegForm.price,
            deliveryDays: daysEl instanceof HTMLSelectElement ? daysEl.value : '',
          };
          updateCreateNegotiationModalDynamicUI();
        }
      }

      // Step 3 validation: buyer found
      if (step === 3) {
        const category = String(state.createNegForm?.category || '').trim();
        const isService = isServiceTaxonomyCategory(category) || category === CATEGORY_SERVICE;
        const requiresSchedule = isService && category !== CATEGORY_BOOST_RANK;
        if (requiresSchedule) {
          try {
            const form = document.querySelector('form[data-action="createNegotiation"]');
            if (form instanceof HTMLFormElement) {
              persistCreateNegotiationDraftFromDOM(form);
            }
          } catch {
            // ignore
          }

          const dates = normalizeDateOptions(state.createNegForm?.service_seller_start_date_options ?? state.createNegForm?.serviceSellerStartDateOptions ?? [], 3);
          if (!dates.length) {
            notify({ type: 'error', message: 'Informe pelo menos 1 data de início (até 3).' });
            return;
          }

          const ranges = normalizeTimeRangeOptions(state.createNegForm?.service_seller_time_range_options ?? state.createNegForm?.serviceSellerTimeRangeOptions ?? [], 3);
          if (!ranges.length) {
            notify({ type: 'error', message: 'Informe pelo menos 1 intervalo de horário (início/fim).' });
            return;
          }
        }

        if (!state.createNegForm?.buyerFound) {
          notify({ type: 'error', message: 'Busque e confirme o comprador antes de continuar.' });
          return;
        }
      }

      // Step 2 validation: service form must have a game selected
      if (step === 2) {
        const category = String(state.createNegForm?.category || '').trim();
        const isService = isServiceTaxonomyCategory(category) || category === CATEGORY_SERVICE;
        if (isService) {
          const gameId = String(state.createNegForm?.gameId || state.createNegForm?.game_id || '').trim();
          if (!gameId) {
            notify({ type: 'error', message: 'Selecione o jogo do serviço antes de continuar.' });
            return;
          }
        }

        if (category === CATEGORY_GAME_ACCOUNT) {
          try {
            const form = document.querySelector('form[data-action="createNegotiation"]');
            if (form instanceof HTMLFormElement) {
              persistCreateNegotiationDraftFromDOM(form);
            }
          } catch {
            // ignore
          }

          const DEFAULT_GAME_ACCOUNT_DELIVERABLE = 'Acesso à conta (login e senha) + instruções para troca de credenciais.';
          const v = (name) => {
            const raw = state.createNegForm?.[name];
            if (raw === null || raw === undefined) return '';
            if (Array.isArray(raw)) return raw.map((x) => String(x || '').trim()).filter(Boolean).join('\n');
            return String(raw || '').trim();
          };
          const reqAll = (names) => names.every((n) => Boolean(v(n)));

          const gameType = v('game_account_type');
          const isCompetitiveType = ['fps', 'moba', 'battle_royale', 'mobile', 'esporte'].includes(gameType);

          const layer1Done = Boolean(v('game_account_type') && v('game_account_platform') && v('game_account_game'));
          const rankingDone = !isCompetitiveType || Boolean(v('ga_rank_current_tier'));

          const hasExclusive = v('ga_has_exclusive_items');
          const exclusiveItems = Array.isArray(state.createNegForm?.exclusiveItems) ? state.createNegForm.exclusiveItems : [];
          const exclusiveItemsDone = (hasExclusive !== '1') || (
            Array.isArray(exclusiveItems)
            && exclusiveItems.length > 0
            && exclusiveItems.some((it) => Boolean(String(it?.preview || '').trim()))
          );
          const exclusiveDone = (hasExclusive === '0' || hasExclusive === '1') && exclusiveItemsDone;

          const specificDone = (() => {
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

          // Entrega (Camada 7) não é necessária no fluxo de conta de jogo: usamos um texto padrão.
          const currentDeliverable = v('what_will_be_delivered');
          if (!currentDeliverable) {
            state.createNegForm = { ...(state.createNegForm || {}), what_will_be_delivered: DEFAULT_GAME_ACCOUNT_DELIVERABLE };
          }
          const deliveryDone = true;

          const providers = Array.isArray(state.createNegForm?.game_account_linked_providers)
            ? state.createNegForm.game_account_linked_providers.map((x) => String(x || '').trim()).filter(Boolean)
            : [];

          const firstOwner = v('game_account_first_owner');
          const hasOriginalEmail = v('game_account_has_original_email');
          const canChange = v('game_account_can_change_credentials');
          const punishment = v('game_account_punishment_history');

          const securityDone = (
            ['0', '1'].includes(firstOwner)
            && ['0', '1'].includes(hasOriginalEmail)
            && ['yes', 'no', 'partial'].includes(canChange)
            && Boolean(punishment)
            && Array.isArray(providers) && providers.length >= 1
            && !(providers.includes('none') && providers.length > 1)
          );

          const openAndScroll = (key, message) => {
            const flag = `_uiGaOpen_${key}`;
            state.createNegForm = { ...(state.createNegForm || {}), [flag]: true };
            updateCreateNegotiationModalDynamicUI();
            notify({ type: 'error', message });
            try {
              requestAnimationFrame(() => {
                const root = document.getElementById('app');
                const block = root ? root.querySelector(`[data-ga-layer="${CSS.escape(key)}"]`) : null;
                if (block && typeof block.scrollIntoView === 'function') {
                  block.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              });
            } catch {
              // ignore
            }
          };

          if (!layer1Done) {
            notify({ type: 'error', message: 'Complete a Camada 1 (Identificação do produto) antes de continuar.' });
            return;
          }
          if (isCompetitiveType && !rankingDone) {
            openAndScroll('ranking', 'Preencha o Ranking (Camada 3) antes de continuar.');
            return;
          }
          if (!exclusiveDone) {
            openAndScroll('exclusive', 'Preencha a Camada 4 (Itens exclusivos) antes de continuar.');
            return;
          }
          if (!specificDone) {
            openAndScroll('specific', 'Preencha a Camada 5 (Dados específicos por tipo) antes de continuar.');
            return;
          }
          if (!securityDone) {
            openAndScroll('security', 'Preencha a Segurança da conta (Camada 2) antes de continuar.');
            return;
          }
        }
      }

      const next = Math.min(4, step + 1);
      state.createNegStep = next;
      if (next === 4 && !state.createNegForm?.termsAccepted) {
        state.showCreateTerms = true;
      }
      updateCreateNegotiationStepUI();

      // Step 4: refresh fee summary and dynamic UI
      if (next === 4) {
        updateCreateFeeSummaryUI();
        updateCreateNegotiationModalDynamicUI();
      }
    },
    toggleCreateFeeGuide() {
      if (state.showCreateNegotiationModal) {
        state.showCreateFeeGuide = !state.showCreateFeeGuide;
        updateCreateNegotiationModalDynamicUI();
        return;
      }
      setState({ showCreateFeeGuide: !state.showCreateFeeGuide });
    },
    openCreateTerms() {
      if (!state.showCreateNegotiationModal) return;
      state.showCreateTerms = true;
      updateCreateNegotiationStepUI();
    },
    acceptCreateTerms() {
      if (!state.showCreateNegotiationModal) return;
      setState({
        showCreateTerms: false,
        createNegForm: {
          ...(state.createNegForm || {}),
          termsAccepted: true,
          terms_accepted: true
        }
      });
    },
    declineCreateTerms() {
      if (!state.showCreateNegotiationModal) return;
      setState({
        showCreateTerms: false,
        createNegForm: {
          ...(state.createNegForm || {}),
          termsAccepted: false,
          terms_accepted: false
        }
      });
    },
    updateNegFormField({ element, dataset, event }) {
      const field = dataset?.field;
      if (!field || !element) return;
      let value = element.value ?? '';
      const currentForm = state.createNegForm || {};
      const nextForm = { ...currentForm, [field]: value };
      if (field === 'buyerTag') {
        nextForm.buyerFound = null;
      }

      // Title-case some text fields on blur/change.
      const shouldTitleCase = [
        'title',
        'digitalGame',
        'digitalPlatformServer',
      ].includes(field);
      if (shouldTitleCase) {
        const shouldFormat = !event || event.type === 'change';
        if (shouldFormat) {
          value = toTitleCasePtBr(value);
          try { element.value = value; } catch { /* ignore */ }
          nextForm[field] = value;
        }
      }

      // Helper: keep both snake_case and camelCase keys in sync (draft vs controlled fields)
      const syncSnake = (snake, camel, v) => {
        nextForm[camel] = v;
        nextForm[snake] = v;
      };

      // Price: format on blur (change event) as "1000,00".
      if (field === 'price') {
        const raw = String(value || '');
        const parsed = parsePtBrMoney(raw);
        const shouldFormat = !event || event.type === 'change';
        if (shouldFormat && parsed > 0) {
          value = formatPtBrMoney(parsed);
          try { element.value = value; } catch { /* ignore */ }
          nextForm.price = value;
        }

        state.createNegForm = nextForm;
        updateCreateFeeSummaryUI();
        return;
      }

      // Quantity: format as pt-BR "1.000,00" while typing; store raw formatted string.
      if (field === 'digitalQuantity') {
        const digits = String(value || '').replace(/\D/g, '');
        if (!digits) {
          value = '';
        } else {
          const intCents = parseInt(digits, 10);
          const units = Math.floor(intCents / 100);
          const cents = String(intCents % 100).padStart(2, '0');
          const withThousands = String(units).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
          value = `${withThousands},${cents}`;
        }
        try { element.value = value; } catch { /* ignore */ }
        syncSnake('digital_quantity', 'digitalQuantity', value);
        state.createNegForm = nextForm;
        return;
      }

      // Negotiation type change: clear category if not allowed.
      if (field === 'negotiationType') {
        const nextType = String(value || '').trim();
        const nextCategory = String(currentForm.category || '').trim();
        const allowed = nextType === 'digital'
          ? DIGITAL_PRODUCT_CATEGORIES
          : (nextType === 'physical' ? PHYSICAL_PRODUCT_CATEGORIES : []);
        if (nextCategory && allowed.length && !allowed.includes(nextCategory)) {
          nextForm.category = '';
        }

        // Clear photos only if the *new* type/category combination does not allow photos.
        const hadPhotos = Array.isArray(currentForm.productPhotos) && currentForm.productPhotos.length > 0;
        const currentCategory = String(currentForm.category || '').trim();
        if (hadPhotos && !categoryAllowsImages(currentCategory, nextType)) {
          const currentPhotos = Array.isArray(currentForm.productPhotos) ? currentForm.productPhotos : [];
          currentPhotos.forEach((p) => {
            if (p?.preview) {
              try { URL.revokeObjectURL(p.preview); } catch { /* ignore */ }
            }
          });
          nextForm.productPhotos = [];
          nextForm.photoError = null;
        }
        // Re-render the modal so Step 1 category select enables and options refresh.
        setState({ createNegForm: nextForm });
        return;
      }

      // Re-render only when we need conditional UI updates.
      if (field === 'category') {
        const prevCategory = String(currentForm.category || '').trim();
        const nextCategory = String(value || '').trim();
        const currentType = String(currentForm.negotiationType || getCreateNegotiationType() || '').trim();

        // Service taxonomy: category implies service_id; reset game and dynamic fields when switching.
        const prevWasServiceTax = isServiceTaxonomyCategory(prevCategory);
        const nextIsServiceTax = isServiceTaxonomyCategory(nextCategory);
        if (nextIsServiceTax) {
          const sid = SERVICE_CATEGORY_LABEL_TO_ID[nextCategory] || '';
          nextForm.serviceId = sid;
          nextForm.service_id = sid;
          if (!prevWasServiceTax || prevCategory !== nextCategory) {
            // Carry PvE + Boost Rank are universal: no game select step; store as game_id='other' + typed game title.
            if (nextCategory === CATEGORY_CARRY_PVE || nextCategory === CATEGORY_BOOST_RANK) {
              nextForm.gameId = 'other';
              nextForm.game_id = 'other';
            } else {
              nextForm.gameId = '';
              nextForm.game_id = '';
            }
            nextForm.serviceFields = {};

            // Slots UI state (per-service)
            if (nextCategory === CATEGORY_BOOST_RANK) nextForm._uiBoostRankSlotCount = 1;
            if (nextCategory === CATEGORY_CARRY_PVE) nextForm._uiCarryPveSlotCount = 1;
          }
        } else if (prevWasServiceTax) {
          nextForm.serviceId = '';
          nextForm.service_id = '';
          nextForm.gameId = '';
          nextForm.game_id = '';
          nextForm.serviceFields = {};
        }

        // Reset delivery days when switching between categories with different max days.
        const prevMax = categoryDeliveryDaysMax(prevCategory);
        const nextMax = categoryDeliveryDaysMax(nextCategory);
        if (prevMax !== nextMax) {
          nextForm.deliveryDays = '';
        }

        // Clear photos when leaving a category/type where photos are allowed.
        if (categoryAllowsImages(prevCategory, currentType) && !categoryAllowsImages(nextCategory, currentType)) {
          const currentPhotos = Array.isArray(currentForm.productPhotos) ? currentForm.productPhotos : [];
          currentPhotos.forEach((p) => {
            if (p?.preview) {
              try { URL.revokeObjectURL(p.preview); } catch { /* ignore */ }
            }
          });
          nextForm.productPhotos = [];
          nextForm.photoError = null;
        }

        // Hide fee guide when leaving currency category (optional).
        if (prevCategory === CATEGORY_CURRENCY && nextCategory !== CATEGORY_CURRENCY) {
          state.showCreateFeeGuide = false;
        }

        // Avoid full-app re-render; update only modal dynamic sections.
        state.createNegForm = nextForm;
        updateCreateNegotiationModalDynamicUI();
        return;
      }

      if (['price', 'sellerFeeMode'].includes(field)) {
        // Update state but avoid full re-render; update summary numbers via DOM.
        state.createNegForm = nextForm;
        updateCreateFeeSummaryUI();
        return;
      }

      state.createNegForm = nextForm;
    },

    refreshCreateNegDynamicUI({ event }) {
      // Evitar re-render pesado em cada tecla; para select, roda em change.
      if (event && event.type === 'input') return;
      // Importante: antes de re-renderizar, persistir o que o usuário digitou no DOM.
      // Sem isso, campos com apenas refresh (ex: nome do jogo / números da camada 5) parecem "não aceitar".
      try {
        const form = document.querySelector('form[data-action="createNegotiation"]');
        if (form instanceof HTMLFormElement) {
          persistCreateNegotiationDraftFromDOM(form);
        }
      } catch {
        // ignore
      }
      try {
        updateCreateNegotiationModalDynamicUI();
      } catch {
        // ignore
      }
    },

    toggleGaLayer({ dataset }) {
      if (!state.showCreateNegotiationModal) return;
      try {
        const form = document.querySelector('form[data-action="createNegotiation"]');
        if (form instanceof HTMLFormElement) {
          persistCreateNegotiationDraftFromDOM(form);
        }
      } catch {
        // ignore
      }
      const key = String(dataset?.key || '').trim();
      if (!key) return;
      const flag = `_uiGaOpen_${key}`;
      const current = Boolean(state.createNegForm?.[flag]);
      state.createNegForm = { ...(state.createNegForm || {}), [flag]: !current };
      updateCreateNegotiationModalDynamicUI();

      if (!current) {
        try {
          requestAnimationFrame(() => {
            const root = document.getElementById('app');
            const block = root ? root.querySelector(`[data-ga-layer="${CSS.escape(key)}"]`) : null;
            if (block && typeof block.scrollIntoView === 'function') {
              block.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            const first = block ? block.querySelector('input, select, textarea') : null;
            if (first && typeof first.focus === 'function') {
              first.focus({ preventScroll: true });
            }
          });
        } catch {
          // ignore
        }
      }
    },

    reloadServiceFormsConfig() {
      try {
        ensureServiceFormsConfigLoaded({ force: true });
      } catch {
        // ignore
      }
    },

    carryPveAddSlot() {
      if (!state.showCreateNegotiationModal) return;
      try {
        const category = String(state.createNegForm?.category || '').trim();
        if (category !== CATEGORY_CARRY_PVE) return;
        const current = Number(state.createNegForm?._uiCarryPveSlotCount) || 1;
        const next = Math.max(1, Math.min(3, current + 1));
        state.createNegForm = { ...(state.createNegForm || {}), _uiCarryPveSlotCount: next };
        updateCreateNegotiationModalDynamicUI();
      } catch {
        // ignore
      }
    },

    carryPveRemoveSlot({ dataset }) {
      if (!state.showCreateNegotiationModal) return;
      try {
        const category = String(state.createNegForm?.category || '').trim();
        if (category !== CATEGORY_CARRY_PVE) return;
        const idx = Number(dataset?.index) || 0;
        if (![2, 3].includes(idx)) return;

        const fields = (state.createNegForm?.serviceFields && typeof state.createNegForm.serviceFields === 'object')
          ? state.createNegForm.serviceFields
          : {};

        const nextFields = { ...fields };

        if (idx === 2) {
          // Keep options contiguous: if slot3 exists, move it into slot2.
          const s3d = String(nextFields.slot3_date || '').trim();
          const s3t = String(nextFields.slot3_time || '').trim();
          if (s3d || s3t) {
            nextFields.slot2_date = s3d;
            nextFields.slot2_time = s3t;
          } else {
            delete nextFields.slot2_date;
            delete nextFields.slot2_time;
          }
          delete nextFields.slot3_date;
          delete nextFields.slot3_time;
        } else {
          delete nextFields.slot3_date;
          delete nextFields.slot3_time;
        }

        // Normalize preferred slot if it points to a removed option.
        const preferred = String(nextFields.preferred_slot || '').trim();
        if (idx === 3 && preferred === '3') {
          delete nextFields.preferred_slot;
        }
        if (idx === 2) {
          // If user preferred slot2 and we moved slot3->slot2, keep it as '2'.
          // If user preferred slot3, it becomes '2'.
          if (preferred === '3') nextFields.preferred_slot = '2';
          if (preferred === '2' && !(String(nextFields.slot2_date || '').trim() || String(nextFields.slot2_time || '').trim())) {
            delete nextFields.preferred_slot;
          }
        }

        const currentCount = Number(state.createNegForm?._uiCarryPveSlotCount) || 1;
        const nextCount = Math.max(1, Math.min(3, currentCount - 1));

        state.createNegForm = {
          ...(state.createNegForm || {}),
          _uiCarryPveSlotCount: nextCount,
          serviceFields: nextFields,
        };
        updateCreateNegotiationModalDynamicUI();
      } catch {
        // ignore
      }
    },

    boostRankAddSlot() {
      if (!state.showCreateNegotiationModal) return;
      try {
        const category = String(state.createNegForm?.category || '').trim();
        if (category !== CATEGORY_BOOST_RANK) return;
        const current = Number(state.createNegForm?._uiBoostRankSlotCount) || 1;
        const next = Math.max(1, Math.min(3, current + 1));
        state.createNegForm = { ...(state.createNegForm || {}), _uiBoostRankSlotCount: next };
        updateCreateNegotiationModalDynamicUI();
      } catch {
        // ignore
      }
    },

    boostRankRemoveSlot({ dataset }) {
      if (!state.showCreateNegotiationModal) return;
      try {
        const category = String(state.createNegForm?.category || '').trim();
        if (category !== CATEGORY_BOOST_RANK) return;
        const idx = Number(dataset?.index) || 0;
        if (![2, 3].includes(idx)) return;

        const fields = (state.createNegForm?.serviceFields && typeof state.createNegForm.serviceFields === 'object')
          ? state.createNegForm.serviceFields
          : {};
        const nextFields = { ...fields };

        if (idx === 2) {
          const s3d = String(nextFields.slot3_date || '').trim();
          const s3t = String(nextFields.slot3_time || '').trim();
          if (s3d || s3t) {
            nextFields.slot2_date = s3d;
            nextFields.slot2_time = s3t;
          } else {
            delete nextFields.slot2_date;
            delete nextFields.slot2_time;
          }
          delete nextFields.slot3_date;
          delete nextFields.slot3_time;
        } else {
          delete nextFields.slot3_date;
          delete nextFields.slot3_time;
        }

        const preferred = String(nextFields.preferred_slot || '').trim();
        if (idx === 3 && preferred === '3') {
          delete nextFields.preferred_slot;
        }
        if (idx === 2) {
          if (preferred === '3') nextFields.preferred_slot = '2';
          if (preferred === '2' && !(String(nextFields.slot2_date || '').trim() || String(nextFields.slot2_time || '').trim())) {
            delete nextFields.preferred_slot;
          }
        }

        const currentCount = Number(state.createNegForm?._uiBoostRankSlotCount) || 1;
        const nextCount = Math.max(1, Math.min(3, currentCount - 1));

        state.createNegForm = {
          ...(state.createNegForm || {}),
          _uiBoostRankSlotCount: nextCount,
          serviceFields: nextFields,
        };
        updateCreateNegotiationModalDynamicUI();
      } catch {
        // ignore
      }
    },

    updateCreateServiceId({ element }) {
      const serviceId = element && typeof element.value !== 'undefined' ? String(element.value ?? '') : '';
      state.createNegForm = {
        ...(state.createNegForm || {}),
        serviceId: String(serviceId || '').trim(),
        service_id: String(serviceId || '').trim(),
        gameId: '',
        game_id: '',
        serviceFields: {},
      };
      updateCreateNegotiationModalDynamicUI();
    },

    updateCreateGameId({ element }) {
      const gameId = element && typeof element.value !== 'undefined' ? String(element.value ?? '') : '';
      state.createNegForm = {
        ...(state.createNegForm || {}),
        gameId: String(gameId || '').trim(),
        game_id: String(gameId || '').trim(),
        serviceFields: (state.createNegForm?.serviceFields && typeof state.createNegForm.serviceFields === 'object') ? state.createNegForm.serviceFields : {},
      };
      updateCreateNegotiationModalDynamicUI();
    },

    updateCreateServiceField({ element, dataset }) {
      const fieldId = String(dataset?.fieldId || dataset?.field_id || '').trim();
      if (!fieldId) return;
      let value = element && typeof element.value !== 'undefined' ? String(element.value ?? '') : '';
      try {
        if (element instanceof HTMLInputElement && element.type === 'checkbox') {
          value = element.checked ? String(element.value ?? '1') : '';
        }
      } catch {
        // ignore
      }
      const current = (state.createNegForm?.serviceFields && typeof state.createNegForm.serviceFields === 'object') ? state.createNegForm.serviceFields : {};
      state.createNegForm = {
        ...(state.createNegForm || {}),
        serviceFields: {
          ...current,
          [fieldId]: value,
        }
      };

      // Carry PvE has conditional UI (participation, RNG, account access) + optional score accordion.
      // Re-render only for fields that change visibility of other inputs.
      try {
        const category = String(state.createNegForm?.category || '').trim();
        if (category === CATEGORY_CARRY_PVE) {
          const rerenderKeys = new Set([
            'client_participation',
            'score_has_system',
            'needs_account_access',
            'preferred_slot',
          ]);
          if (rerenderKeys.has(fieldId)) {
            updateCreateNegotiationModalDynamicUI();
          }
        }

        if (category === CATEGORY_BOOST_RANK) {
          const rerenderKeys = new Set([
            'needs_account_access',
            'downgrade_risk',
            'preferred_slot',
          ]);
          if (rerenderKeys.has(fieldId)) {
            updateCreateNegotiationModalDynamicUI();
          }
        }

        if ([CATEGORY_CUSTOM_SERVICE, CATEGORY_SEASONAL, CATEGORY_COLLECTIBLES].includes(category)) {
          const rerenderKeys = new Set([
            'has_numeric_goal',
            'needs_account_access',
            'known_risk',
            'rng_has_chance',
            'desired_deadline',
          ]);
          if (rerenderKeys.has(fieldId)) {
            updateCreateNegotiationModalDynamicUI();
          }
        }
      } catch {
        // ignore
      }
    },
    async searchBuyer({ element }) {
      const raw = String(state.createNegForm.buyerTag || '').trim();
      if (!raw) {
        notify({ type: 'error', message: 'Informe o usuário no formato nome#id (ex: henrique#15).' });
        return;
      }
      setState({ createNegForm: { ...state.createNegForm, buyerSearching: true, buyerFound: null } });
      try {
        const response = await apiCall(`/users/search?tag=${encodeURIComponent(raw)}`, { method: 'GET' });
        const user = response?.user || response?.data;
        if (user && user.id) {
          setState({ createNegForm: { ...state.createNegForm, buyerSearching: false, buyerFound: user } });
        } else {
          setState({ createNegForm: { ...state.createNegForm, buyerSearching: false, buyerFound: false } });
        }
      } catch (e) {
        setState({ createNegForm: { ...state.createNegForm, buyerSearching: false, buyerFound: false } });
      }
    },
    addProductPhotos({ element }) {
      const category = String(state.createNegForm?.category || '').trim();
      const negotiationType = String(state.createNegForm?.negotiationType || getCreateNegotiationType() || '').trim();
      if (!categoryAllowsImages(category, negotiationType)) {
        notify({ type: 'info', message: 'Imagens estão disponíveis apenas para produto físico, conta de jogo e item/skin.' });
        if (element) element.value = '';
        return;
      }
      const files = element?.files;
      if (!files || !files.length) return;
      const currentPhotos = [...state.createNegForm.productPhotos];
      const maxPhotos = categoryMaxAllowedImages(category, negotiationType) || 8;
      const maxSize = 5 * 1024 * 1024; // 5MB
      
      for (let i = 0; i < files.length && currentPhotos.length < maxPhotos; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) {
          state.createNegForm = { ...state.createNegForm, photoError: 'Apenas imagens são permitidas.' };
          if (state.showCreateNegotiationModal) {
            updateCreateNegotiationModalDynamicUI();
          } else {
            setState({ createNegForm: { ...state.createNegForm } });
          }
          continue;
        }
        if (file.size > maxSize) {
          state.createNegForm = { ...state.createNegForm, photoError: 'Imagem muito grande. Máximo 5MB.' };
          if (state.showCreateNegotiationModal) {
            updateCreateNegotiationModalDynamicUI();
          } else {
            setState({ createNegForm: { ...state.createNegForm } });
          }
          continue;
        }
        const preview = URL.createObjectURL(file);
        currentPhotos.push({ file, preview });
      }

      state.createNegForm = { ...state.createNegForm, productPhotos: currentPhotos, photoError: null };
      if (state.showCreateNegotiationModal) {
        updateCreateNegotiationModalDynamicUI();
      } else {
        setState({ createNegForm: { ...state.createNegForm } });
      }
      element.value = '';
    },
    removeProductPhoto({ dataset }) {
      const index = Number(dataset?.index);
      const currentPhotos = [...state.createNegForm.productPhotos];
      if (currentPhotos[index]?.preview) {
        URL.revokeObjectURL(currentPhotos[index].preview);
      }
      currentPhotos.splice(index, 1);
      state.createNegForm = { ...state.createNegForm, productPhotos: currentPhotos };
      if (state.showCreateNegotiationModal) {
        updateCreateNegotiationModalDynamicUI();
      } else {
        setState({ createNegForm: { ...state.createNegForm } });
      }
    },
    addProofImages({ element }) {
      const files = element?.files;
      if (!files || !files.length) return;
      const current = Array.isArray(state.createNegForm.proofImages) ? [...state.createNegForm.proofImages] : [];
      const maxSize = 5 * 1024 * 1024;
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;
        if (file.size > maxSize) continue;
        const preview = URL.createObjectURL(file);
        current.push({ file, preview });
      }
      state.createNegForm = { ...state.createNegForm, proofImages: current };
      if (state.showCreateNegotiationModal) {
        updateCreateNegotiationModalDynamicUI();
      } else {
        setState({ createNegForm: { ...state.createNegForm } });
      }
      element.value = '';
    },
    removeProofImage({ dataset }) {
      const index = Number(dataset?.index);
      const current = Array.isArray(state.createNegForm?.proofImages) ? [...state.createNegForm.proofImages] : [];
      if (current[index]?.preview) {
        try { URL.revokeObjectURL(current[index].preview); } catch { /* ignore */ }
      }
      current.splice(index, 1);
      state.createNegForm = { ...state.createNegForm, proofImages: current };
      if (state.showCreateNegotiationModal) {
        updateCreateNegotiationModalDynamicUI();
      } else {
        setState({ createNegForm: { ...state.createNegForm } });
      }
    },

    addExclusiveItem() {
      const current = Array.isArray(state.createNegForm?.exclusiveItems) ? [...state.createNegForm.exclusiveItems] : [];
      current.push({ type: '', name: '', rarity: '', description: '', file: null, preview: '' });
      state.createNegForm = { ...state.createNegForm, exclusiveItems: current };
      if (state.showCreateNegotiationModal) {
        updateCreateNegotiationModalDynamicUI();
      } else {
        setState({ createNegForm: { ...state.createNegForm } });
      }
    },
    removeExclusiveItem({ dataset }) {
      const index = Number(dataset?.index);
      const current = Array.isArray(state.createNegForm?.exclusiveItems) ? [...state.createNegForm.exclusiveItems] : [];
      if (!Number.isFinite(index) || index < 0 || index >= current.length) return;
      const prev = current[index];
      if (prev?.preview && String(prev.preview).startsWith('blob:')) {
        try { URL.revokeObjectURL(prev.preview); } catch { /* ignore */ }
      }
      current.splice(index, 1);
      state.createNegForm = { ...state.createNegForm, exclusiveItems: current };
      if (state.showCreateNegotiationModal) {
        updateCreateNegotiationModalDynamicUI();
      } else {
        setState({ createNegForm: { ...state.createNegForm } });
      }
    },
    updateExclusiveItemField({ dataset, value }) {
      const index = Number(dataset?.index);
      const field = String(dataset?.field || '').trim();
      if (!field) return;
      const current = Array.isArray(state.createNegForm?.exclusiveItems) ? [...state.createNegForm.exclusiveItems] : [];
      if (!Number.isFinite(index) || index < 0 || index >= current.length) {
        // If UI starts with a single placeholder card, ensure it exists.
        if (index === 0 && !current.length) {
          current.push({ type: '', name: '', rarity: '', description: '', file: null, preview: '' });
        } else {
          return;
        }
      }
      const item = { ...(current[index] || {}) };
      item[field] = String(value ?? '');
      current[index] = item;
      state.createNegForm = { ...state.createNegForm, exclusiveItems: current };
    },
    setExclusiveItemImage({ element, dataset }) {
      if (!(element instanceof HTMLInputElement)) return;
      const index = Number(dataset?.index);
      const files = element.files;
      if (!files || !files.length) return;
      const file = files[0];
      if (!file || !file.type || !file.type.startsWith('image/')) return;
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        notify({ type: 'error', message: 'A imagem deve ter no máximo 5MB.' });
        return;
      }

      const current = Array.isArray(state.createNegForm?.exclusiveItems) ? [...state.createNegForm.exclusiveItems] : [];
      if (!Number.isFinite(index) || index < 0) return;
      while (current.length <= index) {
        current.push({ type: '', name: '', rarity: '', description: '', file: null, preview: '' });
      }

      const prev = current[index];
      if (prev?.preview && String(prev.preview).startsWith('blob:')) {
        try { URL.revokeObjectURL(prev.preview); } catch { /* ignore */ }
      }
      const preview = URL.createObjectURL(file);
      current[index] = { ...(prev || {}), file, preview };
      state.createNegForm = { ...state.createNegForm, exclusiveItems: current };
      if (state.showCreateNegotiationModal) {
        updateCreateNegotiationModalDynamicUI();
      } else {
        setState({ createNegForm: { ...state.createNegForm } });
      }
      element.value = '';
    },
    async createNegotiation({ values, form }) {
      if (Number(state.createNegStep) !== 4) {
        notify({ type: 'info', message: 'Use “Continuar” para avançar até a confirmação.' });
        return;
      }

      // Validações
      if (!values.category) {
        notify({ type: 'error', message: 'Selecione uma categoria.' });
        return;
      }

      const category = String(values.category || '').trim();
      const requiresImages = categoryRequiresImages(category);
      const minImages = categoryMinImages(category);
      const maxImages = categoryMaxImages(category);
      const isCurrency = category === CATEGORY_CURRENCY;
      const isService = isServiceTaxonomyCategory(category) || category === CATEGORY_SERVICE;
      const isServiceExchange = category === CATEGORY_SERVICE_EXCHANGE;
      const isServiceProductFlow = isService;
      const isGameAccount = category === CATEGORY_GAME_ACCOUNT;
      const isKeyDlc = category === CATEGORY_KEY_DLC;
      const isSkin = category === CATEGORY_SKIN;
      const isItem = category === CATEGORY_ITEM;
      const isOthers = category === CATEGORY_OTHERS;
      const negotiationType = getCreateNegotiationType();
      const isDigitalType = negotiationType === 'digital';
      const needsDescription = negotiationType === 'physical' || isSkin;
      const allowsPhotos = categoryAllowsImages(category, negotiationType);
      const maxAllowedPhotos = categoryMaxAllowedImages(category, negotiationType) || 8;

      // Universal game/product flow: Skin/Item/Outros (digital)
      const isUniversalGameProductFlow = isDigitalType && (isSkin || isItem || isOthers);
      if (isUniversalGameProductFlow) {
        const uGameType = String(values.universal_game_type ?? state.createNegForm?.universal_game_type ?? '').trim();
        const uGameNameRaw = String(values.universal_game_name ?? state.createNegForm?.universal_game_name ?? '').trim();
        const uProductNameRaw = String(values.universal_product_name ?? state.createNegForm?.universal_product_name ?? '').trim();

        if (!uGameType) {
          notify({ type: 'error', message: 'Selecione o tipo do jogo.' });
          return;
        }
        if (!uGameNameRaw) {
          notify({ type: 'error', message: 'Informe o nome do jogo.' });
          return;
        }
        if (!uProductNameRaw) {
          notify({ type: 'error', message: 'Informe o nome do produto.' });
          return;
        }

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

        const gameName = capitalizeFirstPtBr(uGameNameRaw);
        const productName = capitalizeFirstPtBr(uProductNameRaw);
        const typeLabel = typeLabelByValue[uGameType] || '';

        const computedTitleRaw = [
          productName,
          gameName ? `— ${gameName}` : '',
          typeLabel ? `(${typeLabel})` : ''
        ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

        const computedTitle = computedTitleRaw ? String(computedTitleRaw).slice(0, 255) : '';
        const computedDescRaw = [
          productName ? `Produto: ${productName}` : '',
          gameName ? `Jogo: ${gameName}` : '',
          typeLabel ? `Tipo: ${typeLabel}` : ''
        ].filter(Boolean).join(' | ').replace(/\s+/g, ' ').trim();
        const computedDesc = computedDescRaw ? String(computedDescRaw).slice(0, 200) : '';

        values.title = computedTitle;
        values.game_title = String(gameName || '').slice(0, 120);
        if (isItem) {
          values.item_name = String(productName || '').slice(0, 160);
          values.item_general_info = String((typeLabel ? `Tipo do jogo: ${typeLabel}` : '') || '').slice(0, 1000);
        }
        if (isSkin) {
          values.description = computedDesc;
        } else if (!values.description?.trim()) {
          // Optional: populate a short description for better clarity.
          values.description = computedDesc;
        }

        state.createNegForm = {
          ...(state.createNegForm || {}),
          title: values.title,
          description: values.description,
          game_title: values.game_title,
          item_name: values.item_name,
          item_general_info: values.item_general_info,
        };
      }

      let serviceId = '';
      let gameId = '';

      if (!isServiceProductFlow) {
        if (!values.title?.trim()) {
          notify({ type: 'error', message: 'Informe o título do produto.' });
          return;
        }
      } else {
        serviceId = String(values.service_id || state.createNegForm?.serviceId || state.createNegForm?.service_id || '').trim();
        gameId = String(values.game_id || state.createNegForm?.gameId || state.createNegForm?.game_id || '').trim();
        if (!serviceId) {
          notify({ type: 'error', message: 'Selecione o serviço.' });
          return;
        }
        if (!gameId) {
          notify({ type: 'error', message: 'Selecione o jogo.' });
          return;
        }
      }

      const parsePtBrToIntUnits = (raw) => {
        const digits = String(raw || '').replace(/\D/g, '');
        if (!digits) return 0;
        const cents = parseInt(digits, 10);
        if (!Number.isFinite(cents) || cents <= 0) return 0;
        return Math.floor(cents / 100);
      };

      const normalizeCheckboxArray = (raw) => {
        if (Array.isArray(raw)) {
          return raw.map((v) => String(v || '').trim()).filter(Boolean);
        }
        if (typeof raw === 'string') {
          return raw.split(',').map((v) => String(v || '').trim()).filter(Boolean);
        }
        if (raw === undefined || raw === null) return [];
        return [String(raw || '').trim()].filter(Boolean);
      };

      if (isCurrency) {
        if (!values.digital_game?.trim()) {
          notify({ type: 'error', message: 'Informe o jogo.' });
          return;
        }
        const qty = parsePtBrToIntUnits(values.digital_quantity);
        if (!qty || qty < 1) {
          notify({ type: 'error', message: 'Informe a quantidade da moeda.' });
          return;
        }
        if (!values.digital_platform_server?.trim()) {
          notify({ type: 'error', message: 'Informe o servidor.' });
          return;
        }
        if (!values.digital_delivery_method) {
          notify({ type: 'error', message: 'Selecione o método de entrega.' });
          return;
        }

        const sellerTimesRaw = values['gold_seller_time_options[]'] ?? values.gold_seller_time_options;
        const sellerTimes = normalizeTimeOptions(sellerTimesRaw, 3);
        if (!sellerTimes.length) {
          notify({ type: 'error', message: 'Informe pelo menos 1 horário de entrega (até 3).' });
          return;
        }
      }

      if (isKeyDlc) {
        const days = parseInt(values.delivery_days || '', 10);
        if (!days || days < 1 || days > DIGITAL_KEY_DELIVERY_MAX_DAYS) {
          notify({ type: 'error', message: `Selecione um prazo de entrega de 1 a ${DIGITAL_KEY_DELIVERY_MAX_DAYS} dias.` });
          return;
        }
      }

      if (isService) {
        const serviceFields = (state.createNegForm?.serviceFields && typeof state.createNegForm.serviceFields === 'object')
          ? state.createNegForm.serviceFields
          : {};
        const sf = (key) => String(serviceFields?.[key] ?? '').trim();

        if (serviceId === 'custom') {
          if (!sf('game_name')) {
            notify({ type: 'error', message: 'Informe o nome do jogo.' });
            return;
          }
          if (!sf('objective_what')) {
            notify({ type: 'error', message: 'Descreva o que deseja que seja feito.' });
            return;
          }
          if (!sf('objective_expected')) {
            notify({ type: 'error', message: 'Informe o resultado esperado.' });
            return;
          }
          if (!sf('execution_method')) {
            notify({ type: 'error', message: 'Selecione a forma do serviço.' });
            return;
          }
          if (sf('has_numeric_goal') === 'Sim') {
            if (!sf('numeric_goal_desc') || !sf('numeric_goal_value')) {
              notify({ type: 'error', message: 'Preencha a descrição e o valor da meta numérica.' });
              return;
            }
          }
        }

        if (serviceId === 'seasonal') {
          if (!sf('game_name')) {
            notify({ type: 'error', message: 'Informe o nome do jogo.' });
            return;
          }
          if (!sf('season_name')) {
            notify({ type: 'error', message: 'Informe o nome ou número da temporada.' });
            return;
          }
          if (!sf('season_type')) {
            notify({ type: 'error', message: 'Selecione o tipo de temporada.' });
            return;
          }
          if (!sf('reward_desired')) {
            notify({ type: 'error', message: 'Informe a recompensa desejada.' });
            return;
          }
          if (!sf('execution_method')) {
            notify({ type: 'error', message: 'Selecione a forma do serviço.' });
            return;
          }
        }

        if (serviceId === 'collectibles') {
          if (!sf('game_name')) {
            notify({ type: 'error', message: 'Informe o nome do jogo.' });
            return;
          }
          if (!sf('collectible_type')) {
            notify({ type: 'error', message: 'Selecione o tipo de colecionável.' });
            return;
          }
          if (!sf('item_name')) {
            notify({ type: 'error', message: 'Informe o nome do item ou conquista.' });
            return;
          }
          if (sf('rng_has_chance') === 'Sim') {
            if (!sf('rng_attempts') || !sf('rng_policy')) {
              notify({ type: 'error', message: 'Informe as tentativas e a política caso não drope.' });
              return;
            }
          }
        }

        const days = parseInt(values.delivery_days || '', 10);
        if (!days || days < 1 || days > DIGITAL_SERVICE_DELIVERY_MAX_DAYS) {
          notify({ type: 'error', message: `Selecione um prazo de entrega de 1 a ${DIGITAL_SERVICE_DELIVERY_MAX_DAYS} dias.` });
          return;
        }

        const flexibleCategories = [CATEGORY_CUSTOM_SERVICE, CATEGORY_SEASONAL, CATEGORY_COLLECTIBLES];
        const isFlexibleService = flexibleCategories.includes(category);
        if (!isFlexibleService) {
          const rawDates = values['service_seller_start_date_options[]'] ?? values.service_seller_start_date_options;
          const dates = normalizeDateOptions(rawDates, 3);
          if (!dates.length) {
            notify({ type: 'error', message: 'Informe pelo menos 1 data de início (até 3).' });
            return;
          }

          const startsRaw = values['service_seller_time_range_start[]'] ?? values.service_seller_time_range_start;
          const endsRaw = values['service_seller_time_range_end[]'] ?? values.service_seller_time_range_end;
          const starts = Array.isArray(startsRaw) ? startsRaw : (startsRaw ? [startsRaw] : []);
          const ends = Array.isArray(endsRaw) ? endsRaw : (endsRaw ? [endsRaw] : []);
          const ranges = [];
          for (let i = 0; i < Math.max(starts.length, ends.length); i += 1) {
            const a = String(starts[i] || '').trim();
            const b = String(ends[i] || '').trim();
            if (!a || !b) continue;
            ranges.push(`${a}-${b}`);
          }
          const normalizedRanges = normalizeTimeRangeOptions(ranges, 3);
          if (!normalizedRanges.length) {
            notify({ type: 'error', message: 'Informe pelo menos 1 intervalo de horário (início/fim), máx 3.' });
            return;
          }
        }
      }

      if (isServiceExchange) {
        const days = parseInt(values.delivery_days || '', 10);
        if (!days || days < 1 || days > DIGITAL_SERVICE_EXCHANGE_MAX_DAYS) {
          notify({ type: 'error', message: `Selecione um prazo de entrega de 1 a ${DIGITAL_SERVICE_EXCHANGE_MAX_DAYS} dias.` });
          return;
        }
      }

      if (isSkin) {
        if (!values.game_title?.trim()) {
          notify({ type: 'error', message: 'Informe o nome do jogo.' });
          return;
        }
      }

      if (isItem) {
        if (!values.game_title?.trim()) {
          notify({ type: 'error', message: 'Informe o nome do jogo.' });
          return;
        }
        if (!values.item_name?.trim()) {
          notify({ type: 'error', message: 'Informe o nome do item.' });
          return;
        }
        if (!values.item_general_info?.trim()) {
          notify({ type: 'error', message: 'Informe as informações gerais.' });
          return;
        }
      }

      if (isGameAccount) {
        const DEFAULT_GAME_ACCOUNT_DELIVERABLE = 'Acesso à conta (login e senha) + instruções para troca de credenciais.';
        const gameType = String(values.game_account_type ?? '').trim();
        const gameName = String(values.game_account_game ?? '').trim();
        const platform = String(values.game_account_platform ?? '').trim();
        if (!gameType) {
          notify({ type: 'error', message: 'Selecione o tipo do jogo.' });
          return;
        }
        if (!platform) {
          notify({ type: 'error', message: 'Selecione a plataforma.' });
          return;
        }
        if (!gameName) {
          notify({ type: 'error', message: 'Informe o nome do jogo.' });
          return;
        }

        const firstOwner = String(values.game_account_first_owner ?? '').trim();
        if (!['0', '1'].includes(firstOwner)) {
          notify({ type: 'error', message: 'Informe se você é o primeiro dono da conta.' });
          return;
        }
        const hasOriginalEmail = String(values.game_account_has_original_email ?? '').trim();
        if (!['0', '1'].includes(hasOriginalEmail)) {
          notify({ type: 'error', message: 'Informe se possui acesso ao e-mail original.' });
          return;
        }
        const linkedProviders = normalizeCheckboxArray(values['game_account_linked_providers[]'] ?? values.game_account_linked_providers);
        if (!linkedProviders.length) {
          notify({ type: 'error', message: 'Informe as vinculações da conta (ou marque “Nenhuma”).' });
          return;
        }
        if (linkedProviders.includes('none') && linkedProviders.length > 1) {
          notify({ type: 'error', message: 'Selecione apenas “Nenhuma” ou as vinculações existentes.' });
          return;
        }

        const canChange = String(values.game_account_can_change_credentials ?? '').trim();
        if (!['yes', 'no', 'partial'].includes(canChange)) {
          notify({ type: 'error', message: 'Informe se é possível alterar e-mail e senha.' });
          return;
        }
        const punishment = String(values.game_account_punishment_history ?? '').trim();
        if (!punishment) {
          notify({ type: 'error', message: 'Informe o histórico de punições.' });
          return;
        }
        const deliverable = String(values.what_will_be_delivered ?? '').trim() || DEFAULT_GAME_ACCOUNT_DELIVERABLE;
        if (deliverable.length > 200) {
          notify({ type: 'error', message: 'O campo de entrega deve ter no máximo 200 caracteres.' });
          return;
        }

        const competitiveTypes = ['fps', 'moba', 'battle_royale', 'mobile', 'esporte'];
        const isCompetitive = competitiveTypes.includes(gameType);
        if (isCompetitive) {
          const tier = String(values.ga_rank_current_tier ?? '').trim();
          if (!tier) {
            notify({ type: 'error', message: 'Informe o tier atual (ranking).' });
            return;
          }
        }

        const requiredByType = {
          mmorpg: ['ts_mm_avg_level', 'ts_mm_endgame', 'ts_mm_playtime', 'ts_mm_complete_builds', 'ts_mm_has_currency'],
          fps: ['ts_fps_level'],
          battle_royale: ['ts_br_level', 'ts_br_old_seasons', 'ts_br_old_passes'],
          mobile: ['ts_mobile_level'],
          estrategia: ['ts_strat_base_level', 'ts_strat_alliances'],
          esporte: ['ts_sport_level'],
          other: ['ts_other_progression_general', 'ts_other_has_competitive'],
        };
        const required = requiredByType[gameType] || [];
        for (const key of required) {
          const val = values[key];
          const ok = Array.isArray(val) ? val.length > 0 : String(val ?? '').trim().length > 0;
          if (!ok) {
            notify({ type: 'error', message: 'Preencha os campos obrigatórios do tipo de jogo.' });
            return;
          }
        }

        const hasExclusive = String(values.ga_has_exclusive_items ?? '').trim();
        if (!['0', '1'].includes(hasExclusive)) {
          notify({ type: 'error', message: 'Informe se a conta possui itens exclusivos.' });
          return;
        }
        if (hasExclusive === '1') {
          const items = Array.isArray(state.createNegForm?.exclusiveItems) ? state.createNegForm.exclusiveItems : [];
          const hasAnyImage = Array.isArray(items) && items.some((it) => Boolean(it && it.file));
          if (!hasAnyImage) {
            notify({ type: 'error', message: 'Adicione pelo menos 1 imagem de item exclusivo.' });
            return;
          }
        }
      }

      if (needsDescription) {
        if (!values.description?.trim()) {
          notify({ type: 'error', message: 'Informe a descrição.' });
          return;
        }

        const desc = String(values.description || '').trim();
        if (negotiationType === 'physical') {
          if (desc.length > 2000) {
            notify({ type: 'error', message: 'A descrição deve ter no máximo 2000 caracteres.' });
            return;
          }
        } else {
          if (desc.length > 200) {
            notify({ type: 'error', message: 'A descrição curta deve ter no máximo 200 caracteres.' });
            return;
          }
        }
      }

      const price = parsePtBrMoney(values.price);
      if (!price || price < 50 || price > 100000) {
        notify({ type: 'error', message: 'O preço deve ser entre R$ 50,00 e R$ 100.000,00.' });
        return;
      }
      if (!state.createNegForm.buyerFound) {
        notify({ type: 'error', message: 'Busque e confirme o comprador antes de criar.' });
        return;
      }
      if (requiresImages) {
        const count = state.createNegForm.productPhotos.length;
        if (count < minImages) {
          notify({ type: 'error', message: `Adicione pelo menos ${minImages} imagem(ns).` });
          return;
        }
        if (maxImages && count > maxImages) {
          notify({ type: 'error', message: `Máximo de ${maxImages} imagens.` });
          return;
        }
      }

      if (allowsPhotos) {
        const count = state.createNegForm.productPhotos.length;
        if (count > maxAllowedPhotos) {
          notify({ type: 'error', message: `Máximo de ${maxAllowedPhotos} imagens.` });
          return;
        }
      }
      if (!values.terms_accepted) {
        notify({ type: 'error', message: 'Você deve aceitar os termos para continuar.' });
        return;
      }

      await withLoader(async () => {
        // Criar FormData para enviar com fotos
        const formData = new FormData();
        if (!isServiceProductFlow) {
          formData.append('title', values.title.trim());
        }
        formData.append('category', category);
        if (needsDescription && values.description?.trim()) formData.append('description', values.description.trim());
        formData.append('price', price);
        formData.append('buyer_id', String(state.createNegForm.buyerFound.id));
        formData.append('terms_accepted', '1');

        // Seller fee preference: deduct from payout vs pay separately via Pix
        const feeMode = String(state.createNegForm?.sellerFeeMode || 'deduct');
        formData.append('seller_fee_deduct_from_payout', feeMode === 'deduct' ? '1' : '0');

        if (isCurrency) {
          formData.append('digital_game', values.digital_game.trim());
          formData.append('digital_quantity', String(parsePtBrToIntUnits(values.digital_quantity)));
          formData.append('digital_platform_server', values.digital_platform_server.trim());
          formData.append('digital_delivery_method', values.digital_delivery_method);

          // Campos específicos do fluxo de gold/moedas (backend espera gold_*).
          formData.append('gold_seller_delivery_method', values.digital_delivery_method);
          const sellerTimesRaw = values['gold_seller_time_options[]'] ?? values.gold_seller_time_options;
          const sellerTimes = normalizeTimeOptions(sellerTimesRaw, 3);
          sellerTimes.forEach((t) => formData.append('gold_seller_time_options[]', t));
        }

        if (isServiceProductFlow) {
          const serviceId = String(values.service_id || state.createNegForm?.serviceId || state.createNegForm?.service_id || '').trim();
          const gameId = String(values.game_id || state.createNegForm?.gameId || state.createNegForm?.game_id || '').trim();
          if (serviceId) formData.append('service_id', serviceId);
          if (gameId) formData.append('game_id', gameId);

          const fields = (state.createNegForm?.serviceFields && typeof state.createNegForm.serviceFields === 'object')
            ? state.createNegForm.serviceFields
            : {};
          formData.append('service_fields', JSON.stringify(fields));
        }

        if (isService) {
          const rawDates = values['service_seller_start_date_options[]'] ?? values.service_seller_start_date_options;
          const dates = normalizeDateOptions(rawDates, 3);
          dates.forEach((d) => formData.append('service_seller_start_date_options[]', d));

          const startsRaw = values['service_seller_time_range_start[]'] ?? values.service_seller_time_range_start;
          const endsRaw = values['service_seller_time_range_end[]'] ?? values.service_seller_time_range_end;
          const starts = Array.isArray(startsRaw) ? startsRaw : (startsRaw ? [startsRaw] : []);
          const ends = Array.isArray(endsRaw) ? endsRaw : (endsRaw ? [endsRaw] : []);
          const ranges = [];
          for (let i = 0; i < Math.max(starts.length, ends.length); i += 1) {
            const a = String(starts[i] || '').trim();
            const b = String(ends[i] || '').trim();
            if (!a || !b) continue;
            ranges.push(`${a}-${b}`);
          }
          const normalizedRanges = normalizeTimeRangeOptions(ranges, 3);
          normalizedRanges.forEach((r) => formData.append('service_seller_time_range_options[]', r));
        }

        if (isKeyDlc || isService || isServiceExchange) {
          formData.append('delivery_days', String(parseInt(values.delivery_days || '0', 10) || 0));
        }

        if (isSkin || isItem) {
          formData.append('game_title', values.game_title.trim());
        }

        if (isItem) {
          formData.append('item_name', values.item_name.trim());
          formData.append('item_general_info', values.item_general_info.trim());
        }

        if (isGameAccount) {
          const linkedProviders = normalizeCheckboxArray(values['game_account_linked_providers[]'] ?? values.game_account_linked_providers);

          const gameType = String(values.game_account_type ?? '').trim();
          const gameName = String(values.game_account_game ?? '').trim();
          const platform = String(values.game_account_platform ?? '').trim();

          if (gameType) formData.append('game_account_type', gameType);
          if (platform) formData.append('game_account_platform', platform);
          if (gameName) formData.append('game_account_game', capitalizeFirstPtBr(gameName));

          if (values.game_account_can_change_credentials !== undefined) {
            formData.append('game_account_can_change_credentials', String(values.game_account_can_change_credentials));
          }
          if (values.game_account_punishment_history !== undefined) {
            formData.append('game_account_punishment_history', String(values.game_account_punishment_history));
          }
          formData.append('game_account_first_owner', String(values.game_account_first_owner));
          formData.append('game_account_has_original_email', String(values.game_account_has_original_email));
          linkedProviders.forEach((item) => formData.append('game_account_linked_providers[]', item));

          // Append all dynamic universal fields (ga_* / ts_*)
          try {
            for (const [k, v] of Object.entries(values || {})) {
              const key = String(k || '');
              if (!key.startsWith('ga_') && !key.startsWith('ts_')) continue;
              if (v === undefined || v === null) continue;
              if (Array.isArray(v)) {
                formData.append(key, JSON.stringify(v));
              } else {
                formData.append(key, String(v));
              }
            }
          } catch { /* ignore */ }

          // Exclusive items metadata + images
          const hasExclusive = String(values.ga_has_exclusive_items ?? '').trim();
          if (hasExclusive === '1') {
            const items = Array.isArray(state.createNegForm?.exclusiveItems) ? state.createNegForm.exclusiveItems : [];
            const withImages = Array.isArray(items) ? items.filter((it) => Boolean(it && it.file)) : [];
            const meta = withImages.map((it) => ({
              type: String(it?.type || '').trim(),
              name: String(it?.name || '').trim(),
              rarity: String(it?.rarity || '').trim(),
              description: String(it?.description || '').trim(),
            }));
            formData.append('exclusive_items', JSON.stringify(meta));
            withImages.forEach((it, idx) => {
              if (it?.file) formData.append(`exclusive_item_images[${idx}]`, it.file);
            });
          }
        }
        
        if (allowsPhotos && state.createNegForm.productPhotos.length > 0) {
          state.createNegForm.productPhotos.forEach((photo, idx) => {
            formData.append(`photos[${idx}]`, photo.file);
          });
        }

        // Append proof images (evidence) if present
        if (Array.isArray(state.createNegForm.proofImages) && state.createNegForm.proofImages.length > 0) {
          state.createNegForm.proofImages.forEach((p, idx) => {
            if (p && p.file) formData.append(`proof_images[${idx}]`, p.file);
          });
        }

        // Entrega: para conta de jogo, sempre enviar um texto (padrão se vazio)
        const deliverableValue = isGameAccount
          ? (String(values.what_will_be_delivered || '').trim() || 'Acesso à conta (login e senha) + instruções para troca de credenciais.')
          : String(values.what_will_be_delivered || '').trim();
        if (deliverableValue) {
          formData.append('what_will_be_delivered', deliverableValue);
        }

        await apiCall('/intermediation', {
          method: 'POST',
          body: formData,
          isFormData: true
        });

        try {
          const currentPhotos = Array.isArray(state.createNegForm?.productPhotos) ? state.createNegForm.productPhotos : [];
          currentPhotos.forEach((p) => {
            if (p?.preview) {
              try { URL.revokeObjectURL(p.preview); } catch { /* ignore */ }
            }
          });
        } catch {
          // ignore
        }
        
        notify({ type: 'success', message: 'Negociação criada com sucesso!' });
        setState({ 
          showCreateNegotiationModal: false,
          showCreateTerms: false,
          showCreateFeeGuide: false,
          createNegStep: 1,
          createNegForm: {
            buyerFound: null,
            buyerSearching: false,
            productPhotos: [],
            photoError: null,
            title: '',
            category: '',
            negotiationType: '',
            sellerFeeMode: 'deduct',
            deliveryDays: '',
            digitalGame: '',
            digitalQuantity: '',
            digitalPlatformServer: '',
            digitalDeliveryMethod: '',
            description: '',
            price: '',
            buyerTag: '',
            game_account_type: '',
            game_account_game_other: '',
            game_account_can_change_credentials: '',
            game_account_punishment_history: '',
            what_will_be_delivered: '',
            proofImages: [],
            exclusiveItems: []
          }
        });
        await loadNegotiations({ force: true });
      }, 'Criando negociação...');
    },

    async submitGameAccountChangeRequest({ values, dataset }) {
      const id = Number(dataset?.id);
      if (!id) return;

      const manualText = String(values.game_account_buyer_change_request || '').trim();
      const buyerNewEmail = String(values.buyer_new_email || '').trim();
      const buyerContactPhone = normalizePhoneDd9(values.buyer_contact_phone);
      const buyerAvailabilityMinutes = String(values.buyer_availability_minutes || '').trim();
      const buyerAvailabilityNow = String(values.buyer_availability_now || '').trim();
      const buyerNotes = String(values.buyer_notes || '').trim();

      if (!buyerContactPhone) {
        notify({ type: 'error', message: 'Informe o contato direto no formato 19-99999-9999.' });
        return;
      }

      const requestText = manualText || (() => {
        const lines = [];
        if (buyerNewEmail) lines.push(`Novo e-mail: ${buyerNewEmail}`);
        lines.push('Senha: o sistema deve gerar uma senha aleatória e o comprador vai alterar no primeiro acesso.');
        if (buyerContactPhone) lines.push(`Contato direto (WhatsApp): ${buyerContactPhone}`);
        if (buyerAvailabilityNow) {
          lines.push(`Disponível para confirmar e-mail agora: ${buyerAvailabilityNow}${buyerAvailabilityMinutes ? ` (próximos ${buyerAvailabilityMinutes} min)` : ''}`);
        } else if (buyerAvailabilityMinutes) {
          lines.push(`Disponibilidade (próximos): ${buyerAvailabilityMinutes} min`);
        }
        if (buyerNotes) lines.push(`Observações: ${buyerNotes}`);
        return lines.join('\n');
      })();

      if (requestText.length < 10) {
        notify({ type: 'error', message: 'Preencha os dados (mínimo 10 caracteres).' });
        return;
      }

      await withLoader(async () => {
        await apiCall(`/intermediation/${id}/game-account/change-request`, {
          method: 'POST',
          body: { game_account_buyer_change_request: requestText }
        });
        notify({ type: 'success', message: 'Dados enviados com sucesso.' });
        await loadNegotiation(id);
        await loadNegotiations({ force: true });
      }, 'Enviando dados...');
    },

    async submitGameAccountSellerInfo({ values, dataset }) {
      const id = Number(dataset?.id);
      if (!id) return;

      const manualText = String(values.game_account_seller_info || '').trim();
      const login = String(values.seller_account_login || '').trim();
      const password = String(values.seller_account_password || '').trim();
      const email = String(values.seller_account_email || '').trim();
      const emailPassword = String(values.seller_email_password || '').trim();
      const twoFa = String(values.seller_2fa_removed || '').trim();
      const contactPhone = normalizePhoneDd9(values.seller_contact_phone);
      const onlineNow = String(values.seller_online_now || '').trim();
      const notes = String(values.seller_notes || '').trim();

      if (!contactPhone) {
        notify({ type: 'error', message: 'Informe o contato direto no formato 19-99999-9999.' });
        return;
      }

      const sellerInfo = manualText || (() => {
        const lines = [];
        if (login) lines.push(`Login: ${login}`);
        if (password) lines.push(`Senha: ${password}`);
        if (email) lines.push(`E-mail vinculado: ${email}`);
        if (emailPassword) lines.push(`Senha do e-mail: ${emailPassword}`);
        if (twoFa) {
          const label = ({ removed: 'Removida/desativada', not_removed: 'Não removida', unknown: 'Não sei' }[twoFa] || twoFa);
          lines.push(`2FA: ${label}`);
        }
        if (contactPhone) lines.push(`Contato direto (WhatsApp): ${contactPhone}`);
        if (onlineNow) lines.push(`Online agora: ${onlineNow}`);
        if (notes) lines.push(`Observações: ${notes}`);
        return lines.join('\n');
      })();

      if (sellerInfo.length < 10) {
        notify({ type: 'error', message: 'Preencha os dados (mínimo 10 caracteres).' });
        return;
      }

      const deductFromForm = values.seller_fee_deduct_from_payout;
      const deduct = (deductFromForm === undefined || deductFromForm === null || deductFromForm === '')
        ? Boolean(state.currentNegotiation?.seller_fee_deduct_from_payout)
        : Boolean(deductFromForm && deductFromForm !== '0' && deductFromForm !== 'false');

      await withLoader(async () => {
        await apiCall(`/intermediation/${id}/game-account/seller-info`, {
          method: 'POST',
          body: { game_account_seller_info: sellerInfo, seller_fee_deduct_from_payout: deduct }
        });
        notify({ type: 'success', message: 'Dados enviados com sucesso.' });
        await loadNegotiation(id);
        await loadNegotiations({ force: true });
      }, 'Enviando dados...');
    },

    setBuyerAvailabilityNow({ element }) {
      const form = element?.closest?.('form');
      if (!form) return;
      const input = form.querySelector('input[name="buyer_availability_now"]');
      const preview = form.querySelector('[data-availability-preview]');
      const now = new Date();
      const text = now.toLocaleString('pt-BR');
      if (input) input.value = text;
      if (preview) preview.textContent = `Marcado: ${text}`;
    },

    setSellerOnlineNow({ element }) {
      const form = element?.closest?.('form');
      if (!form) return;
      const input = form.querySelector('input[name="seller_online_now"]');
      const preview = form.querySelector('[data-seller-online-preview]');
      const now = new Date();
      const text = now.toLocaleString('pt-BR');
      if (input) input.value = text;
      if (preview) preview.textContent = `Marcado: ${text}`;
    },

    async submitDigitalDeliveryInfo({ values, dataset }) {
      const id = Number(dataset?.id);
      if (!id) return;
      const info = String(values.digital_delivery_info || '').trim();
      if (info.length < 5) {
        notify({ type: 'error', message: 'Detalhe melhor os dados (mínimo 5 caracteres).' });
        return;
      }

      await withLoader(async () => {
        await apiCall(`/intermediation/${id}/digital/seller-info`, {
          method: 'POST',
          body: { digital_delivery_info: info }
        });
        notify({ type: 'success', message: 'Dados enviados com sucesso.' });
        await loadNegotiation(id);
        await loadNegotiations({ force: true });
      }, 'Enviando dados...');
    },

    async adminMarkDigitalDelivered({ dataset }) {
      const id = Number(dataset?.id);
      if (!id) return;
      if (!isAdmin()) {
        notify({ type: 'error', message: 'Apenas a intermediadora pode marcar.' });
        return;
      }
      if (!confirm('Marcar como entrega digital concluída?')) return;
      await withLoader(async () => {
        await apiCall(`/intermediation/${id}/digital/delivered`, { method: 'POST', body: {} });
        notify({ type: 'success', message: 'Entrega digital marcada como concluída.' });
        await Promise.all([loadNegotiation(id), loadNegotiations({ force: true })]);
        if (isAdmin()) {
          await loadAdminSnapshot({ force: true });
        }
      }, 'Atualizando status...');
    },
    openNegotiation({ dataset }) {
      const id = Number(dataset?.id);
      if (!id) return;
      navigate('negotiation-detail', { negotiationId: id });
    },
    openPendingModal() {
      togglePendingModal(true);
    },
    closePendingModal() {
      togglePendingModal(false);
    },
    selectPendingFilter({ element }) {
      if (!element) return;
      const nextFilter = element.value;
      // Alguns navegadores/handlers podem disparar evento ao apenas abrir o select.
      // Não recarrega se o filtro não mudou.
      if (!nextFilter || nextFilter === state.pendingFilter) return;
      loadPendingNotices({ filter: nextFilter, force: true });
    },
    adminSelectTab({ dataset }) {
      const tab = dataset?.tab;
      if (!tab) return;
      setState({ adminTab: tab });
      if ((tab === 'users' || tab === 'concluded') && (!state.adminUsers.length || !state.adminNegotiations.length)) {
        loadAdminSnapshot({ force: true });
      }
    },
    adminOpenUserDetails({ dataset }) {
      const id = Number(dataset?.id);
      if (!id) return;
      const users = Array.isArray(state.adminUsers) ? state.adminUsers : [];
      const user = users.find((u) => Number(u?.id) === id);
      if (!user) {
        notify({ type: 'error', message: 'Usuário não encontrado na lista.' });
        return;
      }
      setState({ adminUserDetails: user, showAdminUserDetailsModal: true });
    },
    closeAdminUserDetails() {
      setState({ showAdminUserDetailsModal: false, adminUserDetails: null });
    },
    adminSelectNegotiationsView({ dataset }) {
      const view = dataset?.view;
      if (view !== 'active' && view !== 'concluded') return;
      setState({ adminNegotiationsView: view, adminNegotiationsPage: 1 });
    },
    adminNegotiationsPrevPage() {
      const page = Math.max(1, Number(state.adminNegotiationsPage) || 1);
      setState({ adminNegotiationsPage: Math.max(1, page - 1) });
    },
    adminNegotiationsNextPage() {
      const list = Array.isArray(state.adminNegotiations) ? state.adminNegotiations : [];
      const { active, concluded } = splitAdminNegotiations(list);
      const viewList = concluded;
      const pageSize = Math.max(1, Number(state.adminNegotiationsPageSize) || 10);
      const totalPages = Math.max(1, Math.ceil(viewList.length / pageSize));
      const page = Math.min(Math.max(1, Number(state.adminNegotiationsPage) || 1), totalPages);
      setState({ adminNegotiationsPage: Math.min(totalPages, page + 1) });
    },
    adminRefresh() {
      loadAdminSnapshot({ force: true });
    },
    // Intermediator actions
    intermediatorSelectTab({ dataset }) {
      const tab = dataset?.tab;
      if (!tab) return;
      setState({ intermediatorTab: tab, intermediatorPage: 1 });
      if (!state.intermediatorMine.length && !state.intermediatorAvailable.length && !state.intermediatorAll?.length) {
        loadIntermediatorData({ force: true });
      }
    },
    intermediatorPrevPage() {
      const page = Math.max(1, Number(state.intermediatorPage) || 1);
      setState({ intermediatorPage: Math.max(1, page - 1) });
    },
    intermediatorNextPage() {
      const page = Math.max(1, Number(state.intermediatorPage) || 1);
      setState({ intermediatorPage: page + 1 });
    },
    intermediatorRefresh() {
      loadIntermediatorData({ force: true });
    },
    intermediatorAssign({ dataset }) {
      const id = dataset?.id;
      if (!id) return;
      intermediatorAssign(id);
    },
    intermediatorUnassign({ dataset }) {
      const id = dataset?.id;
      if (!id) return;
      intermediatorUnassign(id);
    },
    adminApproveNegotiation({ dataset }) {
      adminApprove(dataset?.id);
    },
    adminRejectNegotiation({ dataset }) {
      adminReject(dataset?.id);
    },
    adminDeleteNegotiation({ dataset }) {
      adminDeleteNegotiation(dataset?.id);
    },
    adminOpenNegotiation({ dataset }) {
      openNegotiationDetail(dataset?.id);
    },
    async acceptNegotiation({ dataset, values }) {
      const id = Number(dataset?.id);
      if (!id) return;

      const hasValues = values && typeof values === 'object';
      const toBool = (value) => ['1', 'true', 'on', 'sim', 'yes'].includes(String(value || '').trim().toLowerCase());

      const resolveNegotiation = async () => {
        if (state.currentNegotiation && Number(state.currentNegotiation.id) === id) {
          return state.currentNegotiation;
        }
        const data = await apiCall(`/intermediation/${id}`);
        return data?.data || data;
      };

      const normalizeTimes = (raw) => {
        const asArray = Array.isArray(raw) ? raw : raw ? [raw] : [];
        return asArray
          .map((v) => String(v || '').trim())
          .filter(Boolean)
          .slice(0, 3);
      };

      let category = '';
      try {
        const neg = await resolveNegotiation();
        category = String(neg?.category || '').trim();
      } catch (error) {
        console.warn('Falha ao carregar negociação antes do aceite:', error);
      }

      const isCurrencyCategory = category === CATEGORY_CURRENCY;
      const isServiceCategory = isServiceTaxonomyCategory(category) || category === CATEGORY_SERVICE;
      const requiresServiceSchedule = isServiceScheduleCategory(category);
      const isAccountCategory = category === CATEGORY_GAME_ACCOUNT;
      const isKeyDlcCategory = category === CATEGORY_KEY_DLC;
      const isBoostRankCategory = category === CATEGORY_BOOST_RANK;
      const isCarryPveCategory = category === CATEGORY_CARRY_PVE;
      const isLevelingCategory = category === CATEGORY_LEVELING;
      const isCollectiblesCategory = category === CATEGORY_COLLECTIBLES;
      const isSeasonalCategory = category === CATEGORY_SEASONAL;
      const isCustomCategory = category === CATEGORY_CUSTOM_SERVICE;
      const isServiceExchangeCategory = category === CATEGORY_SERVICE_EXCHANGE;

      if (!hasValues) {
        // If the user clicked "accept" from a list/card (no form), some categories
        // require extra inputs in the detail page.
        if (isCurrencyCategory) {
          openNegotiationDetail(id);
          notify({ type: 'error', message: 'Para aceitar, preencha os dados (personagem/servidor/facção) e selecione um horário no detalhe da negociação.' });
          return;
        }
        if (isServiceCategory && requiresServiceSchedule) {
          openNegotiationDetail(id);
          notify({ type: 'error', message: 'Para aceitar, selecione a data de início e o intervalo de horário no detalhe da negociação.' });
          return;
        }

        openNegotiationDetail(id);
        notify({ type: 'error', message: 'Para aceitar, revise o resumo e confirme as informações obrigatórias no detalhe da negociação.' });
        return;
      }

      const buyerTimes = (hasValues && isCurrencyCategory)
        ? normalizeTimes(values['gold_buyer_time_options[]'] ?? values.gold_buyer_time_options)
        : [];

      const extractPrefixed = (prefix) => {
        if (!hasValues) return {};
        const output = {};
        const prefixKey = `${prefix}[`;
        Object.entries(values).forEach(([key, value]) => {
          if (!key.startsWith(prefixKey) || !key.endsWith(']')) return;
          const inner = key.slice(prefixKey.length, -1);
          if (!inner) return;
          output[inner] = Array.isArray(value)
            ? value.map((v) => String(v || '').trim()).filter(Boolean)
            : String(value || '').trim();
        });
        return output;
      };

      const buyerInviteInputs = extractPrefixed('buyer_invite_inputs');
      const buyerInviteConfirmations = extractPrefixed('buyer_invite_confirmations');
      const buyerInviteAvailability = extractPrefixed('buyer_invite_availability');
      const buyerInviteAccess = extractPrefixed('buyer_invite_access');
      const buyerInviteProofs = extractPrefixed('buyer_invite_proofs');
      const buyerInviteNotes = hasValues ? String(values.buyer_invite_notes || '').trim() : '';

      const payload = {};
      if (hasValues && isCurrencyCategory) {
        payload.gold_buyer_character_name = toTitleCasePtBr(String(values.gold_buyer_character_name || '').trim());
        payload.gold_buyer_server = toTitleCasePtBr(String(values.gold_buyer_server || '').trim());
        payload.gold_buyer_faction = toTitleCasePtBr(String(values.gold_buyer_faction || '').trim());
        payload.gold_buyer_notes = String(values.gold_buyer_notes || '').trim() || null;
        payload.gold_buyer_time_options = buyerTimes;
      }
      if (hasValues && isServiceCategory && requiresServiceSchedule) {
        payload.service_buyer_selected_start_date = String(values.service_buyer_selected_start_date || '').trim();
        payload.service_buyer_selected_time_range = String(values.service_buyer_selected_time_range || '').trim();
      }
      if (hasValues) {
        payload.buyer_invite_inputs = buyerInviteInputs;
        payload.buyer_invite_confirmations = buyerInviteConfirmations;
        if (Object.keys(buyerInviteAvailability).length) payload.buyer_invite_availability = buyerInviteAvailability;
        if (Object.keys(buyerInviteAccess).length) payload.buyer_invite_access = buyerInviteAccess;
        if (Object.keys(buyerInviteProofs).length) payload.buyer_invite_proofs = buyerInviteProofs;
        if (buyerInviteNotes) payload.buyer_invite_notes = buyerInviteNotes;
      }

      if (hasValues && isCurrencyCategory) {
        if (!payload.gold_buyer_character_name) {
          notify({ type: 'error', message: 'Informe o nome do personagem.' });
          return;
        }
        if (!payload.gold_buyer_server) {
          notify({ type: 'error', message: 'Informe o servidor.' });
          return;
        }
        if (!payload.gold_buyer_faction) {
          notify({ type: 'error', message: 'Informe a facção.' });
          return;
        }
        if (!payload.gold_buyer_time_options?.length) {
          notify({ type: 'error', message: 'Informe pelo menos 1 horário disponível (máx 3).' });
          return;
        }
      }

      const selectedSellerTime = (hasValues && isCurrencyCategory)
        ? String(values.gold_buyer_selected_time || '').trim()
        : '';

      // If the buyer didn't select a seller time, treat as a suggestion via buyer time options/notes.

      if (hasValues && isServiceCategory && requiresServiceSchedule) {
        if (!payload.service_buyer_selected_start_date) {
          notify({ type: 'error', message: 'Escolha 1 data de início.' });
          return;
        }
        if (!payload.service_buyer_selected_time_range) {
          notify({ type: 'error', message: 'Escolha 1 intervalo de horário.' });
          return;
        }
      }

      if (hasValues) {
        const confirmScope = toBool(buyerInviteConfirmations.scope);
        const confirmDeadline = toBool(buyerInviteConfirmations.deadline);
        const confirmTerms = toBool(buyerInviteConfirmations.terms);
        if (!confirmScope || !confirmDeadline || !confirmTerms) {
          notify({ type: 'error', message: 'Confirme o escopo, prazo e termos da plataforma.' });
          return;
        }

        if (isAccountCategory) {
          if (!toBool(buyerInviteConfirmations.account_recovery) || !toBool(buyerInviteConfirmations.description) || !toBool(buyerInviteConfirmations.proofs)) {
            notify({ type: 'error', message: 'Confirme recuperação de conta, descrição e provas.' });
            return;
          }
        }

        if (isKeyDlcCategory) {
          if (!toBool(buyerInviteConfirmations.platform_compatible) || !toBool(buyerInviteConfirmations.region_compatible)) {
            notify({ type: 'error', message: 'Confirme plataforma e região compatíveis.' });
            return;
          }
        }

        const getBuyerInput = (key) => String(buyerInviteInputs[key] || '').trim();
        const rngHasChance = ['sim', 'true', '1', 'yes'].includes(String(buyerInviteInputs.rng_has_chance || '').toLowerCase());

        if (isBoostRankCategory) {
          if (!getBuyerInput('rank_current_confirmed') || !getBuyerInput('class_character') || !getBuyerInput('availability')) {
            notify({ type: 'error', message: 'Preencha rank atual, classe/personagem e disponibilidade.' });
            return;
          }
        }

        if (isCarryPveCategory) {
          if (!getBuyerInput('class_role') || !getBuyerInput('character_level') || !getBuyerInput('experience') || !getBuyerInput('availability')) {
            notify({ type: 'error', message: 'Preencha classe/role, nível, experiência e disponibilidade.' });
            return;
          }
        }

        if (isLevelingCategory) {
          if (!getBuyerInput('class_character') || !getBuyerInput('availability')) {
            notify({ type: 'error', message: 'Preencha classe/personagem e disponibilidade.' });
            return;
          }
        }

        if (isCollectiblesCategory) {
          if (!getBuyerInput('already_have') || !getBuyerInput('character_used') || !getBuyerInput('availability')) {
            notify({ type: 'error', message: 'Preencha o que já possui, personagem usado e disponibilidade.' });
            return;
          }
          if (rngHasChance && (!getBuyerInput('rng_attempts') || !getBuyerInput('rng_policy'))) {
            notify({ type: 'error', message: 'Informe tentativas e política caso não drope.' });
            return;
          }
          if (rngHasChance && !toBool(buyerInviteConfirmations.rng)) {
            notify({ type: 'error', message: 'Confirme a política de RNG.' });
            return;
          }
        }

        if (isSeasonalCategory) {
          if (!getBuyerInput('goals') || !getBuyerInput('frequency')) {
            notify({ type: 'error', message: 'Preencha metas desejadas e frequência de jogo.' });
            return;
          }
        }

        if (isCustomCategory) {
          if (!getBuyerInput('objective_detail') || !getBuyerInput('availability')) {
            notify({ type: 'error', message: 'Descreva o objetivo e informe disponibilidade.' });
            return;
          }
        }

        if (isServiceExchangeCategory) {
          if (!getBuyerInput('offered_service') || !getBuyerInput('availability')) {
            notify({ type: 'error', message: 'Informe o serviço oferecido e disponibilidade.' });
            return;
          }
        }
      }

      await withLoader(async () => {
        await apiCall(`/intermediation/${id}/approve`, { method: 'POST', body: payload });

        if (hasValues && isCurrencyCategory && selectedSellerTime) {
          await apiCall(`/intermediation/${id}/gold/confirm-schedule`, {
            method: 'POST',
            body: { gold_buyer_selected_time: selectedSellerTime }
          });
        }

        notify({ type: 'success', message: 'Negociação aceita! Aguarde as próximas etapas.' });
        await loadNegotiation(id);
        await loadNegotiations({ force: true });
      }, 'Aceitando negociação...');
    },

    toggleBuyerGoldRescheduleForm() {
      setState({ showBuyerGoldRescheduleForm: !state.showBuyerGoldRescheduleForm });
    },

    toggleSellerGoldScheduleForm() {
      setState({ showSellerGoldScheduleForm: !state.showSellerGoldScheduleForm });
    },

    async submitSellerGoldSchedule({ dataset, values }) {
      const id = Number(dataset?.id);
      if (!id) return;

      const normalizeTimes = (raw) => {
        const asArray = Array.isArray(raw) ? raw : raw ? [raw] : [];
        return asArray
          .map((v) => String(v || '').trim())
          .filter(Boolean)
          .slice(0, 3);
      };

      const rawTimes = values?.['gold_seller_time_options[]'] ?? values?.gold_seller_time_options;
      const times = normalizeTimes(rawTimes);
      const method = String(values?.gold_seller_delivery_method || '').trim();

      if (!times.length) {
        notify({ type: 'error', message: 'Informe pelo menos 1 horário (até 3).' });
        return;
      }
      if (!['trade', 'mail', 'gift'].includes(method)) {
        notify({ type: 'error', message: 'Selecione o método de entrega.' });
        return;
      }

      await withLoader(async () => {
        await apiCall(`/intermediation/${id}/gold/seller-info`, {
          method: 'POST',
          body: {
            gold_seller_time_options: times,
            gold_seller_delivery_method: method,
          }
        });
        notify({ type: 'success', message: 'Horário/método atualizados.' });
        setState({ showSellerGoldScheduleForm: false });
        await loadNegotiation(id, { silent: true });
        await loadNegotiations({ force: true, silent: true });
      }, 'Salvando horário...');
    },

    async sellerConfirmGoldSent({ dataset }) {
      const id = Number(dataset?.id);
      if (!id) return;
      if (!confirm('Confirma que a entrega foi realizada?')) return;
      await withLoader(async () => {
        await apiCall(`/intermediation/${id}/gold/seller-confirm-sent`, { method: 'POST', body: {} });
        notify({ type: 'success', message: 'Confirmação registrada.' });
        await loadNegotiation(id, { silent: true });
        await loadNegotiations({ force: true, silent: true });
      }, 'Confirmando entrega...');
    },

    async submitBuyerGoldReschedule({ dataset, values }) {
      const id = Number(dataset?.id);
      if (!id) return;
      const time = String(values?.gold_buyer_new_time || '').trim();
      if (!time) {
        notify({ type: 'error', message: 'Informe 1 horário.' });
        return;
      }

      await withLoader(async () => {
        await apiCall(`/intermediation/${id}/gold/buyer-reschedule`, {
          method: 'POST',
          body: {
            gold_buyer_reschedule_request: `Novo horário sugerido: ${time}`
          }
        });
        notify({ type: 'success', message: 'Novo horário enviado.' });
        setState({ showBuyerGoldRescheduleForm: false });
        await loadNegotiation(id, { silent: true });
        await loadNegotiations({ force: true, silent: true });
      }, 'Enviando novo horário...');
    },

    async buyerConfirmGoldReceived({ dataset }) {
      const id = Number(dataset?.id);
      if (!id) return;
      if (!confirm('Confirma que você recebeu o Gold/moedas?')) return;
      await withLoader(async () => {
        await apiCall(`/intermediation/${id}/gold/buyer-confirm-received`, { method: 'POST', body: {} });
        notify({ type: 'success', message: 'Recebimento confirmado.' });
        await loadNegotiation(id, { silent: true });
        await loadNegotiations({ force: true, silent: true });
      }, 'Confirmando recebimento...');
    },
    // Modal de rejeição do comprador
    openRejectModal({ dataset }) {
      const id = Number(dataset?.id);
      if (!id) return;
      setState({ showBuyerRejectModal: true, rejectNegotiationId: id });
    },
    closeRejectModal() {
      setState({ showBuyerRejectModal: false, rejectNegotiationId: null });
    },
    async rejectNegotiationBuyer({ values }) {
      const id = state.rejectNegotiationId;
      if (!id) return;
      if (!values.reject_reason_type) {
        notify({ type: 'error', message: 'Selecione um motivo para a recusa.' });
        return;
      }
      await withLoader(async () => {
        await apiCall(`/intermediation/${id}/buyer-reject`, {
          method: 'POST',
          body: {
            reason_type: values.reject_reason_type,
            reason_details: values.reject_details || null
          }
        });
        notify({ type: 'success', message: 'Negociação recusada.' });
        setState({ showBuyerRejectModal: false, rejectNegotiationId: null });
        await loadNegotiations({ force: true });
        navigate('dashboard');
      }, 'Recusando negociação...');
    },
    // Confirmar pagamento
    async confirmPayment({ dataset }) {
      const id = Number(dataset?.id);
      if (!id) return;
      if (!confirm('Confirma que realizou o pagamento via Pix?')) return;
      await withLoader(async () => {
        await apiCall(`/intermediation/${id}/confirm-payment`, { method: 'POST', body: {} });
        notify({ type: 'success', message: 'Pagamento registrado! Aguardando confirmação.' });
        await loadNegotiation(id);
        await loadNegotiations({ force: true });
      }, 'Confirmando pagamento...');
    },

    openConfirmPaymentProof({ dataset }) {
      const id = Number(dataset?.id);
      if (!id) return;
      setState({ confirmPaymentProofForId: id });
    },

    cancelConfirmPaymentProof() {
      setState({ confirmPaymentProofForId: null });
    },

    async confirmPaymentWithProof({ dataset, form }) {
      const id = Number(dataset?.id);
      if (!id) return;
      if (!confirm('Confirma que realizou o pagamento via Pix?')) return;

      const formEl = form;
      const fileInput = formEl instanceof HTMLFormElement ? formEl.querySelector('input[name="payment_proof"]') : null;
      const file = fileInput instanceof HTMLInputElement ? (fileInput.files?.[0] || null) : null;

      await withLoader(async () => {
        const formData = new FormData();
        if (file) {
          formData.append('payment_proof', file);
        }
        await apiCall(`/intermediation/${id}/confirm-payment`, { method: 'POST', body: formData, isFormData: true });
        notify({ type: 'success', message: 'Pagamento registrado! Aguardando confirmação.' });
        setState({ confirmPaymentProofForId: null });
        await loadNegotiation(id);
        await loadNegotiations({ force: true });
      }, 'Confirmando pagamento...');
    },
    async adminSimulatePayment({ dataset }) {
      const id = Number(dataset?.id);
      if (!id) return;
      if (!isAdmin()) {
        notify({ type: 'error', message: 'Apenas a intermediadora pode simular.' });
        return;
      }
      if (!confirm('Simular confirmação de pagamento? Isso muda o status para "Aguardando envio".')) return;
      await withLoader(async () => {
        await apiCall(`/intermediation/${id}/confirm-payment`, { method: 'POST', body: {} });
        notify({ type: 'success', message: 'Pagamento simulado. Status atualizado.' });
        await Promise.all([loadNegotiations({ force: true }), loadAdminSnapshot({ force: true })]);
        if (state.currentNegotiation?.id === id) {
          await loadNegotiation(id);
        }
      }, 'Simulando pagamento...');
    },
    // Relatório de inspeção
    editInspectionReport({ dataset }) {
      const neg = state.currentNegotiation;
      if (!neg) return;
      const report = neg.inspection_report || {};
      setState({
        inspectionReport: {
          photos: report.photos || [],
          checklist: report.checklist || {},
          notes: report.notes || '',
          editing: true
        }
      });
    },
    cancelEditInspectionReport() {
      setState({
        inspectionReport: { photos: [], checklist: {}, notes: '', editing: false }
      });
    },
    addInspectionPhoto({ element }) {
      const file = element?.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        notify({ type: 'error', message: 'Apenas imagens são permitidas.' });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        notify({ type: 'error', message: 'Imagem muito grande. Máximo 5MB.' });
        return;
      }
      const currentPhotos = [...state.inspectionReport.photos];
      if (currentPhotos.length >= 3) {
        notify({ type: 'error', message: 'Máximo de 3 fotos.' });
        return;
      }
      const preview = URL.createObjectURL(file);
      currentPhotos.push({ file, preview });
      setState({ inspectionReport: { ...state.inspectionReport, photos: currentPhotos } });
      element.value = '';
    },
    removeInspectionPhoto({ dataset }) {
      const index = Number(dataset?.index);
      const currentPhotos = [...state.inspectionReport.photos];
      if (currentPhotos[index]?.preview) {
        URL.revokeObjectURL(currentPhotos[index].preview);
      }
      currentPhotos.splice(index, 1);
      setState({ inspectionReport: { ...state.inspectionReport, photos: currentPhotos } });
    },
    async saveInspectionReport({ values, dataset }) {
      const id = Number(dataset?.id);
      if (!id) return;
      
      // Montar checklist
      const checklist = {};
      INSPECTION_CHECKLIST.forEach(item => {
        checklist[item.id] = !!values[`checklist_${item.id}`];
      });
      
      await withLoader(async () => {
        const formData = new FormData();
        formData.append('checklist', JSON.stringify(checklist));
        formData.append('notes', values.inspection_notes || '');
        
        state.inspectionReport.photos.forEach((photo, idx) => {
          if (photo.file) {
            formData.append(`photos[${idx}]`, photo.file);
          }
        });

        await apiCall(`/intermediation/${id}/inspection-report`, {
          method: 'POST',
          body: formData,
          isFormData: true
        });
        
        notify({ type: 'success', message: 'Relatório salvo com sucesso!' });
        setState({ inspectionReport: { photos: [], checklist: {}, notes: '', editing: false } });
        await loadNegotiation(id);
      }, 'Salvando relatório...');
    },
    // Sistema de logs
    async submitInternalLog({ values, dataset }) {
      const id = Number(dataset?.id);
      if (!id) return;
      if (!values.log_message?.trim()) {
        notify({ type: 'error', message: 'Digite uma mensagem.' });
        return;
      }
      await withLoader(async () => {
        await apiCall(`/intermediation/${id}/logs`, {
          method: 'POST',
          body: {
            message: values.log_message.trim(),
            type: values.log_type || 'note'
          }
        });
        notify({ type: 'success', message: 'Log adicionado.' });
        await loadNegotiation(id);
      }, 'Adicionando log...');
    },
    async adminCreateInvitation({ form, values }) {
      if (!canManageUsers()) return;
      await withLoader(async () => {
        await apiCall('/admin/users', { method: 'POST', body: values });
        if (form) form.reset();
        notify({ type: 'success', message: 'Usuário criado com sucesso.' });
        await loadAdminSnapshot({ force: true });
      }, 'Criando usuário...');
    },
    async adminDeleteUser({ dataset }) {
      if (!canManageUsers()) return;
      const userId = dataset?.id;
      if (!userId) return;
      if (!confirm('Remover este usuário? (Apenas se todas as negociações estiverem ENTREGUE)')) return;
      await withLoader(async () => {
        await apiCall(`/admin/users/${userId}`, { method: 'DELETE' });
        notify({ type: 'success', message: 'Usuário removido.' });
        await loadAdminSnapshot({ force: true });
      }, 'Removendo usuário...');
    },

    async purgeNegotiationImages({ dataset }) {
      const id = Number(dataset?.id);
      if (!id) return;
      if (!confirm('Apagar todas as imagens deste pedido concluído? Esta ação não pode ser desfeita.')) return;
      await withLoader(async () => {
        const result = await apiCall(`/intermediation/${id}/purge-images`, { method: 'POST', body: {} });
        notify({ type: 'success', message: result?.message || 'Imagens apagadas.' });
        if (state.currentNegotiation?.id === id) {
          await loadNegotiation(id);
        }
        await loadNegotiations({ force: true });
        if (isAdmin()) {
          await loadAdminSnapshot({ force: true });
        }
      }, 'Apagando imagens...');
    },
    async updateTracking({ formData, dataset }) {
      const id = Number(dataset?.id);
      if (!id) return;
      const code = formData.get('tracking_code');
      if (!code) {
        notify({ type: 'error', message: 'Informe o código de rastreio.' });
        return;
      }
      const type = dataset?.type === 'buyer' ? 'buyer' : 'seller';
      await withLoader(async () => {
        const endpoint = type === 'buyer'
          ? `/intermediation/${id}/tracking/buyer`
          : `/intermediation/${id}/tracking`;
        await apiCall(endpoint, { method: 'POST', body: { tracking_code: code } });
        notify({ type: 'success', message: 'Código atualizado.' });
        await loadNegotiation(id);
        await loadNegotiations({ force: true });
        if (isAdmin()) {
          await loadAdminSnapshot({ force: true });
        }
      }, 'Atualizando rastreio...');
    },
    async approveProduct({ values, dataset }) {
      const id = Number(dataset?.id);
      if (!id) return;
      await withLoader(async () => {
        await apiCall(`/intermediation/${id}/approve`, {
          method: 'POST',
          body: {
            approved: true,
            tracking_to_buyer: values.tracking_to_buyer,
            notes: values.intermediary_notes || null,
            seller_transferred: Boolean(values.seller_transferred && values.seller_transferred !== 'false')
          }
        });
        notify({ type: 'success', message: 'Produto aprovado e envio registrado.' });
        await loadNegotiation(id);
      }, 'Enviando informações...');
    },
    rejectProduct({ dataset }) {
      rejectProductFlow(dataset?.id);
    },
    markIntermediaryReceived({ dataset }) {
      markProductReceived(dataset?.id);
    },
    buyerConfirmDelivery({ dataset }) {
      buyerConfirm(dataset?.id);
    },
    async submitBuyerFeedback({ formData, dataset }) {
      const id = Number(dataset?.id);
      if (!id) return;
      const rating = Number(formData.get('buyer_rating'));
      if (!Number.isFinite(rating) || rating < 1 || rating > 10) {
        notify({ type: 'error', message: 'Informe uma nota entre 1 e 10.' });
        return;
      }
      const comment = formData.get('buyer_rating_comment');
      await withLoader(async () => {
        await apiCall(`/intermediation/${id}/buyer-confirm`, {
          method: 'POST',
          body: {
            rating,
            comment: comment ? comment.toString().trim() : null
          }
        });
        notify({ type: 'success', message: 'Obrigado pelo feedback!' });
        await loadNegotiation(id);
      }, 'Enviando feedback...');
    },
    async submitSellerFeedback({ formData, dataset }) {
      const id = Number(dataset?.id);
      if (!id) return;
      const rating = Number(formData.get('seller_rating'));
      if (!Number.isFinite(rating) || rating < 1 || rating > 10) {
        notify({ type: 'error', message: 'Informe uma nota entre 1 e 10.' });
        return;
      }
      const comment = formData.get('seller_rating_comment');
      await withLoader(async () => {
        await apiCall(`/intermediation/${id}/seller-feedback`, {
          method: 'POST',
          body: {
            rating,
            comment: comment ? comment.toString().trim() : null
          }
        });
        notify({ type: 'success', message: 'Obrigado pelo feedback!' });
        await loadNegotiation(id);
      }, 'Enviando feedback...');
    },
    async submitIntermediaryFeedback({ formData, dataset }) {
      const id = Number(dataset?.id);
      if (!id) return;
      const rating = Number(formData.get('intermediary_rating'));
      if (!Number.isFinite(rating) || rating < 1 || rating > 10) {
        notify({ type: 'error', message: 'Informe uma nota entre 1 e 10.' });
        return;
      }
      const comment = formData.get('intermediary_rating_comment');
      await withLoader(async () => {
        await apiCall(`/intermediation/${id}/intermediary-feedback`, {
          method: 'POST',
          body: {
            rating,
            comment: comment ? comment.toString().trim() : null
          }
        });
        notify({ type: 'success', message: 'Feedback registrado.' });
        await loadNegotiation(id);
      }, 'Enviando feedback...');
    },
    finalizeNegotiation({ dataset }) {
      finalizeNegotiation(dataset?.id);
    },
    openTimeline({ dataset }) {
      openTimeline(dataset?.id);
    },
    closeTimeline() {
      closeTimeline();
    },
    openGallery({ dataset }) {
      openGallery(dataset?.id, dataset?.index, dataset?.type);
    },
    closeGallery() {
      setState({ gallery: null });
    },
    openIntermediaryReport() {
      openIntermediaryReport();
    },
    closeIntermediaryReport() {
      closeIntermediaryReport();
    },
    galleryPrev() {
      shiftGallery(-1);
    },
    galleryNext() {
      shiftGallery(1);
    },
    copyText({ dataset }) {
      copyText(dataset?.value);
    },
    openResetFromEmail({ dataset }) {
      openResetPage(dataset?.token, dataset?.email);
    }
  };

  //#endregion PART 3/3: Actions e Integração API