export function screenToGraphCoords(mouse, { pan = {x:0, y:0}, zoom, rectLeft = 0, rectTop = 0 }) {
  return {
    x: (mouse.x - rectLeft - pan.x) / zoom,
    y: (mouse.y - rectTop - pan.y) / zoom
  };
}
