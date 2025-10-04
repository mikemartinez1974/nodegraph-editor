// Edge types for the graph editor

const edgeTypes = {
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
      dash: [3, 3],
      curved: true
    }
  }
};
export default edgeTypes;


