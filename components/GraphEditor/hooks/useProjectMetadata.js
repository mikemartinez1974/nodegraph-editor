import { useState, useEffect, useCallback, useRef } from 'react';

const createDefaultProjectMeta = () => {
  const iso = new Date().toISOString();
  return {
    title: 'Untitled Project',
    description: '',
    tags: [],
    shareLink: '',
    allowComments: true,
    allowEdits: true,
    collaborators: [
      { id: 'owner', name: 'You', email: 'you@example.com', role: 'Owner' }
    ],
    createdAt: iso,
    lastModified: iso
  };
};

export default function useProjectMetadata() {
  const [projectMeta, setProjectMeta] = useState(() => createDefaultProjectMeta());
  const projectActivityInitializedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setProjectMeta((prev) => {
      if (prev.shareLink) return prev;
      return { ...prev, shareLink: window.location.href };
    });
  }, []);

  const updateProjectMeta = useCallback((updates) => {
    setProjectMeta((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetProjectMeta = useCallback(() => {
    setProjectMeta((prev) => {
      const defaults = createDefaultProjectMeta();
      return {
        ...defaults,
        shareLink: prev.shareLink || defaults.shareLink,
        createdAt: prev.createdAt || defaults.createdAt
      };
    });
  }, []);

  return {
    projectMeta,
    setProjectMeta,
    updateProjectMeta,
    resetProjectMeta,
    projectActivityInitializedRef
  };
}
