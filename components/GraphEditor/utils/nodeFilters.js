/**
 * Lightweight NodeList fallback filtering logic used by the NodeListPanel.
 * Mirrors the in-component filtering so we can exercise it in isolation.
 * @param {Array} nodes
 * @param {Object} criteria
 * @returns {Array}
 */
export function filterNodesForPanel(nodes = [], criteria = {}) {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return [];
  }

  const {
    types,
    text,
    hasMemo,
    hasLink,
    includeVisible = true,
    includeHidden = true,
    minWidth,
    maxWidth,
    minHeight,
    maxHeight
  } = criteria;

  const normalizedTypes = Array.isArray(types) ? types.filter(Boolean) : null;
  const searchTerm = typeof text === 'string' ? text.trim().toLowerCase() : '';
  const hasTypeFilter = normalizedTypes && normalizedTypes.length > 0;
  const hasMemoFilter = hasMemo === true;
  const hasLinkFilter = hasLink === true;
  const restrictVisible = includeVisible === false;
  const restrictHidden = includeHidden === false;
  const minWidthValue = Number.isFinite(minWidth) ? minWidth : undefined;
  const maxWidthValue = Number.isFinite(maxWidth) ? maxWidth : undefined;
  const minHeightValue = Number.isFinite(minHeight) ? minHeight : undefined;
  const maxHeightValue = Number.isFinite(maxHeight) ? maxHeight : undefined;

  return nodes.filter(node => {
    const nodeType = node?.type || 'default';

    if (hasTypeFilter && !normalizedTypes.includes(nodeType)) {
      return false;
    }

    if (searchTerm) {
      const labelLower = (node?.label ?? '').toString().toLowerCase();
      const idLower = (node?.id ?? '').toString().toLowerCase();
      const memoLower = (node?.data?.memo ?? '').toString().toLowerCase();
      const linkLower = (node?.data?.link ?? '').toString().toLowerCase();

      const matches =
        labelLower.includes(searchTerm) ||
        idLower.includes(searchTerm) ||
        memoLower.includes(searchTerm) ||
        linkLower.includes(searchTerm);

      if (!matches) {
        return false;
      }
    }

    if (hasMemoFilter) {
      const memo = node?.data?.memo;
      if (!(typeof memo === 'string' && memo.trim().length > 0)) {
        return false;
      }
    }

    if (hasLinkFilter) {
      const link = node?.data?.link;
      if (!(typeof link === 'string' && link.trim().length > 0)) {
        return false;
      }
    }

    const isVisible = node?.visible !== false;
    if (restrictVisible && isVisible) {
      return false;
    }
    if (restrictHidden && !isVisible) {
      return false;
    }

    const widthRaw = node?.width ?? node?.data?.width;
    const widthNumber = Number(widthRaw);
    if (minWidthValue !== undefined) {
      if (!Number.isFinite(widthNumber) || widthNumber < minWidthValue) {
        return false;
      }
    }
    if (maxWidthValue !== undefined) {
      if (!Number.isFinite(widthNumber) || widthNumber > maxWidthValue) {
        return false;
      }
    }

    const heightRaw = node?.height ?? node?.data?.height;
    const heightNumber = Number(heightRaw);
    if (minHeightValue !== undefined) {
      if (!Number.isFinite(heightNumber) || heightNumber < minHeightValue) {
        return false;
      }
    }
    if (maxHeightValue !== undefined) {
      if (!Number.isFinite(heightNumber) || heightNumber > maxHeightValue) {
        return false;
      }
    }

    return true;
  });
}

export default filterNodesForPanel;
