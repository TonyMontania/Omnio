// Free-canvas franchise diagram editor + read-only viewer built on
// @xyflow/react. Data persists in settings.franchiseGraphs (see
// types/entities.ts). Edge handles (top/bottom/left/right) are
// persisted alongside source/target so RF re-routes each bezier from
// the same anchors on reload — without them the arrows jump around.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, MiniMap,
  addEdge, applyNodeChanges, applyEdgeChanges,
  MarkerType, Handle, Position, NodeResizer, useReactFlow,
  type Node, type Edge, type NodeChange, type EdgeChange, type Connection,
  type NodeProps, type EdgeProps,
  BaseEdge, EdgeLabelRenderer, getBezierPath, getStraightPath, getSmoothStepPath,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type {
  Item, FranchiseGraph, FranchiseGraphNode, FranchiseGraphEdge,
  FranchiseGraphNodeShape, FranchiseGraphEdgeType, FranchiseGraphEdgeMarker,
} from '../types'
import { assetSrc } from '../types'
import { CATEGORIES } from '../categories'

type ItemNodeData = {
  item: Item
  editing: boolean
  onOpen: (id: string) => void
}
function ItemNode({ data, selected }: NodeProps<Node<ItemNodeData>>) {
  const { item, editing, onOpen } = data
  const year = (() => {
    if (item.releaseDate) { const m = /^(\d{4})/.exec(item.releaseDate); if (m) return m[1] }
    if (item.releaseYear) return String(item.releaseYear)
    return ''
  })()
  const catLabel = CATEGORIES.find((c) => c.id === item.categoryId)?.label ?? item.categoryId
  return (
    <>
      <NodeResizer
        isVisible={editing && selected}
        minWidth={100}
        minHeight={140}
        keepAspectRatio
        lineClassName="franchise-graph-resize-line"
        handleClassName="franchise-graph-resize-handle"
      />
      <div className="franchise-graph-node" onDoubleClick={() => !editing && onOpen(item.id)} style={{ width: '100%', height: '100%' }}>
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
    </>
  )
}

type LabelNodeData = {
  text: string
  shape: FranchiseGraphNodeShape
  editing: boolean
  onChange: (text: string) => void
}
function LabelNode({ data, selected }: NodeProps<Node<LabelNodeData>>) {
  const { text, shape, editing, onChange } = data
  const [draft, setDraft] = useState(text)
  // Input only mounts while typing — otherwise a live <input> would swallow
  // pointer events and break React Flow's drag/selection on the node.
  const [renaming, setRenaming] = useState(!text && editing)
  useEffect(() => setDraft(text), [text])
  useEffect(() => { if (!editing) setRenaming(false) }, [editing])
  const commit = () => { onChange(draft); setRenaming(false) }
  const keepAspect = shape === 'circle' || shape === 'diamond'
  return (
    <>
      <NodeResizer
        isVisible={editing && selected}
        minWidth={60}
        minHeight={30}
        keepAspectRatio={keepAspect}
        lineClassName="franchise-graph-resize-line"
        handleClassName="franchise-graph-resize-handle"
      />
      <div
        className={`franchise-graph-label franchise-graph-label-${shape}`}
        style={{ width: '100%', height: '100%' }}
        onDoubleClick={(e) => { if (editing) { e.stopPropagation(); setRenaming(true) } }}
      >
        <Handle type="target" position={Position.Top}    id="t" />
        <Handle type="source" position={Position.Bottom} id="b" />
        <Handle type="target" position={Position.Left}   id="l" />
        <Handle type="source" position={Position.Right}  id="r" />
        {renaming ? (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { commit(); (e.target as HTMLInputElement).blur() }
              else if (e.key === 'Escape') { setDraft(text); setRenaming(false) }
            }}
            placeholder="Label…"
            autoFocus
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : (
          <span>{text || (editing ? '(double-click to edit)' : '(empty)')}</span>
        )}
      </div>
    </>
  )
}

type LabeledEdgeData = {
  label?: string
  color: string
  edgeType: FranchiseGraphEdgeType
  editing: boolean
  onSetLabel: (id: string, label: string) => void
}

function pathFor(type: FranchiseGraphEdgeType, args: Parameters<typeof getBezierPath>[0]): ReturnType<typeof getBezierPath> {
  switch (type) {
    case 'straight': {
      const [p, x, y] = getStraightPath(args)
      return [p, x, y, 0, 0]
    }
    case 'step':       return getSmoothStepPath({ ...args, borderRadius: 0 })
    case 'smoothstep': return getSmoothStepPath(args)
    default:           return getBezierPath(args)
  }
}

