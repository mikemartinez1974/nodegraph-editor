(function () {
  const sdk = window.NodeGraphPluginRenderer;
  if (!sdk || typeof sdk.createRenderer !== 'function') {
    console.error('[LEDRenderer] Renderer SDK missing');
    return;
  }

  const mount = document.createElement('canvas');
  mount.style.width = '100%';
  mount.style.height = '100%';
  mount.style.display = 'block';
  mount.style.pointerEvents = 'none';
  document.documentElement.style.pointerEvents = 'none';
  document.body.style.margin = '0';
  document.body.style.padding = '0';
  document.body.style.background = 'transparent';
  document.body.appendChild(mount);
  const ctx = mount.getContext('2d');

  const draw = ({ width = 24, height = 54 }) => {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(width, 24);
    const h = Math.max(height, 54);
    mount.width = w * dpr;
    mount.height = h * dpr;
    ctx.resetTransform();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const leadLength = Math.max(14, w * 0.08);
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(0, h / 2 - 1.5, leadLength, 3);
    ctx.fillRect(w - leadLength, h / 2 - 1.5, leadLength, 3);

    const bulbRadius = Math.min(h * 0.45, w * 0.25);
    const centerX = w / 2;
    const centerY = h / 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, bulbRadius, 0, Math.PI * 2);
    const gradient = ctx.createRadialGradient(centerX, centerY, bulbRadius * 0.2, centerX, centerY, bulbRadius);
    gradient.addColorStop(0, '#fee2e2');
    gradient.addColorStop(0.5, '#f87171');
    gradient.addColorStop(1, '#b91c1c');
    ctx.fillStyle = gradient;
    ctx.shadowColor = 'rgba(248,113,113,0.6)';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(15,23,42,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };

  let lastPayload = { width: 140, height: 60 };
  window.addEventListener('resize', () => draw(lastPayload));

  sdk.createRenderer({
    autoHeight: false,
    render(payload) {
      lastPayload = {
        width: payload?.width || lastPayload.width,
        height: payload?.height || lastPayload.height
      };
      draw(lastPayload);
    }
  });
})();
