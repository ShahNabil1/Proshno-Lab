import { describe, expect, it } from "vitest";
import { BLANK_BOARD_KEY, boardReducer, createBoardState, MAX_HISTORY } from "./boardHistory";
import type { PenElement } from "./boardTypes";

const pen = (id: string): PenElement => ({
  id,
  kind: "pen",
  points: [
    [0, 0],
    [10, 10],
  ],
  color: "#ef4444",
  width: 6,
  opacity: 1,
});

describe("boardReducer", () => {
  it("commits elements and stores them per board key", () => {
    const state = boardReducer(createBoardState("q-1"), { type: "commit", elements: [pen("a")] });

    expect(state.elements).toHaveLength(1);
    expect(state.past).toHaveLength(1);
    expect(state.store["q-1"]).toHaveLength(1);
  });

  it("ignores a commit that reuses the same array reference", () => {
    const initial = createBoardState("q-1");
    const state = boardReducer(initial, { type: "commit", elements: initial.elements });

    expect(state).toBe(initial);
  });

  it("undoes and redoes the last change", () => {
    let state = createBoardState("q-1");
    state = boardReducer(state, { type: "commit", elements: [pen("a")] });
    state = boardReducer(state, { type: "commit", elements: [pen("a"), pen("b")] });

    state = boardReducer(state, { type: "undo" });
    expect(state.elements).toHaveLength(1);
    expect(state.future).toHaveLength(1);

    state = boardReducer(state, { type: "redo" });
    expect(state.elements).toHaveLength(2);
    expect(state.future).toHaveLength(0);
  });

  it("clears the board but keeps it undoable", () => {
    let state = boardReducer(createBoardState("q-1"), { type: "commit", elements: [pen("a")] });
    state = boardReducer(state, { type: "clear" });

    expect(state.elements).toHaveLength(0);
    state = boardReducer(state, { type: "undo" });
    expect(state.elements).toHaveLength(1);
  });

  it("keeps separate drawings for each question", () => {
    let state = createBoardState("q-1");
    state = boardReducer(state, { type: "commit", elements: [pen("first")] });
    state = boardReducer(state, { type: "switch", key: "q-2" });

    expect(state.elements).toHaveLength(0);
    state = boardReducer(state, { type: "commit", elements: [pen("second")] });

    state = boardReducer(state, { type: "switch", key: "q-1" });
    expect(state.elements.map((el) => el.id)).toEqual(["first"]);

    state = boardReducer(state, { type: "switch", key: "q-2" });
    expect(state.elements.map((el) => el.id)).toEqual(["second"]);
  });

  it("resets history when switching boards", () => {
    let state = boardReducer(createBoardState("q-1"), { type: "commit", elements: [pen("a")] });
    state = boardReducer(state, { type: "switch", key: "q-2" });

    expect(state.past).toHaveLength(0);
    expect(state.future).toHaveLength(0);
  });

  it("caps the undo stack", () => {
    let state = createBoardState(BLANK_BOARD_KEY);
    for (let index = 0; index < MAX_HISTORY + 12; index += 1) {
      state = boardReducer(state, { type: "commit", elements: [pen(`p-${index}`)] });
    }

    expect(state.past.length).toBeLessThanOrEqual(MAX_HISTORY);
  });
});


it("undoes and redoes part deletion together with drawings in chronological order", () => {
  let state = createBoardState('q-1');
  const moved = { stem: { x: 90, y: 30 } };
  state = boardReducer(state, { type: 'parts', parts: moved });
  state = boardReducer(state, { type: 'commit', elements: [pen('stroke')] });
  state = boardReducer(state, { type: 'parts', parts: { stem: { ...moved.stem, deleted: true } } });
  state = boardReducer(state, { type: 'undo' });
  expect(state.parts).toEqual(moved);
  expect(state.elements).toHaveLength(1);
  state = boardReducer(state, { type: 'undo' });
  expect(state.elements).toHaveLength(0);
  expect(state.parts).toEqual(moved);
  state = boardReducer(state, { type: 'redo' });
  state = boardReducer(state, { type: 'redo' });
  expect(state.parts.stem.deleted).toBe(true);
  expect(state.elements).toHaveLength(1);
  state = boardReducer(state, { type: 'switch', key: 'q-2' });
  expect(state.parts).toEqual({});
  state = boardReducer(state, { type: 'switch', key: 'q-1' });
  expect(state.parts.stem.deleted).toBe(true);
});

it("duplicates drawings and remaps movable question parts independently", () => {
  let source = boardReducer(createBoardState('q-12'), { type: 'commit', elements: [pen('ink')] });
  source = boardReducer(source, { type: 'parts', parts: {
    '12:stem': { x: 10, y: 30, copies: ['12:stem:copy:a'] },
    '12:stem:copy:a': { x: 20, y: 50, deleted: true },
  } });
  let copy = boardReducer(source, { type: 'duplicate', key: 'q--1', sourceId: 12, targetId: -1 });
  expect(copy.elements).toEqual(source.elements);
  expect(copy.elements).not.toBe(source.elements);
  expect(copy.parts['-1:stem'].copies).toEqual(['-1:stem:copy:a']);
  expect(copy.parts['-1:stem:copy:a'].deleted).toBe(true);
  copy = boardReducer(copy, { type: 'clear' });
  copy = boardReducer(copy, { type: 'switch', key: 'q-12' });
  expect(copy.elements).toHaveLength(1);
  expect(copy.parts).toEqual(source.parts);
});
