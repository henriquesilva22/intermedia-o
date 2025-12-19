(() => {
  'use strict';

  /*
    NAV (VS Code)
    - Ctrl+P, depois digite: @renderCreateNegotiationModal / @renderNegotiationDetailPage / @renderRegisterPage
    - Ctrl+P, depois digite: @setState / @shouldDeferRender / @hydratePaymentQrCode / @attachGlobalHandlers
    - Ctrl+P, depois digite: @actions.createNegotiation / @actions.searchBuyer / @actions.confirmPayment
    - Outline: Ctrl+Shift+O (lista de funções)
  */

  //#region PART 1/3: Constantes e Estado

  const API_BASE = 'http://127.0.0.1:8000/api';
  const STORAGE_KEYS = { token: 'token', user: 'user' };
  const AUTH_PAGES = new Set(['login', 'register', 'forgot-password', 'reset-password', 'confirm-email']);
  
  // Design Update: Labels mais descritivas
  const STATUS_LABELS = {
    awaiting_admin_approval: 'Aguardando Aprovação',
    pending_acceptance: 'Convite Pendente',
    waiting_payment: 'Pagamento Pendente',
    waiting_shipment: 'Aguardando Envio',
    shipped: 'Em Trânsito',
    at_intermediary: 'Em Análise (Intermediadora)',
    approved: 'Aprovado para Entrega',
    delivered: 'Entregue',
    rejected_by_admin: 'Reprovado',
    cancelled: 'Cancelado',
    expired: 'Expirado'
  };

  // Design Update: Cores ajustadas para melhor contraste e semântica
  const STATUS_BADGE_COLORS = {
    awaiting_admin_approval: 'bg-primary-100 text-primary-700 border border-primary-200',
    pending_acceptance: 'bg-secondary-100 text-secondary-700 border border-secondary-200',
    waiting_payment: 'bg-warning-100 text-warning-700 border border-warning-200',
    waiting_shipment: 'bg-gray-100 text-gray-700 border border-gray-200',
    shipped: 'bg-secondary-100 text-secondary-700 border border-secondary-200',
    at_intermediary: 'bg-secondary-100 text-secondary-700 border border-secondary-200',
    approved: 'bg-success-100 text-success-700 border border-success-200',
    delivered: 'bg-success-100 text-success-700 border border-success-200',
    rejected_by_admin: 'bg-danger-100 text-danger-700 border border-danger-200',
    cancelled: 'bg-danger-50 text-danger-600 border border-danger-100',
    expired: 'bg-gray-100 text-gray-600 border border-gray-200'
  };

  const STATUS_ORDER = Object.keys(STATUS_LABELS);
  const ROLE_LABELS = {
    buyer: 'Comprador',
    seller: 'Vendedor',
    admin: 'Administrador',
    inspector: 'Inspetor Técnico'
  };

  const initialToken = localStorage.getItem(STORAGE_KEYS.token) || null;
  const initialUser = safeParse(localStorage.getItem(STORAGE_KEYS.user));

  const state = {
    token: initialToken,
    user: initialUser,
    currentPage: initialToken && initialUser?.role === 'admin' ? 'admin' : (initialToken ? 'dashboard' : 'login'),
    isLoading: false,
    loadingMessage: null,
    errorMessage: null,
    successMessage: null,
    toast: null,
    negotiations: [],
    negotiationsLoadedAt: 0,
    currentNegotiation: null,
    negotiationFilters: {
      status: 'all',
      role: 'all',
      query: ''
    },
    showDashboardFiltersModal: false,
    dashboardFiltersDraft: {
      status: 'all',
      role: 'all',
      query: ''
    },
    dashboardPage: 1,
    dashboardPageSize: 6,
    pendingCount: 0,
    pendingNotices: [],
    pendingFilter: 'today',
    showPendingModal: false,
    timelineNegotiationId: null,
    timelineData: null,
    gallery: null,
    adminTab: 'negotiations',
    adminNegotiations: [],
    adminUsers: [],
    adminOverview: null,
    adminIsLoading: false,
    resetPasswordToken: null,
    resetPasswordEmail: null,
    confirmationEmail: null,
    confirmationCooldownRemaining: 0,
    showCreateNegotiationModal: false,
    showCreateTerms: false,
    filtersExpanded: false,
    registerCityFilter: '',
    registerSelectedCity: '',
    saoPauloCities: [],
    saoPauloCitiesLoading: false,
    // Estado para criação de negociação
    createNegForm: {
      buyerFound: null,
      buyerSearching: false,
      productPhotos: [],
      photoError: null,
      // Campos do formulário para preservar durante re-render
      title: '',
      category: '',
      description: '',
      price: '',
      buyerEmail: ''
    },
    // Estado para relatório do intermediador
    inspectionReport: {
      photos: [],
      checklist: {},
      notes: '',
      editing: false
    },
    // Sistema de logs
    negotiationLogs: [],
    // Modal de rejeição do comprador
    showBuyerRejectModal: false,
    rejectNegotiationId: null
  };

  //#endregion PART 1/3: Constantes e Estado

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
    'Eletrônicos & Gadgets',
    'Smartphones & Tablets',
    'Computadores & Notebooks',
    'Games & Consoles',
    'Áudio & Vídeo',
    'Câmeras & Drones',
    'Relógios de Luxo',
    'Instrumentos Musicais',
    'Colecionáveis',
    'Veículos',
    'Outros'
  ];

  const INSPECTION_CHECKLIST = [
    { id: 'original', label: 'Autenticidade Verificada' },
    { id: 'functional', label: 'Funcionamento Operacional' },
    { id: 'condition_match', label: 'Estética conforme descrito' },
    { id: 'accessories', label: 'Todos acessórios presentes' },
    { id: 'no_damage', label: 'Livre de danos estruturais' },
    { id: 'packaging', label: 'Embalagem Segura' }
  ];

  let pendingPollingHandle = null;
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
      `;
      document.head.insertBefore(criticalStyle, document.head.firstChild);
    }
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
        scheduleDeferredRender();
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
  }

  function scheduleDeferredRender(delayMs = 160) {
    if (deferredRenderHandle) {
      clearTimeout(deferredRenderHandle);
    }
    deferredRenderHandle = setTimeout(() => {
      deferredRenderHandle = null;
      render();
      updatePendingPolling();
    }, delayMs);
  }

  function shouldDeferRender(updates) {
    try {
      if (!updates || typeof updates !== 'object') return false;
      if (updates.currentPage) return false;
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

  function render() {
    const root = document.getElementById('app');
    if (!root) return;
    const preservedValues = captureUncontrolledValues(root);
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
    const content = `
      <div class="min-h-screen bg-gray-50 text-gray-800 flex flex-col">
        ${renderHeader(isAuthenticated)}
        ${renderNotifications()}
        ${isAuthenticated ? renderProtectedView() : renderPublicLayout()}
        ${renderFooter()}
      </div>
      ${renderModals()}
      ${renderToast()}
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

  function renderHeader(isAuthenticated) {
    const userName = state.user?.name || 'Visitante';
    const userRole = state.user?.role || 'user';
    const roleLabel = userRole === 'admin' ? 'Administrador' : userRole === 'seller' ? 'Vendedor' : userRole === 'buyer' ? 'Comprador' : 'Usuário';
    
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
              <nav class="hidden md:flex items-center space-x-1">
                ${isAdmin() ? `
                  <button class="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${state.currentPage === 'admin' ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:text-primary-600 hover:bg-gray-50'}" data-action="navigate" data-page="admin">
                    <i class="fas fa-shield-alt mr-2"></i> Admin
                  </button>
                  <button class="relative px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-primary-600 hover:bg-gray-50 transition-all duration-200" data-action="openPendingModal">
                    <i class="fas fa-bell mr-2"></i> Pendências
                    <span data-pending-count-badge style="display:${state.pendingCount > 0 ? '' : 'none'}" class="absolute -top-1 -right-1 w-5 h-5 bg-danger-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse">
                      <span data-pending-count-value>${state.pendingCount}</span>
                    </span>
                  </button>
                ` : `
                  <button class="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${state.currentPage === 'dashboard' ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:text-primary-600 hover:bg-gray-50'}" data-action="navigate" data-page="dashboard">
                    <i class="fas fa-th-large mr-2"></i> Dashboard
                  </button>
                `}
              </nav>

              <!-- User Menu -->
              <div class="flex items-center space-x-4">
                <div class="flex items-center space-x-3">
                  <div class="w-9 h-9 bg-gradient-to-br from-primary-500 to-secondary-400 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    ${getUserInitials(userName)}
                  </div>
                  <div class="hidden md:block text-left">
                    <p class="text-sm font-medium text-gray-900">${escapeHtml(userName)}</p>
                    <p class="text-xs text-gray-500">${roleLabel}</p>
                  </div>
                </div>
                <button class="px-4 py-2 bg-gray-100 hover:bg-danger-50 text-gray-700 hover:text-danger-600 rounded-lg text-sm font-medium transition-all duration-200" data-action="logout">
                  <i class="fas fa-sign-out-alt mr-1"></i> Sair
                </button>
              </div>
            ` : `
              <!-- Navegação Pública -->
              <nav class="hidden md:flex items-center space-x-6">
                <a href="#" class="text-gray-700 hover:text-primary-600 font-medium transition">Como Funciona</a>
                <a href="#" class="text-gray-700 hover:text-primary-600 font-medium transition">Segurança</a>
                <a href="#" class="text-gray-700 hover:text-primary-600 font-medium transition">Taxas</a>
              </nav>
              <div class="flex items-center space-x-3">
                <button class="text-gray-700 font-medium hover:text-primary-600 transition hidden md:block px-4 py-2" data-action="navigate" data-page="login">Entrar</button>
                <button class="bg-gradient-to-r from-primary-600 to-secondary-500 text-white px-5 py-2.5 rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200" data-action="navigate" data-page="register">
                  Começar Grátis
                </button>
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
      <main class="flex-1 bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-600 flex items-center justify-center p-4 sm:p-6 min-h-[calc(100vh-200px)]">
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
        
        <div class="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
          <button class="text-sm text-primary-600 hover:text-primary-700 font-medium transition" data-action="navigate" data-page="forgot-password">
            Esqueci a senha
          </button>
          <button class="text-sm text-primary-600 hover:text-primary-700 font-medium transition" data-action="navigate" data-page="register">
            Criar nova conta
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
              <input type="password" name="password" required minlength="8" autocomplete="new-password" placeholder="Mínimo 8 caracteres" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Confirmar senha *</label>
              <input type="password" name="password_confirmation" required minlength="8" autocomplete="new-password" placeholder="Repita a senha" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
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
            <input type="password" name="password" required minlength="8" autocomplete="new-password" placeholder="Mínimo 8 caracteres" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Confirmar senha</label>
            <input type="password" name="password_confirmation" required minlength="8" autocomplete="new-password" placeholder="Repita a senha" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
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
    return `<main class="flex-1 w-full max-w-6xl mx-auto p-4 sm:p-6">${renderProtectedPage()}</main>`;
  }

  function renderProtectedPage() {
    if (state.currentPage === 'negotiation-detail') {
      return renderNegotiationDetailPage();
    }
    if (state.currentPage === 'admin' && isAdmin()) {
      return renderAdminPage();
    }
    return renderDashboardPage();
  }

  function renderDashboardPage() {
    const negotiations = getFilteredNegotiations();
    const pageSize = Math.max(1, Number(state.dashboardPageSize) || 6);
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
  <div class="flex flex-wrap gap-3">
    <button class="w-full sm:w-auto justify-center px-6 py-3 bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 text-white font-semibold rounded-xl shadow-lg shadow-primary-500/30 transition duration-300 ease-in-out flex items-center gap-2" data-action="openCreateNegotiation">
      <i class="fas fa-plus"></i> Nova Negociação
    </button>
    <button class="w-12 h-12 bg-white border border-gray-200 hover:border-primary-500 rounded-xl text-gray-700 hover:text-primary-600 transition shadow-sm flex items-center justify-center" data-action="dashboardRefresh">
      <i class="fas fa-sync-alt"></i>
    </button>
    ${isAdmin() ? '<button class="w-12 h-12 bg-white border border-gray-200 hover:border-primary-500 rounded-xl text-gray-700 hover:text-primary-600 transition shadow-sm flex items-center justify-center" data-action="navigate" data-page="admin"><i class="fas fa-cog"></i></button>' : ''}
  </div>
</header>
        <!-- Layout com 2 colunas: Filtros à esquerda | Cards + Tabela à direita -->
        <div class="flex flex-col lg:flex-row gap-6 items-start">
          <!-- COLUNA ESQUERDA: Filtros -->
          ${renderFilterSidebar()}

          <!-- COLUNA DIREITA: Cards de resumo + Tabela -->
          <div class="flex-1 min-w-0 space-y-6">
            ${renderDashboardMobileFilterBar()}
            ${renderDashboardSummary()}
            <div class="sm:hidden">
              ${renderNegotiationsCardsMobile(pageItems, pageMeta)}
            </div>
            <div class="hidden sm:block">
              ${renderNegotiationsTable(pageItems, pageMeta)}
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

  function renderFilterSidebar() {
  const { status, query } = state.negotiationFilters;
  const statusOptions = [
    { key: 'all', label: 'Todos', icon: 'fa-th-list', color: 'text-gray-600' },
    { key: 'awaiting_admin_approval', label: 'Aguardando revisão', icon: 'fa-hourglass-half', color: 'text-primary-600' },
    { key: 'pending_acceptance', label: 'Convites pendentes', icon: 'fa-user-plus', color: 'text-secondary-600' },
    { key: 'waiting_payment', label: 'Pagamento pendente', icon: 'fa-credit-card', color: 'text-warning-600' },
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

  return `
    <aside class="hidden lg:block w-72 flex-shrink-0 lg:sticky lg:top-28 self-start">
      <div class="bg-white border border-gray-100 rounded-2xl shadow-card p-4 sm:p-6">
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
            <span class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Buscar negociação</span>
            <div class="relative">
              <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
              <input 
                type="search" 
                placeholder="Filtrar por título, comprador ou vendedor" 
                value="${escapeAttr(query)}" 
                data-action="dashboardSearch" 
                class="w-full pl-9 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-150"
              >
            </div>
          </div>

          <div class="space-y-2">
            <span class="block text-xs font-bold text-gray-500 uppercase tracking-wider">Status</span>
            <nav class="flex flex-col gap-1.5">
              ${statusOptions.map((opt) => {
                const isActive = status === opt.key;
                return `
                  <button
                    type="button"
                    class="w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl text-sm transition duration-150 ${isActive 
                      ? 'bg-gradient-to-r from-primary-600 to-secondary-500 text-white font-semibold shadow-md' 
                      : 'bg-white text-gray-700 hover:bg-primary-50 hover:text-primary-600'}"
                    data-action="dashboardStatusFilter"
                    data-status="${opt.key}"
                  >
                    <span class="flex items-center gap-3">
                      <i class="fas ${opt.icon} ${isActive ? 'text-white' : opt.color}"></i>
                      <span class="truncate">${escapeHtml(opt.label)}</span>
                    </span>
                    ${isActive ? '<i class="fas fa-check text-xs"></i>' : ''}
                  </button>
                `;
              }).join('')}
            </nav>
          </div>

        </div>
      </div>
    </aside>
  `;
  }

  function renderCreateNegotiationModal() {
    const { buyerFound, buyerSearching, productPhotos, photoError } = state.createNegForm;
    const showTerms = state.showCreateTerms;
    const photosHtml = productPhotos.map((photo, idx) => `
      <div class="relative group">
        <img src="${photo.preview}" alt="Foto ${idx + 1}" class="w-full h-24 object-cover rounded-lg border border-gray-200">
        <button type="button" class="absolute top-1 right-1 w-6 h-6 bg-danger-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition" data-action="removeProductPhoto" data-index="${idx}">✕</button>
      </div>
    `).join('');

    return `
      <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div class="bg-white rounded-2xl shadow-card-xl max-w-2xl w-full my-4 overflow-hidden animate-slide-up">
          <div class="h-1 bg-gradient-to-r from-primary-600 to-secondary-500"></div>
          <header class="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100">
            <div>
              <h2 class="text-xl font-bold text-gray-900">Nova Negociação</h2>
              <p class="text-gray-500 text-sm">Preencha todos os dados para iniciar</p>
            </div>
            <button class="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors" data-action="closeCreateNegotiation">✕</button>
          </header>
          
          <form data-action="createNegotiation" class="p-4 sm:p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            <div class="${showTerms ? 'hidden' : 'space-y-5'}">
              <!-- Título do produto -->
              <div>
                <label class="block text-sm text-gray-700 font-medium mb-2">Título do produto *</label>
                <input type="text" name="title" required maxlength="255" placeholder="Ex: iPhone 15 Pro Max 256GB" data-focus-key="create-neg-title" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
              </div>

              <!-- Categoria -->
              <div>
                <label class="block text-sm text-gray-700 font-medium mb-2">Categoria *</label>
                <select name="category" required data-focus-key="create-neg-category" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                  <option value="" selected>Selecione uma categoria</option>
                  ${PRODUCT_CATEGORIES.map(cat => `<option value="${escapeAttr(cat)}">${escapeHtml(cat)}</option>`).join('')}
                </select>
              </div>

              <!-- Descrição -->
              <div>
                <label class="block text-sm text-gray-700 font-medium mb-2">Descrição detalhada *</label>
                <textarea name="description" rows="3" required maxlength="2000" placeholder="Descreva o estado do produto, acessórios inclusos, defeitos conhecidos, etc." data-focus-key="create-neg-description" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all resize-none"></textarea>
              </div>

              <!-- Preço -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm text-gray-700 font-medium mb-2">Preço (R$) *</label>
                  <input type="number" name="price" required min="50" max="100000" step="0.01" placeholder="0,00" data-focus-key="create-neg-price" class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
                  <span class="text-xs text-gray-400 mt-1 block">Mínimo R$ 50,00 - Máximo R$ 100.000,00</span>
                </div>
                <div>
                  <label class="block text-sm text-gray-700 font-medium mb-2">Prazo de envio</label>
                  <input type="text" value="2 dias úteis" disabled class="w-full px-4 py-3 bg-gray-200 border border-gray-300 rounded-lg text-gray-600 cursor-not-allowed">
                  <span class="text-xs text-warning-600 mt-1 block"><i class="fas fa-info-circle mr-1"></i>Prazo fixo obrigatório</span>
                </div>
              </div>

              <!-- Upload de fotos -->
              <div class="space-y-2">
                <label class="block text-sm text-gray-700 font-medium">Fotos do produto (até 8 fotos) *</label>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  ${photosHtml}
                  ${productPhotos.length < 8 ? `
                    <label class="w-full h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition">
                      <i class="fas fa-camera text-gray-400 text-xl mb-1"></i>
                      <span class="text-xs text-gray-400">Adicionar</span>
                      <input type="file" accept="image/*" multiple class="hidden" data-action="addProductPhotos">
                    </label>
                  ` : ''}
                </div>
                ${photoError ? `<p class="text-xs text-danger-500"><i class="fas fa-exclamation-circle mr-1"></i>${photoError}</p>` : ''}
                <p class="text-xs text-gray-400">Adicione pelo menos 1 foto. Formatos: JPG, PNG. Máx 5MB cada.</p>
              </div>

              <!-- Busca do comprador -->
              <div class="space-y-2">
                <label class="block text-sm text-gray-700 font-medium">E-mail do comprador *</label>
                <p class="text-xs text-gray-500">Digite o e-mail completo do comprador e clique em <strong>Buscar</strong> para confirmar o cadastro.</p>
                <div class="flex flex-col sm:flex-row gap-2">
                  <input type="email" name="buyer_email" required placeholder="comprador@email.com" class="flex-1 px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" data-action="updateNegFormField" data-field="buyerEmail" data-focus-key="create-neg-buyer-email">
                  <button type="button" class="w-full sm:w-auto px-4 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-700 transition" data-action="searchBuyer">
                    ${buyerSearching ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-search"></i>'}
                  </button>
                </div>
                <div class="p-3 bg-primary-50 border border-primary-100 rounded-lg text-primary-700 text-xs flex items-center gap-2">
                  <i class="fas fa-info-circle"></i>
                  <span>Encontramos o comprador somente pelo <strong>e-mail já cadastrado</strong>. Confirme com o cliente antes de continuar.</span>
                </div>
                ${buyerFound === false ? `
                  <div class="p-3 bg-danger-50 border border-danger-200 rounded-lg text-danger-700 text-sm">
                    <i class="fas fa-exclamation-circle mr-2"></i>Comprador não encontrado. Verifique o e-mail ou peça para se cadastrar.
                  </div>
                ` : ''}
                ${buyerFound ? `
                  <div class="p-3 bg-success-50 border border-success-200 rounded-lg text-success-700 text-sm flex items-center gap-3">
                    <i class="fas fa-check-circle text-lg"></i>
                    <div>
                      <strong>${escapeHtml(buyerFound.name)}</strong>
                      <span class="block text-xs text-success-600">${escapeHtml(buyerFound.email)}</span>
                    </div>
                  </div>
                ` : ''}
              </div>

              <!-- Endereço da intermediadora -->
              <div class="p-4 bg-gradient-to-r from-primary-50 to-secondary-50 rounded-xl border border-primary-200">
                <h3 class="text-sm font-bold text-primary-800 mb-2 flex items-center gap-2">
                  <i class="fas fa-map-marker-alt"></i> Endereço para envio
                </h3>
                <p class="text-primary-700 font-medium">${escapeHtml([INTERMEDIARY_ADDRESS.street, INTERMEDIARY_ADDRESS.number].filter(Boolean).join(', '))}</p>
                ${INTERMEDIARY_ADDRESS.district ? `<p class="text-primary-700">Bairro: ${escapeHtml(INTERMEDIARY_ADDRESS.district)}</p>` : ''}
                <p class="text-primary-700">${escapeHtml([INTERMEDIARY_ADDRESS.city, INTERMEDIARY_ADDRESS.state].filter(Boolean).join(' - '))}</p>
                <p class="text-primary-700">CEP: ${escapeHtml(formatCep(INTERMEDIARY_ADDRESS.cep))}</p>
                <p class="text-xs text-primary-600 mt-2 italic">
                  <i class="fas fa-info-circle mr-1"></i>
                  Você deve enviar o produto em até 2 dias úteis após aprovar a venda.
                </p>
              </div>

              <div class="p-4 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 flex items-center gap-3">
                <i class="fas fa-file-signature text-primary-500 text-lg"></i>
                <span>Ao clicar em <strong>Criar negociação</strong> você verá todos os termos obrigatórios antes de concluir.</span>
              </div>
            </div>

            ${showTerms ? `
              <div class="space-y-5">
                <div class="p-4 bg-white border border-warning-200 rounded-xl shadow-sm">
                  <div class="flex items-center gap-2 text-warning-700 font-semibold mb-2">
                    <i class="fas fa-shield-alt"></i>
                    Compromissos do vendedor após o pagamento aprovado
                  </div>
                  <ul class="text-sm text-gray-600 space-y-2 text-left">
                    <li><strong>Prazo:</strong> enviar o produto para a intermediadora em até <strong>2 dias corridos</strong>.</li>
                    <li><strong>Obrigatório:</strong> registrar o código de rastreio no sistema.</li>
                    <li><strong>Embalagem:</strong> enviar bem protegido para evitar danos.</li>
                  </ul>
                  <div class="mt-3 p-3 bg-danger-50 border border-danger-200 rounded-lg text-danger-700 text-sm">
                    <p class="font-semibold">Se não enviar em até 2 dias:</p>
                    <ul class="list-disc ml-4 space-y-1">
                      <li>Perde a taxa de R$ 15,00.</li>
                      <li>O comprador recebe 100% do valor pago + taxa.</li>
                      <li>A negociação é cancelada.</li>
                    </ul>
                    <p class="mt-2 text-xs">Envios fora do prazo serão devolvidos e a taxa continua perdida.</p>
                  </div>
                </div>

                <div class="space-y-3">
                  <div class="p-4 bg-warning-50 border border-warning-200 rounded-xl text-warning-800 text-sm space-y-3">
                    <p><strong>Antes de finalizar, confirme que está ciente de todas as regras:</strong></p>
                    <ul class="list-disc ml-4 space-y-2">
                      <li>Envio obrigatório para a intermediadora em até 2 dias corridos após a aprovação do pagamento.</li>
                      <li>Inserir o código de rastreio no sistema imediatamente após a postagem.</li>
                      <li>Embalagem responsável: danos por embalagem inadequada são de responsabilidade do vendedor.</li>
                      <li>Descumprimento do prazo implica perda da taxa de R$ 15,00, devolução total ao comprador e cancelamento da negociação.</li>
                      <li>Envios fora do prazo serão devolvidos e a taxa continua perdida.</li>
                    </ul>
                  </div>
                  <label class="flex items-start gap-3 p-4 bg-white border border-warning-200 rounded-xl cursor-pointer">
                    <input type="checkbox" name="terms_accepted" required class="w-5 h-5 mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500">
                    <span class="text-sm text-gray-700">
                      Confirmo que li e concordo com todas as condições acima e autorizo a inspeção completa do produto pela intermediadora.
                    </span>
                  </label>
                </div>
              </div>
            ` : ''}

            <div class="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-100">
              <button type="button" class="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition" data-action="closeCreateNegotiation">Cancelar</button>
              <button type="submit" class="flex-1 px-4 py-3 bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 rounded-lg text-white font-bold transition disabled:opacity-50 disabled:cursor-not-allowed" ${!buyerFound ? 'disabled' : ''}>
                <i class="fas fa-paper-plane mr-2"></i>${showTerms ? 'Confirmar e enviar' : 'Criar negociação'}
              </button>
            </div>
          </form>
        </div>
      </div>
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
          <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Negociações</h2>
          <span class="text-xs text-gray-500">${showingLabel || totalLabel}${totalPages > 1 ? ` • Página ${page}/${totalPages}` : ''}</span>
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
        ${totalPages > 1 ? `
          <div class="px-5 py-4 border-t border-gray-100 bg-white flex items-center justify-between">
            <button type="button" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed" data-action="dashboardPrevPage" ${page <= 1 ? 'disabled' : ''}>
              Anterior
            </button>
            <div class="text-xs text-gray-500">${showingLabel || ''}</div>
            <button type="button" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed" data-action="dashboardNextPage" ${page >= totalPages ? 'disabled' : ''}>
              Próxima
            </button>
          </div>
        ` : ''}
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
      return { label: 'Pagar agora', icon: 'fa-credit-card' };
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
      const idLabel = neg?.id != null ? `#${neg.id}` : '—';
      const updatedRaw = neg?.updated_at || neg?.created_at;
      const updatedAbsolute = updatedRaw ? formatDateTime(updatedRaw) : '—';
      const priority = getStatusPriority(status, neg);
      const needsAction = priority <= 2;
      const counterparty = getRelevantCounterparty(neg);
      const cta = getMobilePrimaryCta(neg);

      return `
        <article class="bg-white rounded-2xl border border-gray-100 shadow-card p-4 space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="text-xs text-gray-500 font-semibold">Negociação ${escapeHtml(idLabel)}</div>
              <h3 class="text-base font-extrabold text-gray-900 mt-0.5 overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
                ${escapeHtml(productTitle)}
              </h3>
            </div>
            <div class="flex-shrink-0">${renderStatusBadgeEnhanced(status)}</div>
          </div>

          <div class="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
            <div class="w-10 h-10 rounded-full bg-white border border-gray-200 text-gray-700 font-semibold flex items-center justify-center uppercase">
              ${escapeHtml(getInitials(counterparty.name))}
            </div>
            <div class="min-w-0">
              <div class="text-xs text-gray-500">${escapeHtml(counterparty.label)}</div>
              <div class="text-sm font-semibold text-gray-900 truncate">${escapeHtml(counterparty.name)}</div>
              ${counterparty.email ? `<div class="text-xs text-gray-500 break-all">${escapeHtml(counterparty.email)}</div>` : ''}
            </div>
          </div>

          <div class="flex items-center justify-between gap-2 text-xs text-gray-500">
            <span class="truncate">Atualizado em: ${escapeHtml(updatedAbsolute)}</span>
            ${needsAction ? `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold"><i class="fas fa-exclamation-triangle"></i>Ação</span>` : ''}
          </div>

          <div class="flex gap-3">
            <button
              type="button"
              class="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 text-white font-semibold shadow-md transition flex items-center justify-center gap-2"
              data-action="openNegotiation"
              data-id="${neg?.id}"
            >
              <i class="fas ${cta.icon}"></i>
              ${escapeHtml(cta.label)}
            </button>
          </div>
        </article>
      `;
    }).join('');

    return `
      <div class="space-y-4">
        <div class="px-1 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Negociações</h2>
          <span class="text-xs text-gray-500">${escapeHtml(showingLabel)}${totalPages > 1 ? ` • Página ${page}/${totalPages}` : ''}</span>
        </div>
        <div class="space-y-4">
          ${itemsHtml}
        </div>
        ${totalPages > 1 ? `
          <div class="flex items-center gap-3">
            <button type="button" class="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed" data-action="dashboardPrevPage" ${page <= 1 ? 'disabled' : ''}>
              Anterior
            </button>
            <button type="button" class="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed" data-action="dashboardNextPage" ${page >= totalPages ? 'disabled' : ''}>
              Próxima
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }

  function renderNegotiationRow(neg) {
    const buyerName = neg?.buyer?.name || '—';
    const sellerName = neg?.seller?.name || '—';
    const productTitle = neg?.product_title || neg?.product_name || neg?.title || 'Produto';
    const status = neg?.status || 'unknown';
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
          ${renderStatusBadgeEnhanced(status)}
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

  function renderStatusBadgeEnhanced(status) {
    const label = STATUS_LABELS[status] || status || '—';
    const statusConfig = {
      awaiting_admin_approval: { bg: 'bg-primary-100', text: 'text-primary-700', border: 'border-primary-200', icon: 'fa-hourglass-half' },
      pending_acceptance: { bg: 'bg-secondary-100', text: 'text-secondary-700', border: 'border-secondary-200', icon: 'fa-user-plus' },
      waiting_payment: { bg: 'bg-warning-100', text: 'text-warning-700', border: 'border-warning-200', icon: 'fa-credit-card' },
      waiting_shipment: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200', icon: 'fa-box' },
      shipped: { bg: 'bg-secondary-100', text: 'text-secondary-700', border: 'border-secondary-200', icon: 'fa-truck' },
      at_intermediary: { bg: 'bg-secondary-100', text: 'text-secondary-700', border: 'border-secondary-200', icon: 'fa-warehouse' },
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

    const buyer = negotiation.buyer || {};
    const seller = negotiation.seller || {};
    const productTitle = negotiation.product_title || negotiation.product_name || negotiation.title || 'Produto';
    const isBuyerRole = isBuyer(negotiation);
    const isSellerRole = isSeller(negotiation);
    const status = negotiation.status || '—';

    return `
      <section class="space-y-6">
        <header class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <button class="text-primary-600 hover:text-primary-700 font-medium transition mb-2 flex items-center gap-2" data-action="navigate" data-page="dashboard"><i class="fas fa-arrow-left"></i> Voltar</button>
            <h1 class="text-3xl font-bold text-gray-900">Negociação #${negotiation.id}</h1>
            <p class="text-gray-500">${escapeHtml(productTitle)}</p>
          </div>
          <div class="flex items-center gap-3">
            <span>${renderStatusBadge(status)}</span>
            <button class="px-4 py-2 bg-white border border-gray-200 hover:border-primary-400 rounded-lg text-gray-700 font-medium transition shadow-sm flex items-center gap-2" data-action="openTimeline" data-id="${negotiation.id}"><i class="fas fa-stream"></i> Linha do tempo</button>
          </div>
        </header>

        ${renderBuyerAcceptSection(negotiation, { isBuyer: isBuyerRole, isSeller: isSellerRole })}

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <article class="bg-white rounded-2xl p-6 shadow-card border border-gray-100">
            <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-info-circle text-primary-500"></i> Resumo</h2>
            <dl class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt class="text-gray-500">Valor</dt>
                <dd class="text-gray-800 font-bold text-lg">${formatCurrency(negotiation.product_price || negotiation.price)}</dd>
              </div>
              <div>
                <dt class="text-gray-500">Atualizado</dt>
                <dd class="text-gray-700">${formatDateTime(negotiation.updated_at || negotiation.created_at)}</dd>
              </div>
              <div>
                <dt class="text-gray-500">Entrega combinada</dt>
                <dd class="text-gray-700">${negotiation.delivery_days ? `${negotiation.delivery_days} dias` : '—'}</dd>
              </div>
              <div>
                <dt class="text-gray-500">Status atual</dt>
                <dd>${renderStatusBadge(status)}</dd>
              </div>
            </dl>
            ${negotiation.product_description || negotiation.description ? `
              <section class="mt-6 pt-4 border-t border-gray-100">
                <h3 class="text-sm font-medium text-gray-600 mb-2">Descrição enviada pelo vendedor</h3>
                <p class="text-gray-500">${escapeHtml(negotiation.product_description || negotiation.description)}</p>
              </section>
            ` : ''}
          </article>

          <article class="bg-white rounded-2xl p-6 shadow-card border border-gray-100">
            <h2 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-users text-secondary-500"></i> Participantes</h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="p-4 rounded-xl border border-gray-100 bg-gray-50">
                <header class="flex items-center gap-2 mb-2">
                  <span class="px-2 py-0.5 bg-warning-500 text-white text-xs rounded-full font-medium">Vendedor</span>
                  ${isSellerRole ? '<span class="px-2 py-0.5 bg-gray-900 text-white text-xs rounded-full font-medium">Você</span>' : ''}
                </header>
                <strong class="block text-gray-800">${escapeHtml(seller.name || '—')}</strong>
                <span class="block text-gray-500 text-sm break-all">${escapeHtml(seller.email || '—')}</span>
                <span class="block text-gray-500 text-sm">${formatPhone(seller.phone)}</span>
                ${renderAddressDetails(seller)}
              </div>
              <div class="p-4 rounded-xl border border-gray-100 bg-gray-50">
                <header class="flex items-center gap-2 mb-2">
                  <span class="px-2 py-0.5 bg-secondary-500 text-white text-xs rounded-full font-medium">Comprador</span>
                  ${isBuyerRole ? '<span class="px-2 py-0.5 bg-gray-900 text-white text-xs rounded-full font-medium">Você</span>' : ''}
                </header>
                <strong class="block text-gray-800">${escapeHtml(buyer.name || '—')}</strong>
                <span class="block text-gray-500 text-sm break-all">${escapeHtml(buyer.email || '—')}</span>
                <span class="block text-gray-500 text-sm">${formatPhone(buyer.phone)}</span>
                ${renderAddressDetails(buyer)}
              </div>
              <div class="p-4 rounded-xl border border-gray-100 bg-gray-50">
                <header class="flex items-center gap-2 mb-2">
                  <span class="px-2 py-0.5 bg-primary-500 text-white text-xs rounded-full font-medium">Intermediadora</span>
                </header>
                <strong class="block text-gray-800">IntermediaçãoPro</strong>
                <span class="block text-gray-500 text-sm break-all">contato@intermediacaopro.com</span>
                <span class="block text-gray-500 text-sm">${formatPhone('(11) 99999-9999')}</span>
                ${renderAddressDetails(INTERMEDIARY_ADDRESS, 'Endereço não informado.')}
              </div>
            </div>
          </article>
        </div>

        ${renderLogisticsSection(negotiation, { isBuyer: isBuyerRole, isSeller: isSellerRole })}
        ${renderPaymentSection(negotiation, { isBuyer: isBuyerRole })}
        ${renderPaymentsSection(negotiation)}
        ${renderAdminActionsSection(negotiation)}
        ${renderInspectionReportSection(negotiation)}
        ${renderParticipantActions(negotiation, { isBuyer: isBuyerRole })}
        ${renderAttachmentSection(negotiation)}
        ${renderNegotiationLogs(negotiation)}
      </section>
      ${renderBuyerRejectModal()}
    `;
  }

  function renderLogisticsSection(neg, { isBuyer, isSeller }) {
    const trackSeller = neg.tracking_to_intermediary || neg.tracking_code || '';
    const trackBuyer = neg.tracking_to_buyer || neg.buyer_tracking_code || '';
    return `
      <article class="bg-white rounded-2xl p-6 shadow-card border border-gray-100">
        <h2 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-truck text-success-500"></i> Logística</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="p-4 rounded-xl border border-gray-100 bg-gray-50">
            <h3 class="text-sm font-medium text-gray-700 mb-1">Rastreio para intermediadora</h3>
            <p class="text-sm text-gray-800 font-medium">${trackSeller ? escapeHtml(trackSeller) : 'Não informado'}</p>
            ${neg.sent_to_intermediary_at || neg.shipped_at ? `<small class="text-xs text-gray-500">Postado em ${formatDate(neg.sent_to_intermediary_at || neg.shipped_at)}</small>` : ''}
          </div>
          <div class="p-4 rounded-xl border border-gray-100 bg-gray-50">
            <h3 class="text-sm font-medium text-gray-700 mb-1">Rastreio para comprador</h3>
            <p class="text-sm text-gray-800 font-medium">${trackBuyer ? escapeHtml(trackBuyer) : 'Não informado'}</p>
            ${neg.sent_to_buyer_at ? `<small class="text-xs text-gray-500">Despachado em ${formatDate(neg.sent_to_buyer_at)}</small>` : ''}
          </div>
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

    return `
      <article class="bg-white rounded-2xl p-6 shadow-card border border-success-200">
        <h2 class="text-lg font-semibold text-success-700 mb-3 flex items-center gap-2"><i class="fas fa-handshake text-success-600"></i> Aceite da negociação</h2>
        <p class="text-sm text-gray-600 mb-4">Esta negociação está aguardando o aceite do comprador. Revise os detalhes acima e confirme sua participação.</p>
        
        <!-- Endereço de envio informativo -->
        <div class="p-4 rounded-xl border border-gray-100 bg-gray-50 mb-4">
          <h3 class="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <i class="fas fa-info-circle text-secondary-500"></i> Informações importantes
          </h3>
          <p class="text-sm text-gray-600 mb-2">O vendedor deve enviar o produto em até <strong>2 dias úteis</strong> após você aceitar.</p>
          <p class="text-sm text-gray-600">Após o aceite, você receberá as instruções de pagamento.</p>
        </div>
        
        <div class="flex flex-wrap gap-3">
          <button class="px-5 py-2.5 bg-success-600 hover:bg-success-700 rounded-lg text-white font-semibold transition flex items-center gap-2" data-action="acceptNegotiation" data-id="${neg.id}">
            <i class="fas fa-check"></i> Aceitar e participar
          </button>
          <button class="px-5 py-2.5 bg-danger-100 hover:bg-danger-200 text-danger-700 rounded-lg font-medium transition flex items-center gap-2" data-action="openRejectModal" data-id="${neg.id}">
            <i class="fas fa-times"></i> Recusar
          </button>
        </div>
      </article>
    `;
  }

  function renderPaymentSection(neg, { isBuyer }) {
    // Mostra QR Code para pagamento quando o status for waiting_payment e o usuário for comprador
    if (neg.status !== 'waiting_payment' || !isBuyer) return '';

    const amount = neg.product_price || neg.price || 0;
    const fee = amount * 0.05; // Taxa de 5%
    const total = amount + fee;
    
    // Dados para QR Code Pix (usa código vindo da API, com fallback simulado)
    const pixKey = 'pix@intermediacao.com.br';
    const fallbackPixCode = `00020126580014br.gov.bcb.pix0136${pixKey}5204000053039865406${total.toFixed(2)}5802BR5925INTERMEDIACAO PRO LTDA6009SAO PAULO62070503***6304`;
    const pixCode = String(neg.pix_code || fallbackPixCode);

    return `
      <article class="bg-white rounded-2xl p-6 shadow-card border border-gray-100">
        <h2 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-qrcode text-secondary-600"></i> Pagamento via Pix</h2>
        
        <div class="grid md:grid-cols-2 gap-4">
          <div>
            <div class="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-4">
              <h3 class="text-sm font-medium text-gray-700 mb-3">Resumo do pagamento</h3>
              <div class="space-y-2 text-sm text-gray-700">
                <div class="flex justify-between">
                  <span class="text-gray-600">Valor do produto</span>
                  <span class="text-gray-800 font-medium">${formatCurrency(amount)}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">Taxa de intermediação (5%)</span>
                  <span class="text-gray-800 font-medium">${formatCurrency(fee)}</span>
                </div>
                <div class="flex justify-between pt-2 border-t border-gray-200">
                  <span class="text-gray-800 font-bold">Total a pagar</span>
                  <span class="text-secondary-600 font-bold text-lg">${formatCurrency(total)}</span>
                </div>
              </div>
            </div>
            
            <div class="space-y-3">
              <div class="p-3 bg-white rounded-lg border border-secondary-200">
                <span class="text-xs text-gray-500 block mb-1">Chave Pix (E-mail)</span>
                <div class="flex items-center gap-2">
                  <code class="text-sm text-gray-800 flex-1">${pixKey}</code>
                  <button class="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs text-gray-600" data-action="copyText" data-value="${pixKey}">
                    <i class="fas fa-copy"></i>
                  </button>
                </div>
              </div>
              
              <button class="w-full px-4 py-3 bg-gradient-to-r from-success-500 to-success-600 hover:from-success-600 hover:to-success-700 rounded-lg text-white font-bold transition shadow-md" data-action="confirmPayment" data-id="${neg.id}">
                <i class="fas fa-check mr-2"></i>Já realizei o pagamento
              </button>
              <p class="text-xs text-gray-500 text-center">Pagamento confirmado em até 1 hora útil.</p>
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
    
    // Status onde o vendedor pode/deve adicionar código de rastreio
    const sellerTrackingStatuses = [
      'waiting_shipment', 
      'awaiting_shipment', 
      'pending_shipment',
      'approved',
      'payment_confirmed',
      'awaiting_seller_shipment'
    ];
    
    // Vendedor pode adicionar código apenas UMA VEZ (se ainda não tem código)
    // Admin pode sempre editar
    const sellerCanAddCode = isSeller && !trackSeller && sellerTrackingStatuses.includes(neg.status);
    const adminCanEditSellerCode = admin;
    
    // Apenas Admin pode editar código para comprador
    const adminCanEditBuyerCode = admin;
    
    const sections = [];

    // Seção de rastreio para intermediadora (vendedor → intermediadora)
    if (trackSeller || sellerCanAddCode || adminCanEditSellerCode) {
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
      const status = payment.confirmed_at ? `Confirmado em ${formatDate(payment.confirmed_at)}` : 'Pendente';
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
    const awaitingAdmin = neg.status === 'awaiting_admin_approval';
    const atIntermediary = neg.status === 'at_intermediary';
    const showApproveReject = awaitingAdmin;
    const showInspectionForm = atIntermediary && Boolean(neg.inspection_saved_at) && !neg.intermediary_approval_confirmed_at;
    const showFinalize = neg.status === 'delivered';
    const showMarkReceived = neg.status === 'shipped' && !neg.intermediary_received_status;

    const sections = [];

    if (showApproveReject) {
      sections.push(`
        <section class="pt-4 border-t border-gray-200 first:border-t-0 first:pt-0">
          <h3 class="text-sm font-medium text-gray-700 mb-3">Aprovação inicial</h3>
          <div class="flex flex-wrap gap-3">
            <button class="px-4 py-2 bg-gradient-to-r from-success-500 to-success-600 hover:from-success-600 hover:to-success-700 rounded-lg text-white font-medium transition shadow-md" data-action="adminApproveNegotiation" data-id="${neg.id}"><i class="fas fa-check mr-2"></i>Aprovar negociação</button>
            <button class="px-4 py-2 bg-gradient-to-r from-danger-500 to-danger-600 hover:from-danger-600 hover:to-danger-700 rounded-lg text-white font-medium transition shadow-md" data-action="adminRejectNegotiation" data-id="${neg.id}"><i class="fas fa-times mr-2"></i>Reprovar</button>
          </div>
        </section>
      `);
    }

    if (showInspectionForm) {
      sections.push(`
        <section class="pt-4 border-t border-gray-100">
          <h3 class="text-sm font-medium text-gray-700 mb-3">Envio ao comprador</h3>
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
      `);
    }

    if (showMarkReceived) {
      sections.push(`
        <section class="pt-4 border-t border-gray-100">
          <h3 class="text-sm font-medium text-gray-700 mb-3">Confirmação de chegada na intermediadora</h3>
          <button class="px-4 py-2 bg-gradient-to-r from-secondary-500 to-secondary-600 hover:from-secondary-600 hover:to-secondary-700 rounded-lg text-white font-medium transition shadow-md" data-action="markIntermediaryReceived" data-id="${neg.id}"><i class="fas fa-box-open mr-2"></i>Marcar como recebido</button>
        </section>
      `);
    }

    if (showFinalize) {
      sections.push(`
        <section class="pt-4 border-t border-gray-100">
          <h3 class="text-sm font-medium text-gray-700 mb-3">Finalização</h3>
          <button class="px-4 py-2 bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 rounded-lg text-white font-bold transition shadow-md" data-action="finalizeNegotiation" data-id="${neg.id}"><i class="fas fa-flag-checkered mr-2"></i>Finalizar negociação</button>
        </section>
      `);
    }

    if (!sections.length) return '';

    return `
      <article class="bg-white rounded-2xl p-6 shadow-card border border-gray-100">
        <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-shield-alt text-primary-500"></i> Ações da intermediadora</h2>
        <div class="space-y-4">
          ${sections.join('')}
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

  function renderParticipantActions(neg, { isBuyer }) {
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
    const productPhotos = Array.isArray(neg.product_photos || neg.photos) ? (neg.product_photos || neg.photos) : [];
    const report = neg.intermediary_damage_report;
    const canPurgeImages = isAdmin() && neg.status === 'delivered' && (photos.length || productPhotos.length);
    
    if (!photos.length && !productPhotos.length && !report) return '';
    
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
        
        ${productPhotos.length ? `
          <section class="mb-6">
            <h3 class="text-sm font-medium text-gray-700 mb-3">Fotos do Produto</h3>
            <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              ${productPhotos.map((url, index) => `
                <button class="aspect-square rounded-xl overflow-hidden bg-gray-100 hover:ring-2 hover:ring-primary-500 transition shadow-md" data-action="openGallery" data-id="${neg.id}" data-index="${index}" data-type="product">
                  <img src="${escapeAttr(resolvePhotoUrl(url))}" alt="Foto do produto ${index + 1}" class="w-full h-full object-cover">
                </button>
              `).join('')}
            </div>
          </section>
        ` : ''}
        
        ${report ? `
          <section class="mb-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
            <h3 class="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"><i class="fas fa-file-alt text-amber-500"></i> Relatório da Intermediadora</h3>
            <p class="text-gray-600">${escapeHtml(report.summary || report.description || report)}</p>
          </section>
        ` : ''}
        
        ${photos.length ? `
          <section>
            <h3 class="text-sm font-medium text-gray-700 mb-3">Fotos da Inspeção</h3>
            <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              ${photos.map((url, index) => `
                <button class="aspect-square rounded-xl overflow-hidden bg-gray-100 hover:ring-2 hover:ring-primary-500 transition shadow-md" data-action="openGallery" data-id="${neg.id}" data-index="${index}">
                  <img src="${escapeAttr(resolvePhotoUrl(url))}" alt="Foto ${index + 1}" class="w-full h-full object-cover">
                </button>
              `).join('')}
            </div>
          </section>
        ` : ''}
      </article>
    `;
  }

  function renderAdminPage() {
    return `
      <section class="space-y-6">
        <header class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 class="text-3xl font-bold text-gray-900">Painel administrativo</h1>
            <p class="text-gray-500">Visão completa de negociações e usuários.</p>
          </div>
          <div class="flex flex-wrap gap-3">
            <button class="w-full sm:w-auto justify-center px-4 py-2 bg-white border border-gray-200 hover:border-primary-400 rounded-lg text-gray-700 font-medium transition shadow-sm flex items-center gap-2" data-action="adminRefresh"><i class="fas fa-sync-alt"></i> Atualizar</button>
            <button class="w-full sm:w-auto justify-center px-4 py-2 bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 rounded-lg text-white font-medium flex items-center gap-2 transition" data-action="openPendingModal"><i class="fas fa-bell"></i> Pendências (<span data-pending-count-inline>${state.pendingCount}</span>)</button>
          </div>
        </header>
        ${renderAdminTabs()}
        ${renderAdminContent()}
      </section>
    `;
  }

  function renderAdminTabs() {
    const tabs = [
      { key: 'negotiations', label: 'Negociações', icon: 'fa-handshake' },
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
    switch (state.adminTab) {
      case 'users':
        return renderAdminUsers();
      case 'negotiations':
        return renderAdminNegotiations();
      default:
        return renderAdminNegotiations();
    }
  }

  function renderAdminOverview() {
    const overview = state.adminOverview || buildAdminOverview(state.adminNegotiations);
    if (!overview) {
      return `<div class="text-center py-12 text-gray-500"><p>Nenhum dado carregado ainda.</p></div>`;
    }
    const statusCards = Object.entries(overview.byStatus || {}).map(([status, count]) => `
      <div class="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:shadow-md transition">
        <span>${renderStatusBadge(status)}</span>
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
    const rows = list.map((neg) => {
      const canApprove = neg.status === 'awaiting_admin_approval';
      const productTitle = neg.product_title || neg.product_name || neg.title || 'Produto';
      const buyerName = neg.buyer?.name || '—';
      const buyerEmail = neg.buyer?.email || '';
      const sellerName = neg.seller?.name || '—';
      const sellerEmail = neg.seller?.email || '';
      return `
      <div class="grid grid-cols-7 gap-4 px-6 py-4 border-t border-gray-100 items-center hover:bg-primary-50 transition">
        <span class="text-gray-500 font-medium">#${neg.id}</span>
        <span class="min-w-0">
          <div class="truncate text-gray-800 font-medium">${escapeHtml(productTitle)}</div>
          <div class="text-xs text-gray-400">Negociação ID: #${neg.id}</div>
        </span>
        <span class="min-w-0">
          <div class="truncate text-gray-600">${escapeHtml(buyerName)}</div>
          ${buyerEmail ? `<div class="text-xs text-gray-400 break-all">${escapeHtml(buyerEmail)}</div>` : ''}
        </span>
        <span class="min-w-0">
          <div class="truncate text-gray-600">${escapeHtml(sellerName)}</div>
          ${sellerEmail ? `<div class="text-xs text-gray-400 break-all">${escapeHtml(sellerEmail)}</div>` : ''}
        </span>
        <span>${renderStatusBadge(neg.status)}</span>
        <span class="text-gray-500 text-sm">${formatDateTime(neg.updated_at)}</span>
        <span class="flex flex-wrap gap-1">
          <button class="px-3 py-1 bg-gradient-to-r from-primary-600 to-secondary-500 rounded text-xs text-white font-medium" data-action="adminOpenNegotiation" data-id="${neg.id}">Detalhes</button>
          ${canApprove ? `
            <button class="px-3 py-1 bg-gradient-to-r from-success-500 to-success-600 rounded text-xs text-white font-medium" data-action="adminApproveNegotiation" data-id="${neg.id}">Aprovar</button>
            <button class="px-3 py-1 bg-gradient-to-r from-danger-500 to-danger-600 rounded text-xs text-white font-medium" data-action="adminRejectNegotiation" data-id="${neg.id}">Reprovar</button>
          ` : ''}
        </span>
      </div>
    `;
    }).join('');
    return `
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
          ${rows}
        </div>
      </section>
    `;
  }

  function renderAdminUsers() {
    const users = Array.isArray(state.adminUsers) ? state.adminUsers : [];
    return `
      <section class="bg-white rounded-2xl p-4 sm:p-6 shadow-card border border-gray-100">
        <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-user-plus text-success-500"></i> Gerenciar Usuários</h2>
        <form class="flex flex-wrap gap-3 mb-6" data-action="adminCreateInvitation">
          <input type="text" name="name" placeholder="Nome completo" required class="w-full sm:flex-1 sm:min-w-[160px] px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
          <input type="email" name="email" placeholder="email@exemplo.com" required class="w-full sm:flex-1 sm:min-w-[180px] px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
          <select name="role" class="w-full sm:w-auto sm:min-w-[140px] px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all">
            <option value="buyer">Comprador</option>
            <option value="seller">Vendedor</option>
            <option value="admin">Administrador</option>
          </select>
          <button type="submit" class="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 rounded-lg text-white font-bold transition"><i class="fas fa-plus mr-2"></i>Criar convite</button>
        </form>
        <div class="space-y-2 mt-4">
          ${users.length ? users.map((user) => `
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-4 items-center py-4 px-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100 hover:shadow-md transition">
              <span class="text-gray-800 font-medium">${escapeHtml(user.name || user.email || 'Usuário')} <span class="text-xs text-gray-400 font-semibold">#${escapeHtml(user.id ?? '—')}</span></span>
              <span>
                <div class="text-gray-500 break-all">${escapeHtml(user.email || '—')}</div>
                <div class="text-gray-400 text-xs">${escapeHtml(user.address_city || '—')} / ${escapeHtml(user.address_state || '—')}</div>
              </span>
              <span class="px-2 py-1 bg-primary-100 text-primary-700 rounded-full text-xs font-medium inline-block w-fit">${ROLE_LABELS[user.role] || user.role || '—'}</span>
              <span class="text-gray-400 text-sm">${formatDate(user.created_at)}</span>
              <button class="px-3 py-2 bg-gradient-to-r from-danger-500 to-danger-600 rounded-lg text-sm text-white font-medium transition" data-action="adminDeleteUser" data-id="${user.id}"><i class="fas fa-trash mr-1"></i>Remover</button>
            </div>
          `).join('') : '<p class="text-gray-400 text-center py-4">Sem usuários cadastrados.</p>'}
        </div>
      </section>
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
              <p class="text-gray-500 text-sm">Negociações aguardando ação da intermediadora.</p>
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
    const buyerEmail = neg?.buyer?.email || '';
    const seller = neg?.seller?.name || '—';
    const sellerEmail = neg?.seller?.email || '';
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
            <span><i class="fas fa-shopping-cart mr-1"></i> ${escapeHtml(buyer)}${buyerEmail ? ` <span class=\"text-xs text-gray-400 break-all\">(${escapeHtml(buyerEmail)})</span>` : ''}</span>
            <span><i class="fas fa-store mr-1"></i> ${escapeHtml(seller)}${sellerEmail ? ` <span class=\"text-xs text-gray-400 break-all\">(${escapeHtml(sellerEmail)})</span>` : ''}</span>
          </div>
          <div>Status: ${renderStatusBadge(neg.status)}</div>
        </div>
        <footer class="flex flex-wrap gap-2">
          <button class="px-3 py-2 bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 rounded-lg text-sm text-white font-medium transition-all" data-action="adminOpenNegotiation" data-id="${neg.id}"><i class="fas fa-eye mr-1"></i>Ver detalhes</button>
          <button class="px-3 py-2 bg-gradient-to-r from-success-500 to-success-600 hover:from-success-600 hover:to-success-700 rounded-lg text-sm text-white font-medium transition-all" data-action="adminApproveNegotiation" data-id="${neg.id}"><i class="fas fa-check mr-1"></i>Aprovar</button>
          <button class="px-3 py-2 bg-gradient-to-r from-danger-500 to-danger-600 hover:from-danger-600 hover:to-danger-700 rounded-lg text-sm text-white font-medium transition-all" data-action="adminRejectNegotiation" data-id="${neg.id}"><i class="fas fa-times mr-1"></i>Reprovar</button>
        </footer>
      </article>
    `;
  }

  function renderTimelineModal() {
    const timeline = Array.isArray(state.timelineData) ? state.timelineData : [];
    return `
      <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-card-xl overflow-hidden animate-slide-up">
          <div class="h-1 bg-gradient-to-r from-secondary-500 to-primary-500"></div>
          <header class="flex items-start justify-between p-4 sm:p-6 border-b border-gray-100">
            <div>
              <h2 class="text-xl font-bold text-gray-900 flex items-center gap-2"><i class="fas fa-stream text-secondary-500"></i> Linha do tempo</h2>
              <p class="text-gray-500 text-sm mt-1">Acompanhamento dos eventos da negociação.</p>
            </div>
            <button class="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors" data-action="closeTimeline">✕</button>
          </header>
          <section class="p-4 sm:p-6 overflow-y-auto flex-1 space-y-2">
            ${timeline.length ? timeline.map((item) => renderTimelineItem(item)).join('') : '<p class="text-gray-400 text-center py-8">Sem eventos registrados.</p>'}
          </section>
        </div>
      </div>
    `;
  }

  function renderTimelineItem(item) {
    return `
      <div class="flex gap-4 relative">
        <div class="w-3 h-3 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 mt-1.5 shrink-0 ring-4 ring-primary-100"></div>
        <div class="flex-1 pb-4 border-l-2 border-gray-200 pl-4 -ml-1.5">
          <strong class="text-gray-800 block">${escapeHtml(item.label)}</strong>
          <span class="text-gray-500 text-sm">${item.date ? formatDateTime(item.date) : 'Pendente'}</span>
          <p class="text-gray-600 text-sm mt-1">${escapeHtml(item.description || '')}</p>
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
              <h2 class="text-xl font-bold text-gray-900">Fotos da inspeção</h2>
              <p class="text-gray-500 text-sm">${gallery.index + 1} de ${photos.length}</p>
            </div>
            <button class="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors" data-action="closeGallery">✕</button>
          </header>
          <div class="flex-1 flex items-center justify-center p-4 min-h-[300px] bg-gray-50">
            ${current ? `<img src="${escapeAttr(resolvePhotoUrl(current))}" alt="Foto da inspeção" class="max-w-full max-h-[60vh] object-contain rounded-lg shadow-lg">` : '<p class="text-gray-500">Foto indisponível.</p>'}
          </div>
          <footer class="flex items-center justify-center gap-3 p-4 border-t border-gray-100 bg-white">
            <button class="px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 rounded-lg transition-colors" data-action="galleryPrev" ${gallery.index === 0 ? 'disabled' : ''}>Anterior</button>
            <button class="px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 rounded-lg transition-colors" data-action="galleryNext" ${gallery.index >= photos.length - 1 ? 'disabled' : ''}>Próxima</button>
            ${current ? `<a class="px-4 py-2 bg-gradient-to-r from-primary-600 to-secondary-500 hover:from-primary-700 hover:to-secondary-600 text-white rounded-lg transition-colors" href="${escapeAttr(resolvePhotoUrl(current))}" target="_blank" rel="noopener">Abrir em nova guia</a>` : ''}
          </footer>
        </div>
      </div>
    `;
  }

  function renderFooter() {
    return `
      <footer class="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white py-12">
        <div class="container mx-auto px-6">
          <!-- Grid de 3 colunas -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
            <!-- Coluna 1: Logo e descrição -->
            <div class="space-y-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                  <i class="fas fa-handshake text-white text-lg"></i>
                </div>
                <span class="text-xl font-bold">Intermediação<span class="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-secondary-400">Pro</span></span>
              </div>
              <p class="text-gray-400 text-sm leading-relaxed">Conectando pessoas e oportunidades com segurança e eficiência.</p>
              <div class="flex gap-3 pt-2">
                <a href="#" class="w-9 h-9 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-lg"><i class="fab fa-facebook-f text-sm"></i></a>
                <a href="#" class="w-9 h-9 bg-gradient-to-br from-secondary-400 to-primary-400 rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-lg"><i class="fab fa-twitter text-sm"></i></a>
                <a href="#" class="w-9 h-9 bg-gradient-to-br from-danger-400 to-warning-400 rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-lg"><i class="fab fa-instagram text-sm"></i></a>
              </div>
            </div>

            <!-- Coluna 2: Links -->
            <div class="grid grid-cols-2 gap-6">
              <div>
                <h4 class="text-sm font-bold text-white uppercase tracking-wider mb-4">Navegação</h4>
                <ul class="space-y-2">
                  <li><a href="#" class="text-gray-400 hover:text-secondary-400 transition text-sm">Início</a></li>
                  <li><a href="#" class="text-gray-400 hover:text-secondary-400 transition text-sm">Serviços</a></li>
                  <li><a href="#" class="text-gray-400 hover:text-secondary-400 transition text-sm">Como Funciona</a></li>
                </ul>
              </div>
              <div>
                <h4 class="text-sm font-bold text-white uppercase tracking-wider mb-4">Legal</h4>
                <ul class="space-y-2">
                  <li><a href="#" class="text-gray-400 hover:text-secondary-400 transition text-sm">Termos de Uso</a></li>
                  <li><a href="#" class="text-gray-400 hover:text-secondary-400 transition text-sm">Privacidade</a></li>
                  <li><a href="#" class="text-gray-400 hover:text-secondary-400 transition text-sm">FAQ</a></li>
                </ul>
              </div>
            </div>

            <!-- Coluna 3: Contato -->
            <div>
              <h4 class="text-sm font-bold text-white uppercase tracking-wider mb-4">Contato</h4>
              <ul class="space-y-3">
                <li class="flex items-center gap-3 text-gray-400 text-sm">
                  <div class="w-8 h-8 rounded-lg bg-gray-700/50 flex items-center justify-center flex-shrink-0">
                    <i class="fas fa-envelope text-primary-400 text-xs"></i>
                  </div>
                  <span>contato@intermediacaopro.com</span>
                </li>
                <li class="flex items-center gap-3 text-gray-400 text-sm">
                  <div class="w-8 h-8 rounded-lg bg-gray-700/50 flex items-center justify-center flex-shrink-0">
                    <i class="fas fa-phone text-primary-400 text-xs"></i>
                  </div>
                  <span>(11) 99999-9999</span>
                </li>
                <li class="flex items-center gap-3 text-gray-400 text-sm">
                  <div class="w-8 h-8 rounded-lg bg-gray-700/50 flex items-center justify-center flex-shrink-0">
                    <i class="fas fa-map-marker-alt text-primary-400 text-xs"></i>
                  </div>
                  <span>São Paulo, SP</span>
                </li>
              </ul>
            </div>
          </div>

          <!-- Linha divisória e copyright -->
          <div class="border-t border-gray-700/50 mt-10 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p class="text-gray-500 text-sm">© ${new Date().getFullYear()} IntermediaçãoPro. Todos os direitos reservados.</p>
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
    if (state.currentPage === 'dashboard' && state.showDashboardFiltersModal) {
      parts.push(renderDashboardFiltersModal());
    }
    if (state.timelineNegotiationId) {
      parts.push(renderTimelineModal());
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

    const statusOptions = [
      { key: 'all', label: 'Todos' },
      { key: 'awaiting_admin_approval', label: 'Aguardando revisão' },
      { key: 'pending_acceptance', label: 'Convites pendentes' },
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
              <select class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800" data-action="updateDashboardFiltersDraft" data-field="status">
                ${statusOptions.map((opt) => `<option value="${escapeAttr(opt.key)}" ${opt.key === status ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`).join('')}
              </select>
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
                  class="w-full pl-9 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400"
                  placeholder="Título, participante ou #id"
                  value="${escapeAttr(query)}"
                  data-action="updateDashboardFiltersDraft"
                  data-field="query"
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
    Promise.resolve(handler({ form, ...payload })).catch((error) => handleError(error));
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
    const target = event.target;
    if (!(target instanceof Element)) return;
    const actionEl = target.closest('[data-action]');
    if (!actionEl) return;
    if (actionEl instanceof HTMLFormElement) {
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
    const actionName = target.dataset.action;
    if (!actionName) return;
    const handler = actions[actionName];
    if (typeof handler !== 'function') return;
    const dataset = { ...target.dataset };
    handler({ element: target, value: target.value, dataset, event });
  }

  //#endregion Global Event Delegation (submit/click/input)

  //#endregion PART 2/3: Render, UI e Handlers

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
    if (type !== 'error') {
      toastTimer = setTimeout(() => {
        setState({ toast: null, successMessage: null });
        toastTimer = null;
      }, 4000);
    }
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

  async function loadNegotiations({ force = false } = {}) {
    if (!state.token) return;
    if (!force && Date.now() - state.negotiationsLoadedAt < 15000) return;
    await withLoader(async () => {
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
    }, state.negotiations.length ? null : 'Carregando negociações...');
  }

  async function loadNegotiation(id) {
    if (!id) return;
    await withLoader(async () => {
      const data = await apiCall(`/intermediation/${id}`);
      const negotiation = data?.data || data;
      setState({
        currentNegotiation: negotiation,
        currentPage: 'negotiation-detail'
      });
    }, 'Carregando negociação...');
  }

  async function loadAdminSnapshot({ force = false } = {}) {
    if (!isAdmin() || state.adminIsLoading) return;
    setState({ adminIsLoading: true });
    try {
      const [negotiations, users] = await Promise.all([
        apiCall('/intermediation/admin/all').catch(() => []),
        apiCall('/admin/users').catch(() => [])
      ]);
      const negotiationsList = Array.isArray(negotiations?.data) ? negotiations.data : negotiations || [];
      setState({
        adminNegotiations: negotiationsList,
        adminUsers: Array.isArray(users?.data) ? users.data : users || [],
        adminOverview: buildAdminOverview(negotiationsList)
      });
    } catch (error) {
      handleError(error, 'Não foi possível carregar dados administrativos.');
    } finally {
      setState({ adminIsLoading: false });
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
      loadPendingNotices({ filter: state.pendingFilter });
    }
  }

  async function loadPendingNotices({ filter = 'today' } = {}) {
    if (!isAdmin()) return;
    const params = buildPendingParams(filter);
    try {
      const data = await apiCall(`/intermediation/admin/pending?${params}`);
      const notices = Array.isArray(data?.data) ? data.data : data || [];
      setState({ pendingFilter: filter, pendingNotices: notices });
      await apiCall('/intermediation/admin/pending/opened', { method: 'POST', body: {} }).catch(() => null);
    } catch (error) {
      handleError(error, 'Não foi possível carregar pendências.');
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

  function updatePendingPolling() {
    if (state.token && isAdmin()) {
      startPendingPolling();
    } else {
      stopPendingPolling();
    }
  }

  function isAdmin() {
    return state.user && state.user.role === 'admin';
  }

  function isBuyer(negotiation) {
    return state.user && negotiation?.buyer && negotiation.buyer.id === state.user.id;
  }

  function isSeller(negotiation) {
    return state.user && negotiation?.seller && negotiation.seller.id === state.user.id;
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

  function formatRelativeTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    const now = new Date();
    const diff = now - date;
    if (Number.isNaN(diff)) return '—';
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes} min atrás`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} h atrás`;
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
    return list
      .filter((item) => {
        if (status && status !== 'all') {
          if (item?.status !== status) return false;
        }

        if (!isAdmin() && role && role !== 'all') {
          if (role === 'buyer' && !isBuyer(item)) return false;
          if (role === 'seller' && !isSeller(item)) return false;
        }

        if (query) {
          const q = query.toLowerCase();
          const haystack = [
            item?.product_title,
            item?.product_name,
            item?.buyer?.name,
            item?.buyer?.email,
            item?.seller?.name,
            item?.seller?.email,
            item?.id ? `#${item.id}` : ''
          ].map((value) => (value || '').toString().toLowerCase()).join(' ');
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Primeiro: ordenar por prioridade (ações pendentes primeiro)
        const priorityA = getStatusPriority(a?.status, a);
        const priorityB = getStatusPriority(b?.status, b);
        if (priorityA !== priorityB) return priorityA - priorityB;
        
        // Segundo: ordenar por data (mais recente primeiro)
        const dateA = new Date(a?.updated_at || a?.created_at || 0).getTime();
        const dateB = new Date(b?.updated_at || b?.created_at || 0).getTime();
        return dateB - dateA;
      });
  }

  function storeAuth(token, user) {
    localStorage.setItem(STORAGE_KEYS.token, token);
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
    const targetPage = user?.role === 'admin' ? 'admin' : 'dashboard';
    setState({ token, user, currentPage: targetPage });
  }

  function logout(silent = false) {
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.user);
    stopPendingPolling();
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
      confirmationEmail: null,
      confirmationCooldownRemaining: 0,
      successMessage: silent ? null : 'Sessão finalizada.'
    });
  }

  function navigate(page, payload = {}) {
    if (!AUTH_PAGES.has(page) && !state.token) {
      page = 'login';
    }
    if (page === 'admin' && !isAdmin()) {
      page = 'dashboard';
    }

    // Admin não usa dashboard; o "Admin" é o histórico.
    if (isAdmin() && page === 'dashboard') {
      page = 'admin';
    }

    setState({
      currentPage: page,
      errorMessage: null,
      successMessage: null,
      showDashboardFiltersModal: false,
      filtersExpanded: false
    });

    if (page === 'dashboard') {
      if (!state.negotiations.length) {
        loadNegotiations({ force: true });
      }
    } else if (page === 'admin') {
      if (state.adminTab !== 'negotiations') {
        setState({ adminTab: 'negotiations' });
      }
      if (!state.adminNegotiations.length) {
        loadAdminSnapshot({ force: true });
      }
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
    const steps = [
      { key: 'created', label: 'Convite criado', date: neg.created_at, description: `${neg.seller?.name || 'Vendedor'} iniciou a negociação.` },
      { key: 'buyer_accept', label: 'Comprador aceitou', date: neg.buyer_accepted_at, description: `${neg.buyer?.name || 'Comprador'} aceitou participar.` },
      { key: 'payment', label: 'Pagamento confirmado', date: neg.product_paid_at || neg.buyer_fee_paid_at, description: 'Pagamento registrado.' },
      { key: 'sent_to_intermediary', label: 'Envio à intermediadora', date: neg.sent_to_intermediary_at, description: 'Produto enviado para análise.' },
      { key: 'received', label: 'Produto recebido', date: neg.intermediary_received_at, description: 'Intermediadora confirmou recebimento.' },
      { key: 'approved', label: 'Aprovado pela intermediadora', date: neg.intermediary_approval_confirmed_at || neg.admin_approved_at, description: 'Produto pronto para envio.' },
      { key: 'sent_to_buyer', label: 'Envio ao comprador', date: neg.sent_to_buyer_at, description: 'Produto a caminho do comprador.' },
      { key: 'buyer_confirmed', label: 'Entrega confirmada', date: neg.buyer_confirmed_at, description: 'Comprador confirmou recebimento.' },
      { key: 'finalized', label: 'Finalizado', date: neg.finalized_at || (neg.status === 'delivered' ? neg.updated_at : null), description: 'Negociação finalizada.' }
    ];
    return steps.filter((step) => step.date || step.key === 'created');
  }

  function openGallery(negId, index) {
    const negotiation = state.currentNegotiation;
    if (!negotiation || negotiation.id !== Number(negId)) return;
    const photos = Array.isArray(negotiation.intermediary_photos) ? negotiation.intermediary_photos : [];
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
    navigate({ dataset }) {
      if (!dataset || !dataset.page) return;
      navigate(dataset.page, dataset);
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
    dashboardPrevPage() {
      const next = Math.max(1, (Number(state.dashboardPage) || 1) - 1);
      if (next !== state.dashboardPage) setState({ dashboardPage: next });
    },
    dashboardNextPage() {
      const total = getFilteredNegotiations().length;
      const size = Math.max(1, Number(state.dashboardPageSize) || 6);
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
        createNegForm: { 
          buyerFound: null, 
          buyerSearching: false, 
          productPhotos: [], 
          photoError: null,
          title: '',
          category: '',
          description: '',
          price: '',
          buyerEmail: ''
        }
      });
    },
    closeCreateNegotiation() {
      setState({ 
        showCreateNegotiationModal: false,
        showCreateTerms: false,
        createNegForm: { 
          buyerFound: null, 
          buyerSearching: false, 
          productPhotos: [], 
          photoError: null,
          title: '',
          category: '',
          description: '',
          price: '',
          buyerEmail: ''
        }
      });
    },
    updateNegFormField({ element, dataset }) {
      const field = dataset?.field;
      if (!field || !element) return;
      const value = element.value ?? '';
      const currentForm = state.createNegForm || {};
      const nextForm = { ...currentForm, [field]: value };
      if (field === 'buyerEmail') {
        nextForm.buyerFound = null;
      }
      state.createNegForm = nextForm;
    },
    async searchBuyer({ element }) {
      const email = state.createNegForm.buyerEmail?.trim() || '';
      if (!email || !email.includes('@')) {
        notify({ type: 'error', message: 'Informe um e-mail válido.' });
        return;
      }
      setState({ createNegForm: { ...state.createNegForm, buyerSearching: true, buyerFound: null } });
      try {
        const response = await apiCall(`/users/search?email=${encodeURIComponent(email)}`, { method: 'GET' });
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
      const files = element?.files;
      if (!files || !files.length) return;
      const currentPhotos = [...state.createNegForm.productPhotos];
      const maxPhotos = 8;
      const maxSize = 5 * 1024 * 1024; // 5MB
      
      for (let i = 0; i < files.length && currentPhotos.length < maxPhotos; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) {
          setState({ createNegForm: { ...state.createNegForm, photoError: 'Apenas imagens são permitidas.' } });
          continue;
        }
        if (file.size > maxSize) {
          setState({ createNegForm: { ...state.createNegForm, photoError: 'Imagem muito grande. Máximo 5MB.' } });
          continue;
        }
        const preview = URL.createObjectURL(file);
        currentPhotos.push({ file, preview });
      }
      
      setState({ createNegForm: { ...state.createNegForm, productPhotos: currentPhotos, photoError: null } });
      element.value = '';
    },
    removeProductPhoto({ dataset }) {
      const index = Number(dataset?.index);
      const currentPhotos = [...state.createNegForm.productPhotos];
      if (currentPhotos[index]?.preview) {
        URL.revokeObjectURL(currentPhotos[index].preview);
      }
      currentPhotos.splice(index, 1);
      setState({ createNegForm: { ...state.createNegForm, productPhotos: currentPhotos } });
    },
    async createNegotiation({ values, form }) {
      // Validações
      if (!values.title?.trim()) {
        notify({ type: 'error', message: 'Informe o título do produto.' });
        return;
      }
      if (!values.category) {
        notify({ type: 'error', message: 'Selecione uma categoria.' });
        return;
      }
      if (!values.description?.trim()) {
        notify({ type: 'error', message: 'Informe a descrição do produto.' });
        return;
      }
      const price = parseFloat(values.price);
      if (!price || price < 50 || price > 100000) {
        notify({ type: 'error', message: 'O preço deve ser entre R$ 50,00 e R$ 100.000,00.' });
        return;
      }
      if (!state.createNegForm.buyerFound) {
        notify({ type: 'error', message: 'Busque e confirme o comprador antes de criar.' });
        return;
      }
      if (state.createNegForm.productPhotos.length === 0) {
        notify({ type: 'error', message: 'Adicione pelo menos 1 foto do produto.' });
        return;
      }
      if (!state.showCreateTerms) {
        setState({ showCreateTerms: true });
        notify({ type: 'info', message: 'Leia e aceite os termos antes de finalizar.' });
        return;
      }
      if (!values.terms_accepted) {
        notify({ type: 'error', message: 'Você deve aceitar os termos para continuar.' });
        return;
      }

      await withLoader(async () => {
        // Criar FormData para enviar com fotos
        const formData = new FormData();
        formData.append('title', values.title.trim());
        formData.append('category', values.category);
        formData.append('description', values.description.trim());
        formData.append('price', price);
        formData.append('buyer_email', state.createNegForm.buyerFound.email);
        formData.append('terms_accepted', '1');
        
        state.createNegForm.productPhotos.forEach((photo, idx) => {
          formData.append(`photos[${idx}]`, photo.file);
        });

        await apiCall('/intermediation', {
          method: 'POST',
          body: formData,
          isFormData: true
        });
        
        notify({ type: 'success', message: 'Negociação criada com sucesso!' });
        setState({ 
          showCreateNegotiationModal: false,
          showCreateTerms: false,
          createNegForm: { buyerFound: null, buyerSearching: false, productPhotos: [], photoError: null }
        });
        await loadNegotiations({ force: true });
      }, 'Criando negociação...');
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
      loadPendingNotices({ filter: element.value });
    },
    adminSelectTab({ dataset }) {
      const tab = dataset?.tab;
      if (!tab) return;
      setState({ adminTab: tab });
      if (tab === 'negotiations' && !state.adminNegotiations.length) {
        loadAdminSnapshot({ force: true });
      }
    },
    adminRefresh() {
      loadAdminSnapshot({ force: true });
    },
    adminApproveNegotiation({ dataset }) {
      adminApprove(dataset?.id);
    },
    adminRejectNegotiation({ dataset }) {
      adminReject(dataset?.id);
    },
    adminOpenNegotiation({ dataset }) {
      openNegotiationDetail(dataset?.id);
    },
    async acceptNegotiation({ dataset }) {
      const id = Number(dataset?.id);
      if (!id) return;
      if (!confirm('Confirma que deseja aceitar esta negociação?')) return;
      await withLoader(async () => {
        await apiCall(`/intermediation/${id}/approve`, { method: 'POST', body: {} });
        notify({ type: 'success', message: 'Negociação aceita! Aguarde as próximas etapas.' });
        await loadNegotiation(id);
        await loadNegotiations({ force: true });
      }, 'Aceitando negociação...');
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
      }, 'Confirmando pagamento...');
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
      await withLoader(async () => {
        await apiCall('/admin/users', { method: 'POST', body: values });
        if (form) form.reset();
        notify({ type: 'success', message: 'Usuário criado com sucesso.' });
        await loadAdminSnapshot({ force: true });
      }, 'Criando usuário...');
    },
    async adminDeleteUser({ dataset }) {
      const userId = dataset?.id;
      if (!userId) return;
      if (!confirm('Remover este usuário?')) return;
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
      openGallery(dataset?.id, dataset?.index);
    },
    closeGallery() {
      setState({ gallery: null });
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
})();
