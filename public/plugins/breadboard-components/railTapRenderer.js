(function () {
  const sdk = window.NodeGraphPluginRenderer;
  if (!sdk || typeof sdk.createRenderer !== 'function') {
    console.error('[RailTapRenderer] Renderer SDK missing');
    return;
  }

  // Ensure the iframe body doesn’t create scrollbars
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
  // Avoid mutating global document styles
  document.body.appendChild(mount);
  const ctx = mount.getContext('2d');

  const draw = (payload = {}) => {
    const { width = 16, height = 50, type, label, data } = payload;
    const w = Math.max(width, 12);
    const h = Math.max(height, 50);
    const dpr = window.devicePixelRatio || 1;
    mount.width = w * dpr;
    mount.height = h * dpr;
    ctx.resetTransform();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const typeLabel = String(type || label || '').toLowerCase();
    const segmentPref = (data?.pins?.[0]?.segmentPreference || '').toLowerCase();
    const isNegative = typeLabel.includes('negative') || segmentPref.includes('negative');
    const primaryColor = isNegative ? '#0ea5e9' : '#f97316';
    const accentColor = isNegative ? '#bae6fd' : '#fed7aa';

    const centerX = w / 2;
    const topPad = 1;
    const bottomPad = 1;
    const leadRadius = Math.max(5, w * 0.3);
    const stemTop = topPad + leadRadius;
    const stemBottom = h - bottomPad - leadRadius;

    ctx.save();
    // No vertical shift: use the full available canvas height so the tap renders a touch taller.

    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(3, w * 0.35);
    ctx.strokeStyle = primaryColor;
    ctx.beginPath();
    ctx.moveTo(centerX, stemTop);
    ctx.lineTo(centerX, stemBottom);
    ctx.stroke();

    ctx.shadowColor = `${primaryColor}55`;
    ctx.shadowBlur = 6;
    ctx.fillStyle = accentColor;
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.arc(centerX, topPad + leadRadius, leadRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, h - bottomPad - leadRadius, leadRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.restore();
  };

  let lastPayload = {};
  window.addEventListener('resize', () => draw(lastPayload));

  sdk.createRenderer({
    autoHeight: false,
    render(payload) {
      lastPayload = payload || lastPayload;
      draw(lastPayload);
    }
  });
})();
