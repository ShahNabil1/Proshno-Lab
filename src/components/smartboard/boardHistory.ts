import type { BoardElement } from "./boardTypes";

export const MAX_HISTORY = 60;
export const BLANK_BOARD_KEY = "blank";

export interface BoardState {
  /** Key of the board currently on screen (one board per question). */
  key: string;
  elements: BoardElement[];
  past: BoardElement[][];
  future: BoardElement[][];
  /** Drawings for every board the teacher has touched, kept per question. */
  store: Record<string, BoardElement[]>;
}

export type BoardAction =
  | { type: "commit"; elements: BoardElement[] }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "clear" }
  | { type: "switch"; key: string };

export function createBoardState(key: string = BLANK_BOARD_KEY): BoardState {
  return { key, elements: [], past: [], future: [], store: {} };
}

function withBoard(state: BoardState, key: string, elements: BoardElement[]): Record<string, BoardElement[]> {
  return { ...state.store, [key]: elements };
}

export function boardReducer(state: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    case "commit": {
      if (action.elements === state.elements) return state;
      return {
        ...state,
        elements: action.elements,
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
        past: [...state.past, state.elements].slice(-MAX_HISTORY),
        future: [],
        store: withBoard(state, state.key, []),
      };
    }
    case "switch": {
      if (action.key === state.key) return state;
      const store = withBoard(state, state.key, state.elements);
      return {
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

