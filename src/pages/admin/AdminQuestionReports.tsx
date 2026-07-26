import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Search, Pencil, Eye, X, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import LatexRenderer from "@/components/LatexRenderer";
import RichTextEditor from "@/components/RichTextEditor";
import ReferenceInput from "@/components/ReferenceInput";

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: "অপেক্ষমান", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  resolved: { label: "সমাধান হয়েছে", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
};

const typeLabels: Record<string, string> = { mcq: "MCQ", short: "সংক্ষিপ্ত", cq: "সৃজনশীল", descriptive: "বর্ণনামূলক" };
const typeOptions = ["mcq", "short", "cq", "descriptive"];

export default function AdminQuestionReports() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [replyDialog, setReplyDialog] = useState<any>(null);
  const [replyText, setReplyText] = useState("");
  const [previewDialog, setPreviewDialog] = useState<any>(null);
  const [fullQuestion, setFullQuestion] = useState<any>(null);

  // Edit modal state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [allClasses, setAllClasses] = useState<any[]>([]);
  const [allSubjects, setAllSubjects] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [isGroupedMcq, setIsGroupedMcq] = useState(false);
  const [groupedQuestions, setGroupedQuestions] = useState<Array<{
    question: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_answer: string;
  }>>([{ question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "" }]);
  const [stimulusText, setStimulusText] = useState("");
  const [form, setForm] = useState({
    class_id: "", subject_id: "", chapter_id: "", topic_id: "", category_id: "", type: "mcq",
    question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "", explanation: "",
    cq_stem: "", cq_q_ka: "", cq_q_kha: "", cq_q_ga: "", cq_q_gha: "",
    cq_ans_ka: "", cq_ans_kha: "", cq_ans_ga: "", cq_ans_gha: "",
    desc_q_ka: "", desc_q_kha: "", desc_ans_ka: "", desc_ans_kha: "",
    board_references: [] as Array<{ board: string; year: string }>,
    university_references: [] as Array<{ name: string; year: string }>,
  });

  const selectedSubjectName = subjects.find(s => String(s.id) === form.subject_id)?.name || allSubjects.find(s => String(s.id) === form.subject_id)?.name || "";
  const isMathSubject = /^(গণিত|উচ্চতর গণিত|math|higher math)/i.test(selectedSubjectName.trim());

  // Load classes/subjects on mount
  useEffect(() => {
    supabase.from("classes").select("id, name").order("name").then(({ data }) => setAllClasses(data || []));
    supabase.from("subjects").select("id, name, class_id").order("name").then(({ data }) => setAllSubjects(data || []));
  }, []);

  useEffect(() => {
    if (!form.class_id) return;
    setSubjects(allSubjects.filter(s => String(s.class_id) === form.class_id));
  }, [form.class_id, allSubjects]);

  useEffect(() => {
    if (!form.subject_id) return;
    supabase.from("chapters").select("id, name").eq("subject_id", Number(form.subject_id)).order("name")
      .then(({ data }) => setChapters(data || []));
  }, [form.subject_id]);

  useEffect(() => {
    if (!form.chapter_id) { setTopics([]); return; }
    setLoadingTopics(true);
    supabase.from("topics").select("id, name").eq("chapter_id", Number(form.chapter_id)).order("name")
      .then(({ data }) => { setTopics(data || []); setLoadingTopics(false); });
  }, [form.chapter_id]);

  const fetchReports = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("question_reports" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (!data) { setReports([]); setLoading(false); return; }

    const questionIds = [...new Set((data as any[]).map((r: any) => r.question_id))];
    const teacherIds = [...new Set((data as any[]).map((r: any) => r.teacher_id))];

    const [questionsRes, teachersRes] = await Promise.all([
      supabase.from("questions").select("id, question, type, class_id, subject_id, chapter_id, topic_id, option_a, option_b, option_c, option_d, correct_answer, explanation, creative_data, stimulus_text, stimulus_group_id, board_references, university_references, classes(name), subjects(name), chapters(name), topics(name)").in("id", questionIds),
      supabase.from("teachers").select("id, full_name, email").in("id", teacherIds),
    ]);

    const qMap = new Map((questionsRes.data || []).map((q: any) => [q.id, q]));
    const tMap = new Map((teachersRes.data || []).map((t: any) => [t.id, t]));

    const enriched = (data as any[]).map((r: any) => ({
      ...r,
      questionData: qMap.get(r.question_id),
      teacherData: tMap.get(r.teacher_id),
    }));

    setReports(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchReports(); }, []);

  const handleResolve = async (report: any) => {
    const { error } = await supabase
      .from("question_reports" as any)
      .update({ status: "resolved", resolved_at: new Date().toISOString(), admin_reply: replyText || null } as any)
      .eq("id", report.id);
    if (error) { toast.error("আপডেট ব্যর্থ"); return; }
    toast.success("রিপোর্ট সমাধান হয়েছে");
    setReplyDialog(null);
    setReplyText("");
    fetchReports();
  };

  const openPreview = (r: any) => {
    setPreviewDialog(r);
    setFullQuestion(r.questionData);
  };

  const openEdit = (questionData: any) => {
    if (!questionData) return;
    setEditItem(questionData);
    const cd = questionData.creative_data || {};

    if (questionData.type === "mcq" && questionData.stimulus_group_id) {
      setIsGroupedMcq(true);
      setStimulusText(questionData.stimulus_text || "");
      supabase.from("questions").select("*").eq("stimulus_group_id", questionData.stimulus_group_id).order("id")
        .then(({ data }) => {
          if (data && data.length > 0) {
            setGroupedQuestions(data.map((q: any) => ({
              question: q.question || "", option_a: q.option_a || "", option_b: q.option_b || "",
              option_c: q.option_c || "", option_d: q.option_d || "", correct_answer: q.correct_answer || "",
            })));
          }
        });
    } else {
      setIsGroupedMcq(false);
      setStimulusText(questionData.stimulus_text || "");
      setGroupedQuestions([{ question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "" }]);
    }

    setForm({
      class_id: String(questionData.class_id), subject_id: String(questionData.subject_id),
      chapter_id: String(questionData.chapter_id), topic_id: questionData.topic_id ? String(questionData.topic_id) : "",
      category_id: questionData.category_id ? String(questionData.category_id) : "",
      type: questionData.type, question: questionData.question, option_a: questionData.option_a || "",
      option_b: questionData.option_b || "", option_c: questionData.option_c || "", option_d: questionData.option_d || "",
      correct_answer: questionData.correct_answer || "", explanation: questionData.explanation || "",
      cq_stem: cd.stem || "", cq_q_ka: cd.q_ka || "", cq_q_kha: cd.q_kha || "", cq_q_ga: cd.q_ga || "", cq_q_gha: cd.q_gha || "",
      cq_ans_ka: cd.ans_ka || "", cq_ans_kha: cd.ans_kha || "", cq_ans_ga: cd.ans_ga || "", cq_ans_gha: cd.ans_gha || "",
      desc_q_ka: cd.desc_q_ka || "", desc_q_kha: cd.desc_q_kha || "",
      desc_ans_ka: cd.desc_ans_ka || "", desc_ans_kha: cd.desc_ans_kha || "",
      board_references: Array.isArray(questionData.board_references) ? questionData.board_references : [],
      university_references: Array.isArray(questionData.university_references) ? questionData.university_references : [],
    });
    setPreviewDialog(null);
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (form.type === "mcq" && isGroupedMcq) {
      if (!stimulusText || !form.class_id || !form.subject_id || !form.chapter_id) {
        toast.error("উদ্দীপক, শ্রেণী, বিষয় ও অধ্যায় আবশ্যক"); return;
      }
      const validQs = groupedQuestions.filter(gq => gq.question.trim());
      if (validQs.length === 0) { toast.error("অন্তত একটি প্রশ্ন প্রয়োজন"); return; }

      const { data: { user } } = await supabase.auth.getUser();
      const groupId = editItem?.stimulus_group_id || crypto.randomUUID();

      if (editItem?.stimulus_group_id) {
        await supabase.from("questions").delete().eq("stimulus_group_id", editItem.stimulus_group_id);
      }

      const payloads = validQs.map((gq) => ({
        class_id: Number(form.class_id), subject_id: Number(form.subject_id), chapter_id: Number(form.chapter_id),
        topic_id: form.topic_id ? Number(form.topic_id) : null, category_id: form.category_id ? Number(form.category_id) : null,
        type: "mcq", question: gq.question, option_a: gq.option_a || null, option_b: gq.option_b || null,
        option_c: gq.option_c || null, option_d: gq.option_d || null, correct_answer: gq.correct_answer || null,
        explanation: form.explanation || null, stimulus_group_id: groupId, stimulus_text: stimulusText,
        board_references: form.board_references.length > 0 ? form.board_references : [],
        university_references: form.university_references.length > 0 ? form.university_references : [],
        teacher_id: user?.id,
      }));

      const { error } = await supabase.from("questions").insert(payloads as any);
      if (error) { toast.error("আপডেট ব্যর্থ: " + error.message); return; }
      toast.success("গ্রুপ আপডেট হয়েছে");
      setEditDialogOpen(false);
      fetchReports();
      return;
    }

    if (form.type === "cq") {
      if (!form.cq_stem || !form.class_id || !form.subject_id || !form.chapter_id) {
        toast.error("উদ্দীপক, শ্রেণী, বিষয় ও অধ্যায় আবশ্যক"); return;
      }
    } else if (form.type === "descriptive") {
      if ((!form.desc_q_ka && !form.desc_q_kha) || !form.class_id || !form.subject_id || !form.chapter_id) {
        toast.error("অন্তত একটি প্রশ্ন, শ্রেণী, বিষয় ও অধ্যায় আবশ্যক"); return;
      }
    } else {
      if (!form.question || !form.class_id || !form.subject_id || !form.chapter_id) {
        toast.error("প্রশ্ন, শ্রেণী, বিষয় ও অধ্যায় আবশ্যক"); return;
      }
    }

    const questionText = form.type === "cq"
      ? (form.cq_stem.substring(0, 100) + (form.cq_stem.length > 100 ? "..." : ""))
      : form.type === "descriptive"
      ? (form.desc_q_ka.substring(0, 100) + (form.desc_q_ka.length > 100 ? "..." : ""))
      : form.question;

    const payload: any = {
      class_id: Number(form.class_id), subject_id: Number(form.subject_id), chapter_id: Number(form.chapter_id),
      topic_id: form.topic_id ? Number(form.topic_id) : null, type: form.type, question: questionText,
      option_a: form.option_a || null, option_b: form.option_b || null,
      option_c: form.option_c || null, option_d: form.option_d || null, correct_answer: form.correct_answer || null,
      explanation: form.explanation || null,
      board_references: form.board_references.length > 0 ? form.board_references : [],
      university_references: form.university_references.length > 0 ? form.university_references : [],
      stimulus_text: form.type === "mcq" && stimulusText ? stimulusText : null,
      stimulus_group_id: null,
    };

    if (form.type === "cq") {
      const saveSub = subjects.find(s => String(s.id) === form.subject_id) || allSubjects.find(s => String(s.id) === form.subject_id);
      const saveMath = /^(গণিত|উচ্চতর গণিত|math|higher math)/i.test((saveSub?.name || "").trim());
      if (saveMath) {
        payload.creative_data = { is_math: true, stem: form.cq_stem, q_ka: form.cq_q_ka, q_kha: form.cq_q_kha, q_ga: form.cq_q_ga, ans_ka: form.cq_ans_ka, ans_kha: form.cq_ans_kha, ans_ga: form.cq_ans_ga };
      } else {
        payload.creative_data = { is_math: false, stem: form.cq_stem, q_ka: form.cq_q_ka, q_kha: form.cq_q_kha, q_ga: form.cq_q_ga, q_gha: form.cq_q_gha, ans_ka: form.cq_ans_ka, ans_kha: form.cq_ans_kha, ans_ga: form.cq_ans_ga, ans_gha: form.cq_ans_gha };
      }
    }

    if (form.type === "descriptive") {
      payload.creative_data = { desc_q_ka: form.desc_q_ka, desc_q_kha: form.desc_q_kha, desc_ans_ka: form.desc_ans_ka, desc_ans_kha: form.desc_ans_kha };
    }

    if (form.category_id) payload.category_id = Number(form.category_id);

    const { error } = await supabase.from("questions").update(payload).eq("id", editItem.id);
    if (error) { toast.error("আপডেট ব্যর্থ: " + error.message); return; }
    toast.success("প্রশ্ন আপডেট হয়েছে");
    setEditDialogOpen(false);
    fetchReports();
  };

  const filtered = reports.filter(r => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return r.questionData?.question?.toLowerCase().includes(q) ||
      r.teacherData?.full_name?.toLowerCase().includes(q) ||
      r.error_type?.toLowerCase().includes(q);
  });

  // Render full question preview content
  const renderFullQuestion = (q: any) => {
    if (!q) return null;
    const cd = q.creative_data || {};

    return (
      <div className="space-y-4">
        {/* MCQ */}
        {q.type === "mcq" && (
          <>
            {q.stimulus_text && (
              <div>
                <Label className="text-xs text-muted-foreground">উদ্দীপক</Label>
                <div className="bg-muted/50 rounded-lg p-3 mt-1"><LatexRenderer text={q.stimulus_text} /></div>
              </div>
            )}
            <div>
              <Label className="text-xs text-muted-foreground">প্রশ্ন</Label>
              <div className="bg-muted/50 rounded-lg p-3 mt-1">
                <LatexRenderer text={q.question} />
              </div>
            </div>
            {(q.option_a || q.option_b || q.option_c || q.option_d) && (
              <div className="grid grid-cols-2 gap-2">
                {["option_a", "option_b", "option_c", "option_d"].map((key, i) => q[key] && (
                  <div key={key} className={`p-2 rounded border text-sm ${q.correct_answer === ["ক", "খ", "গ", "ঘ"][i] ? "border-emerald-500 bg-emerald-50" : "border-border"}`}>
                    <span className="font-semibold">{["ক", "খ", "গ", "ঘ"][i]}) </span>
                    <LatexRenderer text={q[key]} />
                  </div>
                ))}
              </div>
            )}
            {q.correct_answer && (
              <p className="text-sm"><strong>সঠিক উত্তর:</strong> {q.correct_answer}</p>
            )}
          </>
        )}

        {/* Short */}
        {q.type === "short" && (
          <>
            <div>
              <Label className="text-xs text-muted-foreground">প্রশ্ন</Label>
              <div className="bg-muted/50 rounded-lg p-3 mt-1">
                <LatexRenderer text={q.question} />
              </div>
            </div>
            {q.correct_answer && (
              <div>
                <Label className="text-xs text-muted-foreground">উত্তর</Label>
                <div className="bg-muted/50 rounded-lg p-3 mt-1">
                  <LatexRenderer text={q.correct_answer} />
                </div>
              </div>
            )}
          </>
        )}

        {/* CQ */}
        {q.type === "cq" && (
          <>
            {cd.stem && (
              <div>
                <Label className="text-xs text-muted-foreground">উদ্দীপক</Label>
                <div className="bg-muted/50 rounded-lg p-3 mt-1"><LatexRenderer text={cd.stem} /></div>
              </div>
            )}
            {["q_ka", "q_kha", "q_ga", "q_gha"].map((key, i) => cd[key] && (
              <div key={key}>
                <Label className="text-xs text-muted-foreground">{["ক", "খ", "গ", "ঘ"][i]})</Label>
                <div className="bg-muted/50 rounded-lg p-3 mt-1"><LatexRenderer text={cd[key]} /></div>
              </div>
            ))}
          </>
        )}

        {/* Descriptive */}
        {q.type === "descriptive" && (
          <>
            {cd.desc_q_ka && (
              <div>
                <Label className="text-xs text-muted-foreground">ক) প্রশ্ন</Label>
                <div className="bg-muted/50 rounded-lg p-3 mt-1"><LatexRenderer text={cd.desc_q_ka} /></div>
              </div>
            )}
            {cd.desc_q_kha && (
              <div>
                <Label className="text-xs text-muted-foreground">খ) প্রশ্ন</Label>
                <div className="bg-muted/50 rounded-lg p-3 mt-1"><LatexRenderer text={cd.desc_q_kha} /></div>
              </div>
            )}
          </>
        )}

        {/* Explanation */}
        {q.explanation && (
          <div>
            <Label className="text-xs text-muted-foreground">ব্যাখ্যা</Label>
            <div className="bg-muted/50 rounded-lg p-3 mt-1">
              <LatexRenderer text={q.explanation} />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-bold">প্রশ্নের রিপোর্ট</h1>
        <Badge variant="outline" className="text-sm">{filtered.length}টি রিপোর্ট</Badge>
      </div>

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="অনুসন্ধান করুন..." className="pl-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>শিক্ষক</TableHead>
                <TableHead>প্রশ্ন</TableHead>
                <TableHead>ভুলের ধরন</TableHead>
                <TableHead>মেটাডেটা</TableHead>
                <TableHead>স্ট্যাটাস</TableHead>
                <TableHead>তারিখ</TableHead>
                <TableHead className="text-right">অ্যাকশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">লোড হচ্ছে...</TableCell></TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">কোনো রিপোর্ট নেই</TableCell></TableRow>
              )}
              {filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="text-sm font-medium">{r.teacherData?.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.teacherData?.email || ""}</div>
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    {r.questionData?.question
                      ? <LatexRenderer text={r.questionData.question} className="text-sm truncate" />
                      : <p className="text-sm truncate">—</p>}
                  </TableCell>

                  <TableCell>
                    <Badge variant="secondary" className="text-xs">{r.error_type}</Badge>
                    {r.comment && <p className="text-xs text-muted-foreground mt-1 truncate max-w-[150px]">{r.comment}</p>}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs space-y-0.5">
                      <div>{r.questionData?.classes?.name || ""}</div>
                      <div>{r.questionData?.subjects?.name || ""}</div>
                      <div>{typeLabels[r.questionData?.type] || r.questionData?.type || ""}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusMap[r.status]?.color || statusMap.pending.color}`}>
                      {statusMap[r.status]?.label || r.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(r.created_at).toLocaleDateString("bn-BD")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => openPreview(r)} title="প্রশ্ন দেখুন">
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      {r.status !== "resolved" && (
                        <Button size="sm" variant="outline" className="text-emerald-600 hover:text-emerald-700" onClick={() => { setReplyDialog(r); setReplyText(""); }} title="সমাধান করুন">
                          <CheckCircle className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Full Question Preview Dialog */}
      <Dialog open={!!previewDialog} onOpenChange={() => setPreviewDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">প্রশ্ন প্রিভিউ</DialogTitle>
          </DialogHeader>
          {fullQuestion && (
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                <span>{fullQuestion.classes?.name}</span>
                <span>•</span>
                <span>{fullQuestion.subjects?.name}</span>
                <span>•</span>
                <span>{fullQuestion.chapters?.name}</span>
                {fullQuestion.topics?.name && <><span>•</span><span>{fullQuestion.topics?.name}</span></>}
                <span>•</span>
                <Badge variant="secondary" className="text-xs">{typeLabels[fullQuestion.type] || fullQuestion.type}</Badge>
              </div>

              {renderFullQuestion(fullQuestion)}

              <div className="border-t pt-3">
                <p className="text-sm"><strong>ভুলের ধরন:</strong> {previewDialog?.error_type}</p>
                {previewDialog?.comment && <p className="text-sm mt-1"><strong>মন্তব্য:</strong> {previewDialog.comment}</p>}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDialog(null)}>বন্ধ করুন</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1" onClick={() => openEdit(fullQuestion)}>
              <Pencil className="w-4 h-4" /> এডিট করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve Dialog */}
      <Dialog open={!!replyDialog} onOpenChange={() => setReplyDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">রিপোর্ট সমাধান করুন</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">শিক্ষককে জানাতে একটি উত্তর লিখুন (ঐচ্ছিক):</p>
            <Textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="উত্তর লিখুন..." rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplyDialog(null)}>বাতিল</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleResolve(replyDialog)}>
              <CheckCircle className="w-4 h-4 mr-1" /> সমাধান করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Question Dialog — same as AdminQuestions */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>প্রশ্ন সম্পাদনা</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>শ্রেণী</Label>
                <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value, subject_id: "", chapter_id: "", topic_id: "" })}>
                  <option value="">নির্বাচন করুন</option>
                  {allClasses.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <Label>বিষয়</Label>
                <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value, chapter_id: "", topic_id: "" })}>
                  <option value="">নির্বাচন করুন</option>
                  {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <Label>অধ্যায়</Label>
                <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" value={form.chapter_id} onChange={(e) => setForm({ ...form, chapter_id: e.target.value, topic_id: "" })}>
                  <option value="">নির্বাচন করুন</option>
                  {chapters.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <Label>টপিক {loadingTopics && <span className="text-xs text-muted-foreground">(লোড হচ্ছে...)</span>}</Label>
                <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" value={form.topic_id} onChange={(e) => setForm({ ...form, topic_id: e.target.value })} disabled={!form.chapter_id}>
                  <option value="">নির্বাচন করুন</option>
                  {topics.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <Label>টাইপ</Label>
                <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {typeOptions.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                </select>
              </div>
            </div>

            {/* CQ Form */}
            {form.type === "cq" ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full">
                    {isMathSubject ? "সৃজনশীল (গণিত) — ১০ মার্ক (ক=২, খ=৪, গ=৪)" : "সৃজনশীল — ১০ মার্ক (ক=১, খ=২, গ=৩, ঘ=৪)"}
                  </span>
                </div>
                <div><Label>উদ্দীপক</Label><RichTextEditor value={form.cq_stem} onChange={(v) => setForm({ ...form, cq_stem: v })} placeholder="উদ্দীপক..." minHeight="150px" /></div>
                <div><Label>ক) {isMathSubject ? "(নম্বর: ২)" : "(নম্বর: ১)"}</Label><RichTextEditor value={form.cq_q_ka} onChange={(v) => setForm({ ...form, cq_q_ka: v })} placeholder="প্রশ্ন ক" minHeight="80px" /></div>
                <div><Label>খ) {isMathSubject ? "(নম্বর: ৪)" : "(নম্বর: ২)"}</Label><RichTextEditor value={form.cq_q_kha} onChange={(v) => setForm({ ...form, cq_q_kha: v })} placeholder="প্রশ্ন খ" minHeight="80px" /></div>
                <div><Label>গ) {isMathSubject ? "(নম্বর: ৪)" : "(নম্বর: ৩)"}</Label><RichTextEditor value={form.cq_q_ga} onChange={(v) => setForm({ ...form, cq_q_ga: v })} placeholder="প্রশ্ন গ" minHeight="80px" /></div>
                {!isMathSubject && <div><Label>ঘ) (নম্বর: ৪)</Label><RichTextEditor value={form.cq_q_gha} onChange={(v) => setForm({ ...form, cq_q_gha: v })} placeholder="প্রশ্ন ঘ" minHeight="80px" /></div>}
                <div><Label>উত্তর ক (ঐচ্ছিক)</Label><RichTextEditor value={form.cq_ans_ka} onChange={(v) => setForm({ ...form, cq_ans_ka: v })} placeholder="উত্তর ক" minHeight="80px" /></div>
                <div><Label>উত্তর খ</Label><RichTextEditor value={form.cq_ans_kha} onChange={(v) => setForm({ ...form, cq_ans_kha: v })} placeholder="উত্তর খ" minHeight="80px" /></div>
                <div><Label>উত্তর গ</Label><RichTextEditor value={form.cq_ans_ga} onChange={(v) => setForm({ ...form, cq_ans_ga: v })} placeholder="উত্তর গ" minHeight="80px" /></div>
                {!isMathSubject && <div><Label>উত্তর ঘ</Label><RichTextEditor value={form.cq_ans_gha} onChange={(v) => setForm({ ...form, cq_ans_gha: v })} placeholder="উত্তর ঘ" minHeight="80px" /></div>}
                <div><Label>ব্যাখ্যা (ঐচ্ছিক)</Label><RichTextEditor value={form.explanation} onChange={(v) => setForm({ ...form, explanation: v })} placeholder="ব্যাখ্যা..." minHeight="80px" /></div>
              </div>
            ) : (
              <>
                {/* MCQ Form */}
                {form.type === "mcq" && (
                  <>
                    <div className="flex items-center justify-between p-3 border border-border rounded-lg bg-muted/30">
                      <div>
                        <Label className="font-semibold">উদ্দীপক ভিত্তিক প্রশ্ন (Grouped MCQ)</Label>
                        <p className="text-xs text-muted-foreground">একটি উদ্দীপকের অধীনে একাধিক MCQ</p>
                      </div>
                      <Switch checked={isGroupedMcq} onCheckedChange={setIsGroupedMcq} />
                    </div>
                    <div>
                      <Label>{isGroupedMcq ? "উদ্দীপক *" : "উদ্দীপক (ঐচ্ছিক)"}</Label>
                      <RichTextEditor value={stimulusText} onChange={setStimulusText} placeholder="উদ্দীপক..." minHeight={isGroupedMcq ? "150px" : "100px"} />
                    </div>
                    {!isGroupedMcq ? (
                      <>
                        <div><Label>প্রশ্ন</Label><RichTextEditor value={form.question} onChange={(v) => setForm({ ...form, question: v })} placeholder="প্রশ্ন..." minHeight="180px" /></div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><Label>ক</Label><RichTextEditor value={form.option_a} onChange={(v) => setForm({ ...form, option_a: v })} placeholder="অপশন ক" minHeight="120px" /></div>
                          <div><Label>খ</Label><RichTextEditor value={form.option_b} onChange={(v) => setForm({ ...form, option_b: v })} placeholder="অপশন খ" minHeight="120px" /></div>
                          <div><Label>গ</Label><RichTextEditor value={form.option_c} onChange={(v) => setForm({ ...form, option_c: v })} placeholder="অপশন গ" minHeight="120px" /></div>
                          <div><Label>ঘ</Label><RichTextEditor value={form.option_d} onChange={(v) => setForm({ ...form, option_d: v })} placeholder="অপশন ঘ" minHeight="120px" /></div>
                        </div>
                        <div>
                          <Label>সঠিক উত্তর</Label>
                          <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" value={form.correct_answer} onChange={(e) => setForm({ ...form, correct_answer: e.target.value })}>
                            <option value="">নির্বাচন করুন</option>
                            <option value="ক">ক</option><option value="খ">খ</option><option value="গ">গ</option><option value="ঘ">ঘ</option>
                          </select>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-4">
                        <Label className="text-base font-semibold">প্রশ্নসমূহ ({groupedQuestions.length}টি)</Label>
                        {groupedQuestions.map((gq, gi) => (
                          <div key={gi} className="border border-border rounded-lg p-3 space-y-2 relative bg-background">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-semibold">প্রশ্ন {gi + 1}</span>
                              {groupedQuestions.length > 1 && (
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setGroupedQuestions(prev => prev.filter((_, i) => i !== gi))}>
                                  <X className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              )}
                            </div>
                            <RichTextEditor value={gq.question} onChange={(v) => setGroupedQuestions(prev => prev.map((q, i) => i === gi ? { ...q, question: v } : q))} placeholder={`প্রশ্ন ${gi + 1}`} minHeight="100px" />
                            <div className="grid grid-cols-2 gap-2">
                              <div><Label className="text-xs">ক</Label><RichTextEditor value={gq.option_a} onChange={(v) => setGroupedQuestions(prev => prev.map((q, i) => i === gi ? { ...q, option_a: v } : q))} placeholder="অপশন ক" minHeight="70px" /></div>
                              <div><Label className="text-xs">খ</Label><RichTextEditor value={gq.option_b} onChange={(v) => setGroupedQuestions(prev => prev.map((q, i) => i === gi ? { ...q, option_b: v } : q))} placeholder="অপশন খ" minHeight="70px" /></div>
                              <div><Label className="text-xs">গ</Label><RichTextEditor value={gq.option_c} onChange={(v) => setGroupedQuestions(prev => prev.map((q, i) => i === gi ? { ...q, option_c: v } : q))} placeholder="অপশন গ" minHeight="70px" /></div>
                              <div><Label className="text-xs">ঘ</Label><RichTextEditor value={gq.option_d} onChange={(v) => setGroupedQuestions(prev => prev.map((q, i) => i === gi ? { ...q, option_d: v } : q))} placeholder="অপশন ঘ" minHeight="70px" /></div>
                            </div>
                            <div>
                              <Label className="text-xs">সঠিক উত্তর</Label>
                              <select className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background" value={gq.correct_answer} onChange={(e) => setGroupedQuestions(prev => prev.map((q, i) => i === gi ? { ...q, correct_answer: e.target.value } : q))}>
                                <option value="">নির্বাচন করুন</option>
                                <option value="ক">ক</option><option value="খ">খ</option><option value="গ">গ</option><option value="ঘ">ঘ</option>
                              </select>
                            </div>
                          </div>
                        ))}
                        <Button type="button" variant="outline" className="w-full border-dashed border-emerald-400 text-emerald-600 hover:bg-emerald-50"
                          onClick={() => setGroupedQuestions(prev => [...prev, { question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "" }])}>
                          <Plus className="h-4 w-4 mr-1" /> আরও প্রশ্ন যোগ করুন
                        </Button>
                      </div>
                    )}
                    <div><Label>ব্যাখ্যা (ঐচ্ছিক)</Label><RichTextEditor value={form.explanation} onChange={(v) => setForm({ ...form, explanation: v })} placeholder="ব্যাখ্যা..." minHeight="120px" /></div>
                  </>
                )}

                {/* Short */}
                {form.type === "short" && (
                  <>
                    <div><Label>প্রশ্ন</Label><RichTextEditor value={form.question} onChange={(v) => setForm({ ...form, question: v })} placeholder="সংক্ষিপ্ত প্রশ্ন..." minHeight="140px" /></div>
                    <div><Label>উত্তর (ঐচ্ছিক)</Label><RichTextEditor value={form.correct_answer} onChange={(v) => setForm({ ...form, correct_answer: v })} placeholder="উত্তর..." minHeight="120px" /></div>
                    <div><Label>ব্যাখ্যা (ঐচ্ছিক)</Label><RichTextEditor value={form.explanation} onChange={(v) => setForm({ ...form, explanation: v })} placeholder="ব্যাখ্যা..." minHeight="100px" /></div>
                  </>
                )}

                {/* Descriptive */}
                {form.type === "descriptive" && (
                  <div className="space-y-4">
                    <div><Label>ক) প্রশ্ন (নম্বর: ৩)</Label><RichTextEditor value={form.desc_q_ka} onChange={(v) => setForm({ ...form, desc_q_ka: v })} placeholder="প্রশ্ন ক..." minHeight="140px" /></div>
                    <div><Label>ক) উত্তর (ঐচ্ছিক)</Label><RichTextEditor value={form.desc_ans_ka} onChange={(v) => setForm({ ...form, desc_ans_ka: v })} placeholder="উত্তর ক..." minHeight="100px" /></div>
                    <div><Label>খ) প্রশ্ন (নম্বর: ৭)</Label><RichTextEditor value={form.desc_q_kha} onChange={(v) => setForm({ ...form, desc_q_kha: v })} placeholder="প্রশ্ন খ..." minHeight="140px" /></div>
                    <div><Label>খ) উত্তর (ঐচ্ছিক)</Label><RichTextEditor value={form.desc_ans_kha} onChange={(v) => setForm({ ...form, desc_ans_kha: v })} placeholder="উত্তর খ..." minHeight="100px" /></div>
                    <div><Label>ব্যাখ্যা (ঐচ্ছিক)</Label><RichTextEditor value={form.explanation} onChange={(v) => setForm({ ...form, explanation: v })} placeholder="ব্যাখ্যা..." minHeight="100px" /></div>
                  </div>
                )}
              </>
            )}

            {/* References */}
            <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
              <p className="text-sm font-semibold text-muted-foreground">রেফারেন্স এবং মেটাডাটা</p>
              <ReferenceInput label="বোর্ড রেফারেন্স" nameLabel="বোর্ড" namePlaceholder="যেমন: কু. বো." nameKey="board"
                value={form.board_references} onChange={(refs) => setForm({ ...form, board_references: refs as any })} />
              <ReferenceInput label="বিশ্ববিদ্যালয় রেফারেন্স" nameLabel="বিশ্ববিদ্যালয়" namePlaceholder="যেমন: ঢাকা বিশ্ববিদ্যালয়" nameKey="name"
                value={form.university_references} onChange={(refs) => setForm({ ...form, university_references: refs as any })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>বাতিল</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSave}>আপডেট</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
