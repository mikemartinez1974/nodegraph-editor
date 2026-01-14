"use client";

import React from 'react';
import NodeGraph from '../../NodeGraph';
import { useGraphEditorStateContext } from '../providers/GraphEditorContext';

export default function GraphRendererAdapter({
  graphKey,
  nodeTypes,
  edgeTypes,
  edgeRoutes,
  mode,
  backgroundUrl,
  backgroundInteractive,
  backgroundImage,
  setSnackbar,
  showMinimap,
  snapToGrid,
  showGrid,
  gridSize,
  defaultEdgeRouting,
  edgeLaneGapPx,
  lockedNodes,
  lockedEdges,
  onEdgeClick,
  onEdgeHover,
  onBackgroundClick,
  hoveredEdgeId,
  showAllEdgeLabels
}) {
  const state = useGraphEditorStateContext();
  const {
    nodes,
    setNodes,
    edges,
    setEdges,
    groups,
    setGroups,
    pan,
    setPan,
    zoom,
    setZoom,
    selectedNodeIds,
    setSelectedNodeIds,
    selectedEdgeIds,
    setSelectedEdgeIds,
    selectedGroupIds,
    setSelectedGroupIds,
    hoveredNodeId
  } = state;

  return (
    <NodeGraph
      key={graphKey}
      nodes={nodes}
      setNodes={setNodes}
      edges={edges}
      setEdges={setEdges}
      groups={groups}
      setGroups={setGroups}
      pan={pan}
      zoom={zoom}
      setPan={setPan}
      setZoom={setZoom}
      selectedNodeId={selectedNodeIds[0] || null}
      selectedEdgeId={selectedEdgeIds[0] || null}
      selectedNodeIds={selectedNodeIds}
      selectedEdgeIds={selectedEdgeIds}
      selectedGroupIds={selectedGroupIds}
      setSelectedNodeIds={setSelectedNodeIds}
      setSelectedEdgeIds={setSelectedEdgeIds}
      setSelectedGroupIds={setSelectedGroupIds}
      hoveredNodeId={hoveredNodeId}
      hoveredEdgeId={hoveredEdgeId}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      edgeRoutes={edgeRoutes}
      mode={mode}
      backgroundUrl={backgroundUrl}
      backgroundInteractive={backgroundInteractive}
      backgroundImage={backgroundImage}
      setSnackbar={setSnackbar}
      showMinimap={showMinimap}
      snapToGrid={snapToGrid}
      showGrid={showGrid}
      gridSize={gridSize}
      defaultEdgeRouting={defaultEdgeRouting}
      edgeLaneGapPx={edgeLaneGapPx}
      lockedNodes={lockedNodes}
      lockedEdges={lockedEdges}
      onEdgeClick={onEdgeClick}
      onEdgeHover={onEdgeHover}
      onBackgroundClick={onBackgroundClick}
      showAllEdgeLabels={showAllEdgeLabels}
    />
  );
}
