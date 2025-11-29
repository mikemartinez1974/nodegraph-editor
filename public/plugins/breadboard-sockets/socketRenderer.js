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
  mount.style.width = '100%';
  mount.style.height = '100%';
  mount.style.display = 'block';
  mount.style.pointerEvents = 'none';
  // Avoid changing global styles
  document.body.appendChild(mount);
  const ctx = mount.getContext('2d');

  const MIN_WIDTH = 32;
  const MIN_HEIGHT = 64;

  const drawSockets = ({ data = {}, width = MIN_WIDTH, height = MIN_HEIGHT }) => {
    const segment = (data.segment || 'top').toLowerCase();
    const colors = segment === 'bottom' ? BOTTOM_SEGMENT_COLORS : TOP_SEGMENT_COLORS;
    const dpr = window.devicePixelRatio || 1;
    const renderWidth = Math.max(width || mount.clientWidth || MIN_WIDTH, MIN_WIDTH);
    const renderHeight = Math.max(height || mount.clientHeight || MIN_HEIGHT, MIN_HEIGHT);

    if (!renderWidth || !renderHeight) return;

    mount.width = renderWidth * dpr;
    mount.height = renderHeight * dpr;
    ctx.resetTransform();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, renderWidth, renderHeight);

    const insetX = Math.max(4, renderWidth * 0.18);
    const topLabelSpace = Math.max(8, renderHeight * 0.22);
    const bottomLabelSpace = Math.max(8, renderHeight * 0.22);
    const bodyTop = topLabelSpace;
    const bodyHeight = Math.max(8, renderHeight - topLabelSpace - bottomLabelSpace);
    const bodyWidth = renderWidth - insetX * 2;

    drawRoundedRect(ctx, insetX, bodyTop, bodyWidth, bodyHeight, bodyWidth * 0.25);
    ctx.fillStyle = colors.body;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(15,23,42,0.25)';
    ctx.stroke();

    ctx.fillStyle = colors.accent;
    ctx.fillRect(insetX + bodyWidth * 0.1, bodyTop, bodyWidth * 0.8, Math.max(2, bodyHeight * 0.06));
    ctx.fillRect(
      insetX + bodyWidth * 0.1,
      bodyTop + bodyHeight - Math.max(2, bodyHeight * 0.08),
      bodyWidth * 0.8,
      Math.max(2, bodyHeight * 0.08)
    );

    const rows = Array.isArray(data.rows) && data.rows.length > 0 ? data.rows : ['A', 'B', 'C', 'D', 'E'];
    const holeCount = Math.max(1, rows.length);
    const columnCenterX = renderWidth / 2;
    const availableHeight = bodyHeight - bodyHeight * 0.2;
    const topOffset = bodyTop + bodyHeight * 0.1;
    const spacing = availableHeight / Math.max(holeCount - 1, 1);
    const holeRadius = Math.max(2, Math.min(bodyWidth * 0.18, spacing * 0.3));

    ctx.fillStyle = colors.hole;
    ctx.strokeStyle = 'rgba(15,23,42,0.35)';
    ctx.lineWidth = 0.8;

    rows.forEach((row, index) => {
      const y = topOffset + index * spacing;
      ctx.beginPath();
      ctx.arc(columnCenterX, y, holeRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.beginPath();
      ctx.arc(columnCenterX, y, holeRadius * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = colors.hole;
    });

    const occupied = data.occupiedBy && (Array.isArray(data.occupiedBy) ? data.occupiedBy.length > 0 : true);
    if (occupied) {
      ctx.strokeStyle = '#ffb74d';
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, insetX - 1, bodyTop - 1, bodyWidth + 2, bodyHeight + 2, bodyWidth * 0.3);
      ctx.stroke();
    }

    const columnLabel = data.column ? `${data.column}` : '';
    if (columnLabel) {
      ctx.fillStyle = colors.text;
      ctx.font = `600 ${Math.max(8, bodyWidth * 0.45)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const labelY = Math.max(0, topLabelSpace * 0.25);
      ctx.fillText(columnLabel, columnCenterX, labelY);
    }

    const segmentLabel = segment === 'bottom' ? 'F-J' : 'A-E';
    ctx.fillStyle = 'rgba(15,23,42,0.55)';
    ctx.font = `500 ${Math.max(6, bodyWidth * 0.32)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const segmentBaseline = renderHeight - Math.max(2, bottomLabelSpace * 0.2);
    ctx.fillText(segmentLabel, columnCenterX, segmentBaseline);
  };

  let lastPayload = { data: {}, width: MIN_WIDTH, height: MIN_HEIGHT };

  window.addEventListener('resize', () => {
    drawSockets(lastPayload);
  });

  sdk.createRenderer({
    render: (payload) => {
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
