import { useEffect, useMemo, useState } from 'react';
import eventBus from '../../NodeGraph/eventBus';

export const getNodeFragmentId = (node) =>
  String(
    node?.data?._expansion?.expansionId ||
    node?.data?._origin?.instanceId ||
    ''
  ).trim();

export default function useNodeExecutionGate(node) {
  const [activeFragmentId, setActiveFragmentId] = useState('root');

  useEffect(() => {
    const normalizeFragmentId = (value) => String(value || '').trim() || 'root';
    const handleFocusEnter = ({ fragmentId } = {}) => {
      setActiveFragmentId(normalizeFragmentId(fragmentId));
    };
    eventBus.on('fragmentFocusEnter', handleFocusEnter);
    return () => eventBus.off('fragmentFocusEnter', handleFocusEnter);
  }, []);

  return useMemo(() => {
    const nodeFragmentId = getNodeFragmentId(node) || 'root';
    return {
      activeFragmentId,
      nodeFragmentId,
      isExecutionActive: activeFragmentId === nodeFragmentId
    };
  }, [activeFragmentId, node]);
}
