(function () {
  const sdk = window.NodeGraphPluginRenderer;
  if (!sdk || typeof sdk.createRenderer !== 'function') {
    console.error('[BreadboardBusRenderer] Renderer SDK missing');
    return;
  }

  const mount = document.createElement('div');
  mount.style.width = '100%';
  mount.style.height = '100%';
  mount.style.pointerEvents = 'none';
  mount.style.background = 'transparent';
  document.body.style.margin = '0';
  document.body.style.padding = '0';
  document.body.style.background = 'transparent';
  document.body.appendChild(mount);

  sdk.createRenderer({
    render: () => {},
    autoHeight: false
  });
})();
