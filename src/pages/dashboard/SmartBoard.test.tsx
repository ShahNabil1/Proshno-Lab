import { printSmartboard } from "@/lib/printSmartboard";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";
import SmartBoard from "./SmartBoard";

vi.mock("@/lib/printSmartboard", () => ({ printSmartboard: vi.fn().mockResolvedValue(undefined) }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, session: null, loading: false, signInWithGoogle: vi.fn(), signOut: vi.fn() }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
        }),
      }),
    }),
    rpc: () => Promise.resolve({ data: null }),
  },
}));

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as any).ResizeObserver = ResizeObserverStub;
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <SmartBoard />
    </MemoryRouter>,
  );

describe("SmartBoard page", () => {
  it("exports MCQ references next to its number and type, outside the question text", async () => {
    render(<MemoryRouter initialEntries={[{ pathname: "/dashboard/smartboard", state: { smartBoardImport: {
      questions: [{ id: 77, type: "mcq", question: "Sample MCQ", option_a: "A", option_b: "B", board_references: [{ board: "Dhaka", year: 2025 }] }], meta: {},
    } } }]}><SmartBoard /></MemoryRouter>);
    fireEvent.click(screen.getByText("PDF স্লাইড"));
    fireEvent.click(screen.getByText("PDF ডাউনলোড / প্রিন্ট"));
    await waitFor(() => expect(printSmartboard).toHaveBeenCalled());
    const [slides] = vi.mocked(printSmartboard).mock.calls.at(-1)!;
    const doc = new DOMParser().parseFromString(slides[0], "text/html");
    const row = doc.querySelector('[data-testid="smartboard-question-meta"]')!;
    expect(doc.querySelector('.board-pdf-slide[data-board-dark="true"] .smartboard-dark-media')).not.toBeNull();
    expect(row.textContent).toContain("বহুনির্বাচনী");
    expect(row.querySelector('[aria-label="প্রশ্নের রেফারেন্স"]')?.textContent).toContain("Dhaka");
    expect(doc.querySelector('[data-testid="smartboard-question-panel"] [aria-label="প্রশ্নের রেফারেন্স"]')).toBeNull();
  });
  it("exports separate answer slides in both and answers-only modes", async () => {
    render(<MemoryRouter initialEntries={[{ pathname: "/dashboard/smartboard", state: { smartBoardImport: {
      questions: [{ id: 88, type: "mcq", question: "Question for answer export", option_a: "Correct", option_b: "Other", correct_answer: "a", explanation: "Independent explanation" }], meta: {},
    } } }]}><SmartBoard /></MemoryRouter>);
    fireEvent.click(screen.getByText("PDF স্লাইড"));
    fireEvent.change(screen.getByLabelText("এক্সপোর্টের ধরন"), { target: { value: "both" } });
    fireEvent.click(screen.getByText("PDF ডাউনলোড / প্রিন্ট"));
    await waitFor(() => expect(screen.getByText("PDF ডাউনলোড / প্রিন্ট")).not.toBeDisabled());
    let slides = vi.mocked(printSmartboard).mock.calls.at(-1)![0];
    expect(slides).toHaveLength(2);
    expect(slides[0]).not.toContain("data-answer-slide");
    expect(slides[1]).toContain("data-answer-slide");
    expect(slides[1]).toContain("Independent explanation");
    fireEvent.change(screen.getByLabelText("এক্সপোর্টের ধরন"), { target: { value: "answers" } });
    fireEvent.click(screen.getByText("PDF ডাউনলোড / প্রিন্ট"));
    await waitFor(() => expect(screen.getByText("PDF ডাউনলোড / প্রিন্ট")).not.toBeDisabled());
    slides = vi.mocked(printSmartboard).mock.calls.at(-1)![0];
    expect(slides).toHaveLength(1);
    expect(slides[0]).toContain("data-answer-slide");
  });
  it("exports blank and duplicate pages with independent answer and drawing controls", async () => {
    renderPage();
    fireEvent.click(screen.getByTitle("সমাধানের জন্য ফাঁকা পৃষ্ঠা যোগ করুন"));
    fireEvent.click(screen.getByTitle("বর্তমান পৃষ্ঠা ডুপ্লিকেট করুন"));
    fireEvent.click(screen.getByText("PDF স্লাইড"));
    expect(screen.getByLabelText("এক্সপোর্টের ধরন")).toHaveValue("questions");
    expect(screen.getByLabelText("লেখা ও আঁকা দাগসহ")).toBeChecked();
    fireEvent.change(screen.getByLabelText("এক্সপোর্টের ধরন"), { target: { value: "both" } });
    fireEvent.click(screen.getByLabelText("লেখা ও আঁকা দাগসহ"));
    fireEvent.click(screen.getByText("PDF ডাউনলোড / প্রিন্ট"));
    await waitFor(() => expect(printSmartboard).toHaveBeenCalled());
    const [slides, width, height] = vi.mocked(printSmartboard).mock.calls.at(-1)!;
    expect([width, height]).toEqual([1920, 1080]);
    expect(slides).toHaveLength(2);
    expect(slides.every(slide => !slide.includes('<svg'))).toBe(true);
  });
  it("adds and navigates between independent blank solution pages", () => {
    renderPage();
    fireEvent.click(screen.getByTitle("সমাধানের জন্য ফাঁকা পৃষ্ঠা যোগ করুন"));
    expect(screen.queryByText("স্মার্টবোর্ড প্রস্তুত")).not.toBeInTheDocument();
    expect(screen.getByText("পৃষ্ঠা ১ / ১")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("সমাধানের জন্য ফাঁকা পৃষ্ঠা যোগ করুন"));
    expect(screen.getByText("পৃষ্ঠা ২ / ২")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("পূর্ববর্তী প্রশ্ন (Left Arrow)"));
    expect(screen.getByText("পৃষ্ঠা ১ / ২")).toBeInTheDocument();
  });
  it("mounts with the board shell and an empty whiteboard", () => {
    renderPage();

    expect(screen.getByText(/ইন্টারেক্টিভ স্মার্টবোর্ড/)).toBeInTheDocument();
    expect(screen.getByText("স্মার্টবোর্ড প্রস্তুত")).toBeInTheDocument();
    expect(screen.getByText("উত্তর দেখান")).toBeInTheDocument();
    // The question list stays hidden so the board owns the screen.
    expect(screen.queryByText("Questions (০)")).not.toBeInTheDocument();
  });

  it("reveals the question list from the header toggle", () => {
    renderPage();

    fireEvent.click(screen.getByTitle("প্রশ্ন তালিকা দেখান"));

    expect(screen.getByText("Questions (০)")).toBeInTheDocument();
    expect(screen.getByTitle("প্রশ্ন তালিকা লুকান")).toBeInTheDocument();
  });

  it("switches the active tool", () => {
    renderPage();

    const eraserButton = screen.getByTitle("ইরেজার (E)");
    fireEvent.click(eraserButton);

    expect(eraserButton.className).toContain("bg-primary");
  });

  it("toggles answer visibility", () => {
    renderPage();

    fireEvent.click(screen.getByText("উত্তর দেখান"));

    expect(screen.getByText("উত্তর লুকান")).toBeInTheDocument();
  });

  it("opens the load-paper dialog", () => {
    renderPage();

    fireEvent.click(screen.getAllByText("প্রশ্নপত্র লোড করুন")[0]);

    expect(screen.getByText("এই সেশনের প্রশ্নপত্র")).toBeInTheDocument();
  });
});
