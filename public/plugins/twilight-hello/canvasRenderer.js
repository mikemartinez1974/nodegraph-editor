(function () {
  const sdk = window.NodeGraphPluginRenderer;
  if (!sdk || typeof sdk.createRenderer !== 'function') {
    console.error('[TwilightCanvasRenderer] Renderer SDK missing');
    return;
  }

  const DEFAULT_COLORS = ['#6C63FF', '#2CB67D', '#FFB020', '#FF5C8D'];

  const pickColor = (palette, index) => {
    const colors = Array.isArray(palette) && palette.length > 0 ? palette : DEFAULT_COLORS;
    return colors[index % colors.length];
  };

  const drawRoundedRect = (ctx, x, y, width, height, radius) => {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  const buildWaveSamples = (values) => {
    if (Array.isArray(values) && values.length > 0) {
      return values.slice(0, 48).map((v) => Number(v) || 0);
    }
    const samples = [];
    for (let i = 0; i < 48; i += 1) {
      samples.push(Math.sin(((i / 48) * Math.PI * 2) + Math.random()) * 0.8);
    }
    return samples;
  };

  const buildBarValues = (values) => {
    if (Array.isArray(values) && values.length > 0) {
      return values.slice(0, 12).map((v) => Math.min(1, Math.max(0, Number(v) || 0)));
    }
    const data = [];
    for (let i = 0; i < 12; i += 1) {
      data.push(Math.random());
    }
    return data;
  };

  const createCanvas = () => {
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.borderRadius = '12px';
    return canvas;
  };

  const mount = createCanvas();
  document.body.style.margin = '0';
  document.body.style.background = 'transparent';
  document.body.appendChild(mount);

  const render = ({ data = {}, width = 220, height = 140 }) => {
    const ctx = mount.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const renderWidth = width || 220;
    const renderHeight = height || 140;
    mount.width = renderWidth * dpr;
    mount.height = renderHeight * dpr;
    ctx.resetTransform();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, renderWidth, renderHeight);

    drawRoundedRect(ctx, 0, 0, renderWidth, renderHeight, 16);
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, 0, 0, renderWidth, renderHeight, 16);
    ctx.stroke();

    const gradient = ctx.createLinearGradient(0, 0, renderWidth, renderHeight);
    gradient.addColorStop(0, 'rgba(255,255,255,0.05)');
    gradient.addColorStop(1, 'rgba(255,255,255,0.01)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, renderWidth, renderHeight);

    ctx.font = '600 12px Inter, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.textBaseline = 'top';
    ctx.fillText(data.caption || 'Plugin Canvas Node', 14, 12);

    ctx.save();
    ctx.translate(0, 40);
    ctx.beginPath();
    ctx.rect(14, 0, renderWidth - 28, renderHeight - 60);
    ctx.clip();

    const mode = data.style === 'bars' ? 'bars' : 'wave';
    if (mode === 'bars') {
      const values = buildBarValues(data.values);
      const gap = 6;
      const barWidth = Math.max(6, (renderWidth - 28 - gap * (values.length + 1)) / values.length);
      ctx.fillStyle = pickColor(data.palette, 1);
      values.forEach((value, idx) => {
        const x = 14 + gap + idx * (barWidth + gap);
        const h = Math.max(6, value * (renderHeight - 80));
        const y = renderHeight - 60 - h;
        drawRoundedRect(ctx, x, y, barWidth, h, 4);
        ctx.fill();
      });
    } else {
      const samples = buildWaveSamples(data.samples);
      ctx.strokeStyle = pickColor(data.palette, 0);
      ctx.lineWidth = 2;
      ctx.beginPath();
      samples.forEach((sample, idx) => {
        const x = 14 + (idx / (samples.length - 1 || 1)) * (renderWidth - 28);
        const y = (renderHeight - 60) / 2 - sample * (renderHeight - 80) / 2;
        if (idx === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.fillText(mode === 'bars' ? 'renderer: bars' : 'renderer: wave', renderWidth - 120, renderHeight - 10);
  };

  sdk.createRenderer({ render, autoHeight: false });
})();
