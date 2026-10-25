import { fireEvent, render, screen } from "@testing-library/react";
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
  it("shows CQ board references and respects their visibility toggle", () => {
    const question = { ...cqQuestion, board_references: [{ board: 'Dhaka', year: 2025 }] };
    const { rerender } = render(<QuestionSlide question={question} number={1} meta={null} showAnswer={false} dark={false} />);
    expect(screen.getByText("Dhaka '2025")).toBeInTheDocument();
    const badgeStyle = getComputedStyle(screen.getByText("Dhaka '2025"));
    for (const edge of ['Top', 'Right', 'Bottom', 'Left']) {
      expect(badgeStyle.getPropertyValue(`border-${edge.toLowerCase()}-width`)).toBe('2px');
    }
    rerender(<QuestionSlide question={question} number={1} meta={null} showAnswer={false} dark={false} showBoardReferences={false} />);
    expect(screen.queryByText("Dhaka '2025")).not.toBeInTheDocument();
  });
  it("reflows enlarged selected text within its original column width", () => {
    const { container } = render(<QuestionSlide question={cqQuestion} number={1} meta={null} showAnswer={false} dark={false}
      parts={{ '2:stimulus': { x: 120, y: 60, scale: 2 } }} />);
    const part = container.querySelector<HTMLElement>('[data-question-part="2:stimulus"]')!;
    expect(part.style.width).toBe('50%');
    expect(part.style.transform).toBe('translate(60px, 30px)');
    expect(part.style.overflowWrap).toBe('anywhere');
    expect(part.style.transform).not.toContain('scale');
  });
  it("keeps the header fixed when question content is repositioned", () => {
    render(<QuestionSlide question={cqQuestion} number={1} meta={null} showAnswer={false} dark={false} contentOffset={{ x: 120, y: 80 }} />);
    expect(screen.getByTestId('smartboard-fixed-header').style.transform).toBe('');
    expect(screen.getByTestId('smartboard-question-content')).toHaveStyle({ transform: 'translate(120px, 80px) scale(1)' });
  });
  it("scales CQ content without scaling its institution header", () => {
    render(<QuestionSlide question={cqQuestion} number={1} meta={{ instituteName: 'School' }} showAnswer={false} dark={false} contentScale={1.5} />);
    const content = screen.getByTestId('smartboard-question-content');
    expect(content).toHaveStyle({ transform: 'translate(0px, 0px) scale(1.5)' });
    expect(content).not.toContainElement(screen.getByText('School'));
    expect(content).toContainElement(screen.getByText(cqQuestion.creative_data.stem));
  });
  it("applies independently chosen question and stimulus colors", () => {
    const { container } = render(<QuestionSlide question={cqQuestion} number={1} meta={null} showAnswer={false} dark questionTextColor="#aabbcc" stimulusTextColor="#123456" />);
    expect(screen.getByTestId('smartboard-question-panel')).toHaveStyle({ color: '#aabbcc' });
    expect(container.querySelector('.smartboard-stimulus')).toHaveStyle({ color: '#123456' });
  });
  it("keeps stimulus and questions distinct and updates their palette with the board", () => {
    const { container, rerender } = render(<QuestionSlide question={cqQuestion} number={1} meta={null} showAnswer={false} dark={false} />);
    expect(screen.getByTestId('smartboard-question-panel')).toHaveStyle({ color: '#0f172a' });
    expect(container.querySelector('.smartboard-stimulus')).toHaveStyle({ color: '#92400e' });
    rerender(<QuestionSlide question={cqQuestion} number={1} meta={null} showAnswer={false} dark />);
    expect(screen.getByTestId('smartboard-question-panel')).toHaveStyle({ color: '#f1f5f9' });
    expect(container.querySelector('.smartboard-stimulus')).toHaveStyle({ color: '#fde047' });
  });
  it("copies a stimulus onto the board and removes only its duplicate", () => {
    render(<QuestionSlide question={cqQuestion} number={1} meta={null} showAnswer={false} dark={false} dragEnabled />);
    expect(screen.queryByRole('button', { name: 'এই অংশ কপি করুন' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(cqQuestion.creative_data.stem));
    fireEvent.click(screen.getByRole('button', { name: 'এই অংশ কপি করুন' }));
    expect(screen.getAllByText(cqQuestion.creative_data.stem)).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'কপি সরান' }));
    expect(screen.getAllByText(cqQuestion.creative_data.stem)).toHaveLength(1);
  });
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

  it("renders an embedded MCQ image without hiding it in a one-line question row", () => {
    const imageQuestion = {
      ...mcqQuestion,
      question: '<p>চিত্রটি দেখে উত্তর দাও</p><img src="https://example.com/diagram.png" alt="প্রশ্নের চিত্র" />',
    };

    render(<QuestionSlide question={imageQuestion} number={1} meta={null} showAnswer={false} dark={false} />);

    expect(screen.getByRole("img", { name: "প্রশ্নের চিত্র" })).toHaveAttribute("src", "https://example.com/diagram.png");
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
