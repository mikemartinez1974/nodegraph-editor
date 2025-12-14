(function () {
  const sdk = window.NodeGraphPluginRenderer;
  if (!sdk || typeof sdk.createRenderer !== 'function') {
    console.error('[LEDRenderer] Renderer SDK missing');
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
  // Do not mutate global document styles
  document.body.appendChild(mount);
  const ctx = mount.getContext('2d');

  const draw = (payload = {}) => {
    const { width = 24, height = 54, data = {} } = payload;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(Number(width) || 0, 10);
    const h = Math.max(Number(height) || 0, 10);
    mount.width = w * dpr;
    mount.height = h * dpr;
    ctx.resetTransform();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const centerX = w / 2;
    const leadThickness = Math.max(2, w * 0.16);
    const bodyHeight = Math.min(h * 0.45, 28);
    const bodyWidth = Math.min(w * 0.75, 18);
    const bodyTop = (h - bodyHeight) / 2;
    const bodyBottom = bodyTop + bodyHeight;
    const topPad = 1;
    const bottomPad = 1;

    ctx.fillStyle = '#1f2937';
    ctx.fillRect(centerX - leadThickness / 2, topPad, leadThickness, bodyTop - topPad);
    ctx.fillRect(centerX - leadThickness / 2, bodyBottom, leadThickness, h - bottomPad - bodyBottom);

    const pinState = (data.breadboard && data.breadboard.pinState) || {};
    const rowFromSocketKey = (state) => {
      if (!state || !state.socketKey) return null;
      const match = String(state.socketKey).match(/^[A-Za-z]+/);
      return match ? match[0].toUpperCase() : null;
    };
    const segmentLabel = (state) => (state && state.segment ? String(state.segment).toLowerCase() : null);
    const isTopRowChar = (row) => !!row && ['A', 'B', 'C', 'D', 'E', 'V'].includes(row.charAt(0));
    const isBottomRowChar = (row) => !!row && ['F', 'G', 'H', 'I', 'J', 'G'].includes(row.charAt(0));
    const anodeRow = rowFromSocketKey(pinState.anode);
    const cathodeRow = rowFromSocketKey(pinState.cathode);
    const anodeSeg = segmentLabel(pinState.anode);
    const cathodeSeg = segmentLabel(pinState.cathode);
    const hasPeer = (state) => {
      if (!state) return false;
      if (typeof state.hasPeer === 'boolean') return state.hasPeer;
      if (typeof state.peerCount === 'number') return state.peerCount > 0;
      return false;
    };
    const anodeLooksPowered =
      (isTopRowChar(anodeRow) || (anodeSeg && anodeSeg.includes('positive'))) &&
      hasPeer(pinState.anode);
    const cathodeLooksGrounded =
      (isBottomRowChar(cathodeRow) || (cathodeSeg && cathodeSeg.includes('negative'))) &&
      hasPeer(pinState.cathode);
    const isLit =
      !!pinState.anode &&
      !!pinState.cathode &&
      anodeLooksPowered &&
      cathodeLooksGrounded;

    const radius = bodyWidth / 2;
    const gradient = ctx.createLinearGradient(centerX, bodyTop, centerX, bodyBottom);
    if (isLit) {
      gradient.addColorStop(0, '#fff5f5');
      gradient.addColorStop(0.4, '#fb7185');
      gradient.addColorStop(1, '#be123c');
    } else {
      gradient.addColorStop(0, '#374151');
      gradient.addColorStop(0.5, '#1f2937');
      gradient.addColorStop(1, '#0f172a');
    }

    ctx.beginPath();
    ctx.moveTo(centerX - radius, bodyTop);
    ctx.lineTo(centerX + radius, bodyTop);
    ctx.arc(centerX + radius - 0.01, (bodyTop + bodyBottom) / 2, bodyWidth / 2, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(centerX - radius, bodyBottom);
    ctx.arc(centerX - radius + 0.01, (bodyTop + bodyBottom) / 2, bodyWidth / 2, Math.PI / 2, -Math.PI / 2);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.shadowColor = isLit ? 'rgba(248,113,113,0.8)' : 'rgba(15,23,42,0.4)';
    ctx.shadowBlur = isLit ? 18 : 3;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = isLit ? 'rgba(153,27,27,0.7)' : 'rgba(15,23,42,0.8)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.strokeStyle = isLit ? 'rgba(248,250,252,0.9)' : 'rgba(148,163,184,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX - bodyWidth * 0.2, bodyTop + 4);
    ctx.lineTo(centerX + bodyWidth * 0.2, bodyTop + 4);
    ctx.stroke();

    ctx.fillStyle = isLit ? '#fef2f2' : '#9ca3af';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('+', centerX, topPad + 8);
    ctx.fillText('-', centerX, h - bottomPad - 2);
  };

  let lastPayload = { width: 24, height: 54, data: {} };
  window.addEventListener('resize', () => draw(lastPayload));

  sdk.createRenderer({
    autoHeight: false,
    render(payload) {
      lastPayload = {
        width: payload?.width || lastPayload.width,
        height: payload?.height || lastPayload.height,
        data: payload?.data || lastPayload.data
      };
      draw(lastPayload);
    }
  });
})();
