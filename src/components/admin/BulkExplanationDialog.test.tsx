import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BulkExplanationDialog from "./BulkExplanationDialog";

const mock = vi.hoisted(() => ({ update: vi.fn(), eq: vi.fn(), is: vi.fn(), select: vi.fn() }));
vi.mock("@/components/LatexRenderer", () => ({ default: ({ text }: { text: string }) => <p>{text}</p> }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({
  select: () => ({ in: async () => ({ data: [
    { id: 1, type: "mcq", question: "First", explanation: null, class_id: 1, subject_id: 1 },
    { id: 2, type: "mcq", question: "Second", explanation: "Existing", class_id: 1, subject_id: 1 },
    { id: 3, type: "descriptive", question: "Third", explanation: null, class_id: 1, subject_id: 1 },
    { id: 5, type: "cq", question: "Creative", explanation: null, creative_data: { stem: "Keep stimulus", q_ka: "Keep question", ans_ka: "Old answer" }, class_id: 1, subject_id: 1 },
    { id: 6, type: "short", question: "Short", explanation: null, class_id: 1, subject_id: 1 },
  ], error: null }) }),
  update: mock.update,
}) } }));
afterEach(cleanup);
describe("bulk explanation saving", () => {
  it("saves four CQ answers while preserving stimulus and questions", async () => {
    mock.update.mockClear(); mock.eq.mockClear();
    const query = { eq: mock.eq, is: mock.is, select: mock.select };
    mock.update.mockReturnValue(query); mock.eq.mockReturnValue(query); mock.is.mockReturnValue(query);
    mock.select.mockResolvedValue({ data: [{ id: 5 }], error: null });
    render(<BulkExplanationDialog answerMode isSubjectAllowed={() => true} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "বাল্ক MCQ / SQ / CQ উত্তর" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "5 - উত্তর:\n[ক] One\n[খ] Two\n[গ] Three\n[ঘ] Four" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "যাচাই ও প্রিভিউ" }));
    fireEvent.click(await screen.findByRole("button", { name: "1টি উত্তর সেভ করুন" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mock.update).toHaveBeenCalledExactlyOnceWith({ creative_data: { stem: "Keep stimulus", q_ka: "Keep question", ans_ka: "One", ans_kha: "Two", ans_ga: "Three", ans_gha: "Four" } });
    expect(mock.eq).toHaveBeenCalledWith("creative_data", JSON.stringify({ stem: "Keep stimulus", q_ka: "Keep question", ans_ka: "Old answer" }));
    mock.update.mockClear(); mock.eq.mockClear(); mock.is.mockClear();
  });
  it("saves MCQ keys and SQ answers to correct_answer and rejects invalid MCQ text", async () => {
    mock.update.mockClear(); mock.eq.mockClear(); mock.is.mockClear();
    const query = { eq: mock.eq, is: mock.is, select: mock.select };
    mock.update.mockReturnValue(query); mock.eq.mockReturnValue(query); mock.is.mockReturnValue(query);
    mock.select.mockResolvedValue({ data: [{ id: 1 }], error: null });
    render(<BulkExplanationDialog answerMode isSubjectAllowed={() => true} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "বাল্ক MCQ / SQ / CQ উত্তর" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "1 - উত্তর: invalid\n6 - উত্তর: <p>Full SQ answer</p>" } });
    fireEvent.click(screen.getByRole("button", { name: "যাচাই ও প্রিভিউ" }));
    await screen.findByRole("button", { name: "1টি উত্তর সেভ করুন" });
    expect(screen.getByText(/MCQ উত্তর শুধু/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "উত্তর সম্পাদনা #1" }));
    fireEvent.change(screen.getByRole("textbox", { name: "উত্তর #1" }), { target: { value: "খ" } });
    fireEvent.click(screen.getByRole("button", { name: "2টি উত্তর সেভ করুন" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mock.update).toHaveBeenCalledWith({ correct_answer: "b" });
    expect(mock.update).toHaveBeenCalledWith({ correct_answer: "<p>Full SQ answer</p>" });
    expect(mock.is).toHaveBeenCalledWith("correct_answer", null);
    mock.update.mockClear(); mock.eq.mockClear(); mock.is.mockClear();
  });
  it("saves edited explanations and excludes removed entries", async () => {
    mock.update.mockClear();
    const query = { eq: mock.eq, is: mock.is, select: mock.select };
    mock.update.mockReturnValue(query); mock.eq.mockReturnValue(query); mock.is.mockReturnValue(query);
    mock.select.mockResolvedValue({ data: [{ id: 1 }], error: null });
    render(<BulkExplanationDialog isSubjectAllowed={() => true} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "বাল্ক MCQ ব্যাখ্যা" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "1 - New\n2 - Replacement" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "যাচাই ও প্রিভিউ" }));
    fireEvent.click(await screen.findByRole("button", { name: "ব্যাখ্যা সম্পাদনা #1" }));
    fireEvent.change(screen.getByRole("textbox", { name: "ব্যাখ্যা #1" }), { target: { value: "" } });
    expect(screen.getByRole("button", { name: "1টি ব্যাখ্যা সেভ করুন" })).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "ব্যাখ্যা #1" }), { target: { value: "Edited explanation" } });
    fireEvent.click(screen.getByRole("button", { name: "তালিকা থেকে বাদ দিন #2" }));
    expect(screen.queryByText("Second")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "1টি ব্যাখ্যা সেভ করুন" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mock.update).toHaveBeenCalledExactlyOnceWith({ explanation: "Edited explanation" });
    mock.update.mockClear(); mock.eq.mockClear(); mock.is.mockClear();
  });
  it("closes after a successful save and opens with an empty paste box", async () => {
    const query = { eq: mock.eq, is: mock.is, select: mock.select };
    mock.update.mockReturnValue(query); mock.eq.mockReturnValue(query); mock.is.mockReturnValue(query);
    mock.select.mockResolvedValue({ data: [{ id: 1 }], error: null });
    render(<BulkExplanationDialog isSubjectAllowed={() => true} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "বাল্ক MCQ ব্যাখ্যা" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "1 - New" } });
    fireEvent.click(screen.getByRole("button", { name: "যাচাই ও প্রিভিউ" }));
    fireEvent.click(await screen.findByRole("button", { name: "1টি ব্যাখ্যা সেভ করুন" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "বাল্ক MCQ ব্যাখ্যা" }));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
    mock.update.mockClear(); mock.eq.mockClear(); mock.is.mockClear();
  });
  it("saves only matched MCQs without existing explanations and reports zero-row conflicts", async () => {
    const query = { eq: mock.eq, is: mock.is, select: mock.select };
    mock.update.mockReturnValue(query); mock.eq.mockReturnValue(query); mock.is.mockReturnValue(query);
    mock.select.mockResolvedValue({ data: [], error: null });
    const onSaved = vi.fn();
    render(<BulkExplanationDialog isSubjectAllowed={() => true} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole("button", { name: "বাল্ক MCQ ব্যাখ্যা" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "1 - New\n2 - Replacement\n3 - Wrong type\n4 - Missing" } });
    fireEvent.click(screen.getByRole("button", { name: "যাচাই ও প্রিভিউ" }));
    fireEvent.click(await screen.findByRole("button", { name: "1টি ব্যাখ্যা সেভ করুন" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mock.update).toHaveBeenCalledExactlyOnceWith({ explanation: "New" });
    expect(mock.eq).toHaveBeenCalledWith("id", 1);
    expect(mock.eq).toHaveBeenCalledWith("type", "mcq");
    expect(mock.is).toHaveBeenCalledWith("explanation", null);
    expect(screen.getByText(/#1 · সেভ হয়নি/)).toBeTruthy();
    expect(screen.getByText(/#2 · আগের ব্যাখ্যা আছে/)).toBeTruthy();
    expect(screen.getByText(/#3 · শুধু MCQ-এর ব্যাখ্যা দেওয়া যাবে/)).toBeTruthy();
    expect(screen.getByText(/#4 · প্রশ্ন পাওয়া যায়নি/)).toBeTruthy();
  });
});
