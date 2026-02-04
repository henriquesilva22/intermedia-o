  'use strict';

  /*
    NAV (VS Code)
    - Ctrl+P, depois digite: @renderCreateNegotiationModal / @renderNegotiationDetailPage / @renderRegisterPage
    - Ctrl+P, depois digite: @setState / @shouldDeferRender / @hydratePaymentQrCode / @attachGlobalHandlers
    - Ctrl+P, depois digite: @actions.createNegotiation / @actions.searchBuyer / @actions.confirmPayment
    - Outline: Ctrl+Shift+O (lista de funções)
  */

  //#region PART 1/3: Constantes e Estado

  const API_BASE = (window.__API_BASE__ || `${window.location.origin}/api`).replace(/\/$/, '');
  const STORAGE_KEYS = { token: 'token', user: 'user', theme: 'theme' };
  const AUTH_PAGES = new Set(['login', 'register', 'forgot-password', 'reset-password', 'confirm-email']);
  
  // Design Update: Labels mais descritivas
  const STATUS_LABELS = {
    awaiting_admin_approval: 'Aguardando Aprovação',
    pending_acceptance: 'Convite Pendente',
    waiting_payment: 'Pagamento Pendente',
    waiting_digital_delivery: 'Entrega digital pendente',
    pending_receipt: 'Recebimento pendente',
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
    waiting_digital_delivery: 'bg-secondary-50 text-secondary-700 border border-secondary-200',
    pending_receipt: 'bg-warning-50 text-warning-800 border border-warning-200',
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
    inspector: 'Inspetor Técnico',
    intermediator: 'Intermediador'
  };

  function safeParse(raw) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.warn('Failed to parse JSON from storage', error);
      return null;
    }
  }

  const initialToken = localStorage.getItem(STORAGE_KEYS.token) || null;
  const initialUser = safeParse(localStorage.getItem(STORAGE_KEYS.user));
  const initialThemeRaw = String(localStorage.getItem(STORAGE_KEYS.theme) || '').trim().toLowerCase();
  const initialTheme = ['white', 'gray', 'black', 'default'].includes(initialThemeRaw) ? initialThemeRaw : 'default';
  const defaultPendingFilter = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  })();

  const state = {
    theme: initialTheme,
    token: initialToken,
    user: initialUser,
    currentPage: initialToken && (initialUser?.role === 'admin' || initialUser?.role === 'intermediator') ? 'intermediator' : (initialToken ? 'dashboard' : 'login'),
    isLoading: false,
    loadingMessage: null,
    errorMessage: null,
    successMessage: null,
    toast: null,
    statusOptionsQuery: '',
    sidebarSummaryOpen: false,
    sidebarStatusOpen: false,
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
    pendingFilter: defaultPendingFilter,
    showPendingModal: false,
    timelineNegotiationId: null,
    timelineData: null,
    sellerGuideNegotiationId: null,
    confirmPaymentProofForId: null,
    gallery: null,
    showIntermediaryReportModal: false,
    adminTab: 'negotiations',
    adminNegotiationsView: 'active',
    adminNegotiationsPage: 1,
    intermediatorTab: 'mine',
    intermediatorPage: 1,
    intermediatorAvailable: [],
    intermediatorMine: [],
    intermediatorAll: [],
    intermediatorIsLoading: false,
    adminNegotiationsPageSize: 10,
    adminNegotiations: [],
    adminUsers: [],
    adminOverview: null,
    adminIsLoading: false,
    showAdminUserDetailsModal: false,
    adminUserDetails: null,
    // Estado do intermediador
    resetPasswordToken: null,
    resetPasswordEmail: null,
    confirmationEmail: null,
    confirmationCooldownRemaining: 0,
    showCreateNegotiationModal: false,
    showCreateTerms: false,
    showCreateFeeGuide: false,
    createNegStep: 1,
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
      negotiationType: 'digital',
      sellerFeeMode: 'deduct',
      deliveryDays: '',
      digitalGame: '',
      digitalCurrencyType: '',
      digitalQuantity: '',
      digitalPlatformServer: '',
      digitalDeliveryMethod: '',
      serviceId: '',
      gameId: '',
      serviceFields: {},
      description: '',
      price: '',
      buyerTag: ''
    },

    serviceFormsConfig: null,
    serviceFormsLoading: false,
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
    rejectNegotiationId: null,

    // Entrega de gold (comprador): mostrar/ocultar formulário de novo horário
    showBuyerGoldRescheduleForm: false,
    // Entrega de gold (vendedor): mostrar/ocultar formulário de alteração de horário/método
    showSellerGoldScheduleForm: false
  };

  //#endregion PART 1/3: Constantes e Estado

  