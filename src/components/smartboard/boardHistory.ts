import type { BoardElement } from "./boardTypes";

export const MAX_HISTORY = 60;
export const BLANK_BOARD_KEY = "blank";

export type SlideParts = Record<string, { x: number; y: number; deleted?: boolean; scale?: number; copies?: string[] }>;
export interface BoardState {
  parts: SlideParts;
  partsPast: SlideParts[];
  partsFuture: SlideParts[];
  partsStore: Record<string, SlideParts>;
  /** Key of the board currently on screen (one board per question). */
  key: string;
  elements: BoardElement[];
  past: BoardElement[][];
  future: BoardElement[][];
  /** Drawings for every board the teacher has touched, kept per question. */
  store: Record<string, BoardElement[]>;
}

export type BoardAction =
  | { type: "duplicate"; key: string; sourceId?: number; targetId: number }
  | { type: "parts"; parts: SlideParts }
  | { type: "commit"; elements: BoardElement[] }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "clear" }
  | { type: "switch"; key: string };

export function createBoardState(key: string = BLANK_BOARD_KEY): BoardState {
  return { parts: {}, partsPast: [], partsFuture: [], partsStore: {}, key, elements: [], past: [], future: [], store: {} };
}

function withBoard(state: BoardState, key: string, elements: BoardElement[]): Record<string, BoardElement[]> {
  return { ...state.store, [key]: elements };
}

export function boardReducer(state: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    case "duplicate": {
      const remap = (id: string) => action.sourceId === undefined ? id
        : id.startsWith(`${action.sourceId}:`) ? `${action.targetId}:${id.slice(String(action.sourceId).length + 1)}` : id;
      const parts = Object.fromEntries(Object.entries(state.parts).map(([id, part]) => [remap(id), {
        ...part, ...(part.copies ? { copies: part.copies.map(remap) } : {}),
      }]));
      const elements = structuredClone(state.elements);
      return { ...state, key: action.key, elements, parts, past: [], future: [], partsPast: [], partsFuture: [],
        store: { ...state.store, [state.key]: state.elements, [action.key]: elements },
        partsStore: { ...state.partsStore, [state.key]: state.parts, [action.key]: parts } };
    }
    case "parts":
      return { ...state, parts: action.parts,
        past: [...state.past, state.elements].slice(-MAX_HISTORY), future: [],
        partsPast: [...state.partsPast, state.parts].slice(-MAX_HISTORY), partsFuture: [],
        partsStore: { ...state.partsStore, [state.key]: action.parts } };
    case "commit": {
      if (action.elements === state.elements) return state;
      return {
        ...state,
        elements: action.elements,
        partsPast: [...state.partsPast, state.parts].slice(-MAX_HISTORY), partsFuture: [],
        past: [...state.past, state.elements].slice(-MAX_HISTORY),
        future: [],
        store: withBoard(state, state.key, action.elements),
      };
    }
    case "undo": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        ...state,
        elements: previous,
        parts: state.partsPast.at(-1) ?? state.parts,
        partsPast: state.partsPast.slice(0, -1),
        partsFuture: [state.parts, ...state.partsFuture].slice(0, MAX_HISTORY),
        past: state.past.slice(0, -1),
        future: [state.elements, ...state.future].slice(0, MAX_HISTORY),
        store: withBoard(state, state.key, previous),
      };
    }
    case "redo": {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        ...state,
        elements: next,
        parts: state.partsFuture[0] ?? state.parts,
        partsPast: [...state.partsPast, state.parts].slice(-MAX_HISTORY),
        partsFuture: state.partsFuture.slice(1),
        past: [...state.past, state.elements].slice(-MAX_HISTORY),
        future: state.future.slice(1),
        store: withBoard(state, state.key, next),
      };
    }
    case "clear": {
      if (state.elements.length === 0) return state;
      return {
        ...state,
        elements: [],
        partsPast: [...state.partsPast, state.parts].slice(-MAX_HISTORY), partsFuture: [],
        past: [...state.past, state.elements].slice(-MAX_HISTORY),
        future: [],
        store: withBoard(state, state.key, []),
      };
    }
    case "switch": {
      if (action.key === state.key) return state;
      const store = withBoard(state, state.key, state.elements);
      return {
        parts: state.partsStore[action.key] ?? {}, partsPast: [], partsFuture: [],
        partsStore: { ...state.partsStore, [state.key]: state.parts },
        key: action.key,
        elements: store[action.key] ?? [],
        past: [],
        future: [],
        store,
      };
    }
    default:
      return state;
  }
}

