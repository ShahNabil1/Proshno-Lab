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
  compassRadius?: number;
  showCompassCenter?: boolean;
  onCompassRadiusChange?: (radius: number) => void;
  onCompassClose?: () => void;
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

type DragMode = { type: "move" } | { type: "handle"; handle: AnyHandle } | { type: "rotate" };

interface DragState {
  id: string;
  mode: DragMode;
  start: Point;
  original: BoardElement;
}

interface CompassArcState {
  center: Point;
  radius: number;
  startAngle: number;
  currentAngle: number;
  drawing: boolean;
  moving: boolean;
  resizing: boolean;
  tracePoints?: Point[];
  moveStart?: Point;
  originalCenter?: Point;
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
  compassRadius = 180,
  showCompassCenter = true,
  onCompassRadiusChange,
  onCompassClose,
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
  const [dragPreviews, setDragPreviews] = useState<BoardElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionBox, setSelectionBox] = useState<{ start: Point; current: Point } | null>(null);
  const dragGroupRef = useRef<BoardElement[]>([]);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [erasedIds, setErasedIds] = useState<string[]>([]);
  const [editorScale, setEditorScale] = useState(1);
  const [compassArc, setCompassArc] = useState<CompassArcState | null>(null);

  const brushCursorRef = useRef<SVGGElement | null>(null);
  const brushOuterRef = useRef<SVGCircleElement | null>(null);
  const brushInnerRef = useRef<SVGCircleElement | null>(null);
  const brushDotRef = useRef<SVGCircleElement | null>(null);

  const showBrushCursor = isDrawableTool(tool) || tool === "eraser";

  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  useEffect(() => {
    setCompassArc((current) => current ? { ...current, radius: compassRadius } : current);
  }, [compassRadius]);

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
    const previews = new Map(dragPreviews.map((el) => [el.id, el]));
    if (dragPreview) previews.set(dragPreview.id, dragPreview);
    return previews.size === 0 ? filtered : filtered.map((el) => previews.get(el.id) ?? el);
  }, [elements, erasedIds, dragPreview, dragPreviews]);

  useEffect(() => {
    if (tool !== "select") {
      setSelectedId(null);
      setSelectedIds([]);
      dragRef.current = null;
      setDragPreview(null);
      setDragPreviews([]);
    }
  }, [tool]);

  useEffect(() => {
    if (tool !== "compass") setCompassArc(null);
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
      setSelectedIds([element.id]);
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
      const movingSelectedGroup = mode.type === "move" && selectedIds.includes(el.id) && selectedIds.length > 1;
      if (!movingSelectedGroup) {
        setSelectedId(el.id);
        setSelectedIds([el.id]);
        dragGroupRef.current = [];
      } else {
        dragGroupRef.current = elementsRef.current.filter((item) => selectedIds.includes(item.id));
      }
      dragRef.current = { id: el.id, mode, start: toBoardPoint(event.clientX, event.clientY), original: el };
      svgRef.current?.setPointerCapture(event.pointerId);
    },
    [selectedIds, toBoardPoint, tool],
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
        setSelectedIds([]);
        setSelectionBox({ start: point, current: point });
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

      if (tool === "compass" && compassArc) {
        event.preventDefault();
        const centerDistance = Math.hypot(point[0] - compassArc.center[0], point[1] - compassArc.center[1]);
        const pencilPoint: Point = [
          compassArc.center[0] + Math.cos(compassArc.currentAngle) * compassArc.radius,
          compassArc.center[1] + Math.sin(compassArc.currentAngle) * compassArc.radius,
        ];
        const dx = Math.cos(compassArc.currentAngle);
        const dy = Math.sin(compassArc.currentAngle);
        const hingePoint: Point = [
          compassArc.center[0] + dx * compassArc.radius * 0.48 - dy * compassArc.radius * 0.32,
          compassArc.center[1] + dy * compassArc.radius * 0.48 + dx * compassArc.radius * 0.32,
        ];
        const legX = pencilPoint[0] - hingePoint[0];
        const legY = pencilPoint[1] - hingePoint[1];
        const legLengthSquared = legX * legX + legY * legY;
        const t = Math.max(0, Math.min(1, ((point[0] - hingePoint[0]) * legX + (point[1] - hingePoint[1]) * legY) / Math.max(1, legLengthSquared)));
        const pencilDistance = Math.hypot(point[0] - (hingePoint[0] + t * legX), point[1] - (hingePoint[1] + t * legY));
        if (pencilDistance <= 42) {
          setCompassArc({ ...compassArc, drawing: false, moving: false, resizing: true });
          return;
        }
        if (centerDistance <= Math.max(22, compassArc.radius * 0.16)) {
          setCompassArc({
            ...compassArc,
            drawing: false,
            moving: true,
            resizing: false,
            moveStart: point,
            originalCenter: compassArc.center,
          });
          return;
        }
        const rawAngle = Math.atan2(point[1] - compassArc.center[1], point[0] - compassArc.center[0]);
        setCompassArc({
          ...compassArc,
          startAngle: rawAngle,
          currentAngle: rawAngle,
          drawing: true,
          moving: false,
          resizing: false,
          tracePoints: [[
            compassArc.center[0] + Math.cos(rawAngle) * compassArc.radius,
            compassArc.center[1] + Math.sin(rawAngle) * compassArc.radius,
          ]],
        });
        return;
      }

      if (tool === "compass") {
        event.preventDefault();
        setCompassArc({ center: point, radius: compassRadius, startAngle: 0, currentAngle: 0, drawing: false, moving: false, resizing: false });
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

      if (tool === "line" || tool === "ruler") {
        setDraft({ kind: "line", start: point, current: point, points: [point], shapeKind: "rect" });
        return;
      }

      if (SHAPE_TOOLS.includes(tool)) {
        setDraft({ kind: "shape", start: point, current: point, points: [point], shapeKind: tool as ShapeElementKind });
      }
    },
    [compassArc, compassRadius, eraseAt, finishEditing, moveBrushCursor, openTextEditor, showBrushCursor, toBoardPoint, tool],
  );

  const beginCompassResize = useCallback((event: React.PointerEvent<SVGElement>) => {
    if (!compassArc) return;
    event.preventDefault();
    event.stopPropagation();
    svgRef.current?.setPointerCapture(event.pointerId);
    setCompassArc({ ...compassArc, drawing: false, moving: false, resizing: true });
  }, [compassArc]);

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

      if (selectionBox) {
        setSelectionBox({ ...selectionBox, current: toBoardPoint(event.clientX, event.clientY) });
        return;
      }


      if (compassArc?.moving && compassArc.moveStart && compassArc.originalCenter) {
        const point = toBoardPoint(event.clientX, event.clientY);
        setCompassArc({
          ...compassArc,
          center: [
            compassArc.originalCenter[0] + point[0] - compassArc.moveStart[0],
            compassArc.originalCenter[1] + point[1] - compassArc.moveStart[1],
          ],
        });
        return;
      }

      if (compassArc?.resizing) {
        const point = toBoardPoint(event.clientX, event.clientY);
        const radius = Math.max(30, Math.min(520, Math.hypot(point[0] - compassArc.center[0], point[1] - compassArc.center[1])));
        const angle = Math.atan2(point[1] - compassArc.center[1], point[0] - compassArc.center[0]);
        setCompassArc({ ...compassArc, radius, startAngle: angle, currentAngle: angle });
        onCompassRadiusChange?.(Math.round(radius));
        return;
      }

      if (compassArc?.drawing) {
        const point = toBoardPoint(event.clientX, event.clientY);
        const rawAngle = Math.atan2(point[1] - compassArc.center[1], point[0] - compassArc.center[0]);
        const previousWrapped = Math.atan2(Math.sin(compassArc.currentAngle), Math.cos(compassArc.currentAngle));
        let delta = rawAngle - previousWrapped;
        if (delta > Math.PI) delta -= Math.PI * 2;
        if (delta < -Math.PI) delta += Math.PI * 2;
        const nextAngle = compassArc.currentAngle + delta;
        const tracePoints = compassArc.tracePoints ?? [];
        // Pointer events can be far apart during a fast sweep. Fill that gap
        // from the compass equation instead of joining the samples with a
        // chord/smoothed freehand curve, so every saved point has one radius.
        const interpolationSteps = Math.max(1, Math.ceil(Math.abs(delta) / 0.012));
        const interpolatedPoints: Point[] = Array.from({ length: interpolationSteps }, (_, index) => {
          const angle = compassArc.currentAngle + (delta * (index + 1)) / interpolationSteps;
          return [
            compassArc.center[0] + Math.cos(angle) * compassArc.radius,
            compassArc.center[1] + Math.sin(angle) * compassArc.radius,
          ];
        });
        setCompassArc({
          ...compassArc,
          currentAngle: nextAngle,
          tracePoints: [...tracePoints, ...interpolatedPoints],
        });
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
        if (drag.mode.type === "move" && dragGroupRef.current.length > 1) {
          setDragPreviews(dragGroupRef.current.map((element) => translateElement(element, dx, dy)));
          return;
        }
        if (drag.mode.type === "rotate") {
          const bounds = elementBounds(drag.original);
          const cx = bounds.x + bounds.w / 2;
          const cy = bounds.y + bounds.h / 2;
          const startAngle = Math.atan2(drag.start[1] - cy, drag.start[0] - cx);
          const currentAngle = Math.atan2(point[1] - cy, point[0] - cx);
          setDragPreview({ ...drag.original, rotation: (drag.original.rotation ?? 0) + ((currentAngle - startAngle) * 180) / Math.PI });
          return;
        }
        setDragPreview(
          drag.mode.type === "move"
            ? translateElement(drag.original, dx, dy)
            : resizeElement(drag.original, drag.mode.handle, dx, dy),
        );
      }
    },
    [compassArc, draft, eraseAt, moveBrushCursor, onCompassRadiusChange, selectionBox, showBrushCursor, toBoardPoint],
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
        } else if (draft.shapeKind === "compass") {
          const radius = Math.hypot(draft.current[0] - draft.start[0], draft.current[1] - draft.start[1]);
          if (radius > 6) {
            const angle = Math.atan2(draft.current[1] - draft.start[1], draft.current[0] - draft.start[0]);
            setCompassArc({ center: draft.start, radius, startAngle: angle, currentAngle: angle, drawing: false, moving: false, resizing: false });
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

      if (selectionBox) {
        const box = rectFromPoints(selectionBox.start, selectionBox.current);
        const ids = elementsRef.current.filter((element) => {
          const bounds = elementBounds(element);
          return bounds.x <= box.x + box.w && bounds.x + bounds.w >= box.x && bounds.y <= box.y + box.h && bounds.y + bounds.h >= box.y;
        }).map((element) => element.id);
        setSelectedIds(ids);
        setSelectedId(ids[0] ?? null);
        setSelectionBox(null);
        return;
      }

      if (compassArc?.drawing) {
        const points = compassArc.tracePoints ?? [];
        if (points.length > 1) {
          const committed: BoardElement[] = [...elementsRef.current, {
            id: createElementId(), kind: "pen", points, color, width: strokeWidth, opacity,
          }];
          if (showCompassCenter) {
            const [cx, cy] = compassArc.center;
            const markerSize = 12;
            committed.push(
              { id: createElementId(), kind: "line", x1: cx - markerSize, y1: cy, x2: cx + markerSize, y2: cy, color: "#ef4444", strokeWidth: 2.5, opacity: 1, compassCenter: true },
              { id: createElementId(), kind: "line", x1: cx, y1: cy - markerSize, x2: cx, y2: cy + markerSize, color: "#ef4444", strokeWidth: 2.5, opacity: 1, compassCenter: true },
              { id: createElementId(), kind: "circle", x: cx - 7, y: cy - 7, w: 14, h: 14, color: "#ef4444", strokeWidth: 2, opacity: 1, compassCenter: true },
            );
          }
          onCommit(committed);
        }
        setCompassArc({ ...compassArc, startAngle: compassArc.currentAngle, drawing: false, moving: false, resizing: false, tracePoints: [] });
        return;
      }

      if (compassArc?.moving) {
        setCompassArc({ ...compassArc, moving: false, moveStart: undefined, originalCenter: undefined });
        return;
      }

      if (compassArc?.resizing) {
        setCompassArc({ ...compassArc, resizing: false });
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
      if (dragPreviews.length > 0) {
        const previews = new Map(dragPreviews.map((element) => [element.id, element]));
        onCommit(elementsRef.current.map((element) => previews.get(element.id) ?? element));
      } else if (drag && dragPreview) {
        onCommit(elementsRef.current.map((el) => (el.id === dragPreview.id ? dragPreview : el)));
      }
      dragRef.current = null;
      dragGroupRef.current = [];
      setDragPreview(null);
      setDragPreviews([]);
    },
    [color, compassArc, draft, dragPreview, dragPreviews, onCommit, opacity, selectionBox, showCompassCenter, strokeWidth],
  );

  const handlePointerCancel = useCallback(() => {
    setDraft(null);
    dragRef.current = null;
    setDragPreview(null);
    setDragPreviews([]);
    setSelectionBox(null);
    eraseActiveRef.current = false;
    eraseRef.current = new Set();
    setErasedIds([]);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if (event.key === "Escape") {
        setSelectedId(null);
        setSelectedIds([]);
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedIds.length > 0) {
        event.preventDefault();
        onCommit(elementsRef.current.filter((el) => !selectedIds.includes(el.id)));
        setSelectedId(null);
        setSelectedIds([]);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCommit, selectedIds]);

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
    if (draft.shapeKind === "compass") {
      const radius = Math.hypot(draft.current[0] - draft.start[0], draft.current[1] - draft.start[1]);
      const angle = Math.atan2(draft.current[1] - draft.start[1], draft.current[0] - draft.start[0]);
      return <CompassGuide center={draft.start} radius={radius} angle={angle} color={color} strokeWidth={strokeWidth} />;
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
  const selectedElements = visibleElements.filter((element) => selectedIds.includes(element.id));
  const groupBounds = selectedElements.length > 1 ? selectedElements.reduce((combined, element) => {
    const bounds = elementBounds(element);
    const right = Math.max(combined.x + combined.w, bounds.x + bounds.w);
    const bottom = Math.max(combined.y + combined.h, bounds.y + bounds.h);
    const x = Math.min(combined.x, bounds.x);
    const y = Math.min(combined.y, bounds.y);
    return { x, y, w: right - x, h: bottom - y };
  }, elementBounds(selectedElements[0])) : null;

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
        {visibleElements.filter((el) => showCompassCenter || !el.compassCenter).map((el) => (
          <ElementNode
            key={el.id}
            element={el}
            interactive={tool === "select"}
            onPointerDown={beginElementInteraction}
            onRequestEdit={openTextEditor}
          />
        ))}

        {draftPreviewNode}

        {selectionBox && (() => {
          const box = rectFromPoints(selectionBox.start, selectionBox.current);
          return <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="#3b82f6" fillOpacity={0.1} stroke="#2563eb" strokeWidth={2} strokeDasharray="8 5" pointerEvents="none" />;
        })()}

        {compassArc && (
          <g>
            {compassArc.drawing && (
              <path
                d={polylinePath(compassArc.tracePoints ?? [])}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                opacity={opacity}
                strokeLinecap="round"
              />
            )}
            <CompassGuide
              center={compassArc.center}
              radius={compassArc.radius}
              angle={compassArc.currentAngle}
              color={color}
              strokeWidth={Math.max(2, strokeWidth * 0.65)}
            />
            <CompassResizeHitArea
              center={compassArc.center}
              radius={compassArc.radius}
              angle={compassArc.currentAngle}
              onPointerDown={beginCompassResize}
            />
            {onCompassClose && (
              <CompassCloseButton
                center={compassArc.center}
                radius={compassArc.radius}
                angle={compassArc.currentAngle}
                onClose={onCompassClose}
              />
            )}
            {showCompassCenter && (
              <g aria-label="কম্পাসের কেন্দ্র">
                <circle cx={compassArc.center[0]} cy={compassArc.center[1]} r={17} fill="#ffffff" fillOpacity={0.92} stroke="#ef4444" strokeWidth={3} strokeDasharray="5 3" />
                <line x1={compassArc.center[0] - 22} y1={compassArc.center[1]} x2={compassArc.center[0] + 22} y2={compassArc.center[1]} stroke="#ef4444" strokeWidth={2.5} />
                <line x1={compassArc.center[0]} y1={compassArc.center[1] - 22} x2={compassArc.center[0]} y2={compassArc.center[1] + 22} stroke="#ef4444" strokeWidth={2.5} />
                <circle cx={compassArc.center[0]} cy={compassArc.center[1]} r={4} fill="#ef4444" />
              </g>
            )}
          </g>
        )}

        {groupBounds ? (
          <rect x={groupBounds.x - 8} y={groupBounds.y - 8} width={groupBounds.w + 16} height={groupBounds.h + 16} fill="#3b82f6" fillOpacity={0.05} stroke="#2563eb" strokeWidth={3} strokeDasharray="10 6" pointerEvents="none" />
        ) : selected ? <SelectionOverlay selected={selected} onHandlePointerDown={beginElementInteraction} /> : null}

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

function arcPath(center: Point, radius: number, startAngle: number, endAngle: number): string {
  const sweep = endAngle - startAngle;
  const steps = Math.max(2, Math.ceil(Math.abs(sweep) / 0.04));
  return Array.from({ length: steps + 1 }, (_, index) => {
    const angle = startAngle + (sweep * index) / steps;
    const x = center[0] + Math.cos(angle) * radius;
    const y = center[1] + Math.sin(angle) * radius;
    return `${index === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ");
}

function polylinePath(points: Point[]): string {
  return points.map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
}

function CompassGuide({ center, radius, angle, color, strokeWidth }: {
  center: Point;
  radius: number;
  angle: number;
  color: string;
  strokeWidth: number;
}) {
  const [cx, cy] = center;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const pencilX = cx + dx * radius;
  const pencilY = cy + dy * radius;
  const hingeX = cx + dx * radius * 0.48 - dy * radius * 0.32;
  const hingeY = cy + dy * radius * 0.48 + dx * radius * 0.32;
  const needleMidX = (cx + hingeX) / 2;
  const needleMidY = (cy + hingeY) / 2;
  const pencilMidX = (pencilX + hingeX) / 2;
  const pencilMidY = (pencilY + hingeY) / 2;
  const barMidX = (needleMidX + pencilMidX) / 2;
  const barMidY = (needleMidY + pencilMidY) / 2;
  const metalWidth = Math.max(8, strokeWidth * 3.2);
  const outlineWidth = Math.max(1.5, strokeWidth * 0.55);
  const px = -dy;
  const py = dx;
  const headBackX = hingeX - dx * Math.max(24, radius * 0.11);
  const headBackY = hingeY - dy * Math.max(24, radius * 0.11);
  const headFrontX = hingeX + dx * Math.max(15, radius * 0.055);
  const headFrontY = hingeY + dy * Math.max(15, radius * 0.055);
  const headHalfWidth = Math.max(15, metalWidth * 1.15);
  const eraserX = hingeX + (pencilX - hingeX) * 0.23;
  const eraserY = hingeY + (pencilY - hingeY) * 0.23;
  const woodX = pencilX - dx * Math.max(18, metalWidth * 1.5);
  const woodY = pencilY - dy * Math.max(18, metalWidth * 1.5);
  const common = { fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <g pointerEvents="none">
      <defs>
        <linearGradient id="compass-metal" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#64748b" /><stop offset="0.28" stopColor="#f8fafc" />
          <stop offset="0.62" stopColor="#cbd5e1" /><stop offset="1" stopColor="#475569" />
        </linearGradient>
        <linearGradient id="compass-blue" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" /><stop offset="0.55" stopColor="#4338ca" /><stop offset="1" stopColor="#312e81" />
        </linearGradient>
        <linearGradient id="compass-pencil" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5b2c1d" /><stop offset="0.38" stopColor="#a05236" /><stop offset="0.7" stopColor="#7c3f2b" /><stop offset="1" stopColor="#3f1d14" />
        </linearGradient>
        <filter id="compass-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="3" dy="4" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.3" />
        </filter>
      </defs>

      <g filter="url(#compass-shadow)">
        {/* polished needle leg */}
        <line x1={cx} y1={cy} x2={hingeX} y2={hingeY} stroke="#334155" strokeWidth={metalWidth + 4} {...common} />
        <line x1={cx} y1={cy} x2={hingeX} y2={hingeY} stroke="url(#compass-metal)" strokeWidth={metalWidth} {...common} />
        <line x1={cx + px * 2} y1={cy + py * 2} x2={hingeX + px * 2} y2={hingeY + py * 2} stroke="#ffffff" strokeOpacity={0.65} strokeWidth={2} {...common} />

        {/* wooden pencil leg, metal clamp and eraser */}
        <line x1={hingeX} y1={hingeY} x2={woodX} y2={woodY} stroke="#3f1d14" strokeWidth={metalWidth + 4} {...common} />
        <line x1={hingeX} y1={hingeY} x2={woodX} y2={woodY} stroke="url(#compass-pencil)" strokeWidth={metalWidth} {...common} />
        <line x1={eraserX - dx * 15} y1={eraserY - dy * 15} x2={eraserX + dx * 8} y2={eraserY + dy * 8} stroke="#dc3b2e" strokeWidth={metalWidth * 1.05} {...common} />
        <line x1={eraserX + dx * 7} y1={eraserY + dy * 7} x2={eraserX + dx * 13} y2={eraserY + dy * 13} stroke="#e5e7eb" strokeWidth={metalWidth * 1.12} {...common} />
        <line x1={pencilMidX - dx * 13} y1={pencilMidY - dy * 13} x2={pencilMidX + dx * 13} y2={pencilMidY + dy * 13} stroke="url(#compass-metal)" strokeWidth={metalWidth * 1.35} {...common} />
        <path d={`M ${woodX + px * metalWidth * 0.48} ${woodY + py * metalWidth * 0.48} L ${pencilX} ${pencilY} L ${woodX - px * metalWidth * 0.48} ${woodY - py * metalWidth * 0.48} Z`} fill="#e8c99b" stroke="#713f12" strokeWidth={outlineWidth} />
        <path d={`M ${pencilX} ${pencilY} L ${pencilX - dx * 8 + px * 3} ${pencilY - dy * 8 + py * 3} L ${pencilX - dx * 8 - px * 3} ${pencilY - dy * 8 - py * 3} Z`} fill={color} />
      </g>

      {/* adjustment bar and screw */}
      <line x1={needleMidX} y1={needleMidY} x2={pencilMidX} y2={pencilMidY} stroke="#94a3b8" strokeWidth={Math.max(4, metalWidth * 0.45)} {...common} />
      <circle cx={barMidX} cy={barMidY} r={Math.max(5, metalWidth * 0.55)} fill="#e2e8f0" stroke="#475569" strokeWidth={outlineWidth} />
      <line x1={barMidX - 5} y1={barMidY} x2={barMidX + 5} y2={barMidY} stroke="#475569" strokeWidth={outlineWidth} />

      {/* blue head housing and ribbed handle */}
      <line x1={headBackX} y1={headBackY} x2={headBackX - dx * Math.max(25, radius * 0.1)} y2={headBackY - dy * Math.max(25, radius * 0.1)} stroke="#3730a3" strokeWidth={metalWidth * 0.92} {...common} />
      {[0, 7, 14, 21].map((offset) => <line key={offset} x1={headBackX - dx * offset - px * metalWidth * 0.48} y1={headBackY - dy * offset - py * metalWidth * 0.48} x2={headBackX - dx * offset + px * metalWidth * 0.48} y2={headBackY - dy * offset + py * metalWidth * 0.48} stroke="#6366f1" strokeWidth={2} />)}
      <polygon points={`${headBackX + px * headHalfWidth},${headBackY + py * headHalfWidth} ${headFrontX + px * headHalfWidth * 0.72},${headFrontY + py * headHalfWidth * 0.72} ${headFrontX - px * headHalfWidth * 0.72},${headFrontY - py * headHalfWidth * 0.72} ${headBackX - px * headHalfWidth},${headBackY - py * headHalfWidth}`} fill="url(#compass-blue)" stroke="#312e81" strokeWidth={3} strokeLinejoin="round" filter="url(#compass-shadow)" />
      <circle cx={hingeX} cy={hingeY} r={Math.max(9, metalWidth * 0.82)} fill="url(#compass-metal)" stroke="#e2e8f0" strokeWidth={2.5} />
      <circle cx={hingeX - dx * 2 - px * 2} cy={hingeY - dy * 2 - py * 2} r={Math.max(4, metalWidth * 0.35)} fill="#f8fafc" opacity={0.8} />

      {/* fixed needle and pencil tip */}
      <path d={`M ${cx - dx * 9} ${cy - dy * 9} L ${cx} ${cy}`} stroke="#111827" strokeWidth={Math.max(2, outlineWidth)} {...common} />
      <circle cx={cx} cy={cy} r={Math.max(5, strokeWidth * 1.15)} fill="#ffffff" stroke={color} strokeWidth={Math.max(2, outlineWidth)} />
      <circle cx={cx} cy={cy} r={Math.max(2.5, strokeWidth * 0.55)} fill={color} />
      <path d={`M ${pencilX - dx * 10} ${pencilY - dy * 10} L ${pencilX} ${pencilY}`} stroke={color} strokeWidth={Math.max(3, strokeWidth)} {...common} />
      <circle cx={pencilX} cy={pencilY} r={15} fill="#ffffff" fillOpacity={0.9} stroke="#2563eb" strokeWidth={3} strokeDasharray="4 3" />
      <circle cx={pencilX} cy={pencilY} r={5} fill="#2563eb" />
    </g>
  );
}

function CompassResizeHitArea({ center, radius, angle, onPointerDown }: {
  center: Point;
  radius: number;
  angle: number;
  onPointerDown: (event: React.PointerEvent<SVGElement>) => void;
}) {
  const [cx, cy] = center;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const pencilX = cx + dx * radius;
  const pencilY = cy + dy * radius;
  const hingeX = cx + dx * radius * 0.48 - dy * radius * 0.32;
  const hingeY = cy + dy * radius * 0.48 + dx * radius * 0.32;
  return (
    <g aria-label="পেন্সিল ধরে ব্যাসার্ধ পরিবর্তন করুন">
      <line
        x1={hingeX}
        y1={hingeY}
        x2={pencilX}
        y2={pencilY}
        stroke="transparent"
        strokeWidth={64}
        strokeLinecap="round"
        pointerEvents="stroke"
        style={{ cursor: "nwse-resize" }}
        onPointerDown={onPointerDown}
      />
      <circle
        cx={pencilX}
        cy={pencilY}
        r={25}
        fill="transparent"
        pointerEvents="all"
        style={{ cursor: "nwse-resize" }}
        onPointerDown={onPointerDown}
      />
    </g>
  );
}

function CompassCloseButton({ center, radius, angle, onClose }: {
  center: Point;
  radius: number;
  angle: number;
  onClose: () => void;
}) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const px = -dy;
  const py = dx;
  const x = center[0] + dx * radius * 0.42 - px * Math.max(42, radius * 0.23);
  const y = center[1] + dy * radius * 0.42 - py * Math.max(42, radius * 0.23);

  return (
    <g
      role="button"
      aria-label="কম্পাস বন্ধ করুন"
      className="cursor-pointer"
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
        onClose();
      }}
    >
      <circle cx={x} cy={y} r={22} fill="#ffffff" stroke="#ef4444" strokeWidth={3} />
      <line x1={x - 8} y1={y - 8} x2={x + 8} y2={y + 8} stroke="#dc2626" strokeWidth={3.5} strokeLinecap="round" />
      <line x1={x + 8} y1={y - 8} x2={x - 8} y2={y + 8} stroke="#dc2626" strokeWidth={3.5} strokeLinecap="round" />
      <circle cx={x} cy={y} r={28} fill="transparent" pointerEvents="all" />
    </g>
  );
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
  if (kind === "ruler") {
    const ticks = Array.from({ length: 11 }, (_, index) => {
      const tx = x + (Math.abs(w) * index) / 10;
      const tickHeight = index % 5 === 0 ? Math.abs(h) * 0.45 : Math.abs(h) * 0.25;
      return <line key={index} x1={tx} y1={y} x2={tx} y2={y + tickHeight} {...common} />;
    });
    return <g><rect x={x} y={y} width={Math.abs(w)} height={Math.abs(h)} rx={2} {...common} />{ticks}</g>;
  }
  if (kind === "protractor") {
    const width = Math.abs(w);
    const height = Math.abs(h);
    const path = `M ${x} ${y + height} A ${width / 2} ${height} 0 0 1 ${x + width} ${y + height} L ${x} ${y + height}`;
    return <g><path d={path} {...common} /><line x1={x + width / 2} y1={y + height} x2={x + width / 2} y2={y + height * 0.25} {...common} /></g>;
  }
  if (kind === "compass") {
    const width = Math.abs(w);
    const height = Math.abs(h);
    return <g><circle cx={x + width / 2} cy={y + height * 0.12} r={Math.max(4, width * 0.06)} {...common} /><line x1={x + width / 2} y1={y + height * 0.18} x2={x + width * 0.12} y2={y + height} {...common} /><line x1={x + width / 2} y1={y + height * 0.18} x2={x + width * 0.88} y2={y + height} {...common} /><path d={`M ${x + width * 0.28} ${y + height * 0.64} A ${width * 0.3} ${height * 0.32} 0 0 0 ${x + width * 0.72} ${y + height * 0.64}`} {...common} /></g>;
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
  const bounds = elementBounds(element);
  const centerX = bounds.x + bounds.w / 2;
  const centerY = bounds.y + bounds.h / 2;
  const transform = element.rotation ? `rotate(${element.rotation} ${centerX} ${centerY})` : undefined;

  if (element.kind === "pen") {
    return (
      <g onPointerDown={moveHandler} style={groupStyle} transform={transform}>
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
      <g onPointerDown={moveHandler} style={groupStyle} transform={transform}>
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
        transform={transform}
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
    <g onPointerDown={moveHandler} style={groupStyle} transform={transform}>
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
  const centerX = bounds.x + bounds.w / 2;
  const centerY = bounds.y + bounds.h / 2;
  const rotation = selected.rotation ?? 0;
  const rotateHandleY = bounds.y - 42;
  return (
    <g transform={rotation ? `rotate(${rotation} ${centerX} ${centerY})` : undefined}>
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
      <line
        x1={centerX}
        y1={bounds.y - 6}
        x2={centerX}
        y2={rotateHandleY}
        stroke="#3b82f6"
        strokeWidth={2}
        pointerEvents="none"
      />
      <circle
        cx={centerX}
        cy={rotateHandleY}
        r={11}
        fill="#ffffff"
        stroke="#3b82f6"
        strokeWidth={3}
        pointerEvents="all"
        style={{ cursor: "grab" }}
        aria-label="ঘোরান"
        onPointerDown={(event) => onHandlePointerDown(event, selected, { type: "rotate" })}
      />
    </g>
  );
}
