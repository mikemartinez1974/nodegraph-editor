import React from 'react';
export default function DisplayNode(props) {
  return <div style={{ padding: 16, background: '#fff', border: '2px solid #1976d2', borderRadius: 8 }} key={props.node?.id}>Display Node</div>;
}