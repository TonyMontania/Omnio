// Read-only, category-scoped mini-preview of a franchise graph. Nodes
// referencing items outside the current category are filtered out along
// with any edges attached to them so the strip stays legible.

import { useMemo } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background,
  MarkerType, Handle, Position,
  type Node, type Edge, type NodeProps,
  BaseEdge, EdgeLabelRenderer, getBezierPath, getStraightPath, getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type {
  Item, FranchiseGraph, FranchiseGraphNode, FranchiseGraphEdge,
  FranchiseGraphNodeShape, FranchiseGraphEdgeType,
} from '../../types'
import { assetSrc } from '../../types'
import { CATEGORIES } from '../../categories'

type ItemNodeData = { item: Item; onOpen: (id: string) => void }
function ItemNode({ data }: NodeProps<Node<ItemNodeData>>) {
  const { item, onOpen } = data
  const year = (() => {
    if (item.releaseDate) { const m = /^(\d{4})/.exec(item.releaseDate); if (m) return m[1] }
    if (item.releaseYear) return String(item.releaseYear)
    return ''
  })()
  const catLabel = CATEGORIES.find((c) => c.id === item.categoryId)?.label ?? item.categoryId
  return (
    <div className="franchise-graph-node" onDoubleClick={() => onOpen(item.id)} style={{ width: '100%', height: '100%' }}>
      <Handle type="target" position={Position.Top}    id="t" />
      <Handle type="source" position={Position.Bottom} id="b" />
      <Handle type="target" position={Position.Left}   id="l" />
      <Handle type="source" position={Position.Right}  id="r" />
      {item.cover
        ? <img src={assetSrc(item.cover)} alt="" className="franchise-graph-cover" loading="lazy" />
        : <div className="franchise-graph-cover placeholder"><span>{item.title.charAt(0)}</span></div>}
      <div className="franchise-graph-node-body">
        <div className="franchise-graph-node-year">{year}</div>
        <div className="franchise-graph-node-title">{item.title}</div>
        <div className="franchise-graph-node-cat">{catLabel}</div>
      </div>
    </div>
  )
}

type LabelNodeData = { text: string; shape: FranchiseGraphNodeShape }
function LabelNode({ data }: NodeProps<Node<LabelNodeData>>) {
  const { text, shape } = data
  return (
    <div className={`franchise-graph-label franchise-graph-label-${shape}`} style={{ width: '100%', height: '100%' }}>
      <Handle type="target" position={Position.Top}    id="t" />
      <Handle type="source" position={Position.Bottom} id="b" />
      <Handle type="target" position={Position.Left}   id="l" />
      <Handle type="source" position={Position.Right}  id="r" />
      <span>{text || '(empty)'}</span>
    </div>
  )
}

type LabeledEdgeData = { label?: string; color: string; edgeType: FranchiseGraphEdgeType }

function pathFor(type: FranchiseGraphEdgeType, args: Parameters<typeof getBezierPath>[0]): ReturnType<typeof getBezierPath> {
  switch (type) {
    case 'straight': { const [p, x, y] = getStraightPath(args); return [p, x, y, 0, 0] }
    case 'step':       return getSmoothStepPath({ ...args, borderRadius: 0 })
    case 'smoothstep': return getSmoothStepPath(args)
    default:           return getBezierPath(args)
  }
}

function LabeledEdge(props: EdgeProps<Edge<LabeledEdgeData>>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd, style } = props
  const et = data?.edgeType ?? 'bezier'
  const [path, labelX, labelY] = pathFor(et, { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      {data?.label && (
        <EdgeLabelRenderer>
          <div className="franchise-graph-edge-label" style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}>
            <span>{data.label}</span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

interface Props {
  graph: FranchiseGraph
  items: Item[]
  currentId: string
  onNavigate: (id: string) => void
}

export default function FranchiseGraphPreview(props: Props) {
  return (
    <ReactFlowProvider>
      <Inner {...props} />
    </ReactFlowProvider>
  )
}

function Inner({ graph, items, currentId, onNavigate }: Props) {
  const accentColor = useMemo(() => {
    if (typeof window === 'undefined') return '#c9a227'
    const v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
    return v || '#c9a227'
  }, [])
  const itemById = useMemo(() => new Map(items.map((it) => [it.id, it] as const)), [items])

  const { rfNodes, rfEdges } = useMemo(() => {
    const visibleIds = new Set<string>()
    const rfN: Node[] = graph.nodes
      .filter((n) => {
        if (!n.itemId) { visibleIds.add(n.id); return true }
        if (itemById.has(n.itemId)) { visibleIds.add(n.id); return true }
        return false
      })
      .map((n) => graphNodeToRf(n, itemById, onNavigate, currentId))
    const rfE: Edge[] = graph.edges
      .filter((e) => visibleIds.has(e.from) && visibleIds.has(e.to))
      .map((e) => graphEdgeToRf(e, accentColor))
    return { rfNodes: rfN, rfEdges: rfE }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, itemById, currentId, accentColor])

  const nodeTypes = useMemo(() => ({ item: ItemNode, label: LabelNode }), [])
  const edgeTypes = useMemo(() => ({ labeled: LabeledEdge }), [])

  if (rfNodes.length === 0) {
    return <p className="hint">No items from this category live on the diagram yet — open the full canvas to add them.</p>
  }

  return (
    <div className="franchise-graph-preview">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        preventScrolling={false}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.1 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} />
      </ReactFlow>
    </div>
  )
}

function graphNodeToRf(n: FranchiseGraphNode, itemById: Map<string, Item>, onOpen: (id: string) => void, currentId: string): Node {
  const style = (n.width || n.height) ? { width: n.width, height: n.height } : undefined
  const defaultZ = n.itemId ? 1 : (n.shape === 'text' || n.shape === 'pill' ? 2 : 0)
  const zIndex = n.zIndex ?? defaultZ
  if (n.itemId) {
    const item = itemById.get(n.itemId)!
    return {
      id: n.id,
      type: 'item',
      position: { x: n.x, y: n.y },
      style,
      zIndex,
      selected: item.id === currentId,
      data: { item, onOpen } satisfies ItemNodeData,
    }
  }
  return {
    id: n.id,
    type: 'label',
    position: { x: n.x, y: n.y },
    style,
    zIndex,
    data: { text: n.text ?? '', shape: n.shape ?? 'rect' } satisfies LabelNodeData,
  }
}

function graphEdgeToRf(e: FranchiseGraphEdge, defaultColor: string): Edge {
  // Older saves stored the raw `var(--accent)` string; SVG attributes
  // don't resolve CSS variables, so those look invisible on reload.
  const savedColor = e.color?.startsWith('var(') ? undefined : e.color
  const stroke = savedColor || defaultColor
  const marker = e.marker ?? 'arrow-closed'
  const markerEnd = marker === 'none'
    ? undefined
    : { type: marker === 'arrow-closed' ? MarkerType.ArrowClosed : MarkerType.Arrow, width: 18, height: 18, color: stroke }
  return {
    id: e.id,
    source: e.from,
    target: e.to,
    sourceHandle: e.fromHandle,
    targetHandle: e.toHandle,
    type: 'labeled',
    data: { label: e.label, color: stroke, edgeType: e.edgeType ?? 'bezier' } satisfies LabeledEdgeData,
    style: { strokeWidth: 2, stroke },
    markerEnd,
  }
}
