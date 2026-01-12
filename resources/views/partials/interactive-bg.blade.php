<!-- Fundo em movimento (CSS-only) -->
<style>
    .interactive-bg {
        position: fixed;
        inset: 0;
        z-index: 0;
        overflow: hidden;
        pointer-events: none;
        background: transparent;
    }

    /* Camada base: gradiente suave em movimento */
    .interactive-bg::before {
        content: '';
        position: absolute;
        inset: -20%;
        background:
            radial-gradient(60% 60% at 20% 20%, rgba(124, 58, 237, 0.18) 0%, rgba(124, 58, 237, 0) 60%),
            radial-gradient(55% 55% at 80% 30%, rgba(6, 182, 212, 0.16) 0%, rgba(6, 182, 212, 0) 60%),
            radial-gradient(60% 60% at 40% 85%, rgba(99, 102, 241, 0.14) 0%, rgba(99, 102, 241, 0) 60%);
        filter: blur(12px);
        transform: translate3d(0, 0, 0);
        animation: bg-drift 18s ease-in-out infinite;
        will-change: transform;
        opacity: 1;
    }

    /* Camada de “blobs” (movimento mais lento) */
    .interactive-bg::after {
        content: '';
        position: absolute;
        inset: -30%;
        background:
            radial-gradient(35% 35% at 30% 55%, rgba(240, 240, 255, 0.35) 0%, rgba(240, 240, 255, 0) 60%),
            radial-gradient(40% 40% at 70% 60%, rgba(190, 190, 255, 0.26) 0%, rgba(190, 190, 255, 0) 60%);
        filter: blur(18px);
        transform: translate3d(0, 0, 0);
        animation: bg-float 26s ease-in-out infinite;
        will-change: transform;
        opacity: 1;
    }

    @keyframes bg-drift {
        0% { transform: translate3d(-2%, -1%, 0) scale(1.02); }
        35% { transform: translate3d(2.5%, 1.8%, 0) scale(1.04); }
        70% { transform: translate3d(-1.5%, 2.2%, 0) scale(1.03); }
        100% { transform: translate3d(-2%, -1%, 0) scale(1.02); }
    }

    @keyframes bg-float {
        0% { transform: translate3d(1.5%, -1.2%, 0) scale(1.02); }
        40% { transform: translate3d(-2.2%, 2.4%, 0) scale(1.04); }
        75% { transform: translate3d(2.0%, 1.6%, 0) scale(1.03); }
        100% { transform: translate3d(1.5%, -1.2%, 0) scale(1.02); }
    }

    @media (prefers-reduced-motion: reduce) {
        .interactive-bg::before,
        .interactive-bg::after {
            animation: none !important;
        }
    }

    /* Em telas menores, reduz custo de pintura durante o scroll */
    @media (max-width: 768px) {
        .interactive-bg::before,
        .interactive-bg::after {
            animation: none !important;
            filter: blur(10px);
            opacity: 0.85;
        }
    }
</style>

<div class="interactive-bg" id="interactiveBg" aria-hidden="true"></div>
