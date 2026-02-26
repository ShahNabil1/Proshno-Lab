import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import MathInput from "@/components/MathInput";
import RichTextEditor from "@/components/RichTextEditor";
import LatexRenderer from "@/components/LatexRenderer";
import ReferenceInput from "@/components/ReferenceInput";
import ReferenceBadges from "@/components/ReferenceBadges";
import ExplanationToggle from "@/components/ExplanationToggle";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";

const typeOptions = ["mcq", "short", "cq"];

export default function AdminQuestions() {
  const [items, setItems] = useState<any[]>([]);
  const [allClasses, setAllClasses] = useState<any[]>([]);
  const [allSubjects, setAllSubjects] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const { filterClasses, filterSubjects, hasFullAccess, isSubjectAllowed, loading: permLoading } = useAdminPermissions();
  const [form, setForm] = useState({
    class_id: "", subject_id: "", chapter_id: "", topic_id: "", category_id: "", type: "mcq",
    question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "", explanation: "",
    cq_stem: "", cq_q_ka: "", cq_q_kha: "", cq_q_ga: "", cq_q_gha: "",
    cq_ans_ka: "", cq_ans_kha: "", cq_ans_ga: "", cq_ans_gha: "",
    board_references: [] as Array<{ board: string; year: string }>,
    university_references: [] as Array<{ name: string; year: string }>,
  });

  const classes = filterClasses(allClasses);

  const fetchItems = async () => {
    const { data } = await supabase.from("questions")
      .select("*, classes(name), subjects(name), chapters(name), teachers(full_name)")
      .order("created_at", { ascending: false }).limit(100);
    if (hasFullAccess) {
      setItems(data || []);
    } else {
      setItems((data || []).filter((q: any) => isSubjectAllowed(q.class_id, q.subject_id)));
    }
  };

  useEffect(() => {
    supabase.from("classes").select("id, name").order("name").then(({ data }) => setAllClasses(data || []));
    supabase.from("subjects").select("id, name, class_id").order("name").then(({ data }) => setAllSubjects(data || []));
    supabase.from("question_categories").select("id, name").order("name").then(({ data }) => setCategories(data || []));
  }, []);

  useEffect(() => {
    if (!permLoading) fetchItems();
  }, [permLoading]);

  useEffect(() => {
    if (!form.class_id) return;
    const filtered = filterSubjects(allSubjects.filter(s => String(s.class_id) === form.class_id) as any);
    setSubjects(filtered);
  }, [form.class_id, allSubjects, permLoading]);

  useEffect(() => {
    if (!form.subject_id) return;
    supabase.from("chapters").select("id, name").eq("subject_id", Number(form.subject_id)).order("name")
      .then(({ data }) => setChapters(data || []));
  }, [form.subject_id]);

  // Load topics when chapter changes
  useEffect(() => {
    if (!form.chapter_id) { setTopics([]); return; }
    setLoadingTopics(true);
    supabase.from("topics").select("id, name").eq("chapter_id", Number(form.chapter_id)).order("name")
      .then(({ data }) => { setTopics(data || []); setLoadingTopics(false); });
  }, [form.chapter_id]);

  const openCreate = () => {
    setEditItem(null);
    setForm({ class_id: "", subject_id: "", chapter_id: "", topic_id: "", category_id: "", type: "mcq", question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "", explanation: "", cq_stem: "", cq_q_ka: "", cq_q_kha: "", cq_q_ga: "", cq_q_gha: "", cq_ans_ka: "", cq_ans_kha: "", cq_ans_ga: "", cq_ans_gha: "", board_references: [], university_references: [] });
    setDialogOpen(true);
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    const cd = item.creative_data || {};
    setForm({
      class_id: String(item.class_id), subject_id: String(item.subject_id),
      chapter_id: String(item.chapter_id), topic_id: item.topic_id ? String(item.topic_id) : "", category_id: item.category_id ? String(item.category_id) : "",
      type: item.type, question: item.question, option_a: item.option_a || "", option_b: item.option_b || "",
      option_c: item.option_c || "", option_d: item.option_d || "", correct_answer: item.correct_answer || "",
      explanation: item.explanation || "",
      cq_stem: cd.stem || "", cq_q_ka: cd.q_ka || "", cq_q_kha: cd.q_kha || "", cq_q_ga: cd.q_ga || "", cq_q_gha: cd.q_gha || "",
      cq_ans_ka: cd.ans_ka || "", cq_ans_kha: cd.ans_kha || "", cq_ans_ga: cd.ans_ga || "", cq_ans_gha: cd.ans_gha || "",
      board_references: Array.isArray(item.board_references) ? item.board_references : [],
      university_references: Array.isArray(item.university_references) ? item.university_references : [],
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (form.type === "cq") {
      if (!form.cq_stem || !form.class_id || !form.subject_id || !form.chapter_id) {
        toast.error("উদ্দীপক, শ্রেণী, বিষয় ও অধ্যায় আবশ্যক");
        return;
      }
    } else {
      if (!form.question || !form.class_id || !form.subject_id || !form.chapter_id) {
        toast.error("প্রশ্ন, শ্রেণী, বিষয় ও অধ্যায় আবশ্যক");
        return;
      }
    }

    const payload: any = {
      class_id: Number(form.class_id), subject_id: Number(form.subject_id), chapter_id: Number(form.chapter_id),
      topic_id: form.topic_id ? Number(form.topic_id) : null,
      type: form.type,
      question: form.type === "cq" ? (form.cq_stem.substring(0, 100) + (form.cq_stem.length > 100 ? "..." : "")) : form.question,
      option_a: form.option_a || null, option_b: form.option_b || null,
      option_c: form.option_c || null, option_d: form.option_d || null, correct_answer: form.correct_answer || null,
      explanation: form.explanation || null,
      board_references: form.board_references.length > 0 ? form.board_references : [],
      university_references: form.university_references.length > 0 ? form.university_references : [],
    };

    if (form.type === "cq") {
      payload.creative_data = {
        stem: form.cq_stem,
        q_ka: form.cq_q_ka, q_kha: form.cq_q_kha, q_ga: form.cq_q_ga, q_gha: form.cq_q_gha,
        ans_ka: form.cq_ans_ka, ans_kha: form.cq_ans_kha, ans_ga: form.cq_ans_ga, ans_gha: form.cq_ans_gha,
      };
    }

    if (form.category_id) payload.category_id = Number(form.category_id);

    if (editItem) {
      const { error } = await supabase.from("questions").update(payload).eq("id", editItem.id);
      if (error) { toast.error("আপডেট ব্যর্থ: " + error.message); return; }
      toast.success("আপডেট হয়েছে");
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      payload.teacher_id = user?.id;
      const { error } = await supabase.from("questions").insert(payload);
      if (error) { toast.error("তৈরি ব্যর্থ: " + error.message); return; }
      toast.success("তৈরি হয়েছে");
    }
    setDialogOpen(false);
    fetchItems();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("মুছে ফেলতে চান?")) return;
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) { toast.error("ডিলিট ব্যর্থ"); return; }
    toast.success("মুছে ফেলা হয়েছে");
    fetchItems();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-bold">প্রশ্ন ম্যানেজমেন্ট</h1>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> নতুন প্রশ্ন</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>প্রশ্ন</TableHead>
                <TableHead>টাইপ</TableHead>
                <TableHead>শ্রেণী</TableHead>
                <TableHead>বিষয়</TableHead>
                <TableHead>শিক্ষক</TableHead>
                <TableHead className="text-right">অ্যাকশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.id}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    <LatexRenderer text={item.question} />
                  </TableCell>
                  <TableCell className="uppercase">{item.type}</TableCell>
                  <TableCell>{item.classes?.name}</TableCell>
                  <TableCell>{item.subjects?.name}</TableCell>
                  <TableCell>{item.teachers?.full_name || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">কোনো প্রশ্ন নেই</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editItem ? "প্রশ্ন সম্পাদনা" : "নতুন প্রশ্ন"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>শ্রেণী</Label>
                <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value, subject_id: "", chapter_id: "", topic_id: "" })}>
                  <option value="">নির্বাচন করুন</option>
                  {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
            {/* === CQ Form === */}
            {form.type === "cq" ? (
              <div className="space-y-4">
                <div>
                  <Label className="text-base font-semibold">উদ্দীপক (Stem/Stimulus)</Label>
                  <MathInput value={form.cq_stem} onChange={(v) => setForm({ ...form, cq_stem: v })} rows={5} placeholder="উদ্দীপকটি এখানে লিখুন... (LaTeX: $\\\\\\\\vec{P}$)" />
                </div>
                <div className="space-y-3">
                  <Label className="text-base font-semibold">উপ-প্রশ্নসমূহ</Label>
                  <div><Label>ক) জ্ঞানমূলক</Label><MathInput value={form.cq_q_ka} onChange={(v) => setForm({ ...form, cq_q_ka: v })} singleLine placeholder="প্রশ্ন ক" /></div>
                  <div><Label>খ) অনুধাবনমূলক</Label><MathInput value={form.cq_q_kha} onChange={(v) => setForm({ ...form, cq_q_kha: v })} singleLine placeholder="প্রশ্ন খ" /></div>
                  <div><Label>গ) প্রয়োগমূলক</Label><MathInput value={form.cq_q_ga} onChange={(v) => setForm({ ...form, cq_q_ga: v })} singleLine placeholder="প্রশ্ন গ" /></div>
                  <div><Label>ঘ) উচ্চতর দক্ষতামূলক</Label><MathInput value={form.cq_q_gha} onChange={(v) => setForm({ ...form, cq_q_gha: v })} singleLine placeholder="প্রশ্ন ঘ" /></div>
                </div>
                <div className="space-y-3">
                  <Label className="text-base font-semibold">নমুনা উত্তর (ঐচ্ছিক)</Label>
                  <div><Label>উত্তর ক</Label><MathInput value={form.cq_ans_ka} onChange={(v) => setForm({ ...form, cq_ans_ka: v })} rows={2} /></div>
                  <div><Label>উত্তর খ</Label><MathInput value={form.cq_ans_kha} onChange={(v) => setForm({ ...form, cq_ans_kha: v })} rows={2} /></div>
                  <div><Label>উত্তর গ</Label><MathInput value={form.cq_ans_ga} onChange={(v) => setForm({ ...form, cq_ans_ga: v })} rows={2} /></div>
                  <div><Label>উত্তর ঘ</Label><MathInput value={form.cq_ans_gha} onChange={(v) => setForm({ ...form, cq_ans_gha: v })} rows={2} /></div>
                </div>
              </div>
            ) : (
              <>
                {/* === Non-CQ Form === */}
                <div>
                  <Label>প্রশ্ন</Label>
                  <MathInput value={form.question} onChange={(v) => setForm({ ...form, question: v })} rows={3} placeholder="প্রশ্নটি লিখুন... (LaTeX: $\\\\\\\\sqrt{x}$)" />
                </div>
                {form.type === "mcq" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>অপশন ক</Label><MathInput value={form.option_a} onChange={(v) => setForm({ ...form, option_a: v })} singleLine /></div>
                    <div><Label>অপশন খ</Label><MathInput value={form.option_b} onChange={(v) => setForm({ ...form, option_b: v })} singleLine /></div>
                    <div><Label>অপশন গ</Label><MathInput value={form.option_c} onChange={(v) => setForm({ ...form, option_c: v })} singleLine /></div>
                    <div><Label>অপশন ঘ</Label><MathInput value={form.option_d} onChange={(v) => setForm({ ...form, option_d: v })} singleLine /></div>
                  </div>
                )}
                <div>
                  <Label>সঠিক উত্তর</Label>
                  {form.type === "mcq" ? (
                    <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" value={form.correct_answer} onChange={(e) => setForm({ ...form, correct_answer: e.target.value })}>
                      <option value="">নির্বাচন করুন</option>
                      <option value="ক">ক</option>
                      <option value="খ">খ</option>
                      <option value="গ">গ</option>
                      <option value="ঘ">ঘ</option>
                    </select>
                  ) : (
                    <MathInput value={form.correct_answer} onChange={(v) => setForm({ ...form, correct_answer: v })} singleLine />
                  )}
                </div>
                <div><Label>ব্যাখ্যা (ঐচ্ছিক)</Label><MathInput value={form.explanation} onChange={(v) => setForm({ ...form, explanation: v })} rows={2} /></div>
              </>
            )}

            {/* References & Metadata Section */}
            <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
              <p className="text-sm font-semibold text-muted-foreground">রেফারেন্স এবং মেটাডাটা</p>
              <ReferenceInput
                label="বোর্ড রেফারেন্স"
                nameLabel="বোর্ড"
                namePlaceholder="যেমন: কু. বো."
                nameKey="board"
                value={form.board_references}
                onChange={(refs) => setForm({ ...form, board_references: refs as any })}
              />
              <ReferenceInput
                label="বিশ্ববিদ্যালয় রেফারেন্স"
                nameLabel="বিশ্ববিদ্যালয়"
                namePlaceholder="যেমন: ঢাকা বিশ্ববিদ্যালয়"
                nameKey="name"
                value={form.university_references}
                onChange={(refs) => setForm({ ...form, university_references: refs as any })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>বাতিল</Button>
            <Button onClick={handleSave}>{editItem ? "আপডেট" : "তৈরি করুন"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
