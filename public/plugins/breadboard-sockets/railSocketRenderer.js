(function () {
  const sdk = window.NodeGraphPluginRenderer;
  if (!sdk || typeof sdk.createRenderer !== 'function') {
    console.error('[RailSocketRenderer] Renderer SDK missing');
    return;
  }

  const COLORS = {
    positive: {
      body: '#fee2e2',
      socket: '#dc2626',
      text: '#b91c1c'
    },
    negative: {
      body: '#dbeafe',
      socket: '#2563eb',
      text: '#1d4ed8'
    }
  };

  const mount = document.createElement('canvas');
  mount.style.width = '100%';
  mount.style.height = '100%';
  mount.style.display = 'block';
  mount.style.pointerEvents = 'none';
  document.documentElement.style.margin = '0';
  document.documentElement.style.padding = '0';
  document.documentElement.style.width = '100%';
  document.documentElement.style.height = '100%';
  document.documentElement.style.overflow = 'hidden';
  document.body.style.margin = '0';
  document.body.style.padding = '0';
  document.body.style.width = '100%';
  document.body.style.height = '100%';
  document.body.style.background = 'transparent';
  document.body.style.overflow = 'hidden';
  document.body.appendChild(mount);
  const ctx = mount.getContext('2d');

  const MIN_WIDTH = 20;
  const MIN_HEIGHT = 36;

  const drawRailSockets = ({ data = {}, width = MIN_WIDTH, height = MIN_HEIGHT }) => {
    const rails = Array.isArray(data.rails) ? data.rails.slice(0, 2) : [];
    if (rails.length === 0) {
      rails.push({ polarity: 'negative', railId: 'rail-negative', slot: 0 });
      rails.push({ polarity: 'positive', railId: 'rail-positive', slot: 1 });
    } else if (rails.length === 1) {
      rails.push({
        polarity: rails[0].polarity === 'negative' ? 'positive' : 'negative',
        railId: `${rails[0].railId || 'rail'}-aux`,
        slot: rails[0].slot === 0 ? 1 : 0
      });
    }

    rails.sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));

    const channel = data.channel === 'bottom' ? 'bottom' : 'top';
    const dpr = window.devicePixelRatio || 1;
    const renderWidth = Math.max(width || mount.clientWidth || MIN_WIDTH, MIN_WIDTH);
    const renderHeight = Math.max(height || mount.clientHeight || MIN_HEIGHT, MIN_HEIGHT);

    mount.width = renderWidth * dpr;
    mount.height = renderHeight * dpr;
    ctx.resetTransform();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, renderWidth, renderHeight);

    const rowCount = rails.length;
    const paddingY = Math.max(2, renderHeight * 0.08);
    const availableHeight = renderHeight - paddingY * 2;
    const rowHeight = availableHeight / rowCount;
    const socketRadius = Math.min(renderWidth * 0.25, rowHeight * 0.25);

    rails.forEach((rail, index) => {
      const colors = COLORS[rail.polarity] || COLORS.positive;
      const rowTop = paddingY + index * rowHeight;
      const rowBottom = rowTop + rowHeight;
      const centerY = (rowTop + rowBottom) / 2;
      const cornerRadius = Math.min(rowHeight / 2.5, 6);

      ctx.beginPath();
      ctx.moveTo(0, rowTop + cornerRadius);
      ctx.quadraticCurveTo(0, rowTop, cornerRadius, rowTop);
      ctx.lineTo(renderWidth - cornerRadius, rowTop);
      ctx.quadraticCurveTo(renderWidth, rowTop, renderWidth, rowTop + cornerRadius);
      ctx.lineTo(renderWidth, rowBottom - cornerRadius);
      ctx.quadraticCurveTo(renderWidth, rowBottom, renderWidth - cornerRadius, rowBottom);
      ctx.lineTo(cornerRadius, rowBottom);
      ctx.quadraticCurveTo(0, rowBottom, 0, rowBottom - cornerRadius);
      ctx.closePath();
      ctx.fillStyle = colors.body;
      ctx.fill();
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = 'rgba(15,23,42,0.2)';
      ctx.stroke();

      const socketOffsets = [0]; // One hole per rail, centered
      socketOffsets.forEach((offset) => {
        ctx.beginPath();
        ctx.arc(renderWidth / 2, centerY + offset, socketRadius, 0, Math.PI * 2);
        ctx.fillStyle = colors.socket;
        ctx.fill();
        ctx.lineWidth = 0.9;
        ctx.strokeStyle = 'rgba(15,23,42,0.45)';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(renderWidth / 2, centerY + offset, socketRadius * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fill();
      });

      ctx.fillStyle = colors.text;
      ctx.font = `600 ${Math.max(8, rowHeight * 0.35)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        rail.label || (rail.polarity === 'negative' ? 'GND' : 'V+'),
        4,
        centerY
      );
    });

    ctx.fillStyle = '#111';
    ctx.font = `500 ${Math.max(7, renderHeight * 0.18)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = channel === 'top' ? 'bottom' : 'top';
    const captionY = channel === 'top' ? -4 : renderHeight + 4;
    ctx.fillText(
      channel === 'top' ? 'TOP RAIL' : 'BOTTOM RAIL',
      renderWidth / 2,
      captionY
    );
  };

  let lastPayload = { data: {}, width: MIN_WIDTH, height: MIN_HEIGHT };

  window.addEventListener('resize', () => {
    drawRailSockets(lastPayload);
  });

  sdk.createRenderer({
    render: (payload) => {
      lastPayload = {
        data: payload?.data || {},
        width: payload?.width,
        height: payload?.height
      };
      drawRailSockets(lastPayload);
    },
    autoHeight: false
  });
})();
