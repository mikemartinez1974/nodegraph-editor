(function () {
  const sdk = window.NodeGraphPluginRenderer;
  if (!sdk || typeof sdk.createRenderer !== 'function') {
    console.error('[BreadboardSocketRenderer] Renderer SDK missing');
    return;
  }

  const TOP_SEGMENT_COLORS = {
    body: '#e9f4ff',
    accent: '#cfe4ff',
    hole: '#1e293b',
    text: '#0f172a'
  };
  const BOTTOM_SEGMENT_COLORS = {
    body: '#ecfff3',
    accent: '#d0f5da',
    hole: '#1e293b',
    text: '#0f172a'
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

  const mount = document.createElement('canvas');
  // Let render() set the exact px size each time; CSS stays relative so zoom scales visuals.
  mount.style.display = 'block';
  mount.style.pointerEvents = 'none';
  mount.style.width = '100%';
  mount.style.height = '100%';
  // Avoid changing global styles
  document.body.appendChild(mount);
  const ctx = mount.getContext('2d');

  // Keep mins tiny so zooming out doesn't force scrollbars.
  const MIN_WIDTH = 1;
  const MIN_HEIGHT = 1;

  const drawSockets = ({ data = {}, width = MIN_WIDTH, height = MIN_HEIGHT }) => {
    const segment = (data.segment || 'top').toLowerCase();
    const colors = segment === 'bottom' ? BOTTOM_SEGMENT_COLORS : TOP_SEGMENT_COLORS;
    const dpr = window.devicePixelRatio || 1;
    const renderWidth = Math.max(Number(width) || MIN_WIDTH, MIN_WIDTH);
    const renderHeight = Math.max(Number(height) || MIN_HEIGHT, MIN_HEIGHT);

    if (!renderWidth || !renderHeight) return;

    // Explicitly size the bitmap; CSS stays at 100% so zoom transforms scale the art.
    mount.width = renderWidth * dpr;
    mount.height = renderHeight * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, renderWidth, renderHeight);

    // Fill the entire node area.
    const bodyX = 0;
    const bodyY = 0;
    const bodyWidth = renderWidth;
    const bodyHeight = renderHeight;

    drawRoundedRect(ctx, bodyX, bodyY, bodyWidth, bodyHeight, bodyWidth * 0.22);
    const grd = ctx.createLinearGradient(bodyX, bodyY, bodyX, bodyY + bodyHeight);
    grd.addColorStop(0, colors.body);
    grd.addColorStop(1, colors.accent);
    ctx.fillStyle = grd;
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(15,23,42,0.28)';
    ctx.stroke();

    const rows = Array.isArray(data.rows) && data.rows.length > 0 ? data.rows : ['A', 'B', 'C', 'D', 'E'];
    const holeCount = Math.max(1, rows.length);
    const columnCenterX = bodyX + bodyWidth / 2;
    // Reserve clear bands for labels; keep holes in a central band.
    const topLabelMargin = Math.max(12, bodyHeight * 0.18);
    const bottomLabelMargin = Math.max(14, bodyHeight * 0.22);
    const holeRegionTop = bodyY + topLabelMargin;
    const holeRegionBottom = bodyY + bodyHeight - bottomLabelMargin;
    const holeRegionHeight = Math.max(6, holeRegionBottom - holeRegionTop);
    const spacing = holeRegionHeight / Math.max(holeCount - 1, 1);
    const holeRadius = Math.max(1.5, Math.min(bodyWidth * 0.12, spacing * 0.28));

    ctx.fillStyle = colors.hole;
    ctx.strokeStyle = 'rgba(15,23,42,0.25)';
    ctx.lineWidth = 0.7;

    rows.forEach((row, index) => {
      const y = holeRegionTop + spacing * index;
      ctx.beginPath();
      ctx.arc(columnCenterX, y, holeRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(columnCenterX, y, holeRadius * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = colors.hole;
    });

    const occupied = data.occupiedBy && (Array.isArray(data.occupiedBy) ? data.occupiedBy.length > 0 : true);
    if (occupied) {
      ctx.strokeStyle = '#ffb74d';
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, bodyX - 1, bodyY - 1, bodyWidth + 2, bodyHeight + 2, bodyWidth * 0.26);
      ctx.stroke();
    }

    const columnLabel = data.column ? `${data.column}` : '';
    if (columnLabel) {
      ctx.fillStyle = colors.text;
      ctx.font = `600 ${Math.max(8, bodyWidth * 0.38)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(columnLabel, columnCenterX, bodyY + 4);
    }

    const segmentLabel = segment === 'bottom' ? 'F-J' : 'A-E';
    ctx.fillStyle = 'rgba(15,23,42,0.5)';
    ctx.font = `500 ${Math.max(6, bodyWidth * 0.3)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(
      segmentLabel,
      columnCenterX,
      bodyY + bodyHeight - Math.max(4, bottomLabelMargin * 0.4)
    );
  };

  let lastPayload = { data: {}, width: MIN_WIDTH, height: MIN_HEIGHT };

  window.addEventListener('resize', () => {
    drawSockets(lastPayload);
  });

  sdk.createRenderer({
    render: (payload) => {
      try {
        console.debug('[SocketRenderer] render', { w: payload?.width, h: payload?.height, data: payload?.data });
      } catch (e) {}
      lastPayload = {
        data: payload?.data || {},
        width: payload?.width,
        height: payload?.height
      };
      drawSockets(lastPayload);
    },
    autoHeight: false
  });
})();
