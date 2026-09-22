import { describe, expect, it } from "vitest";
import fixtures from "./__fixtures__/omrLayoutFixtures.json";
import {
  BOX_BORDER,
  MARKER_H,
  ROW_GAP,
  ROW_H,
  ROW_PITCH,
  boxHeight,
  boxWidth,
  bubbleSlots,
  bubbleCentersInColumn,
  columnLeft,
  firstRowCenterY,
  makeCode,
  markerBarPositions,
  markerGroups,
  parseAnswerText,
  parseCode,
  rowsPerColumn,
  slotPosition,
  toBn,
} from "./omrLayout";

/**
 * The printed sheet must match the Python recognizer exactly - these fixtures
 * are generated from omr/layout.py and recognizer._marker_bar_positions().
 */
describe("omrLayout parity with the local engine", () => {
  const cases = fixtures.cases;

  it("covers every supported shape", () => {
    expect(cases.length).toBe(12);
  });

  cases.forEach((testCase) => {
    const { columns, questions } = testCase;

    describe(`${columns} columns / ${questions} questions`, () => {
      it("computes the same box size and aspect", () => {
        expect(boxWidth(columns)).toBe(testCase.boxWidth);
        expect(boxHeight(columns, questions)).toBe(testCase.boxHeight);
        expect(rowsPerColumn(columns, questions)).toBe(testCase.rowsPerColumn);
        const aspect = boxHeight(columns, questions) / boxWidth(columns);
        expect(Math.abs(aspect - testCase.aspect)).toBeLessThan(1e-9);
      });

      it("puts the marker bars where the recognizer looks for them", () => {
        expect(markerGroups(columns, questions)).toEqual(testCase.markerGroups);
        const positions = markerBarPositions(columns, questions);
        expect(positions.length).toBe(testCase.markerBarPositions.length);
        positions.forEach((value, index) => {
          expect(Math.abs(value - testCase.markerBarPositions[index])).toBeLessThan(1e-9);
        });
      });

      it("places the bubble grid on the same coordinates", () => {
        expect(bubbleCentersInColumn().map((value) => Number(value.toFixed(9)))).toEqual(
          testCase.bubbleCentersInColumn.map((value: number) => Number(value.toFixed(9))),
        );
        expect(columnLeft(0)).toBeCloseTo(testCase.columnLefts[0], 9);
        testCase.columnLefts.forEach((value: number, index: number) => {
          expect(columnLeft(index)).toBeCloseTo(value, 9);
        });
        expect(firstRowCenterY()).toBeCloseTo(testCase.firstRowCenterY, 9);
        expect(ROW_PITCH).toBe(testCase.rowPitch);
        expect(ROW_PITCH).toBe(ROW_H + 2 * ROW_GAP);
      });

      it("generates the same bubble slots", () => {
        const slots = bubbleSlots(columns, questions);
        expect(slots.length).toBe(testCase.slotCount);
        testCase.slotSamples.forEach((sample: { number: number; option: number; x: number; y: number }) => {
          const slot = slots.find((item) => item.number === sample.number && item.option === sample.option);
          expect(slot).toBeTruthy();
          expect(slot!.x).toBeCloseTo(sample.x, 9);
          expect(slot!.y).toBeCloseTo(sample.y, 9);
        });
      });

      it("returns the same position for a single question/option lookup", () => {
        const position = slotPosition(columns, questions, 2, 3);
        const slot = bubbleSlots(columns, questions).find((item) => item.number === 2 && item.option === 3);
        expect(slot).toBeTruthy();
        expect(position.x).toBeCloseTo(slot!.x, 9);
        expect(position.y).toBeCloseTo(slot!.y, 9);
      });
    });
  });

  it("keeps the physical constants used by the printer", () => {
    expect(BOX_BORDER).toBe(3);
    expect(MARKER_H).toBe(25);
    expect(ROW_H).toBe(24);
  });
});

describe("OMR codes", () => {
  it("builds the codes the sheet prints", () => {
    expect(makeCode(2, 10)).toBe("12110");
    expect(makeCode(4, 20)).toBe("14120");
    expect(makeCode(4, 100)).toBe("141100");
  });

  it("parses valid codes and rejects invalid ones", () => {
    expect(parseCode("12110")).toMatchObject({ columns: 2, questions: 10, scannable: true });
    expect(parseCode("141100")).toMatchObject({ columns: 4, questions: 100, scannable: true });
    expect(parseCode("24120")).toMatchObject({ scannable: false });
    // the engine accepts any question count from 10 to 100, so 15 questions
    // must parse exactly like the Python side does
    expect(parseCode("12115")).toMatchObject({ questions: 15, scannable: true });
    expect(parseCode("1")).toBeNull();
    expect(parseCode("12105")).toBeNull();
    expect(parseCode("121101")).toBeNull();
    expect(parseCode("15110")).toBeNull();
    expect(parseCode("abcde")).toBeNull();
  });
});

describe("helper parsing", () => {
  it("converts digits to Bengali", () => {
    expect(toBn(0)).toBe("০");
    expect(toBn(120)).toBe("১২০");
  });

  it("reads pasted answer keys in Bengali, Latin and digits", () => {
    expect(parseAnswerText("ক খ গ ঘ")).toEqual([0, 1, 2, 3]);
    expect(parseAnswerText("A b C d")).toEqual([0, 1, 2, 3]);
    expect(parseAnswerText("1,2,3,4\n1 2")).toEqual([0, 1, 2, 3, 0, 1]);
    expect(parseAnswerText("১ ২ ৩ ৪")).toEqual([0, 1, 2, 3]);
    expect(parseAnswerText("x y")).toEqual([-1, -1]);
  });
});
