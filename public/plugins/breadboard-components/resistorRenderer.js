(function () {
  const sdk = window.NodeGraphPluginRenderer;
  if (!sdk || typeof sdk.createRenderer !== 'function') {
    console.error('[ResistorRenderer] Renderer SDK missing');
    return;
  }

  if (document?.body) {
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
  }
  if (document?.documentElement) {
    document.documentElement.style.margin = '0';
    document.documentElement.style.overflow = 'hidden';
  }

  const mount = document.createElement('canvas');
  mount.style.width = '100%';
  mount.style.height = '100%';
  mount.style.display = 'block';
  mount.style.pointerEvents = 'none';
  // Avoid changing global document styles
  document.body.appendChild(mount);
  const ctx = mount.getContext('2d');

  const draw = ({ width = 32, height = 18 }) => {
    const dpr = window.devicePixelRatio || 1;
    const minWidth = 20;
    const minHeight = 12;
    const w = Math.max(width, minWidth);
    const h = Math.max(height, minHeight);
    mount.width = w * dpr;
    mount.height = h * dpr;
    ctx.resetTransform();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const leadWidth = Math.max(2, w * 0.08);
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, h / 2 - 0.8, leadWidth, 1.6);
    ctx.fillRect(w - leadWidth, h / 2 - 0.8, leadWidth, 1.6);

    const bulbW = Math.max(8, w - leadWidth * 2 - 4);
    const bulbH = Math.min(h * 0.7, h - 2);
    const bulbX = (w - bulbW) / 2;
    const bulbY = h / 2 - bulbH / 2;
    const gradient = ctx.createLinearGradient(bulbX, bulbY, bulbX + bulbW, bulbY + bulbH);
    gradient.addColorStop(0, '#fef9c3');
    gradient.addColorStop(0.5, '#f97316');
    gradient.addColorStop(1, '#d97706');
    ctx.fillStyle = gradient;
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 10;
    ctx.fillRect(bulbX, bulbY, bulbW, bulbH);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(15,23,42,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bulbX, bulbY, bulbW, bulbH);
  };

  let lastPayload = { width: 32, height: 18 };
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
