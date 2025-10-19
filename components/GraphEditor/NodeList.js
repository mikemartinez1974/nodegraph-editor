import { Box } from '@mui/material';
import { createPortal } from 'react-dom';

export default function NodeList({ nodes = [], onNodeClick, propertiesPanelAnchor = 'right' }) {
  // Position on opposite side of properties panel
  const anchor = propertiesPanelAnchor === 'right' ? 'left' : 'right';

  return createPortal(
    <Box
      sx={{
        position: 'fixed',
        top: 64,
        [anchor]: isOpen ? 0 : -300,
        [anchor === 'right' ? 'left' : 'right']: 'auto',
        width: 280,
        transition: `${anchor} 0.3s ease`,
        // ...existing styles...
      }}
    >
      {/* ...existing content... */}
    </Box>,
    document.body
  );
}