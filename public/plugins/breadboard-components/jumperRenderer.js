(function () {
  const sdk = window.NodeGraphPluginRenderer;
  if (!sdk || typeof sdk.createRenderer !== 'function') {
    console.error('[JumperRenderer] Renderer SDK missing');
    return;
  }

  const mount = document.createElement('canvas');
  mount.style.width = '100%';
  mount.style.height = '100%';
  mount.style.display = 'block';
  mount.style.pointerEvents = 'none';
  // Avoid mutating global document styles
  document.body.appendChild(mount);
  const ctx = mount.getContext('2d');

  const draw = ({ width = 72, height = 24 }) => {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(width, 72);
    const h = Math.max(height, 24);
    mount.width = w * dpr;
    mount.height = h * dpr;
    ctx.resetTransform();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(59,130,246,0.9)';
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(59,130,246,0.6)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(8, h / 2);
    ctx.bezierCurveTo(w * 0.25, h * 0.1, w * 0.75, h * 0.9, w - 8, h / 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#e0f2fe';
    ctx.strokeStyle = 'rgba(37,99,235,0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(8, h / 2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w - 8, h / 2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };

  let lastPayload = { width: 72, height: 24 };
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
