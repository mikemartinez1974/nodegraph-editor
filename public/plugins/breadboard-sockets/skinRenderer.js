(function () {
  const sdk = window.NodeGraphPluginRenderer;
  if (!sdk || typeof sdk.createRenderer !== 'function') {
    console.error('[BreadboardSkinRenderer] Renderer SDK missing');
    return;
  }

  const mount = document.createElement('canvas');
  mount.style.width = '100%';
  mount.style.height = '100%';
  mount.style.display = 'block';
  mount.style.pointerEvents = 'none';
  // Avoid mutating document.documentElement/body; append mount only
  document.body.appendChild(mount);
  const ctx = mount.getContext('2d');

  const MIN_WIDTH = 260;
  const MIN_HEIGHT = 160;

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

  const drawSkin = ({ data = {}, width = MIN_WIDTH, height = MIN_HEIGHT }) => {
    const rows = Math.max(4, Number(data.rows) || 10);
    const columns = Math.max(8, Number(data.columns) || 30);
    const rawGapHeight = Math.max(24, Number(data.gapHeight) || 96);
    const railInset = Number(data.railInset) || 32;
    const railThickness = Math.min(Math.max(16, Number(data.railThickness) || 24), height * 0.22);

    const renderWidth = Math.max(width || mount.clientWidth || MIN_WIDTH, MIN_WIDTH);
    const renderHeight = Math.max(height || mount.clientHeight || MIN_HEIGHT, MIN_HEIGHT);
    const dpr = window.devicePixelRatio || 1;

    mount.width = renderWidth * dpr;
    mount.height = renderHeight * dpr;
    ctx.resetTransform();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, renderWidth, renderHeight);

    const backgroundGradient = ctx.createLinearGradient(0, 0, 0, renderHeight);
    backgroundGradient.addColorStop(0, '#fcfcfd');
    backgroundGradient.addColorStop(1, '#dfe6f1');
    ctx.fillStyle = backgroundGradient;
    ctx.fillRect(0, 0, renderWidth, renderHeight);

    const boardInset = Math.max(12, renderWidth * 0.03);
    const boardX = boardInset;
    const boardY = boardInset;
    const boardWidth = renderWidth - boardInset * 2;
    const boardHeight = renderHeight - boardInset * 2;
    const boardCorner = Math.min(32, boardHeight * 0.15, boardWidth * 0.06);

    ctx.save();
    drawRoundedRect(ctx, boardX, boardY, boardWidth, boardHeight, boardCorner);
    ctx.fillStyle = '#fcfdff';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(15,23,42,0.12)';
    ctx.stroke();
    ctx.restore();

    const innerPadding = 16;
    const innerX = boardX + innerPadding;
    const innerY = boardY + innerPadding;
    const innerWidth = boardWidth - innerPadding * 2;
    const innerHeight = boardHeight - innerPadding * 2;
    const innerCorner = Math.min(24, innerHeight * 0.1, innerWidth * 0.05);
    const gapHeight = Math.min(rawGapHeight, Math.max(16, innerHeight * 0.55));

    ctx.save();
    drawRoundedRect(ctx, innerX, innerY, innerWidth, innerHeight, innerCorner);
    const innerGradient = ctx.createLinearGradient(innerX, innerY, innerX, innerY + innerHeight);
    innerGradient.addColorStop(0, '#f9fafb');
    innerGradient.addColorStop(1, '#e5ecf5');
    ctx.fillStyle = innerGradient;
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = 'rgba(15,23,42,0.08)';
    ctx.stroke();
    ctx.restore();

    const gridTop = innerY + railThickness + 24;
    const gridBottom = innerY + innerHeight - railThickness - 24;
    const gridLeft = innerX + 18;
    const gridRight = innerX + innerWidth - 18;
    const gridHeight = Math.max(gridBottom - gridTop, 1);
    const gridWidth = Math.max(gridRight - gridLeft, 1);

    const gapTop = gridTop + Math.max(0, (gridHeight - gapHeight) / 2);
    const gapBottom = Math.min(gridBottom, gapTop + gapHeight);

    ctx.save();
    ctx.fillStyle = 'rgba(15,23,42,0.04)';
    ctx.fillRect(gridLeft, gridTop, gridWidth, gridBottom - gridTop);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(gridLeft, gapTop, gridWidth, gapBottom - gapTop);
    ctx.restore();

    ctx.save();
    const labelFont = `${Math.max(12, renderWidth * 0.03)}px Inter, system-ui, sans-serif`;
    ctx.font = labelFont;
    ctx.fillStyle = 'rgba(15,23,42,0.65)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Breadboard', innerX + 10, innerY + 8);
    ctx.font = `${Math.max(10, renderWidth * 0.02)}px Inter, system-ui, sans-serif`;
    ctx.fillText('0.1" pitch', innerX + 12, innerY + 28);
    ctx.restore();
  };

  let lastPayload = { data: {}, width: MIN_WIDTH, height: MIN_HEIGHT };
  window.addEventListener('resize', () => drawSkin(lastPayload));

  sdk.createRenderer({
    render: (payload) => {
      lastPayload = {
        data: payload?.data || {},
        width: payload?.width,
        height: payload?.height
      };
      drawSkin(lastPayload);
    },
    autoHeight: false
  });
})();
