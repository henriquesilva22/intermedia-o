(() => {
  'use strict';

  const API_BASE = 'http://127.0.0.1:8000/api';
  const STORAGE_KEYS = { token: 'token', user: 'user' };
  const AUTH_PAGES = new Set(['login', 'register', 'forgot-password', 'reset-password', 'confirm-email']);
  const STATUS_LABELS = {
    awaiting_admin_approval: 'Aguardando intermediadora',
    pending_acceptance: 'Aguardando aceite do comprador',
    waiting_payment: 'Aguardando pagamento',
    waiting_shipment: 'Aguardando envio',
    shipped: 'Enviado para intermediadora',
    at_intermediary: 'Na intermediadora',
    approved: 'Aguardando confirmação do comprador',
    delivered: 'Entregue',
    rejected_by_admin: 'Reprovado',
    cancelled: 'Cancelado',
    expired: 'Expirado'
  };
  const STATUS_BADGE_COLORS = {
    awaiting_admin_approval: 'bg-purple-600',
    pending_acceptance: 'bg-indigo-600',
    waiting_payment: 'bg-amber-500',
    waiting_shipment: 'bg-slate-500',
    shipped: 'bg-blue-600',
    at_intermediary: 'bg-cyan-600',
    approved: 'bg-teal-600',
    delivered: 'bg-green-600',
    rejected_by_admin: 'bg-red-600',
    cancelled: 'bg-red-600',
    expired: 'bg-gray-600'
  };
  const STATUS_ORDER = Object.keys(STATUS_LABELS);
  const ROLE_LABELS = {
    buyer: 'Comprador',
    seller: 'Vendedor',
    admin: 'Administrador',
    inspector: 'Inspetor'
  };

  const initialToken = localStorage.getItem(STORAGE_KEYS.token) || null;
  const initialUser = safeParse(localStorage.getItem(STORAGE_KEYS.user));

  const state = {
    token: initialToken,
    user: initialUser,
    currentPage: initialToken ? 'dashboard' : 'login',
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
      query: '',
      mineOnly: false
    },
    dashboardPage: 1,
    dashboardPageSize: 12,
    pendingCount: 0,
    pendingNotices: [],
    pendingFilter: 'today',
    showPendingModal: false,
    timelineNegotiationId: null,
    timelineData: null,
    gallery: null,
    adminTab: 'overview',
    adminNegotiations: [],
    adminUsers: [],
    adminOverview: null,
    adminIsLoading: false,
    resetPasswordToken: null,
    resetPasswordEmail: null,
    confirmationEmail: null,
    confirmationCooldownRemaining: 0,
    showCreateNegotiationModal: false,
    filtersExpanded: false,
    // Estado para criação de negociação
    createNegForm: {
      buyerFound: null,
      buyerSearching: false,
      productPhotos: [],
      photoError: null
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

  // Constantes do sistema
  const INTERMEDIARY_ADDRESS = {
    street: 'Rua Intermediação, 123',
    city: 'São Paulo - SP',
    cep: '00000-000'
  };

  const PRODUCT_CATEGORIES = [
    'Eletrônicos',
    'Smartphones',
    'Computadores',
    'Games',
    'Acessórios',
    'Roupas',
    'Calçados',
    'Relógios',
    'Joias',
    'Veículos',
    'Móveis',
    'Outros'
  ];

  const INSPECTION_CHECKLIST = [
    { id: 'original', label: 'Produto é original/autêntico' },
    { id: 'functional', label: 'Funcionamento verificado' },
    { id: 'condition_match', label: 'Condição conforme descrito' },
    { id: 'accessories', label: 'Acessórios inclusos verificados' },
    { id: 'no_damage', label: 'Sem danos não declarados' },
    { id: 'packaging', label: 'Embalagem adequada' }
  ];

  let pendingPollingHandle = null;
  let confirmationIntervalHandle = null;
  let toastTimer = null;

  document.addEventListener('DOMContentLoaded', () => {
    injectBaseStyles();
    attachGlobalHandlers();
    render();
    if (state.token && state.user) {
      bootstrapAuthenticated().catch((error) => handleError(error));
    }
  });

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

  function injectBaseStyles() {
    if (document.getElementById('twind-script')) return;
    
    // Load Tailwind CSS from CDN
    const tailwindScript = document.createElement('script');
    tailwindScript.id = 'twind-script';
    tailwindScript.src = 'https://cdn.tailwindcss.com';
    document.head.appendChild(tailwindScript);

    // Load Google Fonts - Inter
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap';
    document.head.appendChild(fontLink);

    // Load Font Awesome
    const faLink = document.createElement('link');
    faLink.rel = 'stylesheet';
    faLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
    document.head.appendChild(faLink);

    // Add base styles with gradients
    const style = document.createElement('style');
    style.id = 'app-styles';
    style.textContent = `
      * { box-sizing: border-box; font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; }
      body { margin: 0; }
      img { max-width: 100%; height: auto; }
      [hidden] { display: none !important; }
      .gradient-bg { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
      .gradient-text { background: linear-gradient(90deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
      .card-hover { transition: transform 0.3s ease, box-shadow 0.3s ease; }
      .card-hover:hover { transform: translateY(-4px); box-shadow: 0 12px 30px rgba(102, 126, 234, 0.15); }
      .btn-gradient { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); transition: all 0.3s ease; }
      .btn-gradient:hover { box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4); transform: translateY(-1px); }
      .glass-card { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1); }
    `;
    document.head.appendChild(style);
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

  function setState(updater) {
    const updates = typeof updater === 'function' ? updater({ ...state }) : updater;
    if (!updates || typeof updates !== 'object') return;

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
      render();
      updatePendingPolling();
    }
  }

  function render() {
    const root = document.getElementById('app');
    if (!root) return;
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
  }

  function renderHeader(isAuthenticated) {
    const userName = state.user?.name || 'Visitante';
    const roleLabel = state.user?.role ? ROLE_LABELS[state.user.role] || state.user.role : '';
    return `
      <header class="sticky top-0 z-50 bg-white shadow-md">
        <div class="container mx-auto px-4 py-3 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 gradient-bg rounded-lg flex items-center justify-center">
              <i class="fas fa-handshake text-white text-xl"></i>
            </div>
            <span class="text-2xl font-bold text-gray-800">Intermediação<span class="gradient-text">Pro</span></span>
          </div>
          ${isAuthenticated ? `
            <nav class="hidden md:flex items-center gap-6">
              <button class="font-medium transition ${state.currentPage === 'dashboard' ? 'text-purple-600' : 'text-gray-700 hover:text-purple-600'}" data-action="navigate" data-page="dashboard">
                <i class="fas fa-home mr-1"></i> Dashboard
              </button>
              ${isAdmin() ? `
                <button class="font-medium transition ${state.currentPage === 'admin' ? 'text-purple-600' : 'text-gray-700 hover:text-purple-600'}" data-action="navigate" data-page="admin">
                  <i class="fas fa-cog mr-1"></i> Admin
                </button>
                <button class="relative font-medium text-gray-700 hover:text-purple-600 transition" data-action="openPendingModal">
                  <i class="fas fa-bell mr-1"></i> Pendências
                  ${state.pendingCount ? `<span class="absolute -top-2 -right-3 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">${state.pendingCount}</span>` : ''}
                </button>
              ` : ''}
            </nav>
            <div class="flex items-center gap-4">
              <div class="hidden md:block text-right">
                <span class="block font-semibold text-gray-800">${escapeHtml(userName)}</span>
                <small class="text-gray-500 text-xs">${escapeHtml(roleLabel)}</small>
              </div>
              <button class="btn-gradient text-white px-5 py-2 rounded-lg font-medium" data-action="logout">
                <i class="fas fa-sign-out-alt mr-1"></i> Sair
              </button>
            </div>
          ` : `
            <nav class="hidden md:flex items-center gap-6">
              <a href="#" class="text-gray-700 hover:text-purple-600 font-medium transition">Início</a>
              <a href="#" class="text-gray-700 hover:text-purple-600 font-medium transition">Serviços</a>
              <a href="#" class="text-gray-700 hover:text-purple-600 font-medium transition">Como Funciona</a>
            </nav>
            <div class="flex items-center gap-3">
              <button class="text-gray-700 font-medium hover:text-purple-600 transition hidden md:block" data-action="navigate" data-page="login">Entrar</button>
              <button class="btn-gradient text-white px-5 py-2 rounded-lg font-medium" data-action="navigate" data-page="register">Cadastre-se</button>
            </div>
          `}
        </div>
      </header>
    `;
  }

  function renderNotifications() {
    const banners = [];
    if (state.errorMessage) {
      banners.push(`<div class="px-4 py-3 bg-red-100 border border-red-300 text-red-700 rounded-lg flex items-center gap-2"><i class="fas fa-exclamation-circle"></i> ${escapeHtml(state.errorMessage)}</div>`);
    }
    if (state.successMessage) {
      banners.push(`<div class="px-4 py-3 bg-green-100 border border-green-300 text-green-700 rounded-lg flex items-center gap-2"><i class="fas fa-check-circle"></i> ${escapeHtml(state.successMessage)}</div>`);
    }
    if (state.loadingMessage) {
      banners.push(`<div class="px-4 py-3 bg-blue-100 border border-blue-300 text-blue-700 rounded-lg flex items-center gap-2"><i class="fas fa-spinner fa-spin"></i> ${escapeHtml(state.loadingMessage)}</div>`);
    }
    return banners.length ? `<section class="container mx-auto px-4 py-3 flex flex-col gap-2">${banners.join('')}</section>` : '';
  }

  function renderPublicLayout() {
    return `<main class="flex-1 gradient-bg flex items-center justify-center p-6 min-h-[calc(100vh-200px)]">${renderPublicPage()}</main>`;
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
      <section class="w-full max-w-md bg-white rounded-2xl p-8 shadow-2xl card-hover">
        <div class="text-center mb-6">
          <div class="w-16 h-16 gradient-bg rounded-xl flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-user-lock text-white text-2xl"></i>
          </div>
          <h1 class="text-2xl font-bold text-gray-800">Bem-vindo(a) de volta</h1>
          <p class="text-gray-600 mt-2">Acesse sua conta para acompanhar negociações.</p>
        </div>
        <form data-action="login" class="flex flex-col gap-4">
          <label class="flex flex-col gap-1">
            <span class="text-sm text-gray-700 font-medium">E-mail</span>
            <input type="email" name="email" required autocomplete="email" placeholder="voce@email.com" class="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm text-gray-700 font-medium">Senha</span>
            <input type="password" name="password" required autocomplete="current-password" minlength="8" class="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
          </label>
          <button type="submit" class="w-full py-3 btn-gradient rounded-lg font-bold text-white mt-2">Entrar</button>
        </form>
        <div class="flex justify-between mt-6 text-sm">
          <button class="text-purple-600 hover:text-purple-800 font-medium transition" data-action="navigate" data-page="forgot-password">Esqueci minha senha</button>
          <button class="text-purple-600 hover:text-purple-800 font-medium transition" data-action="navigate" data-page="register">Criar conta</button>
        </div>
      </section>
    `;
  }

  function renderRegisterPage() {
    return `
      <section class="w-full max-w-md bg-white rounded-2xl p-8 shadow-2xl card-hover">
        <div class="text-center mb-6">
          <div class="w-16 h-16 bg-gradient-to-r from-green-400 to-blue-500 rounded-xl flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-user-plus text-white text-2xl"></i>
          </div>
          <h1 class="text-2xl font-bold text-gray-800">Criar conta</h1>
          <p class="text-gray-600 mt-2">Cadastre-se para negociar com segurança.</p>
        </div>
        <form data-action="register" class="flex flex-col gap-4">
          <label class="flex flex-col gap-1">
            <span class="text-sm text-gray-700 font-medium">Nome completo</span>
            <input type="text" name="name" required autocomplete="name" class="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm text-gray-700 font-medium">E-mail</span>
            <input type="email" name="email" required autocomplete="email" class="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm text-gray-700 font-medium">Telefone</span>
            <input type="tel" name="phone" placeholder="(00) 00000-0000" class="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm text-gray-700 font-medium">Senha</span>
            <input type="password" name="password" required minlength="8" autocomplete="new-password" class="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm text-gray-700 font-medium">Confirmar senha</span>
            <input type="password" name="password_confirmation" required minlength="8" autocomplete="new-password" class="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
          </label>
          <button type="submit" class="w-full py-3 btn-gradient rounded-lg font-bold text-white mt-2">Cadastrar</button>
        </form>
        <div class="flex justify-center mt-6 text-sm">
          <button class="text-purple-600 hover:text-purple-800 font-medium transition" data-action="navigate" data-page="login">Já tenho conta</button>
        </div>
      </section>
    `;
  }

  function renderForgotPasswordPage() {
    return `
      <section class="w-full max-w-md bg-white rounded-2xl p-8 shadow-2xl card-hover">
        <div class="text-center mb-6">
          <div class="w-16 h-16 bg-gradient-to-r from-amber-400 to-orange-500 rounded-xl flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-key text-white text-2xl"></i>
          </div>
          <h1 class="text-2xl font-bold text-gray-800">Recuperar acesso</h1>
          <p class="text-gray-600 mt-2">Informe o e-mail cadastrado para receber instruções.</p>
        </div>
        <form data-action="forgotPassword" class="flex flex-col gap-4">
          <label class="flex flex-col gap-1">
            <span class="text-sm text-gray-700 font-medium">E-mail</span>
            <input type="email" name="email" required class="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
          </label>
          <button type="submit" class="w-full py-3 btn-gradient rounded-lg font-bold text-white mt-2">Enviar link de recuperação</button>
        </form>
        <div class="flex justify-center mt-6 text-sm">
          <button class="text-purple-600 hover:text-purple-800 font-medium transition" data-action="navigate" data-page="login">Voltar para login</button>
        </div>
      </section>
    `;
  }

  function renderResetPasswordPage() {
    return `
      <section class="w-full max-w-md bg-white rounded-2xl p-8 shadow-2xl card-hover">
        <div class="text-center mb-6">
          <div class="w-16 h-16 bg-gradient-to-r from-teal-400 to-green-500 rounded-xl flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-lock text-white text-2xl"></i>
          </div>
          <h1 class="text-2xl font-bold text-gray-800">Definir nova senha</h1>
          <p class="text-gray-600 mt-2">Escolha uma senha forte para proteger sua conta.</p>
        </div>
        <form data-action="resetPassword" class="flex flex-col gap-4">
          <label class="flex flex-col gap-1">
            <span class="text-sm text-gray-700 font-medium">Token de redefinição</span>
            <input type="text" name="token" required value="${escapeAttr(state.resetPasswordToken || '')}" placeholder="Cole o token recebido por email" class="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm text-gray-700 font-medium">E-mail</span>
            <input type="email" name="email" required value="${escapeAttr(state.resetPasswordEmail || '')}" class="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm text-gray-700 font-medium">Nova senha</span>
            <input type="password" name="password" required minlength="8" autocomplete="new-password" class="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm text-gray-700 font-medium">Confirmar senha</span>
            <input type="password" name="password_confirmation" required minlength="8" autocomplete="new-password" class="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
          </label>
          <button type="submit" class="w-full py-3 btn-gradient rounded-lg font-bold text-white mt-2">Atualizar senha</button>
        </form>
        <div class="flex justify-center mt-6 text-sm">
          <button class="text-purple-600 hover:text-purple-800 font-medium transition" data-action="navigate" data-page="login">Voltar para login</button>
        </div>
      </section>
    `;
  }

  function renderConfirmEmailPage() {
    return `
      <section class="w-full max-w-md bg-white rounded-2xl p-8 shadow-2xl card-hover text-center">
        <div class="w-16 h-16 bg-gradient-to-r from-blue-400 to-cyan-500 rounded-xl flex items-center justify-center mx-auto mb-4">
          <i class="fas fa-envelope text-white text-2xl"></i>
        </div>
        <h1 class="text-2xl font-bold text-gray-800 mb-2">Confirme seu e-mail</h1>
        <p class="text-gray-600 mb-4">Enviamos um link de confirmação para ${escapeHtml(state.confirmationEmail || 'seu e-mail')}.</p>
        <p class="text-gray-500 text-sm mb-6">Não recebeu? Podemos reenviar.</p>
        <div class="flex flex-col gap-3">
          <button class="w-full py-3 btn-gradient disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold text-white transition" data-action="resendConfirmation" ${state.confirmationCooldownRemaining ? 'disabled' : ''}>
            ${state.confirmationCooldownRemaining ? `Aguarde ${state.confirmationCooldownRemaining}s` : 'Reenviar e-mail'}
          </button>
          <button class="text-purple-600 hover:text-purple-800 font-medium transition text-sm" data-action="navigate" data-page="login">Voltar</button>
        </div>
      </section>
    `;
  }

  function renderProtectedView() {
    return `<main class="flex-1 w-full max-w-6xl mx-auto p-6">${renderProtectedPage()}</main>`;
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
    return `
      <section class="space-y-0">
        <!-- Header principal -->
        <header class="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 class="text-2xl font-bold text-gray-800">Minhas negociações</h1>
            <p class="text-gray-500">Gerencie cada etapa do processo de intermediação.</p>
          </div>
          <div class="flex gap-2">
            <button class="px-4 py-2 btn-gradient rounded-lg text-white font-medium flex items-center gap-2" data-action="openCreateNegotiation"><i class="fas fa-plus"></i> Nova negociação</button>
            <button class="px-4 py-2 bg-white border border-gray-200 hover:border-purple-400 rounded-lg text-gray-700 transition shadow-sm" data-action="dashboardRefresh"><i class="fas fa-sync-alt"></i></button>
            ${isAdmin() ? '<button class="px-4 py-2 bg-white border border-gray-200 hover:border-purple-400 rounded-lg text-gray-700 transition shadow-sm" data-action="navigate" data-page="admin">Ir para admin</button>' : ''}
          </div>
        </header>

        <!-- Barra de filtros estilo Mercado Livre -->
        ${renderFilterBar()}

        <!-- Cards de resumo -->
        <div class="mb-6">
          ${renderDashboardSummary()}
        </div>

        <!-- Tabela de negociações -->
        ${renderNegotiationsTable(negotiations)}
      </section>
      ${state.showCreateNegotiationModal ? renderCreateNegotiationModal() : ''}
    `;
  }

  function renderFilterBar() {
    const { status, query, mineOnly } = state.negotiationFilters;
    const statusOptions = [
      { key: 'all', label: 'Todos', icon: 'fa-list' },
      { key: 'awaiting_admin_approval', label: 'Aguardando Análise', icon: 'fa-hourglass-half' },
      { key: 'pending_acceptance', label: 'Aguardando Aceite', icon: 'fa-user-check' },
      { key: 'waiting_payment', label: 'Aguardando Pagamento', icon: 'fa-credit-card' },
      { key: 'waiting_shipment', label: 'Aguardando Envio', icon: 'fa-box' },
      { key: 'shipped', label: 'Em Trânsito', icon: 'fa-truck' },
      { key: 'at_intermediary', label: 'Na Intermediadora', icon: 'fa-warehouse' },
      { key: 'approved', label: 'Aprovado', icon: 'fa-check-circle' },
      { key: 'delivered', label: 'Entregue', icon: 'fa-flag-checkered' },
      { key: 'cancelled', label: 'Cancelado', icon: 'fa-times-circle' }
    ];

    const activeFilter = statusOptions.find(o => o.key === status) || statusOptions[0];

    return `
      <div class="bg-white border-y border-gray-200 -mx-6 px-6 py-3 mb-6 sticky top-16 z-30 shadow-sm">
        <div class="flex items-center gap-4 flex-wrap">
          <!-- Filtros à esquerda -->
          <div class="flex items-center gap-2">
            <div class="relative">
              <button class="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition text-sm" data-action="toggleFilters">
                <i class="fas ${activeFilter.icon} text-purple-500"></i>
                <span>${escapeHtml(activeFilter.label)}</span>
                <i class="fas fa-chevron-down text-gray-400 text-xs ml-1"></i>
              </button>
              ${state.filtersExpanded ? `
                <div class="absolute top-full left-0 mt-1 w-64 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50">
                  ${statusOptions.map((opt) => `
                    <button
                      class="w-full px-4 py-2.5 text-left text-sm transition flex items-center gap-3 ${status === opt.key ? 'bg-purple-50 text-purple-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}"
                      data-action="dashboardStatusFilter"
                      data-status="${opt.key}"
                    >
                      <i class="fas ${opt.icon} w-4 ${status === opt.key ? 'text-purple-500' : 'text-gray-400'}"></i>
                      ${escapeHtml(opt.label)}
                      ${status === opt.key ? '<i class="fas fa-check text-purple-500 ml-auto"></i>' : ''}
                    </button>
                  `).join('')}
                </div>
              ` : ''}
            </div>

            <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer px-3 py-2.5 rounded-lg hover:bg-gray-100 transition">
              <input type="checkbox" ${mineOnly ? 'checked' : ''} data-action="dashboardMine" class="w-4 h-4 rounded bg-gray-50 border-gray-300 text-purple-600 focus:ring-purple-500">
              <span>Apenas minhas</span>
            </label>
          </div>

          <!-- Espaço flexível -->
          <div class="flex-1"></div>

          <!-- Busca à direita -->
          <div class="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 min-w-[280px]">
            <i class="fas fa-search text-gray-400"></i>
            <input type="search" placeholder="Buscar negociação..." value="${escapeAttr(query)}" data-action="dashboardSearch" class="bg-transparent text-gray-800 placeholder-gray-400 focus:outline-none flex-1 text-sm">
          </div>
        </div>
      </div>
    `;
  }

  function renderCreateNegotiationModal() {
    const { buyerFound, buyerSearching, productPhotos, photoError } = state.createNegForm;
    const photosHtml = productPhotos.map((photo, idx) => `
      <div class="relative group">
        <img src="${photo.preview}" alt="Foto ${idx + 1}" class="w-full h-24 object-cover rounded-lg border border-gray-200">
        <button type="button" class="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition" data-action="removeProductPhoto" data-index="${idx}">✕</button>
      </div>
    `).join('');

    return `
      <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full my-4 overflow-hidden">
          <div class="h-1 gradient-bg"></div>
          <header class="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 class="text-xl font-bold text-gray-800">Nova Negociação</h2>
              <p class="text-gray-500 text-sm">Preencha todos os dados para iniciar</p>
            </div>
            <button class="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors" data-action="closeCreateNegotiation">✕</button>
          </header>
          
          <form data-action="createNegotiation" class="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            <!-- Título do produto -->
            <label class="flex flex-col gap-1">
              <span class="text-sm text-gray-700 font-medium">Título do produto *</span>
              <input type="text" name="title" required maxlength="255" placeholder="Ex: iPhone 15 Pro Max 256GB" class="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
            </label>

            <!-- Categoria -->
            <label class="flex flex-col gap-1">
              <span class="text-sm text-gray-700 font-medium">Categoria *</span>
              <select name="category" required class="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                <option value="">Selecione uma categoria</option>
                ${PRODUCT_CATEGORIES.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
              </select>
            </label>

            <!-- Descrição -->
            <label class="flex flex-col gap-1">
              <span class="text-sm text-gray-700 font-medium">Descrição detalhada *</span>
              <textarea name="description" rows="3" required maxlength="2000" placeholder="Descreva o estado do produto, acessórios inclusos, defeitos conhecidos, etc." class="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"></textarea>
            </label>

            <!-- Preço -->
            <div class="grid grid-cols-2 gap-4">
              <label class="flex flex-col gap-1">
                <span class="text-sm text-gray-700 font-medium">Preço (R$) *</span>
                <input type="number" name="price" required min="50" max="100000" step="0.01" placeholder="0,00" class="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                <span class="text-xs text-gray-400">Mínimo R$ 50,00 - Máximo R$ 100.000,00</span>
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-sm text-gray-700 font-medium">Prazo de envio</span>
                <input type="text" value="2 dias úteis" disabled class="px-4 py-3 bg-gray-200 border border-gray-300 rounded-lg text-gray-600 cursor-not-allowed">
                <span class="text-xs text-amber-600"><i class="fas fa-info-circle mr-1"></i>Prazo fixo obrigatório</span>
              </label>
            </div>

            <!-- Upload de fotos -->
            <div class="space-y-2">
              <span class="text-sm text-gray-700 font-medium">Fotos do produto (até 8 fotos) *</span>
              <div class="grid grid-cols-4 gap-2">
                ${photosHtml}
                ${productPhotos.length < 8 ? `
                  <label class="w-full h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition">
                    <i class="fas fa-camera text-gray-400 text-xl mb-1"></i>
                    <span class="text-xs text-gray-400">Adicionar</span>
                    <input type="file" accept="image/*" multiple class="hidden" data-action="addProductPhotos">
                  </label>
                ` : ''}
              </div>
              ${photoError ? `<p class="text-xs text-red-500"><i class="fas fa-exclamation-circle mr-1"></i>${photoError}</p>` : ''}
              <p class="text-xs text-gray-400">Adicione pelo menos 1 foto. Formatos: JPG, PNG. Máx 5MB cada.</p>
            </div>

            <!-- Busca do comprador -->
            <div class="space-y-2">
              <label class="flex flex-col gap-1">
                <span class="text-sm text-gray-700 font-medium">E-mail do comprador *</span>
                <div class="flex gap-2">
                  <input type="email" name="buyer_email" required placeholder="comprador@email.com" class="flex-1 px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent" data-action="searchBuyerOnBlur">
                  <button type="button" class="px-4 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-700 transition" data-action="searchBuyer">
                    ${buyerSearching ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-search"></i>'}
                  </button>
                </div>
              </label>
              ${buyerFound === false ? `
                <div class="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  <i class="fas fa-exclamation-circle mr-2"></i>Comprador não encontrado. Verifique o e-mail ou peça para se cadastrar.
                </div>
              ` : ''}
              ${buyerFound ? `
                <div class="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-3">
                  <i class="fas fa-check-circle text-lg"></i>
                  <div>
                    <strong>${escapeHtml(buyerFound.name)}</strong>
                    <span class="block text-xs text-green-600">${escapeHtml(buyerFound.email)}</span>
                  </div>
                </div>
              ` : ''}
            </div>

            <!-- Endereço da intermediadora -->
            <div class="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200">
              <h3 class="text-sm font-bold text-purple-800 mb-2 flex items-center gap-2">
                <i class="fas fa-map-marker-alt"></i> Endereço para envio
              </h3>
              <p class="text-purple-700 font-medium">${INTERMEDIARY_ADDRESS.street}</p>
              <p class="text-purple-700">${INTERMEDIARY_ADDRESS.city}</p>
              <p class="text-purple-700">CEP: ${INTERMEDIARY_ADDRESS.cep}</p>
              <p class="text-xs text-purple-600 mt-2 italic">
                <i class="fas fa-info-circle mr-1"></i>
                Você deve enviar o produto em até 2 dias úteis após aprovar a venda.
              </p>
            </div>

            <!-- Termo de verificação -->
            <label class="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl cursor-pointer">
              <input type="checkbox" name="terms_accepted" required class="w-5 h-5 mt-0.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500">
              <span class="text-sm text-amber-800">
                <strong>Declaro que:</strong> O produto está em condições conforme descrito, assumo responsabilidade pela veracidade das informações e autorizo a intermediadora a inspecionar o produto.
              </span>
            </label>

            <div class="flex gap-3 pt-4 border-t border-gray-200">
              <button type="button" class="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition" data-action="closeCreateNegotiation">Cancelar</button>
              <button type="submit" class="flex-1 px-4 py-3 btn-gradient rounded-lg text-white font-bold" ${!buyerFound ? 'disabled' : ''}>
                <i class="fas fa-paper-plane mr-2"></i>Criar negociação
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
          <div class="w-16 h-16 gradient-bg rounded-xl flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-folder-open text-white text-2xl"></i>
          </div>
          <p class="mb-4 text-gray-600">Sem negociações carregadas ainda.</p>
          <button class="px-6 py-3 btn-gradient rounded-lg text-white font-bold" data-action="dashboardRefresh">Atualizar agora</button>
        </div>
      `;
    }
    const total = list.length;
    const active = list.filter((item) => !['delivered', 'cancelled', 'rejected_by_admin', 'expired'].includes(item?.status)).length;
    const awaiting = list.filter((item) => item?.status === 'awaiting_admin_approval').length;
    const delivered = list.filter((item) => item?.status === 'delivered').length;

    return `
      <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        ${renderSummaryCard('Total', total, 'fa-chart-bar', 'from-purple-500 to-indigo-600', 'Resumo de negociações registradas')}
        ${renderSummaryCard('Em andamento', active, 'fa-clock', 'from-blue-500 to-cyan-500', 'Negociações ainda não finalizadas')}
        ${renderSummaryCard('Aguardando aprovação', awaiting, 'fa-hourglass-half', 'from-amber-500 to-orange-500', 'Necessitam análise da intermediadora')}
        ${renderSummaryCard('Entregues', delivered, 'fa-check-circle', 'from-green-500 to-emerald-500', 'Finalizadas com sucesso')}
      </section>
    `;
  }

  function renderSummaryCard(label, value, icon, gradient, description) {
    return `
      <article class="bg-white rounded-2xl p-6 shadow-lg card-hover border border-gray-100">
        <div class="flex items-center gap-4">
          <div class="w-14 h-14 bg-gradient-to-r ${gradient} rounded-xl flex items-center justify-center">
            <i class="fas ${icon} text-white text-xl"></i>
          </div>
          <div>
            <span class="text-gray-500 text-sm">${escapeHtml(label)}</span>
            <div class="text-3xl font-bold text-gray-800">${Number(value) || 0}</div>
          </div>
        </div>
        <footer class="text-xs text-gray-400 mt-3">${escapeHtml(description)}</footer>
      </article>
    `;
  }

  function renderNegotiationsTable(negotiations) {
    if (!negotiations.length) {
      return `
        <div class="text-center py-12">
          <div class="w-16 h-16 bg-gradient-to-r from-gray-300 to-gray-400 rounded-xl flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-inbox text-white text-2xl"></i>
          </div>
          <p class="mb-4 text-gray-500">Nenhum resultado para os filtros atuais.</p>
          <button class="px-6 py-3 bg-white border border-gray-200 hover:border-purple-400 rounded-lg text-gray-700 font-medium transition shadow-sm" data-action="dashboardRefresh">Recarregar</button>
        </div>
      `;
    }
    const rows = negotiations.map((neg) => renderNegotiationRow(neg)).join('');
    return `
      <section class="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
        <div class="grid grid-cols-12 gap-2 px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">
          <span class="col-span-1">ID</span>
          <span class="col-span-3">Produto</span>
          <span class="col-span-2">Comprador</span>
          <span class="col-span-2">Vendedor</span>
          <span class="col-span-2">Status</span>
          <span class="col-span-2">Atualização</span>
        </div>
        ${rows}
      </section>
    `;
  }

  function renderNegotiationRow(neg) {
    const buyerName = neg?.buyer?.name || '—';
    const sellerName = neg?.seller?.name || '—';
    const productTitle = neg?.product_title || neg?.product_name || neg?.title || 'Produto';
    const status = neg?.status || 'unknown';
    const priority = getStatusPriority(status, neg);
    const needsAction = priority <= 2;
    
    const baseClasses = 'grid grid-cols-12 gap-2 px-6 py-5 border-t border-gray-100 items-center transition cursor-pointer';
    const hoverClass = 'hover:bg-purple-50';
    const actionClasses = needsAction ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-l-orange-400' : '';
    const rowClasses = `${baseClasses} ${hoverClass} ${actionClasses}`;
    
    const actionBadge = needsAction ? '<span class="ml-1 inline-block w-2 h-2 bg-orange-500 rounded-full animate-pulse" title="Ação necessária"></span>' : '';
    
    return `
      <div class="${rowClasses}" data-action="openNegotiation" data-id="${neg?.id}">
        <span class="col-span-1 text-gray-500 font-semibold text-sm flex items-center">#${neg?.id ?? '—'}${actionBadge}</span>
        <span class="col-span-3 text-gray-800 font-medium truncate pr-2">${escapeHtml(productTitle)}</span>
        <span class="col-span-2 text-gray-600 truncate text-sm">${escapeHtml(buyerName)}</span>
        <span class="col-span-2 text-gray-600 truncate text-sm">${escapeHtml(sellerName)}</span>
        <span class="col-span-2">${renderStatusBadge(status)}</span>
        <span class="col-span-2 text-gray-500 text-sm flex items-center gap-2">
          <i class="fas fa-clock text-gray-400 text-xs"></i>
          ${formatRelativeTime(neg?.updated_at || neg?.created_at)}
        </span>
      </div>
    `;
  }

  function renderStatusBadge(status) {
    const label = STATUS_LABELS[status] || status || '—';
    const colorClass = STATUS_BADGE_COLORS[status] || 'bg-gray-600';
    return `<span class="inline-block px-2 py-1 rounded-full text-xs font-medium text-white ${colorClass}">${escapeHtml(label)}</span>`;
  }

  function renderNegotiationDetailPage() {
    const negotiation = state.currentNegotiation;
    if (!negotiation) {
      return `
        <section class="space-y-6">
          <header>
            <h1 class="text-2xl font-bold text-gray-800">Negociação</h1>
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
            <button class="text-purple-600 hover:text-purple-800 font-medium transition mb-2 flex items-center gap-2" data-action="navigate" data-page="dashboard"><i class="fas fa-arrow-left"></i> Voltar</button>
            <h1 class="text-3xl font-bold text-gray-800">Negociação #${negotiation.id}</h1>
            <p class="text-gray-500">${escapeHtml(productTitle)}</p>
          </div>
          <div class="flex items-center gap-3">
            <span>${renderStatusBadge(status)}</span>
            <button class="px-4 py-2 bg-white border border-gray-200 hover:border-purple-400 rounded-lg text-gray-700 font-medium transition shadow-sm flex items-center gap-2" data-action="openTimeline" data-id="${negotiation.id}"><i class="fas fa-stream"></i> Linha do tempo</button>
          </div>
        </header>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <article class="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 card-hover">
            <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-info-circle text-purple-500"></i> Resumo</h2>
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
              <section class="mt-6 pt-4 border-t border-gray-200">
                <h3 class="text-sm font-medium text-gray-600 mb-2">Descrição enviada pelo vendedor</h3>
                <p class="text-gray-500">${escapeHtml(negotiation.product_description || negotiation.description)}</p>
              </section>
            ` : ''}
          </article>

          <article class="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 card-hover">
            <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-users text-blue-500"></i> Participantes</h2>
            <div class="space-y-4">
              <div class="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                <header class="flex items-center gap-2 mb-2">
                  <span class="px-2 py-0.5 bg-amber-500 text-white text-xs rounded-full font-medium">Vendedor</span>
                  ${isSellerRole ? '<span class="px-2 py-0.5 gradient-bg text-white text-xs rounded-full font-medium">Você</span>' : ''}
                </header>
                <strong class="block text-gray-800">${escapeHtml(seller.name || '—')}</strong>
                <span class="block text-gray-500 text-sm">${escapeHtml(seller.email || '—')}</span>
                <span class="block text-gray-500 text-sm">${formatPhone(seller.phone)}</span>
              </div>
              <div class="p-4 bg-gradient-to-r from-cyan-50 to-blue-50 rounded-xl border border-cyan-200">
                <header class="flex items-center gap-2 mb-2">
                  <span class="px-2 py-0.5 bg-cyan-500 text-white text-xs rounded-full font-medium">Comprador</span>
                  ${isBuyerRole ? '<span class="px-2 py-0.5 gradient-bg text-white text-xs rounded-full font-medium">Você</span>' : ''}
                </header>
                <strong class="block text-gray-800">${escapeHtml(buyer.name || '—')}</strong>
                <span class="block text-gray-500 text-sm">${escapeHtml(buyer.email || '—')}</span>
                <span class="block text-gray-500 text-sm">${formatPhone(buyer.phone)}</span>
              </div>
            </div>
          </article>
        </div>

        ${renderLogisticsSection(negotiation, { isBuyer: isBuyerRole, isSeller: isSellerRole })}
        ${renderBuyerAcceptSection(negotiation, { isBuyer: isBuyerRole })}
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
      <article class="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 card-hover">
        <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-truck text-green-500"></i> Logística</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
            <h3 class="text-sm font-medium text-gray-700 mb-1">Rastreio para intermediadora</h3>
            <p class="text-gray-800 font-medium">${trackSeller ? escapeHtml(trackSeller) : 'Não informado'}</p>
            ${neg.sent_to_intermediary_at || neg.shipped_at ? `<small class="text-gray-500">Postado em ${formatDate(neg.sent_to_intermediary_at || neg.shipped_at)}</small>` : ''}
          </div>
          <div class="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
            <h3 class="text-sm font-medium text-gray-700 mb-1">Rastreio para comprador</h3>
            <p class="text-gray-800 font-medium">${trackBuyer ? escapeHtml(trackBuyer) : 'Não informado'}</p>
            ${neg.sent_to_buyer_at ? `<small class="text-gray-500">Despachado em ${formatDate(neg.sent_to_buyer_at)}</small>` : ''}
          </div>
        </div>
        ${renderTrackingForms(neg, { isBuyer, isSeller })}
      </article>
    `;
  }

  function renderBuyerAcceptSection(neg, { isBuyer }) {
    // Mostra apenas se o status for pending_acceptance e o usuário for comprador ou não tiver comprador ainda
    const canAccept = neg.status === 'pending_acceptance' && (isBuyer || !neg.buyer_id);
    if (!canAccept) return '';

    return `
      <article class="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 shadow-lg border-2 border-green-300">
        <h2 class="text-lg font-bold text-green-800 mb-4 flex items-center gap-2"><i class="fas fa-handshake text-green-600"></i> Aceite da Negociação</h2>
        <p class="text-green-700 mb-4">Esta negociação está aguardando o aceite do comprador. Revise os detalhes acima e confirme sua participação.</p>
        
        <!-- Endereço de envio informativo -->
        <div class="p-4 bg-white rounded-xl border border-green-200 mb-4">
          <h3 class="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
            <i class="fas fa-info-circle text-blue-500"></i> Informações importantes
          </h3>
          <p class="text-sm text-gray-600 mb-2">O vendedor deve enviar o produto em até <strong>2 dias úteis</strong> após você aceitar.</p>
          <p class="text-sm text-gray-600">Após o aceite, você receberá as instruções de pagamento.</p>
        </div>
        
        <div class="flex flex-wrap gap-3">
          <button class="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 rounded-lg text-white font-bold transition shadow-md flex items-center gap-2" data-action="acceptNegotiation" data-id="${neg.id}">
            <i class="fas fa-check"></i> Aceitar e participar
          </button>
          <button class="px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 rounded-lg text-white font-medium transition shadow-md flex items-center gap-2" data-action="openRejectModal" data-id="${neg.id}">
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
    
    // Dados para QR Code Pix (simulado)
    const pixKey = 'pix@intermediacao.com.br';
    const pixCode = `00020126580014br.gov.bcb.pix0136${pixKey}5204000053039865406${total.toFixed(2)}5802BR5925INTERMEDIACAO PRO LTDA6009SAO PAULO62070503***6304`;

    return `
      <article class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 shadow-lg border-2 border-blue-300">
        <h2 class="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2"><i class="fas fa-qrcode text-blue-600"></i> Pagamento via Pix</h2>
        
        <div class="grid md:grid-cols-2 gap-6">
          <div>
            <div class="bg-white p-4 rounded-xl border border-blue-200 mb-4">
              <h3 class="text-sm font-medium text-gray-700 mb-3">Resumo do pagamento</h3>
              <div class="space-y-2 text-sm">
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
                  <span class="text-blue-600 font-bold text-lg">${formatCurrency(total)}</span>
                </div>
              </div>
            </div>
            
            <div class="space-y-3">
              <div class="p-3 bg-white rounded-lg border border-blue-200">
                <span class="text-xs text-gray-500 block mb-1">Chave Pix (E-mail)</span>
                <div class="flex items-center gap-2">
                  <code class="text-sm text-gray-800 flex-1">${pixKey}</code>
                  <button class="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs text-gray-600" data-action="copyText" data-value="${pixKey}">
                    <i class="fas fa-copy"></i>
                  </button>
                </div>
              </div>
              
              <button class="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 rounded-lg text-white font-bold transition shadow-md" data-action="confirmPayment" data-id="${neg.id}">
                <i class="fas fa-check mr-2"></i>Já realizei o pagamento
              </button>
            </div>
          </div>
          
          <div class="flex flex-col items-center justify-center">
            <div class="bg-white p-4 rounded-xl border border-blue-200">
              <div class="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center mb-3" id="qrcode-container">
                <!-- QR Code gerado via JS -->
                <canvas id="qrcode-${neg.id}" class="w-full h-full"></canvas>
              </div>
              <p class="text-xs text-center text-gray-500">Escaneie com o app do seu banco</p>
            </div>
            <script>
              (function() {
                const canvas = document.getElementById('qrcode-${neg.id}');
                if (canvas && window.QRCode) {
                  QRCode.toCanvas(canvas, '${pixCode}', { width: 192 });
                }
              })();
            </script>
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
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
          <div class="h-1 bg-gradient-to-r from-red-500 to-pink-500"></div>
          <header class="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 class="text-xl font-bold text-gray-800">Recusar Negociação</h2>
              <p class="text-gray-500 text-sm">Informe o motivo da recusa</p>
            </div>
            <button class="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors" data-action="closeRejectModal">✕</button>
          </header>
          <form data-action="rejectNegotiationBuyer" class="p-6 space-y-4">
            <input type="hidden" name="negotiation_id" value="${state.rejectNegotiationId || ''}">
            <label class="flex flex-col gap-1">
              <span class="text-sm text-gray-700 font-medium">Motivo da recusa *</span>
              <select name="reject_reason_type" required class="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent">
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
              <textarea name="reject_details" rows="3" maxlength="500" placeholder="Explique melhor o motivo..." class="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"></textarea>
            </label>
            <div class="flex gap-3 pt-4">
              <button type="button" class="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition" data-action="closeRejectModal">Cancelar</button>
              <button type="submit" class="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 rounded-lg text-white font-bold">
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
    
    // Vendedor pode adicionar código apenas UMA VEZ (se ainda não tem código)
    // Admin pode sempre editar
    const sellerCanAddCode = isSeller && !trackSeller && neg.status === 'waiting_shipment';
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
            <label class="flex flex-col gap-1 flex-1 min-w-[200px]">
              <span class="text-sm text-gray-600 font-medium"><i class="fas fa-truck mr-1"></i>Código de rastreio para intermediadora</span>
              <input type="text" name="tracking_code" placeholder="Ex: BR123456789" required class="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
            </label>
            <button type="submit" class="px-4 py-3 btn-gradient rounded-lg text-white font-medium">Salvar</button>
          </form>
        `);
      } else if (adminCanEditSellerCode) {
        // Admin pode editar
        sections.push(`
          <form class="flex flex-wrap items-end gap-3 mt-4" data-action="updateTracking" data-id="${neg.id}" data-type="seller">
            <label class="flex flex-col gap-1 flex-1 min-w-[200px]">
              <span class="text-sm text-gray-600 font-medium"><i class="fas fa-truck mr-1"></i>Rastreio para intermediadora (Admin)</span>
              <input type="text" name="tracking_code" placeholder="Ex: BR123456789" value="${escapeAttr(trackSeller)}" required class="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
            </label>
            <button type="submit" class="px-4 py-3 btn-gradient rounded-lg text-white font-medium">Atualizar</button>
          </form>
        `);
      } else if (trackSeller) {
        // Apenas visualização para vendedor (já preenchido) e comprador
        sections.push(`
          <div class="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <span class="text-sm text-gray-600 font-medium"><i class="fas fa-truck mr-1"></i>Rastreio para intermediadora</span>
            <div class="mt-1 flex items-center gap-2">
              <code class="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 font-mono">${escapeHtml(trackSeller)}</code>
              <a href="https://www.google.com/search?q=${encodeURIComponent(trackSeller + ' rastreio')}" target="_blank" class="text-purple-600 hover:text-purple-700 text-sm"><i class="fas fa-external-link-alt"></i> Rastrear</a>
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
            <label class="flex flex-col gap-1 flex-1 min-w-[200px]">
              <span class="text-sm text-gray-600 font-medium"><i class="fas fa-shipping-fast mr-1"></i>Rastreio para comprador (Admin)</span>
              <input type="text" name="tracking_code" placeholder="Ex: BR987654321" value="${escapeAttr(trackBuyer)}" required class="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
            </label>
            <button type="submit" class="px-4 py-3 btn-gradient rounded-lg text-white font-medium">Atualizar</button>
          </form>
        `);
      } else if (trackBuyer) {
        // Apenas visualização para comprador e vendedor
        sections.push(`
          <div class="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <span class="text-sm text-gray-600 font-medium"><i class="fas fa-shipping-fast mr-1"></i>Rastreio para comprador</span>
            <div class="mt-1 flex items-center gap-2">
              <code class="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 font-mono">${escapeHtml(trackBuyer)}</code>
              <a href="https://www.google.com/search?q=${encodeURIComponent(trackBuyer + ' rastreio')}" target="_blank" class="text-purple-600 hover:text-purple-700 text-sm"><i class="fas fa-external-link-alt"></i> Rastrear</a>
            </div>
          </div>
        `);
      }
    }

    if (!sections.length) return '';
    return `<div class="mt-4 pt-4 border-t border-gray-200">${sections.join('')}</div>`;
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
        <div class="grid grid-cols-3 gap-4 py-2 border-b border-slate-700 last:border-b-0">
          <span class="text-white">${escapeHtml(label)}</span>
          <span class="text-green-600 font-bold">${formatCurrency(payment.amount)}</span>
          <span class="text-gray-500">${escapeHtml(status)}</span>
        </div>
      `;
    }).join('');
    return `
      <article class="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 card-hover">
        <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-credit-card text-indigo-500"></i> Pagamentos</h2>
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
    const showInspectionForm = atIntermediary && !neg.intermediary_approval_confirmed_at;
    const showFinalize = neg.status === 'delivered';

    const sections = [];

    if (showApproveReject) {
      sections.push(`
        <section class="pt-4 border-t border-gray-200 first:border-t-0 first:pt-0">
          <h3 class="text-sm font-medium text-gray-700 mb-3">Aprovação inicial</h3>
          <div class="flex flex-wrap gap-3">
            <button class="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 rounded-lg text-white font-medium transition shadow-md" data-action="adminApproveNegotiation" data-id="${neg.id}"><i class="fas fa-check mr-2"></i>Aprovar negociação</button>
            <button class="px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 rounded-lg text-white font-medium transition shadow-md" data-action="adminRejectNegotiation" data-id="${neg.id}"><i class="fas fa-times mr-2"></i>Reprovar</button>
          </div>
        </section>
      `);
    }

    if (showInspectionForm) {
      sections.push(`
        <section class="pt-4 border-t border-gray-200">
          <h3 class="text-sm font-medium text-gray-700 mb-3">Envio ao comprador</h3>
          <form data-action="approveProduct" data-id="${neg.id}" class="space-y-4">
            <label class="flex flex-col gap-1">
              <span class="text-sm text-gray-600 font-medium">Rastreio para o comprador</span>
              <input type="text" name="tracking_to_buyer" required placeholder="Código de rastreio" class="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm text-gray-600 font-medium">Observações</span>
              <textarea name="intermediary_notes" rows="3" placeholder="Observações sobre estado do produto" class="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"></textarea>
            </label>
            <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" name="seller_transferred" checked class="w-4 h-4 rounded bg-gray-50 border-gray-300 text-purple-600 focus:ring-purple-500">
              <span>Transferir valor ao vendedor imediatamente</span>
            </label>
            <div class="flex flex-wrap gap-3">
              <button type="submit" class="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 rounded-lg text-white font-medium transition shadow-md"><i class="fas fa-paper-plane mr-2"></i>Aprovar e enviar</button>
              <button type="button" class="px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 rounded-lg text-white font-medium transition shadow-md" data-action="rejectProduct" data-id="${neg.id}"><i class="fas fa-times mr-2"></i>Reprovar</button>
            </div>
          </form>
        </section>
      `);
    }

    if (neg.status === 'at_intermediary' && !neg.intermediary_received_status) {
      sections.push(`
        <section class="pt-4 border-t border-gray-200">
          <h3 class="text-sm font-medium text-gray-700 mb-3">Confirmação de chegada na intermediadora</h3>
          <button class="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-lg text-white font-medium transition shadow-md" data-action="markIntermediaryReceived" data-id="${neg.id}"><i class="fas fa-box-open mr-2"></i>Marcar como recebido</button>
        </section>
      `);
    }

    if (showFinalize) {
      sections.push(`
        <section class="pt-4 border-t border-gray-200">
          <h3 class="text-sm font-medium text-gray-700 mb-3">Finalização</h3>
          <button class="px-4 py-2 btn-gradient rounded-lg text-white font-bold transition shadow-md" data-action="finalizeNegotiation" data-id="${neg.id}"><i class="fas fa-flag-checkered mr-2"></i>Finalizar negociação</button>
        </section>
      `);
    }

    if (!sections.length) return '';

    return `
      <article class="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 card-hover">
        <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-shield-alt text-purple-500"></i> Ações da intermediadora</h2>
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
        <article class="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 card-hover">
          <header class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-bold text-gray-800 flex items-center gap-2">
              <i class="fas fa-clipboard-check text-teal-500"></i> Relatório de Inspeção
            </h2>
            <button class="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 text-sm transition" data-action="editInspectionReport" data-id="${neg.id}">
              <i class="fas fa-edit mr-1"></i>Editar
            </button>
          </header>
          
          <div class="space-y-4">
            <!-- Checklist -->
            <div class="grid grid-cols-2 gap-2">
              ${INSPECTION_CHECKLIST.map(item => `
                <div class="flex items-center gap-2 text-sm ${checklist[item.id] ? 'text-green-600' : 'text-red-500'}">
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
                <div class="grid grid-cols-3 gap-2">
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
      <article class="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 card-hover">
        <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <i class="fas fa-clipboard-check text-teal-500"></i> ${existingReport ? 'Editar' : 'Criar'} Relatório de Inspeção
        </h2>
        
        <form data-action="saveInspectionReport" data-id="${neg.id}" class="space-y-5">
          <!-- Checklist -->
          <div>
            <h3 class="text-sm font-medium text-gray-700 mb-3">Checklist de verificação</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              ${INSPECTION_CHECKLIST.map(item => `
                <label class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
                  <input type="checkbox" name="checklist_${item.id}" ${state.inspectionReport.checklist[item.id] ? 'checked' : ''} class="w-5 h-5 rounded border-gray-300 text-teal-600 focus:ring-teal-500">
                  <span class="text-sm text-gray-700">${escapeHtml(item.label)}</span>
                </label>
              `).join('')}
            </div>
          </div>
          
          <!-- Upload de fotos -->
          <div>
            <h3 class="text-sm font-medium text-gray-700 mb-2">Fotos da inspeção (até 3)</h3>
            <div class="grid grid-cols-4 gap-2">
              ${currentPhotos.map((photo, idx) => `
                <div class="relative group">
                  <img src="${photo.preview || resolvePhotoUrl(photo)}" alt="Foto ${idx + 1}" class="w-full h-20 object-cover rounded-lg border border-gray-200">
                  <button type="button" class="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition" data-action="removeInspectionPhoto" data-index="${idx}">✕</button>
                </div>
              `).join('')}
              ${currentPhotos.length < 3 ? `
                <label class="w-full h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-teal-400 hover:bg-teal-50 transition">
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
            <textarea name="inspection_notes" rows="3" placeholder="Descreva o estado do produto, problemas encontrados, etc." class="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none">${escapeHtml(state.inspectionReport.notes || '')}</textarea>
          </label>
          
          <div class="flex gap-3">
            ${existingReport ? `
              <button type="button" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition" data-action="cancelEditInspectionReport">Cancelar</button>
            ` : ''}
            <button type="submit" class="flex-1 px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 rounded-lg text-white font-medium transition shadow-md">
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
      <article class="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 card-hover">
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
        <form data-action="submitInternalLog" data-id="${neg.id}" class="mt-4 pt-4 border-t border-gray-200">
          <div class="flex gap-2">
            <input type="text" name="log_message" placeholder="Adicionar nota interna..." class="flex-1 px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm">
            <select name="log_type" class="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
              <option value="note">Nota</option>
              <option value="warning">Alerta</option>
              <option value="action">Ação</option>
              <option value="system">Sistema</option>
            </select>
            <button type="submit" class="px-4 py-2 btn-gradient rounded-lg text-white text-sm font-medium">
              <i class="fas fa-plus"></i>
            </button>
          </div>
        </form>
      </article>
    `;
  }

  function getLogBorderColor(type) {
    const colors = {
      note: 'border-blue-400',
      warning: 'border-amber-400',
      action: 'border-green-400',
      system: 'border-gray-400',
      error: 'border-red-400'
    };
    return colors[type] || colors.note;
  }

  function getLogTextColor(type) {
    const colors = {
      note: 'text-blue-600',
      warning: 'text-amber-600',
      action: 'text-green-600',
      system: 'text-gray-600',
      error: 'text-red-600'
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
        <section class="pt-4 border-t border-gray-200 first:border-t-0 first:pt-0">
          <h3 class="text-sm font-medium text-gray-700 mb-2">Confirmação de recebimento</h3>
          <p class="text-gray-500 text-sm mb-3">Ao confirmar, a negociação avança para etapa final.</p>
          <button class="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 rounded-lg text-white font-medium transition shadow-md" data-action="buyerConfirmDelivery" data-id="${neg.id}"><i class="fas fa-check mr-2"></i>Confirmar recebimento</button>
        </section>
      `);

      sections.push(`
        <section class="pt-4 border-t border-gray-200">
          <h3 class="text-sm font-medium text-gray-700 mb-3">Avaliação da experiência</h3>
          <form data-action="submitBuyerFeedback" data-id="${neg.id}" class="space-y-4">
            <label class="flex flex-col gap-1">
              <span class="text-sm text-gray-600 font-medium">Nota (1 a 10)</span>
              <input type="number" name="buyer_rating" min="1" max="10" value="${neg.buyer_rating ?? 10}" required class="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent w-24">
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm text-gray-600 font-medium">Comentário (opcional)</span>
              <textarea name="buyer_rating_comment" rows="3" maxlength="500" placeholder="Conte como foi sua experiência" class="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"></textarea>
            </label>
            <button type="submit" class="px-4 py-2 btn-gradient rounded-lg text-white font-medium"><i class="fas fa-paper-plane mr-2"></i>Enviar feedback</button>
          </form>
        </section>
      `);
    }

    if (!sections.length) return '';

    return `
      <article class="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 card-hover">
        <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-user-check text-cyan-500"></i> Ações do participante</h2>
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
    
    if (!photos.length && !productPhotos.length && !report) return '';
    
    return `
      <article class="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 card-hover">
        <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-images text-pink-500"></i> Fotos e Relatórios</h2>
        
        ${productPhotos.length ? `
          <section class="mb-6">
            <h3 class="text-sm font-medium text-gray-700 mb-3">Fotos do Produto</h3>
            <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              ${productPhotos.map((url, index) => `
                <button class="aspect-square rounded-xl overflow-hidden bg-gray-100 hover:ring-2 hover:ring-purple-500 transition shadow-md" data-action="openGallery" data-id="${neg.id}" data-index="${index}" data-type="product">
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
                <button class="aspect-square rounded-xl overflow-hidden bg-gray-100 hover:ring-2 hover:ring-purple-500 transition shadow-md" data-action="openGallery" data-id="${neg.id}" data-index="${index}">
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
            <h1 class="text-3xl font-bold text-gray-800">Painel administrativo</h1>
            <p class="text-gray-500">Visão completa de negociações e usuários.</p>
          </div>
          <div class="flex gap-3">
            <button class="px-4 py-2 bg-white border border-gray-200 hover:border-purple-400 rounded-lg text-gray-700 font-medium transition shadow-sm flex items-center gap-2" data-action="adminRefresh"><i class="fas fa-sync-alt"></i> Atualizar</button>
            <button class="px-4 py-2 btn-gradient rounded-lg text-white font-medium flex items-center gap-2" data-action="openPendingModal"><i class="fas fa-bell"></i> Pendências (${state.pendingCount})</button>
          </div>
        </header>
        ${renderAdminTabs()}
        ${renderAdminContent()}
      </section>
    `;
  }

  function renderAdminTabs() {
    const tabs = [
      { key: 'overview', label: 'Resumo', icon: 'fa-chart-pie' },
      { key: 'negotiations', label: 'Negociações', icon: 'fa-handshake' },
      { key: 'users', label: 'Usuários', icon: 'fa-users' }
    ];
    return `
      <nav class="flex gap-2 bg-white rounded-xl p-2 shadow-md">
        ${tabs.map((tab) => `
          <button class="flex-1 px-4 py-3 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${state.adminTab === tab.key ? 'btn-gradient text-white' : 'text-gray-600 hover:text-purple-600 hover:bg-purple-50'}" data-action="adminSelectTab" data-tab="${tab.key}">
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
      case 'overview':
      default:
        return renderAdminOverview();
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
        <article class="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-chart-bar text-purple-500"></i> Resumo geral</h2>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
            ${renderSummaryCard('Negociações', overview.total, 'fa-box', 'from-purple-500 to-indigo-600', 'Total de registros')}
            ${renderSummaryCard('Pendentes', overview.awaiting, 'fa-hourglass-half', 'from-amber-500 to-orange-500', 'Necessitam análise')}
            ${renderSummaryCard('Usuários', state.adminUsers.length, 'fa-users', 'from-cyan-500 to-blue-500', 'Usuários registrados')}
          </div>
        </article>
        <article class="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-chart-pie text-blue-500"></i> Distribuição por status</h2>
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
          <button class="px-6 py-3 bg-white border border-gray-200 hover:border-purple-400 rounded-lg text-gray-700 font-medium transition shadow-sm" data-action="adminRefresh">Recarregar</button>
        </div>
      `;
    }
    const rows = list.map((neg) => {
      const canApprove = neg.status === 'awaiting_admin_approval';
      return `
      <div class="grid grid-cols-7 gap-4 px-6 py-4 border-t border-gray-100 items-center hover:bg-purple-50 transition">
        <span class="text-gray-500 font-medium">#${neg.id}</span>
        <span class="truncate text-gray-800 font-medium">${escapeHtml(neg.product_title || neg.product_name || neg.title || 'Produto')}</span>
        <span class="truncate text-gray-600">${escapeHtml(neg.buyer?.name || '—')}</span>
        <span class="truncate text-gray-600">${escapeHtml(neg.seller?.name || '—')}</span>
        <span>${renderStatusBadge(neg.status)}</span>
        <span class="text-gray-500 text-sm">${formatDateTime(neg.updated_at)}</span>
        <span class="flex flex-wrap gap-1">
          <button class="px-3 py-1 btn-gradient rounded text-xs text-white font-medium" data-action="adminOpenNegotiation" data-id="${neg.id}">Detalhes</button>
          ${canApprove ? `
            <button class="px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-500 rounded text-xs text-white font-medium" data-action="adminApproveNegotiation" data-id="${neg.id}">Aprovar</button>
            <button class="px-3 py-1 bg-gradient-to-r from-red-500 to-pink-500 rounded text-xs text-white font-medium" data-action="adminRejectNegotiation" data-id="${neg.id}">Reprovar</button>
          ` : ''}
        </span>
      </div>
    `;
    }).join('');
    return `
      <section class="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
        <div class="grid grid-cols-7 gap-4 px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">
          <span>ID</span>
          <span>Produto</span>
          <span>Comprador</span>
          <span>Vendedor</span>
          <span>Status</span>
          <span>Atualizado</span>
          <span></span>
        </div>
        ${rows}
      </section>
    `;
  }

  function renderAdminUsers() {
    const users = Array.isArray(state.adminUsers) ? state.adminUsers : [];
    return `
      <section class="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
        <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-user-plus text-green-500"></i> Gerenciar Usuários</h2>
        <form class="flex flex-wrap gap-3 mb-6" data-action="adminCreateInvitation">
          <input type="text" name="name" placeholder="Nome completo" required class="flex-1 min-w-[160px] px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
          <input type="email" name="email" placeholder="email@exemplo.com" required class="flex-1 min-w-[180px] px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
          <select name="role" class="min-w-[140px] px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
            <option value="buyer">Comprador</option>
            <option value="seller">Vendedor</option>
            <option value="admin">Administrador</option>
          </select>
          <button type="submit" class="px-6 py-3 btn-gradient rounded-lg text-white font-bold"><i class="fas fa-plus mr-2"></i>Criar convite</button>
        </form>
        <div class="space-y-2 mt-4">
          ${users.length ? users.map((user) => `
            <div class="grid grid-cols-5 gap-4 items-center py-4 px-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100 hover:shadow-md transition">
              <span class="text-gray-800 font-medium">${escapeHtml(user.name || user.email || 'Usuário')}</span>
              <span class="text-gray-500">${escapeHtml(user.email || '—')}</span>
              <span class="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium inline-block w-fit">${ROLE_LABELS[user.role] || user.role || '—'}</span>
              <span class="text-gray-400 text-sm">${formatDate(user.created_at)}</span>
              <button class="px-3 py-2 bg-gradient-to-r from-red-500 to-pink-500 rounded-lg text-sm text-white font-medium transition" data-action="adminDeleteUser" data-id="${user.id}"><i class="fas fa-trash mr-1"></i>Remover</button>
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
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
          <header class="flex items-start justify-between p-6 border-b border-gray-200">
            <div>
              <h2 class="text-xl font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-bell text-purple-500"></i> Pendências</h2>
              <p class="text-gray-500 text-sm">Negociações aguardando ação da intermediadora.</p>
            </div>
            <button class="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition" data-action="closePendingModal">✕</button>
          </header>
          <section class="flex-1 overflow-y-auto p-6">
            <label class="flex items-center gap-3 mb-4">
              <span class="text-gray-600 text-sm font-medium">Filtrar por mês</span>
              <select data-action="selectPendingFilter" class="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
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
      <article class="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-200 card-hover">
        <header class="flex items-center justify-between mb-3">
          <span class="px-2 py-0.5 gradient-bg text-white text-xs rounded-full font-medium">#${neg.id}</span>
          <span class="text-gray-500 text-sm">${formatRelativeTime(neg.created_at)}</span>
        </header>
        <div class="space-y-2 mb-4">
          <strong class="block text-gray-800">${escapeHtml(product)}</strong>
          <div class="flex flex-wrap gap-4 text-sm text-gray-500">
            <span><i class="fas fa-shopping-cart mr-1"></i> ${escapeHtml(buyer)}</span>
            <span><i class="fas fa-store mr-1"></i> ${escapeHtml(seller)}</span>
          </div>
          <div>Status: ${renderStatusBadge(neg.status)}</div>
        </div>
        <footer class="flex flex-wrap gap-2">
          <button class="px-3 py-2 btn-gradient rounded-lg text-sm text-white font-medium" data-action="adminOpenNegotiation" data-id="${neg.id}"><i class="fas fa-eye mr-1"></i>Ver detalhes</button>
          <button class="px-3 py-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg text-sm text-white font-medium" data-action="adminApproveNegotiation" data-id="${neg.id}"><i class="fas fa-check mr-1"></i>Aprovar</button>
          <button class="px-3 py-2 bg-gradient-to-r from-red-500 to-pink-500 rounded-lg text-sm text-white font-medium" data-action="adminRejectNegotiation" data-id="${neg.id}"><i class="fas fa-times mr-1"></i>Reprovar</button>
        </footer>
      </article>
    `;
  }

  function renderTimelineModal() {
    const timeline = Array.isArray(state.timelineData) ? state.timelineData : [];
    return `
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
          <header class="flex items-start justify-between p-6 border-b border-gray-200">
            <div>
              <h2 class="text-xl font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-stream text-blue-500"></i> Linha do tempo</h2>
              <p class="text-gray-500 text-sm mt-1">Acompanhamento dos eventos da negociação.</p>
            </div>
            <button class="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors" data-action="closeTimeline">✕</button>
          </header>
          <section class="p-6 overflow-y-auto flex-1 space-y-2">
            ${timeline.length ? timeline.map((item) => renderTimelineItem(item)).join('') : '<p class="text-gray-400 text-center py-8">Sem eventos registrados.</p>'}
          </section>
        </div>
      </div>
    `;
  }

  function renderTimelineItem(item) {
    return `
      <div class="flex gap-4 relative">
        <div class="w-3 h-3 rounded-full bg-purple-500 mt-1.5 shrink-0 ring-4 ring-purple-100"></div>
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
        <div class="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
          <div class="h-1 gradient-bg"></div>
          <header class="flex items-start justify-between p-4 border-b border-gray-200">
            <div>
              <h2 class="text-xl font-bold text-gray-800">Fotos da inspeção</h2>
              <p class="text-gray-500 text-sm">${gallery.index + 1} de ${photos.length}</p>
            </div>
            <button class="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors" data-action="closeGallery">✕</button>
          </header>
          <div class="flex-1 flex items-center justify-center p-4 min-h-[300px] bg-gray-50">
            ${current ? `<img src="${escapeAttr(resolvePhotoUrl(current))}" alt="Foto da inspeção" class="max-w-full max-h-[60vh] object-contain rounded-lg shadow-md">` : '<p class="text-gray-500">Foto indisponível.</p>'}
          </div>
          <footer class="flex items-center justify-center gap-3 p-4 border-t border-gray-200 bg-white">
            <button class="px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 rounded-lg transition-colors" data-action="galleryPrev" ${gallery.index === 0 ? 'disabled' : ''}>Anterior</button>
            <button class="px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 rounded-lg transition-colors" data-action="galleryNext" ${gallery.index >= photos.length - 1 ? 'disabled' : ''}>Próxima</button>
            ${current ? `<a class="px-4 py-2 gradient-bg hover:opacity-90 text-white rounded-lg transition-colors" href="${escapeAttr(resolvePhotoUrl(current))}" target="_blank" rel="noopener">Abrir em nova guia</a>` : ''}
          </footer>
        </div>
      </div>
    `;
  }

  function renderFooter() {
    return `
      <footer class="bg-gray-900 text-white py-12">
        <div class="container mx-auto px-4">
          <div class="grid md:grid-cols-4 gap-8">
            <div>
              <div class="flex items-center gap-2 mb-6">
                <div class="w-10 h-10 gradient-bg rounded-lg flex items-center justify-center">
                  <i class="fas fa-handshake text-white text-xl"></i>
                </div>
                <span class="text-2xl font-bold">Intermediação<span class="gradient-text">Pro</span></span>
              </div>
              <p class="text-gray-400">Conectando pessoas e oportunidades com segurança e eficiência.</p>
            </div>
            <div>
              <h4 class="text-xl font-bold mb-6">Links Rápidos</h4>
              <ul class="space-y-3">
                <li><a href="#" class="text-gray-400 hover:text-white transition">Início</a></li>
                <li><a href="#" class="text-gray-400 hover:text-white transition">Serviços</a></li>
                <li><a href="#" class="text-gray-400 hover:text-white transition">Como Funciona</a></li>
              </ul>
            </div>
            <div>
              <h4 class="text-xl font-bold mb-6">Legal</h4>
              <ul class="space-y-3">
                <li><a href="#" class="text-gray-400 hover:text-white transition">Termos de Uso</a></li>
                <li><a href="#" class="text-gray-400 hover:text-white transition">Privacidade</a></li>
                <li><a href="#" class="text-gray-400 hover:text-white transition">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 class="text-xl font-bold mb-6">Contato</h4>
              <ul class="space-y-3 text-gray-400">
                <li class="flex items-center"><i class="fas fa-envelope mr-3"></i> contato@intermediacaopro.com</li>
                <li class="flex items-center"><i class="fas fa-phone mr-3"></i> (11) 99999-9999</li>
              </ul>
              <div class="flex gap-3 mt-6">
                <a href="#" class="w-10 h-10 gradient-bg rounded-full flex items-center justify-center hover:opacity-90 transition"><i class="fab fa-facebook-f"></i></a>
                <a href="#" class="w-10 h-10 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full flex items-center justify-center hover:opacity-90 transition"><i class="fab fa-twitter"></i></a>
                <a href="#" class="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center hover:opacity-90 transition"><i class="fab fa-instagram"></i></a>
              </div>
            </div>
          </div>
          <div class="border-t border-gray-800 mt-10 pt-6 text-center text-gray-500">
            <p>© ${new Date().getFullYear()} IntermediaçãoPro. Todos os direitos reservados.</p>
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
    if (state.timelineNegotiationId) {
      parts.push(renderTimelineModal());
    }
    if (state.gallery) {
      parts.push(renderGalleryModal());
    }
    return parts.join('');
  }

  function renderToast() {
    const toast = state.toast;
    if (!toast || !toast.message) return '';
    const typeColors = {
      success: 'bg-green-600 text-white',
      error: 'bg-red-600 text-white',
      warning: 'bg-yellow-500 text-black',
      info: 'bg-blue-600 text-white'
    };
    const colorClass = typeColors[toast.type] || typeColors.info;
    return `<div class="fixed bottom-6 right-6 px-6 py-3 rounded-xl shadow-xl ${colorClass} z-50 animate-pulse">${escapeHtml(toast.message)}</div>`;
  }

  function attachGlobalHandlers() {
    document.addEventListener('submit', handleSubmit, true);
    document.addEventListener('click', handleClick);
    document.addEventListener('input', handleInput);
  }

  function handleSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const actionName = form.dataset.action;
    if (!actionName) return;
    const handler = actions[actionName];
    if (typeof handler !== 'function') return;
    event.preventDefault();
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
      setState({ pendingFilter: filter });
      const data = await apiCall(`/intermediation/admin/pending?${params}`);
      const notices = Array.isArray(data?.data) ? data.data : data || [];
      setState({ pendingNotices: notices });
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

  // Status que requerem ação do usuário (prioridade alta)
  const ACTION_REQUIRED_STATUSES = [
    'awaiting_admin_approval',
    'pending_buyer_acceptance', 
    'waiting_payment',
    'waiting_shipment',
    'at_intermediary',
    'shipped_to_buyer'
  ];

  function getStatusPriority(status, neg) {
    const userId = state.user?.id;
    const isBuyer = neg?.buyer?.id === userId;
    const isSeller = neg?.seller?.id === userId;
    const admin = isAdmin();

    // Admin: prioridade para aprovação
    if (admin && status === 'awaiting_admin_approval') return 0;
    if (admin && status === 'at_intermediary') return 1;
    
    // Comprador: precisa aceitar ou pagar
    if (isBuyer && status === 'pending_buyer_acceptance') return 0;
    if (isBuyer && status === 'waiting_payment') return 1;
    if (isBuyer && status === 'shipped_to_buyer') return 2;
    
    // Vendedor: precisa enviar
    if (isSeller && status === 'waiting_shipment') return 0;
    
    // Outros status ativos
    if (ACTION_REQUIRED_STATUSES.includes(status)) return 5;
    
    // Status finalizados ou cancelados
    if (['completed', 'delivered', 'cancelled'].includes(status)) return 10;
    
    return 7;
  }

  function getFilteredNegotiations() {
    const list = Array.isArray(state.negotiations) ? state.negotiations : [];
    const { status, query, mineOnly } = state.negotiationFilters;
    return list
      .filter((item) => {
        if (mineOnly) {
          const userId = state.user?.id;
          if (!userId) return false;
          const isParticipant = item?.buyer?.id === userId || item?.seller?.id === userId || item?.created_by?.id === userId;
          if (!isParticipant) return false;
        }
        if (status && status !== 'all') {
          if (item?.status !== status) return false;
        }
        if (query) {
          const q = query.toLowerCase();
          const haystack = [
            item?.product_title,
            item?.product_name,
            item?.buyer?.name,
            item?.seller?.name,
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
    setState({ token, user, currentPage: 'dashboard' });
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

    setState({
      currentPage: page,
      errorMessage: null,
      successMessage: null
    });

    if (page === 'dashboard') {
      if (!state.negotiations.length) {
        loadNegotiations({ force: true });
      }
    } else if (page === 'admin') {
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
    setState({ confirmationCooldownRemaining: seconds });
    confirmationIntervalHandle = setInterval(() => {
      if (state.confirmationCooldownRemaining <= 1) {
        clearInterval(confirmationIntervalHandle);
        confirmationIntervalHandle = null;
        setState({ confirmationCooldownRemaining: 0 });
      } else {
        setState({ confirmationCooldownRemaining: state.confirmationCooldownRemaining - 1 });
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
    navigate({ dataset }) {
      if (!dataset || !dataset.page) return;
      navigate(dataset.page, dataset);
    },
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
      await withLoader(async () => {
        await apiCall('/register', {
          method: 'POST',
          body: {
            name: values.name,
            email: values.email,
            phone: values.phone,
            password: values.password,
            password_confirmation: values.password_confirmation
          }
        });
        notify({ type: 'success', message: 'Conta criada! Faça login para continuar.' });
        setState({
          currentPage: 'login',
          confirmationEmail: values.email
        });
      }, 'Criando conta...');
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
      if (state.confirmationCooldownRemaining) return;
      const email = state.confirmationEmail;
      if (!email) {
        notify({ type: 'error', message: 'Informe o e-mail primeiro.' });
        return;
      }
      await withLoader(async () => {
        await apiCall('/email/resend', { method: 'POST', body: { email } });
        notify({ type: 'success', message: 'E-mail reenviado.' });
        startConfirmationCooldown(45);
      }, 'Reenviando e-mail...');
    },
    dashboardRefresh() {
      loadNegotiations({ force: true });
    },
    dashboardStatusFilter({ dataset }) {
      if (!dataset || dataset.status === undefined) return;
      setState({ negotiationFilters: { ...state.negotiationFilters, status: dataset.status } });
    },
    dashboardSearch({ value }) {
      setState({ negotiationFilters: { ...state.negotiationFilters, query: value || '' } });
    },
    dashboardMine({ element }) {
      const checked = element instanceof HTMLInputElement ? element.checked : false;
      setState({ negotiationFilters: { ...state.negotiationFilters, mineOnly: checked } });
    },
    toggleFilters() {
      setState({ filtersExpanded: !state.filtersExpanded });
    },
    openCreateNegotiation() {
      setState({ 
        showCreateNegotiationModal: true,
        createNegForm: { buyerFound: null, buyerSearching: false, productPhotos: [], photoError: null }
      });
    },
    closeCreateNegotiation() {
      setState({ 
        showCreateNegotiationModal: false,
        createNegForm: { buyerFound: null, buyerSearching: false, productPhotos: [], photoError: null }
      });
    },
    async searchBuyer({ element }) {
      const form = element?.closest('form');
      const emailInput = form?.querySelector('input[name="buyer_email"]');
      const email = emailInput?.value?.trim();
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
    searchBuyerOnBlur({ element }) {
      const email = element?.value?.trim();
      if (email && email.includes('@') && !state.createNegForm.buyerFound) {
        actions.searchBuyer({ element });
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
})();
