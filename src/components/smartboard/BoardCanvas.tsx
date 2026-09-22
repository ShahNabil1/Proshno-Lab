import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  createElementId,
  isDrawableTool,
  SHAPE_KINDS,
  type BoardElement,
  type Point,
  type ShapeElementKind,
  type TextElement,
  type ToolId,
} from "./boardTypes";
import { boardCursor } from "./boardCursors";
import {
  arrowHead,
  elementBounds,
  elementHandles,
  hitTest,
  penPath,
  rectFromPoints,
  resizeElement,
  shapePolygonPoints,
  textMetrics,
  translateElement,
  type AnyHandle,
} from "./boardGeometry";

interface BoardCanvasProps {
  tool: ToolId;
  color: string;
  strokeWidth: number;
  opacity: number;
  fontSize: number;
  elements: BoardElement[];
  onCommit: (elements: BoardElement[]) => void;
  className?: string;
  /** Surface size in board units. It can grow past A4 so the board fills the screen. */
  boardWidth?: number;
  boardHeight?: number;
}

interface DraftState {
  kind: "pen" | "arrow" | "line" | "shape";
  start: Point;
  current: Point;
  points: Point[];
  shapeKind: ShapeElementKind;
}

interface EditingState {
  id: string | null;
  x: number;
  y: number;
  value: string;
  fontSize: number;
  color: string;
}

type DragMode = { type: "move" } | { type: "handle"; handle: AnyHandle };

interface DragState {
  id: string;
  mode: DragMode;
  start: Point;
  original: BoardElement;
}

const TEXT_LINE_HEIGHT = 1.3;
const HANDLE_SIZE = 14;
const MIN_PEN_POINT_DISTANCE = 1.6;
const SHAPE_TOOLS: ToolId[] = [...SHAPE_KINDS];

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

