} catch (error) {
      console.error('Invalid JSON in clipboard:', error.message);
      
      // Not JSON - treat as plain text and create a resizable node
      const lines = text.trim().split('\n');
      const label = lines[0].substring(0, 50); // First line, max 50 chars
      const memo = text.trim();
      
      // Calculate position at center of current view (assuming pan and zoom are available)
      const centerX = (window.innerWidth / 2 - (window.pan?.x || 0)) / (window.zoom || 1);
      const centerY = (window.innerHeight / 2 - (window.pan?.y || 0)) / (window.zoom || 1);
      
      // Use GraphCRUD API if available
      if (window.graphAPI && window.graphAPI.createNode) {
        const result = window.graphAPI.createNode({
          type: 'default',
          label: label,
          data: { memo: memo, link: '' },
          position: { x: centerX, y: centerY },
          width: 200,
          height: 100,
          resizable: true,
          handlePosition: 'center',
          showLabel: true
        });
        
        if (result.success) {
          console.log('Pasted text as node:', result.data.id);
        } else {
          console.error('Failed to create node from paste:', result.error);
        }
      }
    }