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

    expect(screen.getByText(/OMR উত্তরপত্র/i)).toBeInTheDocument();
    expect(screen.getByText(/MV Academy/i)).toBeInTheDocument();
    expect(screen.getByText(/সেট কোড:/i)).toBeInTheDocument();
    expect(screen.getByText(/রোল নং:/i)).toBeInTheDocument();
    // Check Bangla numerals for 1st question "০১"
    expect(screen.getByText("০১")).toBeInTheDocument();
    // Check bubbles "ক", "খ", "গ", "ঘ"
    expect(container.querySelectorAll(".in-paper-omr-container").length).toBe(1);
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

    expect(screen.getByText(/OMR ANSWER SHEET/i)).toBeInTheDocument();
    expect(screen.getByText(/Set Code:/i)).toBeInTheDocument();
    expect(screen.getByText("01")).toBeInTheDocument();
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

  it("renders scissor cut-line and correct answers in compact format", () => {
    render(
      <ChirkutAnswerSheet
        questions={sampleQuestions}
        instituteName="আইডিয়াল স্কুল"
        subjectName="সাধারণ গণিত"
        className="নবম শ্রেণি"
        setCode="ক"
        showSetCode={true}
      />
    );

    expect(screen.getByText(/কেটে আলাদা করুন — চিরকুট উত্তরমালা/i)).toBeInTheDocument();
    expect(screen.getByText(/আইডিয়াল স্কুল/i)).toBeInTheDocument();
    expect(screen.getByText(/নবম শ্রেণি/i)).toBeInTheDocument();
    // Question 1 correct answer 'a' -> Bangla 'ক'
    expect(screen.getByText("ক")).toBeInTheDocument();
    // Question 2 correct answer 'b' -> Bangla 'খ'
    expect(screen.getByText("খ")).toBeInTheDocument();
    // Short question answer
    expect(screen.getByText("πr²")).toBeInTheDocument();
  });

  it("renders English version for English papers", () => {
    render(
      <ChirkutAnswerSheet
        questions={sampleQuestions}
        isEnglishVersion={true}
        setCode="A"
      />
    );

    expect(screen.getByText(/CUT HERE — CHIRKUT ANSWER KEY/i)).toBeInTheDocument();
    expect(screen.getAllByText(/ANSWER KEY/i).length).toBeGreaterThan(0);
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });
});