export default function BoardCanvas({
  tool,
  color,
  strokeWidth,
  opacity,
  fontSize,
  elements,
  onCommit,
  boardWidth = BOARD_WIDTH,
  boardHeight = BOARD_HEIGHT,
  className = "",
}: BoardCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const elementsRef = useRef<BoardElement[]>(elements);
  const editingRef = useRef<EditingState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const eraseRef = useRef<Set<string>>(new Set());
  const eraseActiveRef = useRef(false);

  const [draft, setDraft] = useState<DraftState | null>(null);
  const [dragPreview, setDragPreview] = useState<BoardElement | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [erasedIds, setErasedIds] = useState<string[]>([]);
  const [editorScale, setEditorScale] = useState(1);

  const brushCursorRef = useRef<SVGGElement | null>(null);
  const brushOuterRef = useRef<SVGCircleElement | null>(null);
  const brushInnerRef = useRef<SVGCircleElement | null>(null);
  const brushDotRef = useRef<SVGCircleElement | null>(null);

  const showBrushCursor = isDrawableTool(tool) || tool === "eraser";

  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  const toBoardPoint = useCallback((clientX: number, clientY: number): Point => {
    const svg = svgRef.current;
    if (!svg) return [0, 0];
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return [0, 0];
    return [((clientX - rect.left) * boardWidth) / rect.width, ((clientY - rect.top) * boardHeight) / rect.height];
  }, [boardHeight, boardWidth]);

  /**
   * Moves the brush preview ring to the pointer. Written through refs on
   * purpose: drawing has to stay smooth, so this must not re-render the board.
   */
  const moveBrushCursor = useCallback(
    (clientX: number, clientY: number) => {
      const group = brushCursorRef.current;
      const svg = svgRef.current;
      if (!group || !svg) return;
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const screenScale = rect.width / boardWidth;
      const [x, y] = toBoardPoint(clientX, clientY);
      // Brush size in board units, with a small floor so the ring stays visible
      // on wide screens and at low zoom levels.
      const brushRadius = tool === "eraser" ? 6 : Math.max(strokeWidth, 2) / 2;
      const radius = Math.max(brushRadius, 7 / screenScale);
      const dotRadius = Math.max(1.6 / screenScale, radius * 0.14);

      group.setAttribute("transform", `translate(${x} ${y})`);
      group.setAttribute("opacity", "1");
      brushOuterRef.current?.setAttribute("r", String(radius));
      brushInnerRef.current?.setAttribute("r", String(radius));
      brushDotRef.current?.setAttribute("r", String(dotRadius));
    },
    [boardWidth, strokeWidth, toBoardPoint, tool],
  );

  const hideBrushCursor = useCallback(() => {
    brushCursorRef.current?.setAttribute("opacity", "0");
  }, []);

  useEffect(() => {
    if (!showBrushCursor) hideBrushCursor();
  }, [hideBrushCursor, showBrushCursor]);

  const visibleElements = useMemo(() => {
    const filtered = erasedIds.length > 0 ? elements.filter((el) => !erasedIds.includes(el.id)) : elements;
    if (!dragPreview) return filtered;
    return filtered.map((el) => (el.id === dragPreview.id ? dragPreview : el));
  }, [elements, erasedIds, dragPreview]);

  useEffect(() => {
    if (tool !== "select") {
      setSelectedId(null);
      dragRef.current = null;
      setDragPreview(null);
    }
  }, [tool]);

  useEffect(() => {
    if (!editing) return;
    const node = textareaRef.current;
    if (node) {
      node.focus();
      node.setSelectionRange(node.value.length, node.value.length);
    }
  }, [editing]);

  /** Applies the in-progress text editor value and closes the editor. */
  const finishEditing = useCallback(
    (overrideValue?: string) => {
      const current = editingRef.current;
      editingRef.current = null;
      setEditing(null);
      if (!current) return;

      const text = (overrideValue ?? current.value).trim();
      const currentElements = elementsRef.current;

      if (current.id) {
        if (!text) {
          onCommit(currentElements.filter((el) => el.id !== current.id));
        } else {
          onCommit(currentElements.map((el) => (el.id === current.id ? ({ ...el, text } as BoardElement) : el)));
        }
        return;
      }

      if (!text) return;
      const element: TextElement = {
        id: createElementId(),
        kind: "text",
        x: current.x,
        y: current.y,
        text,
        fontSize: current.fontSize,
        color: current.color,
        opacity,
      };
      onCommit([...currentElements, element]);
      setSelectedId(element.id);
    },
    [onCommit, opacity],
  );

  const openTextEditor = useCallback(
    (point: Point, existing?: TextElement) => {
      const svg = svgRef.current;
      if (svg) {
        const rect = svg.getBoundingClientRect();
        if (rect.width > 0) setEditorScale(rect.width / boardWidth);
      }
      const next: EditingState = existing
        ? {
            id: existing.id,
            x: existing.x,
            y: existing.y,
            value: existing.text,
            fontSize: existing.fontSize,
            color: existing.color,
          }
        : { id: null, x: point[0], y: point[1], value: "", fontSize, color };
      editingRef.current = next;
      setEditing(next);
    },
    [boardWidth, color, fontSize],
  );

  const eraseAt = useCallback((point: Point) => {
    let changed = false;
    for (const el of elementsRef.current) {
      if (eraseRef.current.has(el.id)) continue;
      if (hitTest(el, point, 6)) {
        eraseRef.current.add(el.id);
        changed = true;
      }
    }
    if (changed) setErasedIds(Array.from(eraseRef.current));
  }, []);

  const beginElementInteraction = useCallback(
    (event: React.PointerEvent, el: BoardElement, mode: DragMode) => {
      if (tool !== "select") return;
      event.stopPropagation();
      event.preventDefault();
      setSelectedId(el.id);
      dragRef.current = { id: el.id, mode, start: toBoardPoint(event.clientX, event.clientY), original: el };
      svgRef.current?.setPointerCapture(event.pointerId);
    },
    [toBoardPoint, tool],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (event.button !== 0) return;

      if (showBrushCursor) moveBrushCursor(event.clientX, event.clientY);

      if (editingRef.current) {
        finishEditing();
        return;
      }

      const point = toBoardPoint(event.clientX, event.clientY);
      svgRef.current?.setPointerCapture(event.pointerId);

      if (tool === "select") {
        setSelectedId(null);
        return;
      }

      if (tool === "eraser") {
        eraseActiveRef.current = true;
        eraseRef.current = new Set();
        setErasedIds([]);
        eraseAt(point);
        return;
      }

      if (tool === "text") {
        // Without this the browser moves focus back to the board right after
        // the editor opens, so the textarea blurred instantly and typing
        // appeared to do nothing.
        event.preventDefault();
        openTextEditor(point);
        return;
      }

      if (tool === "pen") {
        setDraft({ kind: "pen", start: point, current: point, points: [point], shapeKind: "rect" });
        return;
      }

      if (tool === "arrow") {
        setDraft({ kind: "arrow", start: point, current: point, points: [point], shapeKind: "rect" });
        return;
      }

      if (tool === "line") {
        setDraft({ kind: "line", start: point, current: point, points: [point], shapeKind: "rect" });
        return;
      }

      if (SHAPE_TOOLS.includes(tool)) {
        setDraft({ kind: "shape", start: point, current: point, points: [point], shapeKind: tool as ShapeElementKind });
      }
    },
    [eraseAt, finishEditing, moveBrushCursor, openTextEditor, showBrushCursor, toBoardPoint, tool],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (showBrushCursor) moveBrushCursor(event.clientX, event.clientY);

      if (draft) {
        const point = toBoardPoint(event.clientX, event.clientY);
        if (draft.kind === "pen") {
          const last = draft.points[draft.points.length - 1];
          if (Math.hypot(point[0] - last[0], point[1] - last[1]) < MIN_PEN_POINT_DISTANCE) return;
          setDraft({ ...draft, current: point, points: [...draft.points, point] });
          return;
        }
        setDraft({ ...draft, current: point });
        return;
      }

      if (eraseActiveRef.current) {
        eraseAt(toBoardPoint(event.clientX, event.clientY));
        return;
      }

      const drag = dragRef.current;
      if (drag) {
        const point = toBoardPoint(event.clientX, event.clientY);
        const dx = point[0] - drag.start[0];
        const dy = point[1] - drag.start[1];
        setDragPreview(
          drag.mode.type === "move"
            ? translateElement(drag.original, dx, dy)
            : resizeElement(drag.original, drag.mode.handle, dx, dy),
        );
      }
    },
    [draft, eraseAt, moveBrushCursor, showBrushCursor, toBoardPoint],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      try {
        svgRef.current?.releasePointerCapture(event.pointerId);
      } catch {
        /* pointer capture may already be gone */
      }

      if (draft) {
        const current = elementsRef.current;
        if (draft.kind === "pen") {
          onCommit([
            ...current,
            { id: createElementId(), kind: "pen", points: draft.points, color, width: strokeWidth, opacity },
          ]);
        } else if (draft.kind === "arrow" || draft.kind === "line") {
          const end = draft.current;
          if (Math.hypot(end[0] - draft.start[0], end[1] - draft.start[1]) > 4) {
            const shared = {
              id: createElementId(),
              x1: draft.start[0],
              y1: draft.start[1],
              x2: end[0],
              y2: end[1],
              color,
              strokeWidth,
              opacity,
            };
            onCommit([
              ...current,
              draft.kind === "line" ? { ...shared, kind: "line" } : { ...shared, kind: "arrow" },
            ]);
          }
        } else {
          const rect = rectFromPoints(draft.start, draft.current);
          if (rect.w > 6 || rect.h > 6) {
            onCommit([
              ...current,
              {
                id: createElementId(),
                kind: draft.shapeKind,
                x: rect.x,
                y: rect.y,
                w: rect.w,
                h: rect.h,
                color,
                strokeWidth,
                opacity,
              },
            ]);
          }
        }
        setDraft(null);
        return;
      }

      if (eraseActiveRef.current) {
        eraseActiveRef.current = false;
        const removed = eraseRef.current;
        eraseRef.current = new Set();
        setErasedIds([]);
        if (removed.size > 0) {
          onCommit(elementsRef.current.filter((el) => !removed.has(el.id)));
        }
        return;
      }

      const drag = dragRef.current;
      if (drag && dragPreview) {
        onCommit(elementsRef.current.map((el) => (el.id === dragPreview.id ? dragPreview : el)));
      }
      dragRef.current = null;
      setDragPreview(null);
    },
    [color, draft, dragPreview, onCommit, opacity, strokeWidth],
  );

  const handlePointerCancel = useCallback(() => {
    setDraft(null);
    dragRef.current = null;
    setDragPreview(null);
    eraseActiveRef.current = false;
    eraseRef.current = new Set();
    setErasedIds([]);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if (event.key === "Escape") {
        setSelectedId(null);
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedId) {
        event.preventDefault();
        onCommit(elementsRef.current.filter((el) => el.id !== selectedId));
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCommit, selectedId]);

  const draftPreviewNode = useMemo(() => {
    if (!draft) return null;
    if (draft.kind === "pen") {
      return (
        <path
          d={penPath(draft.points)}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={opacity}
        />
      );
    }
    if (draft.kind === "arrow" || draft.kind === "line") {
      const head = arrowHead({
        x1: draft.start[0],
        y1: draft.start[1],
        x2: draft.current[0],
        y2: draft.current[1],
        strokeWidth,
      });
      return (
        <g opacity={opacity}>
          <line
            x1={draft.start[0]}
            y1={draft.start[1]}
            x2={draft.current[0]}
            y2={draft.current[1]}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {draft.kind === "arrow" && (
            <polygon points={head.points.map((p) => `${p[0]},${p[1]}`).join(" ")} fill={color} />
          )}
        </g>
      );
    }
    const rect = rectFromPoints(draft.start, draft.current);
    return (
      <ShapeBody
        kind={draft.shapeKind}
        x={rect.x}
        y={rect.y}
        w={rect.w}
        h={rect.h}
        color={color}
        strokeWidth={strokeWidth}
        opacity={opacity}
      />
    );
  }, [color, draft, opacity, strokeWidth]);

  const selected = selectedId ? visibleElements.find((el) => el.id === selectedId) ?? null : null;

  return (
    <div className={`absolute inset-0 ${className}`}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${boardWidth} ${boardHeight}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full touch-none"
        style={{ cursor: boardCursor(tool) }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={hideBrushCursor}
      >
        {visibleElements.map((el) => (
          <ElementNode
            key={el.id}
            element={el}
            interactive={tool === "select"}
            onPointerDown={beginElementInteraction}
            onRequestEdit={openTextEditor}
          />
        ))}

        {draftPreviewNode}

        {selected && <SelectionOverlay selected={selected} onHandlePointerDown={beginElementInteraction} />}

        {showBrushCursor && (
          <g ref={brushCursorRef} opacity={0} pointerEvents="none" data-testid="board-brush-cursor">
            <circle ref={brushOuterRef} r={10} fill="none" stroke="#ffffff" strokeWidth={3.5} vectorEffect="non-scaling-stroke" />
            <circle ref={brushInnerRef} r={10} fill="none" stroke="#0f172a" strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
            <circle ref={brushDotRef} r={2} fill="#0f172a" stroke="#ffffff" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          </g>
        )}
      </svg>

      {editing && (
        <textarea
          ref={textareaRef}
          value={editing.value}
          onChange={(event) => {
            const value = event.target.value;
            setEditing((current) => {
              if (!current) return current;
              const next = { ...current, value };
              editingRef.current = next;
              return next;
            });
          }}
          onBlur={() => finishEditing()}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Escape") {
              event.preventDefault();
              editingRef.current = null;
              setEditing(null);
            }
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              finishEditing();
            }
          }}
          rows={1}
          spellCheck={false}
          className="absolute resize-none overflow-hidden rounded border-2 border-blue-500 bg-white/95 px-1 py-0.5 leading-tight text-slate-900 outline-none"
          style={{
            left: `${(editing.x / boardWidth) * 100}%`,
            top: `${((editing.y - (editing.fontSize * TEXT_LINE_HEIGHT) / 2) / boardHeight) * 100}%`,
            minWidth: 180 * editorScale,
            minHeight: Math.max(24, editing.fontSize * TEXT_LINE_HEIGHT * editorScale),
            fontSize: Math.max(10, editing.fontSize * editorScale),
            color: editing.color,
          }}
        />
      )}
    </div>
  );
}

