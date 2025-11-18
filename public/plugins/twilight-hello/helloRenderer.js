(function () {
  const sdk = window.NodeGraphPluginRenderer;
  if (!sdk || typeof sdk.createRenderer !== 'function') {
    console.error('[TwilightRenderer] Renderer SDK missing');
    return;
  }

  const mount = document.createElement('div');
  mount.style.fontFamily = 'Inter, system-ui, sans-serif';
  mount.style.fontSize = '12px';
  mount.style.padding = '12px';
  mount.style.height = '100%';
  document.body.style.margin = '0';
  document.body.appendChild(mount);

  const render = ({ data = {}, nodeId }) => {
    mount.innerHTML = '';
    const title = document.createElement('h3');
    title.textContent = data.greeting || 'Hello from the Twilight Zone!';
    title.style.margin = '0 0 8px';
    const tagline = document.createElement('p');
    tagline.textContent = data.tagline || 'Configure me from the Properties Panel';
    tagline.style.margin = '0 0 8px';
    tagline.style.color = '#555';
    const meta = document.createElement('small');
    meta.textContent = nodeId;
    meta.style.color = '#999';
    mount.appendChild(title);
    mount.appendChild(tagline);
    mount.appendChild(meta);
  };

  sdk.createRenderer({ render, autoHeight: true });
})();
