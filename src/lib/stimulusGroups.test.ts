import { describe, expect, it } from "vitest";
import {
  findRepeatedStimuli,
  hasRenderableStimulus,
  normalizeStimulusKey,
} from "./stimulusGroups";

describe("stimulus grouping", () => {
  it("recognizes repeated stimuli despite insignificant whitespace", () => {
    const questions = [
      { stimulus: "<p>ধরি, a + 1/a = √6</p>" },
      { stimulus: " <p>ধরি,  a + 1/a = √6</p> " },
      { stimulus: "<p>একক উদ্দীপক</p>" },
    ];

    const repeated = findRepeatedStimuli(questions, q => q.stimulus);

    expect(repeated).toEqual(new Set([normalizeStimulusKey(questions[0].stimulus)]));
  });

  it("keeps a stimulus used by only one question standalone", () => {
    const questions = [{ stimulus: "<p>শুধু একটি প্রশ্ন</p>" }];
    expect(findRepeatedStimuli(questions, q => q.stimulus).size).toBe(0);
  });

  it("treats image-only rich content as a renderable stimulus", () => {
    expect(hasRenderableStimulus('<p><img src="figure.png" /></p>')).toBe(true);
    expect(hasRenderableStimulus("<p> </p>")).toBe(false);
  });
});
