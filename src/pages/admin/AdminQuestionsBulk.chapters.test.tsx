import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import * as XLSX from "xlsx";

const state = vi.hoisted(() => ({ inserted: [] as any[], topicInserts: [] as any[], dbDuplicates: false, className: "নবম শ্রেণি", subjectName: "জীববিজ্ঞান" }));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock("@/components/LatexRenderer", () => ({ default: ({ text }: any) => <span>{text}</span> }));
vi.mock("@/components/admin/bulk/AIExtract", () => ({ default: () => null }));
vi.mock("@/components/admin/bulk/EnglishFirstUpload", () => ({ default: ({ classId, subjectId }: any) => <div data-testid="english-upload">{classId}:{subjectId}</div> }));
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, disabled, children }: any) => <select value={value} disabled={disabled} onChange={e => onValueChange(e.target.value)}>{children}</select>,
  SelectTrigger: () => null, SelectValue: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: "test-admin" } } }) },
  from: (table: string) => {
    const filters: Record<string, any> = {};
    let payload: any;
    const query: any = {
      select: () => query, eq: (key: string, value: any) => { filters[key] = value; return query; },
      in: () => query, order: () => query, range: () => query,
      insert: (data: any[]) => { payload = data; return query; },
      then: (resolve: any, reject: any) => {
        let data: any[] = [];
        if (table === "classes") data = [{ id: 1, name: state.className }];
        if (table === "subjects") data = [{ id: 2, name: state.subjectName }];
        if (table === "chapters") data = [{ id: 10, name: "অধ্যায় ১ - কোষ" }, { id: 20, name: "অধ্যায় ২ - টিস্যু" }];
        if (table === "topics") {
          data = payload ? payload.map((row: any, i: number) => ({ ...row, id: 200 + i })) : [{ id: 99, name: "ডিফল্ট টপিক", chapter_id: 10 }];
          if (payload) state.topicInserts.push(...data);
        }
        if (table === "questions") {
          if (payload) state.inserted.push(...payload);
          else if (state.dbDuplicates && filters.chapter_id === 10) data = [{ id: 1, type: "short", question: "একই প্রশ্ন?" }];
        }
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    }; return query;
  },
} }));
import AdminQuestionsBulk from "./AdminQuestionsBulk";

beforeEach(() => { localStorage.clear(); state.inserted = []; state.topicInserts = []; state.dbDuplicates = false; state.className = "নবম শ্রেণি"; state.subjectName = "জীববিজ্ঞান"; });
afterEach(cleanup);
async function openPage(chapterId = "", topicId = "") {
  localStorage.setItem("adminBulkContext.v1", JSON.stringify({ classId: "1", subjectId: "2", chapterId, topicId, type: "short" }));
  render(<AdminQuestionsBulk />);
  await screen.findByRole("option", { name: "অধ্যায় ২ - টিস্যু" });
}
async function paste(text: string) {
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Paste" }), { button: 0, ctrlKey: false });
  fireEvent.change(await screen.findByRole("textbox"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Parse করুন" }));
  await screen.findByText("Preview ও যাচাই");
}
async function save(count: number) {
  fireEvent.click(screen.getByRole("button", { name: `${count} টি প্রশ্ন সেভ করুন` }));
  fireEvent.click(await screen.findByRole("button", { name: "হ্যাঁ, সেভ করুন" }));
  await waitFor(() => expect(state.inserted).toHaveLength(count));
}
describe("chapter destinations in bulk upload", () => {
  it("offers a chapter template using the subject's actual chapter names", async () => {
    await openPage();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Paste" }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole("button", { name: "পেস্ট করার নিয়ম" }));
    fireEvent.click(await screen.findByRole("button", { name: "অধ্যায়সহ টেমপ্লেট" }));
    expect(screen.getByText(/অধ্যায়: অধ্যায় ১ - কোষ/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "নমুনা ডাউনলোড (.txt)" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "বক্সে নমুনা বসান" }));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toContain("অধ্যায়: অধ্যায় ২ - টিস্যু");
  });
  it("saves multiple pasted chapters and keeps the dashboard topic inside its own chapter", async () => {
    await openPage("10", "99");
    await paste("অধ্যায়: কোষ\n১. কোষ কী?\nউত্তর: একক।\n\nঅধ্যায়: টিস্যু\n১. টিস্যু কী?\nউত্তর: সমষ্টি।");
    await save(2);
    expect(state.inserted.map(q => [q.chapter_id, q.topic_id])).toEqual([[10, 99], [20, null]]);
  });
  it("keeps the old dashboard chapter workflow for unlabelled questions", async () => {
    await openPage("10"); await paste("১. কোষ কী?\nউত্তর: একক।"); await save(1);
    expect(state.inserted[0].chapter_id).toBe(10);
  });
  it("checks database duplicates per destination chapter even without a default", async () => {
    state.dbDuplicates = true; await openPage();
    await paste("Chapter: কোষ\n১. একই প্রশ্ন?\nউত্তর: এক।\n\nChapter: টিস্যু\n১. একই প্রশ্ন?\nউত্তর: এক।");
    await save(1); expect(state.inserted[0].chapter_id).toBe(20);
  });
  it("blocks a misspelled explicit chapter instead of silently using the dashboard chapter", async () => {
    await openPage("10"); await paste("Chapter: ভুল\n১. কোষ কী?\nউত্তর: একক।");
    expect(screen.getByRole("button", { name: "0 টি প্রশ্ন সেভ করুন" })).toBeDisabled();
    expect(state.inserted).toEqual([]);
  });
  it("creates same-named Excel topics separately in each destination chapter", async () => {
    await openPage();
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Chapter", "Topic", "উদ্দীপক", "প্রশ্ন*", "উত্তর", "ছবি URL", "ব্যাখ্যা"],
      ["কোষ", "গঠন", "", "কোষের গঠন?", "এক", "", ""],
      ["টিস্যু", "গঠন", "", "টিস্যুর গঠন?", "দুই", "", ""],
    ]), "Questions");
    const file = new File([], "chapters.xlsx");
    Object.defineProperty(file, "arrayBuffer", { value: async () => XLSX.write(wb, { type: "array", bookType: "xlsx" }) });
    fireEvent.change(screen.getByLabelText("প্রশ্নের Excel বা CSV ফাইল বাছাই করুন", { selector: "input" }), { target: { files: [file] } });
    await screen.findByText("Preview ও যাচাই"); await save(2);
    expect(state.topicInserts.map(t => [t.chapter_id, t.name])).toEqual([[10, "গঠন"], [20, "গঠন"]]);
    expect(state.inserted.map(q => [q.chapter_id, q.topic_id])).toEqual([[10, 200], [20, 201]]);
  });
});


describe("full English 1st Paper upload", () => {
  it.each(["ষষ্ঠ শ্রেণি", "সপ্তম শ্রেণি", "অষ্টম শ্রেণি", "Class 6 (English Version)", "Class 7 (English Version)", "নবম-দশম শ্রেণি", "SSC (Eglish Version)"])("opens the complete upload workflow for %s", async (className) => {
    state.className = className;
    state.subjectName = "English 1st Paper";
    localStorage.setItem("adminBulkContext.v1", JSON.stringify({classId:"1",subjectId:"2",chapterId:"",type:"mcq"}));
    render(<AdminQuestionsBulk />);
    expect(await screen.findByRole("heading", {name: className + " · English 1st Paper আপলোড"})).toBeTruthy();
    expect(screen.getByTestId("english-upload").textContent).toBe("1:2");
  });
});
