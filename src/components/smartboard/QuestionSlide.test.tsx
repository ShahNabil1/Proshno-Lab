import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import QuestionSlide, { type SmartBoardQuestion } from "./QuestionSlide";

const mcqQuestion: SmartBoardQuestion = {
  id: 1,
  type: "mcq",
  question: "বাংলাদেশের রাজধানীর নাম কী?",
  option_a: "ঢাকা",
  option_b: "চট্টগ্রাম",
  option_c: "খুলনা",
  option_d: "রাজশাহী",
  correct_answer: "a",
  explanation: "ঢাকা বাংলাদেশের রাজধানী ও সর্ববৃহৎ শহর।",
};

const cqQuestion: SmartBoardQuestion = {
  id: 2,
  type: "cq",
  question: "সৃজনশীল প্রশ্ন",
  creative_data: {
    stem: "একটি বস্তু ২০ মিটার উচ্চতা থেকে পড়ছে।",
    sub_questions: [
      { question: "বস্তুটির প্রাথমিক বেগ কত?", answer: "শূন্য" },
      { question: "কত সময়ে মাটিতে পৌঁছাবে?", answer: "২ সেকেন্ড" },
    ],
  },
};

const shortQuestion: SmartBoardQuestion = {
  id: 3,
  type: "short",
  question: "মহাকর্ষীয় ধ্রুবক কী?",
  explanation: "দুটি একক ভরের বস্তুর মধ্যকার আকর্ষণ বলকে মহাকর্ষীয় ধ্রুবক বলে।",
};

describe("QuestionSlide", () => {
  it("renders an MCQ with its options and hides the answer by default", () => {
    render(<QuestionSlide question={mcqQuestion} number={1} meta={null} showAnswer={false} dark={false} />);

    expect(screen.getByText("বাংলাদেশের রাজধানীর নাম কী?")).toBeInTheDocument();
    expect(screen.getByText("ঢাকা")).toBeInTheDocument();
    expect(screen.getByText("চট্টগ্রাম")).toBeInTheDocument();
    expect(screen.queryByText("উত্তর")).not.toBeInTheDocument();
  });

  it("reveals the correct option and explanation when the answer is shown", () => {
    render(<QuestionSlide question={mcqQuestion} number={1} meta={null} showAnswer dark={false} />);

    expect(screen.getByText("উত্তর")).toBeInTheDocument();
    expect(screen.getByText("সঠিক উত্তর:")).toBeInTheDocument();
    expect(screen.getByText("ব্যাখ্যা:")).toBeInTheDocument();
    expect(screen.getByText("ঢাকা বাংলাদেশের রাজধানী ও সর্ববৃহৎ শহর।")).toBeInTheDocument();
  });

  it("renders the paper meta header when provided", () => {
    render(
      <QuestionSlide
        question={mcqQuestion}
        number={4}
        meta={{ instituteName: "আদর্শ উচ্চ বিদ্যালয়", className: "নবম শ্রেণি", subjectName: "গণিত" }}
        showAnswer={false}
        dark={false}
      />,
    );

    expect(screen.getByText("আদর্শ উচ্চ বিদ্যালয়")).toBeInTheDocument();
    expect(screen.getByText("নবম শ্রেণি")).toBeInTheDocument();
    expect(screen.getByText("গণিত")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("renders CQ sub-questions and their answers", () => {
    const { rerender } = render(
      <QuestionSlide question={cqQuestion} number={1} meta={null} showAnswer={false} dark={false} />,
    );

    expect(screen.getByText("একটি বস্তু ২০ মিটার উচ্চতা থেকে পড়ছে।")).toBeInTheDocument();
    expect(screen.getByText("বস্তুটির প্রাথমিক বেগ কত?")).toBeInTheDocument();
    expect(screen.queryByText("শূন্য")).not.toBeInTheDocument();

    rerender(<QuestionSlide question={cqQuestion} number={1} meta={null} showAnswer dark={false} />);

    expect(screen.getByText("শূন্য")).toBeInTheDocument();
    expect(screen.getByText("২ সেকেন্ড")).toBeInTheDocument();
  });

  it("renders a CQ stimulus only once when it is stored in both fields", () => {
    const duplicatedStimulus = "একই উদ্দীপক";
    const question = {
      ...cqQuestion,
      stimulus_text: duplicatedStimulus,
      creative_data: { ...cqQuestion.creative_data, stem: duplicatedStimulus },
    };

    render(<QuestionSlide question={question} number={1} meta={null} showAnswer={false} dark={false} />);

    expect(screen.getAllByText(duplicatedStimulus)).toHaveLength(1);
  });

  it("falls back to the explanation for short questions", () => {
    render(<QuestionSlide question={shortQuestion} number={2} meta={null} showAnswer dark />);

    expect(
      screen.getByText("দুটি একক ভরের বস্তুর মধ্যকার আকর্ষণ বলকে মহাকর্ষীয় ধ্রুবক বলে।"),
    ).toBeInTheDocument();
  });
});
