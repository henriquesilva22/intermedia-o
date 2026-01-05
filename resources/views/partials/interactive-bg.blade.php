<!-- Fundo interativo (nós e conexões) -->
<style>
    .interactive-bg {
        position: fixed;
        inset: 0;
        z-index: 0;
        background-color: #ffffff;
        overflow: hidden;
        pointer-events: none;
    }

    .interactive-bg .node {
        position: absolute;
        border-radius: 9999px;
        background: rgba(240, 240, 255, 0.7);
        transition: transform 0.3s ease;
        will-change: left, top, transform;
    }

    .interactive-bg .connection {
        position: absolute;
        height: 2px;
        background: rgba(190, 190, 255, 0.65);
        transform-origin: 0 0;
        will-change: width, left, top, transform, opacity;
    }
</style>

<div class="interactive-bg" id="interactiveBg" aria-hidden="true"></div>

<script>
    // Fundo interativo (nós e conexões) - acompanha mouse (leve) e anima em loop
    (function () {
        if (window.__interactiveBgNetworkMounted) return;
        window.__interactiveBgNetworkMounted = true;

        const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduceMotion) return;

        const bgContainer = document.getElementById('interactiveBg');
        if (!bgContainer) return;

        const nodes = [];
        const connections = [];
        let rafId = null;
        let rebuildTimer = null;

        function clamp(n, min, max) {
            return Math.max(min, Math.min(max, n));
        }

        function clearAll() {
            if (rebuildTimer) {
                clearInterval(rebuildTimer);
                rebuildTimer = null;
            }
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            nodes.length = 0;
            connections.length = 0;
            bgContainer.innerHTML = '';
        }

        function getNodeCount() {
            const area = (window.innerWidth || 0) * (window.innerHeight || 0);
            const raw = Math.floor(area / 16000);
            return clamp(raw, 40, 85);
        }

        function createNodes() {
            const nodeCount = getNodeCount();
            for (let i = 0; i < nodeCount; i++) {
                const nodeEl = document.createElement('div');
                nodeEl.className = 'node';

                const size = Math.random() * 60 + 20;
                nodeEl.style.width = size + 'px';
                nodeEl.style.height = size + 'px';

                const x = Math.random() * 100;
                const y = Math.random() * 100;
                nodeEl.style.left = x + '%';
                nodeEl.style.top = y + '%';
                nodeEl.style.opacity = String(Math.random() * 0.45 + 0.22);

                const speedX = (Math.random() - 0.5) * 0.22;
                const speedY = (Math.random() - 0.5) * 0.22;

                bgContainer.appendChild(nodeEl);
                nodes.push({
                    element: nodeEl,
                    x,
                    y,
                    speedX,
                    speedY,
                    baseOpacity: parseFloat(nodeEl.style.opacity) || 0.2,
                });
            }
        }

        function removeConnections() {
            for (const conn of connections) {
                if (conn.element && conn.element.parentNode) {
                    conn.element.parentNode.removeChild(conn.element);
                }
            }
            connections.length = 0;
        }

        function createConnections() {
            removeConnections();
            const maxDistance = 18; // em porcentagem
            const maxConnections = 420;
            let created = 0;
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    if (created >= maxConnections) return;
                    const nodeA = nodes[i];
                    const nodeB = nodes[j];
                    const dx = nodeB.x - nodeA.x;
                    const dy = nodeB.y - nodeA.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < maxDistance) {
                        const connEl = document.createElement('div');
                        connEl.className = 'connection';
                        bgContainer.appendChild(connEl);
                        connections.push({ element: connEl, nodeA, nodeB });
                        created++;
                    }
                }
            }
        }

        function updateConnections() {
            for (const conn of connections) {
                const dx = conn.nodeB.x - conn.nodeA.x;
                const dy = conn.nodeB.y - conn.nodeA.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx) * 180 / Math.PI;
                conn.element.style.width = distance + '%';
                conn.element.style.left = conn.nodeA.x + '%';
                conn.element.style.top = conn.nodeA.y + '%';
                conn.element.style.transform = 'rotate(' + angle + 'deg)';
                conn.element.style.opacity = String(Math.max(0.10, 0.55 - (distance / 45)));
            }
        }

        function animate() {
            for (const node of nodes) {
                node.x += node.speedX;
                node.y += node.speedY;
                if (node.x <= 0 || node.x >= 100) node.speedX *= -1;
                if (node.y <= 0 || node.y >= 100) node.speedY *= -1;
                node.x = clamp(node.x, 0, 100);
                node.y = clamp(node.y, 0, 100);
                node.element.style.left = node.x + '%';
                node.element.style.top = node.y + '%';
            }
            updateConnections();
            rafId = requestAnimationFrame(animate);
        }

        function init() {
            clearAll();
            createNodes();
            createConnections();
            animate();
            rebuildTimer = setInterval(createConnections, 2000);
        }

        document.addEventListener('mousemove', function (e) {
            const w = window.innerWidth || 1;
            const h = window.innerHeight || 1;
            const mouseX = (e.clientX / w) * 100;
            const mouseY = (e.clientY / h) * 100;
            for (const node of nodes) {
                const dx = mouseX - node.x;
                const dy = mouseY - node.y;
                const distance = Math.sqrt(dx * dx + dy * dy) || 0.0001;
                if (distance < 20) {
                    const force = (20 - distance) / 20;
                    node.x -= (dx / distance) * force * 0.45;
                    node.y -= (dy / distance) * force * 0.45;
                    node.x = clamp(node.x, 0, 100);
                    node.y = clamp(node.y, 0, 100);
                    node.element.style.transform = 'scale(' + (1 + force * 0.2).toFixed(3) + ')';
                    node.element.style.opacity = String(Math.min(0.95, node.baseOpacity + force * 0.35));
                } else {
                    node.element.style.transform = 'scale(1)';
                    node.element.style.opacity = String(node.baseOpacity);
                }
            }
        }, { passive: true });

        window.addEventListener('resize', function () {
            init();
        }, { passive: true });

        init();
    })();
</script>
