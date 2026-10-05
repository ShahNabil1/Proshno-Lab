import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MyQuestions from "./MyQuestions";

const mock = vi.hoisted(() => ({ fail: false, eq: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "teacher-1" } }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => {
    const data: Record<string, unknown[]> = {
      classes: [{ id: 1, name: "নবম" }, { id: 2, name: "অষ্টম" }],
      subjects: [{ id: 1, class_id: 1, name: "পদার্থ" }],
      chapters: [{ id: 1, subject_id: 1, name: "গতি" }, { id: 2, subject_id: 1, name: "বল" }],
      saved_papers: [
        { id: "paper-1", class_name: "নবম", subject_name: "পদার্থ", exam_name: "বার্ষিক পরীক্ষা", institution_name: "স্কুল", chapter_names: ["গতি", "বল"], question_ids: [1, 2], created_at: "2026-09-24T00:00:00Z" },
        { id: "paper-2", class_name: "নবম", subject_name: "পদার্থ", exam_name: "মডেল টেস্ট", chapter_names: ["বল"], question_ids: [3], created_at: "2026-09-23T00:00:00Z" },
      ],
    };
    const chain = { select: () => chain, eq: (...args: unknown[]) => { mock.eq(...args); return chain; }, order: () => Promise.resolve({ data: data[table], error: mock.fail ? { message: "offline" } : null }) };
    return chain;
  } },
}));
function Location() { const location = useLocation(); return <div data-testid="location">{location.pathname}{location.search}</div>; }
const setup = () => render(<MemoryRouter initialEntries={["/dashboard/my-questions"]}><Routes><Route path="/dashboard/my-questions" element={<MyQuestions />} /><Route path="/dashboard/view-paper" element={<Location />} /></Routes></MemoryRouter>);
beforeEach(() => { mock.fail = false; mock.eq.mockClear(); sessionStorage.clear(); });
afterEach(cleanup);

describe("saved question library", () => {
  it("browses class, subject and chapter; includes multi-chapter papers without showing unrelated papers", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "নবম/দশম" }));
    fireEvent.click(screen.getByRole("button", { name: "পদার্থ" }));
    fireEvent.click(screen.getByRole("button", { name: "গতি" }));
    expect(screen.getByText("বার্ষিক পরীক্ষা")).toBeInTheDocument();
    expect(screen.queryByText("মডেল টেস্ট")).not.toBeInTheDocument();
    expect(mock.eq).toHaveBeenCalledWith("teacher_id", "teacher-1");
    fireEvent.click(screen.getByRole("button", { name: "সকল শ্রেণি" }));
    fireEvent.click(screen.getByRole("button", { name: "অষ্টম শ্রেণি" }));
    expect(screen.getByText("এখানে এখনো কোনো প্রশ্নপত্র সংরক্ষিত নেই")).toBeInTheDocument();
  });
  it("searches saved papers and opens the selected ID without stale draft data", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "নবম/দশম" }));
    fireEvent.change(screen.getByRole("textbox", { name: "প্রশ্নপত্র খুঁজুন" }), { target: { value: "মডেল" } });
    expect(screen.queryByText("বার্ষিক পরীক্ষা")).not.toBeInTheDocument();
    sessionStorage.setItem("viewPaperQuestions", "stale");
    sessionStorage.setItem("viewPaperMeta", "stale");
    sessionStorage.setItem("unrelated", "keep");
    fireEvent.click(screen.getByText("মডেল টেস্ট"));
    expect(screen.getByTestId("location")).toHaveTextContent("/dashboard/view-paper?paper_id=paper-2");
    expect(sessionStorage.getItem("viewPaperQuestions")).toBeNull();
    expect(sessionStorage.getItem("viewPaperMeta")).toBeNull();
    expect(sessionStorage.getItem("unrelated")).toBe("keep");
  });
  it("distinguishes a failed request from an empty library and supports retry", async () => {
    mock.fail = true;
    setup();
    expect(await screen.findByRole("alert")).toHaveTextContent("প্রশ্নপত্র লোড করা যায়নি");
    mock.fail = false;
    fireEvent.click(screen.getByRole("button", { name: "আবার চেষ্টা করুন" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "নবম/দশম" })).toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