interface ShapeBodyProps {
  kind: ShapeElementKind;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  strokeWidth: number;
  opacity: number;
}

function ShapeBody({ kind, x, y, w, h, color, strokeWidth, opacity }: ShapeBodyProps) {
  const common = {
    fill: "none",
    stroke: color,
    strokeWidth,
    opacity,
    strokeLinejoin: "round" as const,
  };
  if (kind === "circle") {
    return <ellipse cx={x + w / 2} cy={y + h / 2} rx={Math.abs(w / 2)} ry={Math.abs(h / 2)} {...common} />;
  }
  const polygon = shapePolygonPoints(kind, { x, y, w: Math.abs(w), h: Math.abs(h) });
  if (polygon) {
    return <polygon points={polygon} {...common} />;
  }
  return <rect x={x} y={y} width={Math.abs(w)} height={Math.abs(h)} rx={2} {...common} />;
}

interface ElementNodeProps {
  element: BoardElement;
  interactive: boolean;
  onPointerDown: (event: React.PointerEvent, el: BoardElement, mode: DragMode) => void;
  onRequestEdit: (point: Point, existing?: TextElement) => void;
}

function ElementNode({ element, interactive, onPointerDown, onRequestEdit }: ElementNodeProps) {
  const moveHandler = interactive
    ? (event: React.PointerEvent) => onPointerDown(event, element, { type: "move" })
    : undefined;
  const groupStyle = interactive ? { cursor: "move" as const } : undefined;

  if (element.kind === "pen") {
    return (
      <g onPointerDown={moveHandler} style={groupStyle}>
        {interactive && (
          <path
            d={penPath(element.points)}
            fill="none"
            stroke="transparent"
            strokeWidth={element.width + 18}
            strokeLinecap="round"
            strokeLinejoin="round"
            pointerEvents="stroke"
          />
        )}
        <path
          d={penPath(element.points)}
          fill="none"
          stroke={element.color}
          strokeWidth={element.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={element.opacity}
          pointerEvents="none"
        />
      </g>
    );
  }

  if (element.kind === "arrow" || element.kind === "line") {
    const head = arrowHead(element);
    return (
      <g onPointerDown={moveHandler} style={groupStyle}>
        {interactive && (
          <line
            x1={element.x1}
            y1={element.y1}
            x2={element.x2}
            y2={element.y2}
            stroke="transparent"
            strokeWidth={element.strokeWidth + 20}
            pointerEvents="stroke"
          />
        )}
        <line
          x1={element.x1}
          y1={element.y1}
          x2={element.x2}
          y2={element.y2}
          stroke={element.color}
          strokeWidth={element.strokeWidth}
          strokeLinecap="round"
          opacity={element.opacity}
          pointerEvents="none"
        />
        {element.kind === "arrow" && (
          <polygon
            points={head.points.map((p) => `${p[0]},${p[1]}`).join(" ")}
            fill={element.color}
            opacity={element.opacity}
            pointerEvents="none"
          />
        )}
      </g>
    );
  }

  if (element.kind === "text") {
    const lineHeight = element.fontSize * TEXT_LINE_HEIGHT;
    const metrics = textMetrics(element);
    return (
      <g
        onPointerDown={moveHandler}
        onDoubleClick={(event) => {
          if (!interactive) return;
          event.stopPropagation();
          onRequestEdit([element.x, element.y], element);
        }}
        style={groupStyle}
      >
        {interactive && (
          <rect
            x={element.x}
            y={element.y - lineHeight / 2}
            width={metrics.width}
            height={metrics.height}
            fill="transparent"
          />
        )}
        <text
          x={element.x}
          y={element.y}
          fill={element.color}
          fontSize={element.fontSize}
          opacity={element.opacity}
          dominantBaseline="middle"
          pointerEvents="none"
        >
          {element.text.split("\n").map((line, index) => (
            <tspan key={index} x={element.x} dy={index === 0 ? 0 : lineHeight}>
              {line.length > 0 ? line : " "}
            </tspan>
          ))}
        </text>
      </g>
    );
  }

  return (
    <g onPointerDown={moveHandler} style={groupStyle}>
      {interactive && (
        <rect
          x={element.x - 6}
          y={element.y - 6}
          width={Math.abs(element.w) + 12}
          height={Math.abs(element.h) + 12}
          fill="transparent"
        />
      )}
      <ShapeBody
        kind={element.kind}
        x={element.x}
        y={element.y}
        w={element.w}
        h={element.h}
        color={element.color}
        strokeWidth={element.strokeWidth}
        opacity={element.opacity}
      />
    </g>
  );
}

interface SelectionOverlayProps {
  selected: BoardElement;
  onHandlePointerDown: (event: React.PointerEvent, el: BoardElement, mode: DragMode) => void;
}

function SelectionOverlay({ selected, onHandlePointerDown }: SelectionOverlayProps) {
  const bounds = elementBounds(selected);
  const handles = elementHandles(selected);
  return (
    <g>
      <rect
        x={bounds.x - 6}
        y={bounds.y - 6}
        width={Math.max(bounds.w, 8) + 12}
        height={Math.max(bounds.h, 8) + 12}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={2}
        strokeDasharray="8 6"
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
      {handles.map((handle) => (
        <rect
          key={String(handle.handle)}
          x={handle.x - HANDLE_SIZE / 2}
          y={handle.y - HANDLE_SIZE / 2}
          width={HANDLE_SIZE}
          height={HANDLE_SIZE}
          rx={3}
          fill="#ffffff"
          stroke="#3b82f6"
          strokeWidth={2}
          pointerEvents="all"
          style={{ cursor: "nwse-resize" }}
          onPointerDown={(event) => onHandlePointerDown(event, selected, { type: "handle", handle: handle.handle })}
        />
      ))}
    </g>
  );
}
