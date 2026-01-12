<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Intermediação Segura - Plataforma de Transações Online Seguras</title>
    
    <!-- Twind CSS via CDN (compatível com CSP atual) -->
    <script src="https://cdn.twind.style" crossorigin></script>
    
    <!-- Fontes do Google -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    
    <!-- Ícones -->
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    
    <style>
        :root {
            --primary: #4f46e5;
            --primary-dark: #3730a3;
            --primary-light: #e0e7ff;
            --secondary: #7c3aed;
            --accent: #8b5cf6;
            --light-bg: #f8fafc;
        }
        
        body {
            font-family: 'Inter', sans-serif;
            scroll-behavior: smooth;
            color: #1e293b;
        }
        
        .gradient-bg {
            background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
        }
        
        .gradient-primary {
            background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
        }
        
        .gradient-secondary {
            background: linear-gradient(135deg, var(--primary-light) 0%, #f3f4f6 100%);
        }
        
        .step-card {
            transition: all 0.3s ease;
            border-left: 4px solid var(--primary);
        }
        
        .step-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.1);
        }
        
        .feature-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
            border-radius: 12px;
            color: white;
            font-size: 1.5rem;
            margin-bottom: 1rem;
        }
        
        .feature-icon-secondary {
            background: linear-gradient(135deg, var(--accent) 0%, #a78bfa 100%);
        }
        
        .timeline-line {
            position: relative;
        }
        
        .timeline-line::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 2px;
            background: linear-gradient(180deg, var(--primary) 0%, var(--accent) 100%);
        }
        
        .timeline-dot {
            position: absolute;
            left: -9px;
            top: 0;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
            z-index: 10;
            box-shadow: 0 0 0 4px var(--primary-light);
        }
        
        .fee-card {
            transition: all 0.3s ease;
            border-top: 4px solid transparent;
        }
        
        .fee-card:hover {
            transform: translateY(-5px);
        }
        
        .stats-card {
            background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
            color: white;
            border-radius: 16px;
        }
        
        .animate-fade-in {
            animation: fadeIn 0.6s ease forwards;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .back-to-top {
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            width: 50px;
            height: 50px;
            background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
            cursor: pointer;
            opacity: 0;
            transform: translateY(20px);
            transition: all 0.3s ease;
            z-index: 100;
        }
        
        .back-to-top.visible {
            opacity: 1;
            transform: translateY(0);
        }
        
        .back-to-top:hover {
            background: linear-gradient(135deg, var(--primary-dark) 0%, var(--secondary) 100%);
            transform: translateY(-3px);
        }
        
        .testimonial-card {
            background-color: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.05);
            border: 1px solid #e2e8f0;
            transition: all 0.3s ease;
        }
        
        .testimonial-card:hover {
            box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.1);
            border-color: var(--primary-light);
        }
        
        .highlight-box {
            background: linear-gradient(135deg, var(--primary-light) 0%, #f8fafc 100%);
            border-radius: 12px;
            padding: 1.5rem;
            border-left: 4px solid var(--primary);
        }
        
        .hero-section {
            background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
            color: #1e293b;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .nav-link {
            position: relative;
            color: #475569;
        }
        
        .nav-link:hover {
            color: var(--primary);
        }
        
        .nav-link::after {
            content: '';
            position: absolute;
            width: 0;
            height: 2px;
            background: linear-gradient(90deg, var(--primary) 0%, var(--secondary) 100%);
            left: 0;
            bottom: -5px;
            transition: width 0.3s ease;
        }
        
        .nav-link:hover::after {
            width: 100%;
        }
        
        .mobile-menu {
            transition: all 0.3s ease;
            max-height: 0;
            overflow: hidden;
        }
        
        .mobile-menu.open {
            max-height: 300px;
        }
        
        .section-divider {
            height: 1px;
            background: linear-gradient(90deg, transparent, var(--primary-light), transparent);
            margin: 3rem 0;
        }
        
        .btn-primary {
            background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
            color: white;
            font-weight: 600;
            transition: all 0.3s ease;
        }
        
        .btn-primary:hover {
            background: linear-gradient(135deg, var(--primary-dark) 0%, var(--secondary) 100%);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
        }
        
        .btn-secondary {
            background: white;
            color: var(--primary);
            border: 2px solid var(--primary-light);
            font-weight: 600;
            transition: all 0.3s ease;
        }
        
        .btn-secondary:hover {
            background: var(--primary-light);
            border-color: var(--primary);
        }
        
        .gradient-text {
            background: linear-gradient(90deg, var(--primary) 0%, var(--secondary) 100%);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
            display: inline-block;
        }
        
        .border-gradient {
            border-image: linear-gradient(90deg, var(--primary) 0%, var(--secondary) 100%) 1;
        }
        
        .shadow-soft {
            box-shadow: 0 10px 30px rgba(79, 70, 229, 0.08);
        }
        
        .glow-effect {
            box-shadow: 0 0 20px rgba(139, 92, 246, 0.15);
        }
    </style>
    
    <script>
        // Twind: habilita classes estilo Tailwind sem build step
        twind.install({
            hash: false,
            theme: {
                extend: {
                    colors: {
                        primary: '#4f46e5',
                        'primary-dark': '#3730a3',
                        'primary-light': '#e0e7ff',
                        secondary: '#7c3aed',
                        accent: '#8b5cf6',
                    },
                    fontFamily: {
                        inter: ['Inter', 'sans-serif'],
                    },
                },
            },
        });
    </script>
</head>
<body class="font-inter text-gray-800 bg-gray-100">

    @include('partials.interactive-bg')

    <div style="position:relative; z-index:1;">
    
    <!-- Botão de voltar ao topo -->
    <div id="backToTop" class="back-to-top">
        <i class="fas fa-chevron-up"></i>
    </div>
    
    <!-- Header -->
    <header class="hero-section sticky top-0 z-50 shadow-sm">
        <div class="container mx-auto px-4 py-4">
            <nav class="flex justify-between items-center">
                <div class="flex items-center space-x-3">
                    <div class="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center shadow-soft">
                        <span class="text-white font-bold text-xl">IS</span>
                    </div>
                    <div>
                        <h1 class="text-xl font-bold text-gray-900">Intermediação Segura</h1>
                        <p class="text-sm text-gray-600">Transações 100% protegidas</p>
                    </div>
                </div>
                
                <!-- Menu Desktop -->
                <div class="hidden md:flex items-center space-x-8">
                    <a href="#como-funciona" class="nav-link">Como Funciona</a>
                    <a href="#vantagens" class="nav-link">Vantagens</a>
                    <a href="#taxas" class="nav-link">Taxas</a>
                    <a href="#depoimentos" class="nav-link">Depoimentos</a>
                    <a href="#cta" class="btn-primary px-6 py-2 rounded-lg">Começar Agora</a>
                </div>
                
                <!-- Menu Mobile Button -->
                <button id="mobileMenuButton" class="md:hidden text-2xl text-gray-700">
                    <i class="fas fa-bars"></i>
                </button>
            </nav>
            
            <!-- Menu Mobile -->
            <div id="mobileMenu" class="mobile-menu md:hidden mt-4 bg-white rounded-lg shadow-lg">
                <div class="flex flex-col space-y-4 p-4">
                    <a href="#como-funciona" class="text-gray-700 hover:text-primary transition duration-200">Como Funciona</a>
                    <a href="#vantagens" class="text-gray-700 hover:text-primary transition duration-200">Vantagens</a>
                    <a href="#taxas" class="text-gray-700 hover:text-primary transition duration-200">Taxas</a>
                    <a href="#depoimentos" class="text-gray-700 hover:text-primary transition duration-200">Depoimentos</a>
                    <a href="#cta" class="btn-primary px-6 py-2 rounded-lg text-center">Começar Agora</a>
                </div>
            </div>
        </div>
    </header>
    
    <!-- Hero Content -->
    <section class="gradient-bg">
        <div class="container mx-auto px-4 py-12 md:py-20">
            <div class="flex flex-col lg:flex-row items-center">
                <div class="lg:w-1/2 mb-12 lg:mb-0">
                    <h2 class="text-4xl md:text-5xl font-bold mb-6">Negocie com <span class="gradient-text">segurança total</span> online</h2>
                    <p class="text-lg text-gray-600 mb-8 leading-relaxed">Plataforma de intermediação que protege compradores e vendedores em transações online. Conte com nossa inspeção técnica e garantia de satisfação.</p>
                    <div class="flex flex-col sm:flex-row gap-4">
                        <a href="#cta" class="btn-primary py-3 px-8 rounded-lg text-center">Criar Negociação</a>
                        <a href="#como-funciona" class="btn-secondary py-3 px-8 rounded-lg text-center">Ver Como Funciona</a>
                    </div>
                    <div class="mt-10 flex items-center space-x-6">
                        <div class="flex items-center">
                            <div class="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-soft mr-3">
                                <i class="fas fa-shield-alt text-primary"></i>
                            </div>
                            <div>
                                <p class="font-semibold">100% Seguro</p>
                                <p class="text-sm text-gray-500">Proteção garantida</p>
                            </div>
                        </div>
                        <div class="flex items-center">
                            <div class="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-soft mr-3">
                                <i class="fas fa-bolt text-accent"></i>
                            </div>
                            <div>
                                <p class="font-semibold">Processo Rápido</p>
                                <p class="text-sm text-gray-500">Conclusão em dias</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="lg:w-1/2 flex justify-center">
                    <div class="relative">
                        <div class="w-full max-w-md bg-white rounded-2xl p-8 shadow-soft glow-effect border border-gray-100">
                            <div class="flex items-center mb-6">
                                <div class="feature-icon">
                                    <i class="fas fa-lock"></i>
                                </div>
                                <div>
                                    <h3 class="text-xl font-bold text-gray-900">Processo Seguro</h3>
                                    <p class="text-gray-600">9 etapas de proteção</p>
                                </div>
                            </div>
                            
                            <div class="space-y-4">
                                <div class="flex items-center">
                                    <div class="w-8 h-8 bg-primary-light rounded-full flex items-center justify-center mr-3">
                                        <i class="fas fa-check text-primary text-sm"></i>
                                    </div>
                                    <p>Inspeção técnica completa</p>
                                </div>
                                <div class="flex items-center">
                                    <div class="w-8 h-8 bg-primary-light rounded-full flex items-center justify-center mr-3">
                                        <i class="fas fa-check text-primary text-sm"></i>
                                    </div>
                                    <p>Pagamento protegido</p>
                                </div>
                                <div class="flex items-center">
                                    <div class="w-8 h-8 bg-primary-light rounded-full flex items-center justify-center mr-3">
                                        <i class="fas fa-check text-primary text-sm"></i>
                                    </div>
                                    <p>Rastreio em tempo real</p>
                                </div>
                                <div class="flex items-center">
                                    <div class="w-8 h-8 bg-primary-light rounded-full flex items-center justify-center mr-3">
                                        <i class="fas fa-check text-primary text-sm"></i>
                                    </div>
                                    <p>Garantia de satisfação</p>
                                </div>
                            </div>
                            
                            <div class="mt-8 pt-6 border-t border-gray-200">
                                <p class="text-gray-600 text-sm">Junte-se a <span class="font-bold text-primary">500+</span> usuários satisfeitos</p>
                            </div>
                        </div>
                        
                        <!-- Elementos decorativos -->
                        <div class="absolute -top-4 -right-4 w-20 h-20 bg-accent/10 rounded-full"></div>
                        <div class="absolute -bottom-4 -left-4 w-16 h-16 bg-primary/10 rounded-full"></div>
                    </div>
                </div>
            </div>
        </div>
    </section>
    
    <!-- Stats Section -->
    <section class="py-10 bg-white">
        <div class="container mx-auto px-4">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div class="stats-card p-6 text-center shadow-soft">
                    <p class="text-3xl font-bold">500+</p>
                    <p class="text-sm opacity-90">Transações Concluídas</p>
                </div>
                <div class="bg-gradient-to-r from-accent to-purple-500 p-6 text-center text-white rounded-2xl shadow-soft">
                    <p class="text-3xl font-bold">R$ 0</p>
                    <p class="text-sm opacity-90">Em Golpes Prevenidos</p>
                </div>
                <div class="stats-card p-6 text-center shadow-soft">
                    <p class="text-3xl font-bold">100%</p>
                    <p class="text-sm opacity-90">De Satisfação</p>
                </div>
                <div class="bg-gradient-to-r from-blue-500 to-primary p-6 text-center text-white rounded-2xl shadow-soft">
                    <p class="text-3xl font-bold">24h</p>
                    <p class="text-sm opacity-90">Suporte Disponível</p>
                </div>
            </div>
        </div>
    </section>
    
    <!-- Como Funciona Section -->
    <section id="como-funciona" class="py-16 bg-gray-50">
        <div class="container mx-auto px-4">
            <div class="text-center mb-12">
                <h2 class="text-3xl md:text-4xl font-bold mb-4">Como Funciona</h2>
                <p class="text-gray-600 max-w-2xl mx-auto">Processo seguro em 9 etapas que garante proteção total para compradores e vendedores.</p>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <!-- Etapa 1 -->
                <div class="step-card bg-white p-6 rounded-xl shadow-soft animate-fade-in">
                    <div class="flex items-center mb-4">
                        <div class="w-10 h-10 gradient-primary text-white rounded-full flex items-center justify-center font-bold mr-3">1</div>
                        <h3 class="font-bold text-lg">Vendedor Cria Convite</h3>
                    </div>
                    <p class="text-gray-600">Cadastra título, descrição, fotos e valor do produto, depois envia convite personalizado ao comprador.</p>
                </div>
                
                <!-- Etapa 2 -->
                <div class="step-card bg-white p-6 rounded-xl shadow-soft animate-fade-in">
                    <div class="flex items-center mb-4">
                        <div class="w-10 h-10 gradient-primary text-white rounded-full flex items-center justify-center font-bold mr-3">2</div>
                        <h3 class="font-bold text-lg">Comprador Aceita ou Recusa</h3>
                    </div>
                    <p class="text-gray-600">Se aceitar, o sistema envia para análise. Se recusar, nada é cobrado e a negociação é encerrada.</p>
                </div>
                
                <!-- Etapa 3 -->
                <div class="step-card bg-white p-6 rounded-xl shadow-soft animate-fade-in">
                    <div class="flex items-center mb-4">
                        <div class="w-10 h-10 gradient-primary text-white rounded-full flex items-center justify-center font-bold mr-3">3</div>
                        <h3 class="font-bold text-lg">Pré-análise da Intermediadora</h3>
                    </div>
                    <p class="text-gray-600">Nossa equipe avalia autenticidade, risco de fraude e coerência do anúncio antes de prosseguir.</p>
                </div>
                
                <!-- Etapa 4 -->
                <div class="step-card bg-white p-6 rounded-xl shadow-soft animate-fade-in">
                    <div class="flex items-center mb-4">
                        <div class="w-10 h-10 gradient-primary text-white rounded-full flex items-center justify-center font-bold mr-3">4</div>
                        <h3 class="font-bold text-lg">Pagamento e Taxas</h3>
                    </div>
                    <p class="text-gray-600">Comprador paga produto + taxa de R$15. Vendedor paga R$15 somente se a transação for concluída.</p>
                </div>
                
                <!-- Etapa 5 -->
                <div class="step-card bg-white p-6 rounded-xl shadow-soft animate-fade-in">
                    <div class="flex items-center mb-4">
                        <div class="w-10 h-10 gradient-primary text-white rounded-full flex items-center justify-center font-bold mr-3">5</div>
                        <h3 class="font-bold text-lg">Envio do Produto</h3>
                    </div>
                    <p class="text-gray-600">Vendedor tem até 2 dias úteis para enviar com rastreio. Se não enviar, perde a taxa e comprador é reembolsado.</p>
                </div>
                
                <!-- Etapa 6 -->
                <div class="step-card bg-white p-6 rounded-xl shadow-soft animate-fade-in">
                    <div class="flex items-center mb-4">
                        <div class="w-10 h-10 gradient-primary text-white rounded-full flex items-center justify-center font-bold mr-3">6</div>
                        <h3 class="font-bold text-lg">Conferência Completa</h3>
                    </div>
                    <p class="text-gray-600">Testamos funcionalidades, verificamos autenticidade e estado físico, conferindo com a descrição.</p>
                </div>
            </div>
            
            <!-- Ver mais etapas (ocultas por padrão) -->
            <div id="moreSteps" class="hidden mt-8">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <!-- Etapa 7 -->
                    <div class="step-card bg-white p-6 rounded-xl shadow-soft">
                        <div class="flex items-center mb-4">
                            <div class="w-10 h-10 gradient-primary text-white rounded-full flex items-center justify-center font-bold mr-3">7</div>
                            <h3 class="font-bold text-lg">Envio para Comprador</h3>
                        </div>
                        <p class="text-gray-600">Produto é enviado ao comprador com rastreio garantido. Atualizações aparecem na timeline.</p>
                    </div>
                    
                    <!-- Etapa 8 -->
                    <div class="step-card bg-white p-6 rounded-xl shadow-soft">
                        <div class="flex items-center mb-4">
                            <div class="w-10 h-10 gradient-primary text-white rounded-full flex items-center justify-center font-bold mr-3">8</div>
                            <h3 class="font-bold text-lg">Recusas e Devoluções</h3>
                        </div>
                        <p class="text-gray-600">Recusa enquanto item está conosco: taxas devolvidas. Recusa após receber: comprador perde R$15.</p>
                    </div>
                    
                    <!-- Etapa 9 -->
                    <div class="step-card bg-white p-6 rounded-xl shadow-soft">
                        <div class="flex items-center mb-4">
                            <div class="w-10 h-10 gradient-primary text-white rounded-full flex items-center justify-center font-bold mr-3">9</div>
                            <h3 class="font-bold text-lg">Finalização e Liberação</h3>
                        </div>
                        <p class="text-gray-600">Comprador confirma recebimento e satisfação, então o valor é liberado ao vendedor.</p>
                    </div>
                </div>
            </div>
            
            <div class="text-center mt-10">
                <button id="toggleSteps" class="btn-primary py-3 px-8 rounded-lg">
                    Ver Todas as Etapas <i class="fas fa-chevron-down ml-2"></i>
                </button>
            </div>
        </div>
    </section>
    
    <div class="section-divider"></div>
    
    <!-- Vantagens Section -->
    <section id="vantagens" class="py-16 bg-white">
        <div class="container mx-auto px-4">
            <div class="text-center mb-12">
                <h2 class="text-3xl md:text-4xl font-bold mb-4">Vantagens da Intermediação</h2>
                <p class="text-gray-600 max-w-2xl mx-auto">Criamos um ambiente 100% seguro para negociações online, eliminando riscos de golpes.</p>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div class="gradient-secondary p-8 rounded-xl shadow-soft">
                    <div class="feature-icon">
                        <i class="fas fa-search"></i>
                    </div>
                    <h3 class="font-bold text-xl mb-4">Inspeção Técnica</h3>
                    <p class="text-gray-600">Analisamos todos os produtos antes de encaminhar ao comprador, garantindo que estejam conforme descrito.</p>
                </div>
                
                <div class="gradient-secondary p-8 rounded-xl shadow-soft">
                    <div class="feature-icon feature-icon-secondary">
                        <i class="fas fa-shield-alt"></i>
                    </div>
                    <h3 class="font-bold text-xl mb-4">Pagamento Seguro</h3>
                    <p class="text-gray-600">Vendedor só recebe após confirmação do comprador. Comprador só paga após aprovação da inspeção.</p>
                </div>
                
                <div class="gradient-secondary p-8 rounded-xl shadow-soft">
                    <div class="feature-icon">
                        <i class="fas fa-shipping-fast"></i>
                    </div>
                    <h3 class="font-bold text-xl mb-4">Entrega Protegida</h3>
                    <p class="text-gray-600">Rastreio obrigatório em todas as etapas com atualizações em tempo real na plataforma.</p>
                </div>
                
                <div class="gradient-secondary p-8 rounded-xl shadow-soft">
                    <div class="feature-icon feature-icon-secondary">
                        <i class="fas fa-undo-alt"></i>
                    </div>
                    <h3 class="font-bold text-xl mb-4">Direito à Recusa</h3>
                    <p class="text-gray-600">Recusa protegida se o item não for como descrito, com devolução garantida do valor pago.</p>
                </div>
                
                <div class="gradient-secondary p-8 rounded-xl shadow-soft">
                    <div class="feature-icon">
                        <i class="fas fa-balance-scale"></i>
                    </div>
                    <h3 class="font-bold text-xl mb-4">Proteção Mútua</h3>
                    <p class="text-gray-600">Ambas as partes têm proteção completa caso a outra parte descumpra as regras estabelecidas.</p>
                </div>
                
                <div class="gradient-secondary p-8 rounded-xl shadow-soft">
                    <div class="feature-icon feature-icon-secondary">
                        <i class="fas fa-headset"></i>
                    </div>
                    <h3 class="font-bold text-xl mb-4">Suporte Dedicado</h3>
                    <p class="text-gray-600">Equipe especializada disponível para auxiliar em todas as etapas da transação.</p>
                </div>
            </div>
        </div>
    </section>
    
    <div class="section-divider"></div>
    
    <!-- Taxas Section -->
    <section id="taxas" class="py-16 bg-gray-50">
        <div class="container mx-auto px-4">
            <div class="text-center mb-12">
                <h2 class="text-3xl md:text-4xl font-bold mb-4">Taxas Transparentes</h2>
                <p class="text-gray-600 max-w-2xl mx-auto">Cobranças fixas e sem surpresas. Sem porcentagem sobre o valor do produto.</p>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                <!-- Taxa Comprador -->
                <div class="fee-card bg-white p-8 rounded-xl shadow-soft border-t-4 border-primary glow-effect">
                    <div class="flex items-center mb-6">
                        <div class="w-16 h-16 bg-primary-light rounded-full flex items-center justify-center mr-4">
                            <i class="fas fa-user text-primary text-2xl"></i>
                        </div>
                        <div>
                            <h3 class="font-bold text-2xl">Taxa do Comprador</h3>
                            <p class="text-primary font-bold text-3xl">R$ 15,00</p>
                        </div>
                    </div>
                    <p class="text-gray-600 mb-6">Cobrada uma vez, junto com o valor do produto. Garante segurança da transação do início ao fim.</p>
                    <ul class="space-y-2">
                        <li class="flex items-center">
                            <i class="fas fa-check text-green-500 mr-2"></i>
                            <span>Inspeção técnica completa</span>
                        </li>
                        <li class="flex items-center">
                            <i class="fas fa-check text-green-500 mr-2"></i>
                            <span>Garantia contra produtos não conformes</span>
                        </li>
                        <li class="flex items-center">
                            <i class="fas fa-check text-green-500 mr-2"></i>
                            <span>Suporte durante toda a transação</span>
                        </li>
                    </ul>
                </div>
                
                <!-- Taxa Vendedor -->
                <div class="fee-card bg-white p-8 rounded-xl shadow-soft border-t-4 border-accent glow-effect">
                    <div class="flex items-center mb-6">
                        <div class="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mr-4">
                            <i class="fas fa-store text-accent text-2xl"></i>
                        </div>
                        <div>
                            <h3 class="font-bold text-2xl">Taxa do Vendedor</h3>
                            <p class="text-accent font-bold text-3xl">R$ 15,00</p>
                        </div>
                    </div>
                    <p class="text-gray-600 mb-6">Cobrada somente se a negociação for concluída corretamente e o vendedor receber o pagamento.</p>
                    <ul class="space-y-2">
                        <li class="flex items-center">
                            <i class="fas fa-check text-green-500 mr-2"></i>
                            <span>Garantia de recebimento após confirmação</span>
                        </li>
                        <li class="flex items-center">
                            <i class="fas fa-check text-green-500 mr-2"></i>
                            <span>Proteção contra chargebacks</span>
                        </li>
                        <li class="flex items-center">
                            <i class="fas fa-check text-green-500 mr-2"></i>
                            <span>Acesso a compradores verificados</span>
                        </li>
                    </ul>
                </div>
            </div>
            
            <div class="highlight-box">
                <h3 class="font-bold text-xl mb-4 text-gray-900">💰 Sem surpresas nos valores</h3>
                <p class="text-gray-700">Todas as taxas são claramente informadas antes da confirmação da compra. Não cobramos porcentagem sobre o valor do produto, apenas uma taxa fixa que cobre todos os nossos serviços. Em caso de desistência antes da conclusão, devolvemos integralmente todas as taxas pagas.</p>
            </div>
        </div>
    </section>
    
    <!-- Depoimentos Section -->
    <section id="depoimentos" class="py-16 bg-white">
        <div class="container mx-auto px-4">
            <div class="text-center mb-12">
                <h2 class="text-3xl md:text-4xl font-bold mb-4">O que nossos usuários dizem</h2>
                <p class="text-gray-600 max-w-2xl mx-auto">Avaliações reais de quem já utilizou nossa plataforma.</p>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div class="testimonial-card p-6">
                    <div class="flex items-center mb-4">
                        <div class="w-12 h-12 gradient-primary rounded-full flex items-center justify-center mr-4">
                            <i class="fas fa-user text-white"></i>
                        </div>
                        <div>
                            <h4 class="font-bold">Carlos Silva</h4>
                            <p class="text-sm text-gray-500">Comprador</p>
                        </div>
                    </div>
                    <p class="text-gray-600">"Comprei um iPhone e fiquei tranquilo sabendo que o produto seria inspecionado antes de chegar às minhas mãos. Processo super seguro!"</p>
                    <div class="mt-4 text-yellow-400">
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star"></i>
                    </div>
                </div>
                
                <div class="testimonial-card p-6">
                    <div class="flex items-center mb-4">
                        <div class="w-12 h-12 gradient-primary rounded-full flex items-center justify-center mr-4">
                            <i class="fas fa-user text-white"></i>
                        </div>
                        <div>
                            <h4 class="font-bold">Ana Rodrigues</h4>
                            <p class="text-sm text-gray-500">Vendedora</p>
                        </div>
                    </div>
                    <p class="text-gray-600">"Vendi minha câmera profissional sem medo de golpes. A taxa vale cada centavo pela segurança de receber o pagamento garantido."</p>
                    <div class="mt-4 text-yellow-400">
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star"></i>
                    </div>
                </div>
                
                <div class="testimonial-card p-6">
                    <div class="flex items-center mb-4">
                        <div class="w-12 h-12 gradient-primary rounded-full flex items-center justify-center mr-4">
                            <i class="fas fa-user text-white"></i>
                        </div>
                        <div>
                            <h4 class="font-bold">Roberto Almeida</h4>
                            <p class="text-sm text-gray-500">Comprador</p>
                        </div>
                    </div>
                    <p class="text-gray-600">"Já fui vítima de golpe antes, mas com a Intermediação Segura pude comprar um notebook caro sem preocupações. Recomendo!"</p>
                    <div class="mt-4 text-yellow-400">
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star"></i>
                    </div>
                </div>
            </div>
        </div>
    </section>
    
    <!-- CTA Section -->
    <section id="cta" class="py-20 bg-gradient-to-r from-blue-50 to-primary-light">
        <div class="container mx-auto px-4">
            <div class="bg-white rounded-3xl p-10 text-center shadow-soft glow-effect max-w-4xl mx-auto">
                <h2 class="text-3xl md:text-4xl font-bold mb-6">Pronto para negociar com segurança?</h2>
                <p class="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">Junte-se a centenas de usuários que já realizaram transações seguras através da nossa plataforma.</p>
                <div class="flex flex-col sm:flex-row justify-center gap-4">
                    <a href="#" class="btn-primary py-3 px-8 rounded-lg text-lg">Criar uma Negociação</a>
                    <a href="#" class="btn-secondary py-3 px-8 rounded-lg text-lg">Falar com Suporte</a>
                </div>
                <p class="mt-8 text-gray-500 text-sm">Dúvidas? Entre em contato: contato@intermediacaosegura.com.br</p>
            </div>
        </div>
    </section>
    
    <!-- Footer -->
    <footer class="bg-gray-900 text-white py-12">
        <div class="container mx-auto px-4">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div>
                    <div class="flex items-center space-x-3 mb-4">
                        <div class="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center">
                            <span class="text-white font-bold text-xl">IS</span>
                        </div>
                        <div>
                            <h3 class="text-xl font-bold">Intermediação Segura</h3>
                        </div>
                    </div>
                    <p class="text-gray-400">Transações online 100% seguras desde 2023.</p>
                </div>
                
                <div>
                    <h4 class="font-bold text-lg mb-4">Links Rápidos</h4>
                    <ul class="space-y-2">
                        <li><a href="#como-funciona" class="text-gray-400 hover:text-white transition duration-200">Como Funciona</a></li>
                        <li><a href="#vantagens" class="text-gray-400 hover:text-white transition duration-200">Vantagens</a></li>
                        <li><a href="#taxas" class="text-gray-400 hover:text-white transition duration-200">Taxas</a></li>
                        <li><a href="#depoimentos" class="text-gray-400 hover:text-white transition duration-200">Depoimentos</a></li>
                    </ul>
                </div>
                
                <div>
                    <h4 class="font-bold text-lg mb-4">Legal</h4>
                    <ul class="space-y-2">
                        <li><a href="#" class="text-gray-400 hover:text-white transition duration-200">Termos de Uso</a></li>
                        <li><a href="#" class="text-gray-400 hover:text-white transition duration-200">Política de Privacidade</a></li>
                        <li><a href="#" class="text-gray-400 hover:text-white transition duration-200">FAQ</a></li>
                    </ul>
                </div>
                
                <div>
                    <h4 class="font-bold text-lg mb-4">Contato</h4>
                    <ul class="space-y-2">
                        <li class="flex items-center">
                            <i class="fas fa-envelope mr-2 text-gray-400"></i>
                            <span class="text-gray-400">contato@intermediacaosegura.com.br</span>
                        </li>
                        <li class="flex items-center">
                            <i class="fas fa-phone mr-2 text-gray-400"></i>
                            <span class="text-gray-400">(11) 99999-9999</span>
                        </li>
                        <li class="flex items-center">
                            <i class="fas fa-map-marker-alt mr-2 text-gray-400"></i>
                            <span class="text-gray-400">São Paulo, SP</span>
                        </li>
                    </ul>
                </div>
            </div>
            
            <div class="border-t border-gray-800 mt-10 pt-8 text-center text-gray-500">
                <p>© 2023 Intermediação Segura. Todos os direitos reservados.</p>
                <p class="mt-2 text-sm">CNPJ: 12.345.678/0001-99</p>
            </div>
        </div>
    </footer>

    </div>
    
    <script>
        // Menu Mobile
        const mobileMenuButton = document.getElementById('mobileMenuButton');
        const mobileMenu = document.getElementById('mobileMenu');
        
        mobileMenuButton.addEventListener('click', function() {
            mobileMenu.classList.toggle('open');
            mobileMenuButton.innerHTML = mobileMenu.classList.contains('open') 
                ? '<i class="fas fa-times"></i>' 
                : '<i class="fas fa-bars"></i>';
        });
        
        // Botão voltar ao topo
        const backToTopBtn = document.getElementById('backToTop');

        let backToTopTicking = false;
        const updateBackToTopVisibility = () => {
            const y = window.scrollY || window.pageYOffset || 0;
            if (y > 300) {
                backToTopBtn.classList.add('visible');
            } else {
                backToTopBtn.classList.remove('visible');
            }
        };

        window.addEventListener('scroll', function() {
            if (backToTopTicking) return;
            backToTopTicking = true;
            window.requestAnimationFrame(() => {
                updateBackToTopVisibility();
                backToTopTicking = false;
            });
        }, { passive: true });
        
        backToTopBtn.addEventListener('click', function() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
        
        // Mostrar/ocultar etapas
        const toggleStepsBtn = document.getElementById('toggleSteps');
        const moreSteps = document.getElementById('moreSteps');
        let stepsVisible = false;
        
        toggleStepsBtn.addEventListener('click', function() {
            stepsVisible = !stepsVisible;
            moreSteps.classList.toggle('hidden');
            
            if (stepsVisible) {
                toggleStepsBtn.innerHTML = 'Ver Menos Etapas <i class="fas fa-chevron-up ml-2"></i>';
            } else {
                toggleStepsBtn.innerHTML = 'Ver Todas as Etapas <i class="fas fa-chevron-down ml-2"></i>';
            }
        });
        
        // Fechar menu mobile ao clicar em um link
        const mobileLinks = document.querySelectorAll('#mobileMenu a');
        mobileLinks.forEach(link => {
            link.addEventListener('click', function() {
                mobileMenu.classList.remove('open');
                mobileMenuButton.innerHTML = '<i class="fas fa-bars"></i>';
            });
        });
        
        // Animação de entrada dos elementos
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };
        
        const observer = new IntersectionObserver(function(entries) {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-fade-in');
                }
            });
        }, observerOptions);
        
        // Observar elementos para animação
        document.querySelectorAll('.step-card, .feature-icon, .fee-card, .testimonial-card').forEach(el => {
            observer.observe(el);
        });
    </script>
</body>
</html>