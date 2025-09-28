// Edge types for the graph editor

export const edgeTypes = {
  child: {
    label: 'Child',
    style: {
      color: undefined, // Use theme default
      width: 2,
      dash: [],
      curved: true
    }
  },
  peer: {
    label: 'Peer',
    style: {
      color: undefined, // Use theme default
      width: 2,
      dash: [2, 4],
      curved: true
    }
  }
};


