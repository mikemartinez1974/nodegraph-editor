import React, { useState } from 'react';
import introGraphData from '../../data/IntroGraph.json';

const GraphComponent = () => {
  const [nodes, setNodes] = useState(introGraphData.nodes || []);
  const [edges, setEdges] = useState(introGraphData.edges || []);

  return (
    <div>
      {/* Render your graph using nodes and edges state */}
    </div>
  );
};

export default GraphComponent;