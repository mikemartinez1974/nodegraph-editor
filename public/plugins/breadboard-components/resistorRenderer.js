(function () {
  const sdk = window.NodeGraphPluginRenderer;
  if (!sdk || typeof sdk.createRenderer !== 'function') {
    console.error('[ResistorRenderer] Renderer SDK missing');
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

  const draw = ({ width = 56, height = 32 }) => {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(width, 56);
    const h = Math.max(height, 32);
    mount.width = w * dpr;
    mount.height = h * dpr;
    ctx.resetTransform();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const leadWidth = Math.max(4, w * 0.05);
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, h / 2 - 1.5, leadWidth, 3);
    ctx.fillRect(w - leadWidth, h / 2 - 1.5, leadWidth, 3);

    const bulbW = w - leadWidth * 2 - 12;
    const bulbH = Math.min(h * 0.55, 36);
    const bulbX = leadWidth + 6;
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

  let lastPayload = { width: 160, height: 60 };
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