function LabeledEdge(props: EdgeProps<Edge<LabeledEdgeData>>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd, style } = props
  const et = data?.edgeType ?? 'bezier'
  const [path, labelX, labelY] = pathFor(et, { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data?.label ?? '')
  useEffect(() => setDraft(data?.label ?? ''), [data?.label])
  const commit = () => { data?.onSetLabel(id, draft.trim()); setEditing(false) }
  const showLabel = !!data?.label || editing
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      {showLabel && (
        <EdgeLabelRenderer>
          <div
            className="franchise-graph-edge-label"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {editing && data?.editing ? (
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => { if (e.key === 'Enter') commit(); else if (e.key === 'Escape') setEditing(false) }}
                autoFocus
              />
            ) : (
              <span
                onDoubleClick={() => data?.editing && setEditing(true)}
                title={data?.editing ? 'Double-click to edit' : undefined}
              >{data?.label}</span>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

interface Props {
  franchise: string
  items: Item[]
  graph: FranchiseGraph
  onSaveGraph: (next: FranchiseGraph | undefined) => void
  onNavigate: (id: string) => void
  fullscreen?: boolean
  onSetFullscreen?: (next: boolean) => void
}

const PRESET_COLORS = [
  { name: 'accent',  value: '' },
  { name: 'red',     value: '#e05a5a' },
  { name: 'orange',  value: '#e0a72e' },
  { name: 'green',   value: '#4caf78' },
  { name: 'blue',    value: '#5aa7e0' },
  { name: 'purple',  value: '#a56ae0' },
  { name: 'pink',    value: '#e07aa8' },
  { name: 'neutral', value: '#a9a9b2' },
]

const EDGE_TYPES: { value: FranchiseGraphEdgeType; label: string }[] = [
  { value: 'bezier',     label: 'Curved' },
  { value: 'straight',   label: 'Straight' },
  { value: 'step',       label: 'Angled' },
  { value: 'smoothstep', label: 'Angled (rounded)' },
]

const MARKER_TYPES: { value: FranchiseGraphEdgeMarker; label: string }[] = [
  { value: 'arrow-closed', label: 'Solid ▶' },
  { value: 'arrow',        label: 'Open ▷' },
  { value: 'none',         label: 'No arrow' },
]

const NODE_SHAPES: { value: FranchiseGraphNodeShape; label: string }[] = [
  { value: 'rect',    label: 'Rectangle' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'pill',    label: 'Pill' },
  { value: 'circle',  label: 'Circle' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'text',    label: 'Plain text' },
]

export default function FranchiseGraphView(props: Props) {
  return (
    <ReactFlowProvider>
      <InnerGraphView {...props} />
    </ReactFlowProvider>
  )
}

function InnerGraphView({ franchise, items, graph, onSaveGraph, onNavigate, fullscreen, onSetFullscreen }: Props) {
  const [editing, setEditing] = useState(false)
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([])
  const [snapEnabled, setSnapEnabled] = useState(false)
  const [zoomPercent, setZoomPercent] = useState(100)
  const [itemsFilter, setItemsFilter] = useState('')
  const rf = useReactFlow()

  const selectedNodeId = selectedNodeIds[0] ?? null
  const selectedEdgeId = selectedEdgeIds[0] ?? null

  const accentColor = useMemo(() => {
    if (typeof window === 'undefined') return '#c9a227'
    const v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
    return v || '#c9a227'
  }, [])

  const itemById = useMemo(() => new Map(items.map((it) => [it.id, it] as const)), [items])

  const [rfNodes, setRfNodes] = useState<Node[]>([])
  const [rfEdges, setRfEdges] = useState<Edge[]>([])
  const initializedFor = useRef<string | null>(null)

  useEffect(() => {
    if (initializedFor.current === franchise) return
    initializedFor.current = franchise
    setRfNodes(graph.nodes.map((n) => graphNodeToRf(n, itemById, editing, onNavigate, updateLabelNodeText)))
    setRfEdges(graph.edges.map((e) => graphEdgeToRf(e, editing, setEdgeLabel, accentColor)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [franchise])

  // Patches .data.editing in place instead of rebuilding nodes so the
  // current selection survives an edit-mode toggle.
  useEffect(() => {
    setRfNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, editing } })))
    setRfEdges((es) => es.map((e) => ({ ...e, data: { ...(e.data as object), editing } })))
    if (!editing) { setSelectedNodeIds([]); setSelectedEdgeIds([]) }
  }, [editing])

  const nodeTypes = useMemo(() => ({ item: ItemNode, label: LabelNode }), [])
  const edgeTypes = useMemo(() => ({ labeled: LabeledEdge }), [])

  // In-memory undo stack, capped so a long session can't balloon.
  const historyPast = useRef<FranchiseGraph[]>([])
  const historyFuture = useRef<FranchiseGraph[]>([])
  const [historyTick, setHistoryTick] = useState(0)
  const HISTORY_LIMIT = 50

  const persist = useCallback((nextNodes: Node[], nextEdges: Edge[]) => {
    const g: FranchiseGraph = {
      nodes: nextNodes.map((n) => rfNodeToGraph(n)),
      edges: nextEdges.map((e) => rfEdgeToGraph(e)),
    }
    // JSON-compare so no-op saves (re-render without real changes) don't
    // pollute the undo stack.
    const prev = { nodes: graph.nodes, edges: graph.edges }
    const prevJson = JSON.stringify(prev)
    const nextJson = JSON.stringify(g)
    if (prevJson !== nextJson) {
      historyPast.current.push(prev)
      if (historyPast.current.length > HISTORY_LIMIT) historyPast.current.shift()
      historyFuture.current = []
      setHistoryTick((t) => t + 1)
    }
    onSaveGraph(g)
  }, [onSaveGraph, graph.nodes, graph.edges])

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setRfNodes((ns) => {
      const next = applyNodeChanges(changes, ns)
      // Only persist on the terminal frame of a drag/resize so we don't
      // hammer disk on every intermediate mouse-move.
      const shouldPersist = changes.some((c) =>
        (c.type === 'position' && c.dragging === false) ||
        (c.type === 'dimensions' && (c as { resizing?: boolean }).resizing === false) ||
        c.type === 'remove' ||
        c.type === 'add'
      )
      if (shouldPersist) persist(next, rfEdges)
      return next
    })
  }, [persist, rfEdges])

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setRfEdges((es) => {
      const next = applyEdgeChanges(changes, es)
      const shouldPersist = changes.some((c) => c.type === 'remove' || c.type === 'add')
      if (shouldPersist) persist(rfNodes, next)
      return next
    })
  }, [persist, rfNodes])

  const onConnect = useCallback((conn: Connection) => {
    setRfEdges((es) => {
      const newEdge: Edge = {
        id: crypto.randomUUID(),
        source: conn.source!,
        target: conn.target!,
        sourceHandle: conn.sourceHandle ?? undefined,
        targetHandle: conn.targetHandle ?? undefined,
        type: 'labeled',
        data: { label: '', color: accentColor, edgeType: 'bezier', editing, onSetLabel: setEdgeLabel } satisfies LabeledEdgeData,
        style: { strokeWidth: 2, stroke: accentColor },
        markerEnd: { type: MarkerType.ArrowClosed, width: 22, height: 22, color: accentColor },
      }
      const next = addEdge(newEdge, es)
      persist(rfNodes, next)
      return next
    })
  }, [persist, rfNodes, editing, accentColor])

  function setEdgeLabel(id: string, label: string) {
    setRfEdges((es) => {
      const next = es.map((e) => e.id === id
        ? { ...e, data: { ...(e.data as LabeledEdgeData), label } } as Edge
        : e)
      persist(rfNodes, next)
      return next
    })
  }

  function updateLabelNodeText(id: string, text: string) {
    setRfNodes((ns) => {
      const next = ns.map((n) => n.id === id
        ? { ...n, data: { ...n.data, text } }
        : n)
      persist(next, rfEdges)
      return next
    })
  }

  const placedItemIds = useMemo(() => new Set(
    rfNodes.filter((n) => n.type === 'item').map((n) => (n.data as ItemNodeData).item.id),
  ), [rfNodes])
  const available = items.filter((it) => !placedItemIds.has(it.id))

  // z-index defaults: item cards at 1, background shapes (rect/rounded/
  // circle/diamond) at 0, annotations (text/pill) at 2. A fresh rectangle
  // drops behind the covers without the user hitting "Send to back".
  const addItemNode = (item: Item) => {
    const id = crypto.randomUUID()
    const last = rfNodes[rfNodes.length - 1]
    const x = (last?.position.x ?? 0) + 260
    const y = last?.position.y ?? 0
    const node: Node = {
      id, type: 'item',
      position: { x, y },
      zIndex: 1,
      data: { item, editing: true, onOpen: onNavigate } satisfies ItemNodeData,
    }
    setRfNodes((ns) => {
      const next = [...ns, node]
      persist(next, rfEdges)
      return next
    })
  }

  const addLabelNode = (shape: FranchiseGraphNodeShape = 'rect') => {
    const id = crypto.randomUUID()
    const last = rfNodes[rfNodes.length - 1]
    const x = (last?.position.x ?? 0) + 260
    const y = (last?.position.y ?? 0) - 80
    const isAnnotation = shape === 'text' || shape === 'pill'
    const zIndex = isAnnotation ? 2 : 0
    // Background shapes start large enough to drop items onto without
    // resizing first.
    const style = (shape === 'rect' || shape === 'rounded')
      ? { width: 320, height: 220 }
      : undefined
    const node: Node = {
      id, type: 'label',
      position: { x, y },
      zIndex,
      style,
      data: { text: '', shape, editing: true, onChange: (t: string) => updateLabelNodeText(id, t) } satisfies LabelNodeData,
    }
    setRfNodes((ns) => {
      const next = [...ns, node]
      persist(next, rfEdges)
      return next
    })
  }

  const bringToFront = (id: string) => {
    setRfNodes((ns) => {
      const maxZ = Math.max(0, ...ns.map((n) => (n.zIndex ?? 0)))
      const next = ns.map((n) => n.id === id ? { ...n, zIndex: maxZ + 1 } : n)
      persist(next, rfEdges)
      return next
    })
  }
  const sendToBack = (id: string) => {
    setRfNodes((ns) => {
      const minZ = Math.min(0, ...ns.map((n) => (n.zIndex ?? 0)))
      const next = ns.map((n) => n.id === id ? { ...n, zIndex: minZ - 1 } : n)
      persist(next, rfEdges)
      return next
    })
  }

  const clearAll = () => {
    if (!window.confirm(`Clear the whole diagram for ${franchise}? This can't be undone.`)) return
    setRfNodes([])
    setRfEdges([])
    onSaveGraph(undefined)
  }

  const selectedEdge = rfEdges.find((e) => e.id === selectedEdgeId) ?? null
  const selectedNode = rfNodes.find((n) => n.id === selectedNodeId) ?? null

  const patchEdge = (id: string, patch: (e: Edge) => Edge) => {
    setRfEdges((es) => {
      const next = es.map((e) => e.id === id ? patch(e) : e)
      persist(rfNodes, next)
      return next
    })
  }

  const setEdgeColor = (id: string, color: string) => {
    const resolved = color || accentColor
    patchEdge(id, (e) => ({
      ...e,
      data: { ...(e.data as LabeledEdgeData), color: resolved },
      style: { ...(e.style ?? {}), strokeWidth: 2, stroke: resolved },
      markerEnd: typeof e.markerEnd === 'object' && e.markerEnd
        ? { ...e.markerEnd, color: resolved }
        : e.markerEnd,
    }))
  }
  const setEdgeType = (id: string, edgeType: FranchiseGraphEdgeType) => {
    patchEdge(id, (e) => ({ ...e, data: { ...(e.data as LabeledEdgeData), edgeType } }))
  }
  const setEdgeMarker = (id: string, marker: FranchiseGraphEdgeMarker) => {
    patchEdge(id, (e) => {
      const color = (e.data as LabeledEdgeData).color
      const markerEnd = marker === 'none'
        ? undefined
        : {
          type: marker === 'arrow-closed' ? MarkerType.ArrowClosed : MarkerType.Arrow,
          width: 22, height: 22, color,
        }
      return { ...e, markerEnd }
    })
  }

  const patchNode = (id: string, patch: (n: Node) => Node) => {
    setRfNodes((ns) => {
      const next = ns.map((n) => n.id === id ? patch(n) : n)
      persist(next, rfEdges)
      return next
    })
  }
  const setNodeShape = (id: string, shape: FranchiseGraphNodeShape) => {
    patchNode(id, (n) => ({ ...n, data: { ...n.data, shape } }))
  }

  const deleteSelected = () => {
    if (selectedNode) {
      setRfNodes((ns) => {
        const next = ns.filter((n) => n.id !== selectedNode.id)
        setRfEdges((es) => {
          const nextE = es.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id)
          persist(next, nextE)
          return nextE
        })
        return next
      })
      setSelectedNodeIds([])
    } else if (selectedEdge) {
      setRfEdges((es) => {
        const next = es.filter((e) => e.id !== selectedEdge.id)
        persist(rfNodes, next)
        return next
      })
      setSelectedEdgeIds([])
    }
  }

  // Read historyTick each render so the button `disabled` reflects it.
  void historyTick
  const canUndo = historyPast.current.length > 0
  const canRedo = historyFuture.current.length > 0

  const undo = () => {
    const prev = historyPast.current.pop()
    if (!prev) return
    const current: FranchiseGraph = {
      nodes: rfNodes.map((n) => rfNodeToGraph(n)),
      edges: rfEdges.map((e) => rfEdgeToGraph(e)),
    }
    historyFuture.current.push(current)
    setRfNodes(prev.nodes.map((n) => graphNodeToRf(n, itemById, editing, onNavigate, updateLabelNodeText)))
    setRfEdges(prev.edges.map((e) => graphEdgeToRf(e, editing, setEdgeLabel, accentColor)))
    onSaveGraph(prev)
    setHistoryTick((t) => t + 1)
  }

  const redo = () => {
    const next = historyFuture.current.pop()
    if (!next) return
    const current: FranchiseGraph = {
      nodes: rfNodes.map((n) => rfNodeToGraph(n)),
      edges: rfEdges.map((e) => rfEdgeToGraph(e)),
    }
    historyPast.current.push(current)
    setRfNodes(next.nodes.map((n) => graphNodeToRf(n, itemById, editing, onNavigate, updateLabelNodeText)))
    setRfEdges(next.edges.map((e) => graphEdgeToRf(e, editing, setEdgeLabel, accentColor)))
    onSaveGraph(next)
    setHistoryTick((t) => t + 1)
  }

  useEffect(() => {
    if (!editing) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      // Never steal Ctrl+Z from an input the user is typing into.
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault(); undo()
      } else if ((e.ctrlKey || e.metaKey) && ((e.shiftKey && e.key.toLowerCase() === 'z') || e.key.toLowerCase() === 'y')) {
        e.preventDefault(); redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, rfNodes, rfEdges])

  const zoomIn = () => rf.zoomIn({ duration: 150 })
  const zoomOut = () => rf.zoomOut({ duration: 150 })
  const zoomFit = () => rf.fitView({ padding: 0.3, maxZoom: 1.2, duration: 250 })
  const zoomReset = () => rf.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 200 })

  const alignSelection = (mode: 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom') => {
    if (selectedNodeIds.length < 2) return
    const selected = rfNodes.filter((n) => selectedNodeIds.includes(n.id))
    const withBox = selected.map((n) => {
      const w = numFromStyle(n.style?.width) ?? n.measured?.width ?? 140
      const h = numFromStyle(n.style?.height) ?? n.measured?.height ?? 80
      return { n, w, h }
    })
    const minX = Math.min(...withBox.map((s) => s.n.position.x))
    const maxX = Math.max(...withBox.map((s) => s.n.position.x + s.w))
    const minY = Math.min(...withBox.map((s) => s.n.position.y))
    const maxY = Math.max(...withBox.map((s) => s.n.position.y + s.h))
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2

    const next = rfNodes.map((n) => {
      if (!selectedNodeIds.includes(n.id)) return n
      const w = numFromStyle(n.style?.width) ?? n.measured?.width ?? 140
      const h = numFromStyle(n.style?.height) ?? n.measured?.height ?? 80
      let x = n.position.x, y = n.position.y
      if (mode === 'left')     x = minX
      if (mode === 'right')    x = maxX - w
      if (mode === 'center-h') x = centerX - w / 2
      if (mode === 'top')      y = minY
      if (mode === 'bottom')   y = maxY - h
      if (mode === 'center-v') y = centerY - h / 2
      return { ...n, position: { x, y } }
    })
    setRfNodes(next)
    persist(next, rfEdges)
  }

  const currentEdgeMarker: FranchiseGraphEdgeMarker = selectedEdge
    ? (selectedEdge.markerEnd == null
      ? 'none'
      : (typeof selectedEdge.markerEnd === 'object' && selectedEdge.markerEnd.type === MarkerType.Arrow ? 'arrow' : 'arrow-closed'))
    : 'arrow-closed'
  const currentEdgeType = ((selectedEdge?.data as LabeledEdgeData | undefined)?.edgeType) ?? 'bezier'
  const currentEdgeColor = ((selectedEdge?.data as LabeledEdgeData | undefined)?.color) ?? accentColor
  const currentNodeShape = ((selectedNode?.data as LabelNodeData | undefined)?.shape) ?? 'rect'
  const isLabelNode = selectedNode?.type === 'label'

  const multiSelected = selectedNodeIds.length >= 2

  return (
    <div className={editing ? 'franchise-graph-wrap franchise-graph-editing' : 'franchise-graph-wrap'}>
      <div className="franchise-graph-toolbar">
        <label className="franchise-graph-edit-toggle">
          <input type="checkbox" checked={editing} onChange={(e) => setEditing(e.target.checked)} />
          Edit graph
        </label>

        {editing && (
          <>
            <div className="franchise-graph-toolbar-group" role="group" aria-label="History">
              <IconBtn onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" label="Undo">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 14l-4-4 4-4"/><path d="M5 10h9a5 5 0 010 10h-2"/></svg>
              </IconBtn>
              <IconBtn onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)" label="Redo">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 14l4-4-4-4"/><path d="M19 10h-9a5 5 0 000 10h2"/></svg>
              </IconBtn>
            </div>

            <div className="franchise-graph-toolbar-group" role="group" aria-label="Zoom">
              <IconBtn onClick={zoomOut} title="Zoom out" label="−"><span>−</span></IconBtn>
              <span className="franchise-graph-zoom-level" onClick={zoomReset} title="Reset to 100%">{zoomPercent}%</span>
              <IconBtn onClick={zoomIn} title="Zoom in" label="+"><span>+</span></IconBtn>
              <IconBtn onClick={zoomFit} title="Fit to view" label="⤢">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h6M4 4v6M20 4h-6M20 4v6M4 20h6M4 20v-6M20 20h-6M20 20v-6"/></svg>
              </IconBtn>
            </div>

            {multiSelected && (
              <div className="franchise-graph-toolbar-group" role="group" aria-label="Align">
                <IconBtn onClick={() => alignSelection('left')}     title="Align left"                     label="⇤">⇤</IconBtn>
                <IconBtn onClick={() => alignSelection('center-h')} title="Center horizontally"            label="↔">↔</IconBtn>
                <IconBtn onClick={() => alignSelection('right')}    title="Align right"                    label="⇥">⇥</IconBtn>
                <IconBtn onClick={() => alignSelection('top')}      title="Align top"                      label="⤒">⤒</IconBtn>
                <IconBtn onClick={() => alignSelection('center-v')} title="Center vertically"              label="↕">↕</IconBtn>
                <IconBtn onClick={() => alignSelection('bottom')}   title="Align bottom"                   label="⤓">⤓</IconBtn>
              </div>
            )}

            <div className="franchise-graph-toolbar-group" role="group" aria-label="Options">
              <label className="franchise-graph-inline-toggle" title="Snap nodes to a 16px grid">
                <input type="checkbox" checked={snapEnabled} onChange={(e) => setSnapEnabled(e.target.checked)} />
                Snap
              </label>
            </div>

            {(selectedNodeIds.length > 0 || selectedEdgeIds.length > 0) && (
              <IconBtn onClick={deleteSelected} title="Delete selection (Del)" label="Delete" danger>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M6 6l1 14a2 2 0 002 2h6a2 2 0 002-2l1-14"/></svg>
              </IconBtn>
            )}

            <button type="button" className="ghost" onClick={clearAll}>Clear all</button>
          </>
        )}

        <span className="franchise-graph-hint" style={{ marginLeft: 'auto' }}>
          {editing
            ? 'Drag between the dots on a card to connect. Shift-click to multi-select. Ctrl+Z / Ctrl+Y for undo/redo.'
            : 'Double-click any card to open its detail.'}
        </span>

        {onSetFullscreen && (
          <IconBtn onClick={() => onSetFullscreen(!fullscreen)} title={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} label="Fullscreen">
            {fullscreen
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 4H5v4M15 4h4v4M9 20H5v-4M15 20h4v-4"/></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>}
          </IconBtn>
        )}
      </div>
      <div className="franchise-graph-body">
        {editing && (
          <aside className="franchise-graph-shapes-panel">
            <h4>Shapes</h4>
            <div className="franchise-graph-shapes-grid">
              <button type="button" onClick={() => addLabelNode('rect')} title="Rectangle label">
                <span className="shape-preview shape-preview-rect" />
                <span>Rectangle</span>
              </button>
              <button type="button" onClick={() => addLabelNode('rounded')} title="Rounded label">
                <span className="shape-preview shape-preview-rounded" />
                <span>Rounded</span>
              </button>
              <button type="button" onClick={() => addLabelNode('pill')} title="Pill label">
                <span className="shape-preview shape-preview-pill" />
                <span>Pill</span>
              </button>
              <button type="button" onClick={() => addLabelNode('circle')} title="Circle label">
                <span className="shape-preview shape-preview-circle" />
                <span>Circle</span>
              </button>
              <button type="button" onClick={() => addLabelNode('diamond')} title="Diamond label">
                <span className="shape-preview shape-preview-diamond" />
                <span>Diamond</span>
              </button>
              <button type="button" onClick={() => addLabelNode('text')} title="Plain text — no border, sits over other shapes">
                <span className="shape-preview shape-preview-text">T</span>
                <span>Text</span>
              </button>
            </div>
            <p className="hint" style={{ marginTop: 8 }}>
              Tip: shapes default to the bottom layer so they read as backgrounds under items. Use <b>Send to back</b> / <b>Bring to front</b> in the Properties panel to change.
            </p>
          </aside>
        )}

        <div className="franchise-graph-canvas">
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesDraggable={editing}
            nodesConnectable={editing}
            elementsSelectable={editing}
            deleteKeyCode={editing ? ['Backspace', 'Delete'] : null}
            fitView
            fitViewOptions={{ padding: 0.3, maxZoom: 1.2 }}
            defaultEdgeOptions={{
              type: 'labeled',
              markerEnd: { type: MarkerType.ArrowClosed, width: 22, height: 22, color: accentColor },
              style: { strokeWidth: 2, stroke: accentColor },
            }}
            onSelectionChange={({ nodes: sn, edges: se }) => {
              setSelectedNodeIds(sn.map((n) => n.id))
              setSelectedEdgeIds(se.map((e) => e.id))
            }}
            onMove={(_, viewport) => setZoomPercent(Math.round(viewport.zoom * 100))}
            snapToGrid={snapEnabled}
            snapGrid={[16, 16]}
            multiSelectionKeyCode={['Shift']}
            selectionKeyCode={['Shift']}
          >
            <Background gap={16} />
            <MiniMap
              pannable zoomable
              ariaLabel="Franchise graph minimap"
              nodeColor={() => accentColor}
              maskColor="rgba(0, 0, 0, 0.6)"
              style={{ width: 160, height: 100 }}
            />
          </ReactFlow>
        </div>

        {editing && (
          <aside className="franchise-graph-sidebar">
            <section className="franchise-graph-panel">
              <h4>Properties</h4>
              {(selectedEdge || selectedNode) ? (
                <div className="franchise-graph-inspector">
                  {selectedEdge && (
                    <>
                      <label className="inspector-field">
                        <span>Line style</span>
                        <select value={currentEdgeType} onChange={(e) => setEdgeType(selectedEdge.id, e.target.value as FranchiseGraphEdgeType)}>
                          {EDGE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </label>
                      <label className="inspector-field">
                        <span>Arrowhead</span>
                        <select value={currentEdgeMarker} onChange={(e) => setEdgeMarker(selectedEdge.id, e.target.value as FranchiseGraphEdgeMarker)}>
                          {MARKER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </label>
                      <div className="inspector-field">
                        <span>Color</span>
                        <div className="inspector-swatches">
                          {PRESET_COLORS.map((c) => {
                            const resolved = c.value || accentColor
                            const active = currentEdgeColor === resolved
                            return (
                              <button
                                key={c.name}
                                type="button"
                                className={active ? 'swatch active' : 'swatch'}
                                style={{ background: resolved }}
                                onClick={() => setEdgeColor(selectedEdge.id, c.value)}
                                title={c.name}
                                aria-label={c.name}
                              />
                            )
                          })}
                        </div>
                      </div>
                    </>
                  )}
                  {selectedNode && isLabelNode && (
                    <label className="inspector-field">
                      <span>Shape</span>
                      <select value={currentNodeShape} onChange={(e) => setNodeShape(selectedNode.id, e.target.value as FranchiseGraphNodeShape)}>
                        {NODE_SHAPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </label>
                  )}
                  {selectedNode && (
                    <div className="inspector-field">
                      <span>Layer</span>
                      <div className="inspector-btn-row">
                        <button type="button" className="secondary-btn" onClick={() => sendToBack(selectedNode.id)} title="Send to back — the node will sit under other shapes and cards">↓ Back</button>
                        <button type="button" className="secondary-btn" onClick={() => bringToFront(selectedNode.id)} title="Bring to front — the node will sit above other shapes and cards">↑ Front</button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="hint">
                  {selectedNodeIds.length > 1
                    ? `${selectedNodeIds.length} nodes selected — use the align tools in the toolbar.`
                    : 'Select an item, arrow or label to customize it.'}
                </p>
              )}
            </section>

            <section className="franchise-graph-panel">
              <h4>Items {available.length > 0 && <span className="panel-count">({available.length})</span>}</h4>
              <input
                type="text"
                className="franchise-graph-side-search"
                placeholder="Search…"
                value={itemsFilter}
                onChange={(e) => setItemsFilter(e.target.value)}
              />
              {available.length === 0
                ? <p className="hint">Every item is on the canvas.</p>
                : <p className="hint">Click to drop onto the canvas.</p>}
              <ul>
                {available
                  .filter((it) => !itemsFilter.trim() || it.title.toLowerCase().includes(itemsFilter.trim().toLowerCase()))
                  .map((it) => (
                    <li key={it.id}>
                      <button type="button" onClick={() => addItemNode(it)}>
                        {it.cover
                          ? <img src={assetSrc(it.cover)} alt="" />
                          : <span className="franchise-graph-side-thumb placeholder">{it.title.charAt(0)}</span>}
                        <span>{it.title}</span>
                      </button>
                    </li>
                  ))}
              </ul>
            </section>
          </aside>
        )}
      </div>
    </div>
  )
}

function graphNodeToRf(
  n: FranchiseGraphNode,
  itemById: Map<string, Item>,
  editing: boolean,
  onOpen: (id: string) => void,
  onLabelChange: (id: string, text: string) => void,
): Node {
  const style = (n.width || n.height)
    ? { width: n.width, height: n.height }
    : undefined
  const defaultZ = n.itemId
    ? 1
    : (n.shape === 'text' || n.shape === 'pill' ? 2 : 0)
  const zIndex = n.zIndex ?? defaultZ
  if (n.itemId) {
    const item = itemById.get(n.itemId)
    return {
      id: n.id,
      type: 'item',
      position: { x: n.x, y: n.y },
      style,
      zIndex,
      data: { item: item ?? placeholderItem(n.itemId), editing, onOpen } satisfies ItemNodeData,
    }
  }
  return {
    id: n.id,
    type: 'label',
    position: { x: n.x, y: n.y },
    style,
    zIndex,
    data: {
      text: n.text ?? '',
      shape: n.shape ?? 'rect',
      editing,
      onChange: (t: string) => onLabelChange(n.id, t),
    } satisfies LabelNodeData,
  }
}

function graphEdgeToRf(e: FranchiseGraphEdge, editing: boolean, onSetLabel: (id: string, label: string) => void, defaultColor: string): Edge {
  // Older saves stored the raw `var(--accent)` string; SVG attributes
  // don't resolve CSS variables, so those look invisible on reload.
  // Skip them and fall back to the resolved default.
  const savedColor = e.color?.startsWith('var(') ? undefined : e.color
  const stroke = savedColor || defaultColor
  const marker: FranchiseGraphEdgeMarker = e.marker ?? 'arrow-closed'
  const markerEnd = marker === 'none'
    ? undefined
    : {
      type: marker === 'arrow-closed' ? MarkerType.ArrowClosed : MarkerType.Arrow,
      width: 22, height: 22, color: stroke,
    }
  return {
    id: e.id,
    source: e.from,
    target: e.to,
    sourceHandle: e.fromHandle,
    targetHandle: e.toHandle,
    type: 'labeled',
    data: { label: e.label, color: stroke, edgeType: e.edgeType ?? 'bezier', editing, onSetLabel } satisfies LabeledEdgeData,
    style: { strokeWidth: 2, stroke },
    markerEnd,
  }
}

function rfNodeToGraph(n: Node): FranchiseGraphNode {
  // Prefer style width/height (set by NodeResizer) over `measured` so
  // an intrinsic-sized node still round-trips its natural dimensions.
  const styleW = numFromStyle(n.style?.width)
  const styleH = numFromStyle(n.style?.height)
  const width  = styleW ?? n.measured?.width
  const height = styleH ?? n.measured?.height
  const base: FranchiseGraphNode = {
    id: n.id,
    x: n.position.x,
    y: n.position.y,
    width, height,
    zIndex: n.zIndex,
  }
  if (n.type === 'item') {
    const d = n.data as ItemNodeData
    return { ...base, itemId: d.item.id }
  }
  const d = n.data as LabelNodeData
  return { ...base, text: d.text ?? '', shape: d.shape ?? 'rect' }
}

function numFromStyle(v: string | number | undefined): number | undefined {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

function rfEdgeToGraph(e: Edge): FranchiseGraphEdge {
  const d = (e.data as LabeledEdgeData | undefined) ?? { color: '', edgeType: 'bezier' as const, editing: false, onSetLabel: () => {} }
  const marker: FranchiseGraphEdgeMarker = e.markerEnd == null
    ? 'none'
    : (typeof e.markerEnd === 'object' && e.markerEnd.type === MarkerType.Arrow ? 'arrow' : 'arrow-closed')
  return {
    id: e.id,
    from: e.source,
    to: e.target,
    fromHandle: e.sourceHandle ?? undefined,
    toHandle: e.targetHandle ?? undefined,
    label: d.label || undefined,
    color: d.color || undefined,
    edgeType: d.edgeType,
    marker,
  }
}

function placeholderItem(id: string): Item {
  return { id, categoryId: 'videojuegos', title: '(missing item)' } as unknown as Item
}

// Small icon button used across the toolbar. Same visual weight for
// each so the toolbar reads as one strip of controls; disabled state
// is a lower opacity + no hover accent.
function IconBtn({ onClick, title, disabled, danger, label, children }: {
  onClick: () => void
  title: string
  disabled?: boolean
  danger?: boolean
  label: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={danger ? 'franchise-graph-icon-btn danger' : 'franchise-graph-icon-btn'}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={label}
    >
      {children}
    </button>
  )
}
