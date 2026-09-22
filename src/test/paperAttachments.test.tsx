import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import InPaperOmrBox from "@/components/paper/InPaperOmrBox";
import ChirkutAnswerSheet from "@/components/paper/ChirkutAnswerSheet";

describe("InPaperOmrBox component", () => {
  it("renders nothing if totalQuestions is 0", () => {
    const { container } = render(<InPaperOmrBox totalQuestions={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders OMR header and bubbles for 10 questions in Bangla", () => {
    const { container } = render(
      <InPaperOmrBox
        totalQuestions={10}
        columns={2}
        instituteName="MV Academy"
        subjectName="গণিত"
        setCode="ক"
        showSetCode={true}
        showStudentInfo={true}
      />
    );

    expect(screen.getByText("OMR Area")).toBeInTheDocument();
    expect(screen.getByText(/নাম:/i)).toBeInTheDocument();
    expect(screen.getByText(/রোল :/i)).toBeInTheDocument();
    // Check Bangla numerals for 1st question "১"
    expect(screen.getByText("১")).toBeInTheDocument();
    // Check bubbles "ক", "খ", "গ", "ঘ"
    expect(screen.getAllByText("ক").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".in-paper-omr-container").length).toBe(1);
    expect(screen.getByText(/This OMR is scanable/i)).toBeInTheDocument();
  });

  it("renders OMR in English when isEnglishVersion is true", () => {
    render(
      <InPaperOmrBox
        totalQuestions={5}
        isEnglishVersion={true}
        setCode="A"
        showSetCode={true}
      />
    );

    expect(screen.getByText("OMR Area")).toBeInTheDocument();
    expect(screen.getByText(/Name:/i)).toBeInTheDocument();
    expect(screen.getByText(/Roll:/i)).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getAllByText("A").length).toBeGreaterThan(0);
  });
});

describe("ChirkutAnswerSheet component", () => {
  const sampleQuestions = [
    {
      id: 1,
      type: "mcq",
      question: "বাংলাদেশের রাজধানী কী?",
      option_a: "ঢাকা",
      option_b: "খুলনা",
      option_c: "সিলেট",
      option_d: "বরিশাল",
      correct_answer: "a",
    },
    {
      id: 2,
      type: "mcq",
      question: "২ + ২ = কত?",
      option_a: "৩",
      option_b: "৪",
      option_c: "৫",
      option_d: "৬",
      correct_answer: "b",
    },
    {
      id: 3,
      type: "short",
      question: "বৃত্তের ক্ষেত্রফলের সূত্র কী?",
      correct_answer: "πr²",
    },
  ];

  it("renders answers in compact format", () => {
    const { container } = render(
      <ChirkutAnswerSheet
        questions={sampleQuestions}
        instituteName="আইডিয়াল স্কুল"
        subjectName="সাধারণ গণিত"
        className="নবম শ্রেণি"
        setCode="ক"
        showSetCode={true}
      />
    );

    expect(screen.getByText("উত্তর")).toBeInTheDocument();
    expect(screen.getByText("১")).toBeInTheDocument();
    expect(screen.getByText("ক")).toBeInTheDocument();
    expect(screen.getByText("২")).toBeInTheDocument();
    expect(screen.getByText("খ")).toBeInTheDocument();
    expect(container.querySelector(".chirkut-answer-table")).toBeInTheDocument();
  });

  it("renders English version for English papers", () => {
    const { container } = render(
      <ChirkutAnswerSheet
        questions={sampleQuestions}
        isEnglishVersion={true}
        setCode="A"
      />
    );

    expect(screen.getByText("ANSWER")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(container.querySelector(".chirkut-answer-table")).toBeInTheDocument();
  });
});
