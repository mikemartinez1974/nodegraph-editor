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

  // Avoid mutating global document styles; append mount only
  document.body.appendChild(mount);

  sdk.createRenderer({
    render: () => {},
    autoHeight: false,
    // provide the mount element in case the SDK expects it
    mount
  });
})();
