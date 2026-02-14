"use client";

import React from 'react';
import NodeGraph from '../../NodeGraph';
import { useGraphEditorStateContext } from '../providers/GraphEditorContext';

const CANVAS_HIDDEN_NODE_TYPES = new Set(['manifest', 'dictionary', 'legend']);

export default function GraphRendererAdapter({
  graphKey,
  nodeTypes,
  resolveNodeComponent,
  edgeTypes,
  edgeRoutes,
  mode,
  backgroundUrl,
  backgroundInteractive,
  backgroundImage,
  setSnackbar,
  showMinimap,
  minimapOffset,
  snapToGrid,
  showGrid,
  gridSize,
  defaultEdgeRouting,
  edgeLaneGapPx,
  lockedNodes,
  lockedEdges,
  onNodeDoubleClick,
  onEdgeDoubleClick,
  onGroupDoubleClick,
  onEdgeClick,
  onEdgeHover,
  onNodeContextMenu,
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
  const renderNodes = React.useMemo(
    () => (Array.isArray(nodes) ? nodes.filter((node) => !CANVAS_HIDDEN_NODE_TYPES.has(node?.type)) : []),
    [nodes]
  );
  const renderNodeIds = React.useMemo(
    () => new Set(renderNodes.map((node) => node.id)),
    [renderNodes]
  );
  const renderEdges = React.useMemo(
    () =>
      Array.isArray(edges)
        ? edges.filter((edge) => renderNodeIds.has(edge?.source) && renderNodeIds.has(edge?.target))
        : [],
    [edges, renderNodeIds]
  );
  const renderSelectedNodeIds = React.useMemo(
    () => (Array.isArray(selectedNodeIds) ? selectedNodeIds.filter((id) => renderNodeIds.has(id)) : []),
    [selectedNodeIds, renderNodeIds]
  );
  const renderSelectedEdgeIds = React.useMemo(() => {
    if (!Array.isArray(selectedEdgeIds)) return [];
    const edgeIdSet = new Set(renderEdges.map((edge) => edge.id));
    return selectedEdgeIds.filter((id) => edgeIdSet.has(id));
  }, [selectedEdgeIds, renderEdges]);

  return (
    <>
      <NodeGraph
        key={graphKey}
        nodes={renderNodes}
        setNodes={setNodes}
        edges={renderEdges}
        setEdges={setEdges}
        groups={groups}
        setGroups={setGroups}
        pan={pan}
        zoom={zoom}
        setPan={setPan}
        setZoom={setZoom}
        selectedNodeId={renderSelectedNodeIds[0] || null}
        selectedEdgeId={renderSelectedEdgeIds[0] || null}
        selectedNodeIds={renderSelectedNodeIds}
        selectedEdgeIds={renderSelectedEdgeIds}
        selectedGroupIds={selectedGroupIds}
        setSelectedNodeIds={setSelectedNodeIds}
        setSelectedEdgeIds={setSelectedEdgeIds}
        setSelectedGroupIds={setSelectedGroupIds}
        hoveredNodeId={hoveredNodeId}
        hoveredEdgeId={hoveredEdgeId}
        nodeTypes={nodeTypes}
        resolveNodeComponent={resolveNodeComponent}
        edgeTypes={edgeTypes}
        edgeRoutes={edgeRoutes}
        mode={mode}
        backgroundUrl={backgroundUrl}
        backgroundInteractive={backgroundInteractive}
        backgroundImage={backgroundImage}
        setSnackbar={setSnackbar}
        showMinimap={showMinimap}
        minimapOffset={minimapOffset}
        snapToGrid={snapToGrid}
        showGrid={showGrid}
        gridSize={gridSize}
        defaultEdgeRouting={defaultEdgeRouting}
        edgeLaneGapPx={edgeLaneGapPx}
        lockedNodes={lockedNodes}
        lockedEdges={lockedEdges}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onGroupDoubleClick={onGroupDoubleClick}
        onEdgeClick={onEdgeClick}
        onEdgeHover={onEdgeHover}
        onNodeContextMenu={onNodeContextMenu}
        onBackgroundClick={onBackgroundClick}
        showAllEdgeLabels={showAllEdgeLabels}
      />
    </>
  );
}
