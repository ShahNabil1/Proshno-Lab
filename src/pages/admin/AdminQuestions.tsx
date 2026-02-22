import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

const typeOptions = ["mcq", "short", "cq", "descriptive"];

export default function AdminQuestions() {
  const [items, setItems] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({
    class_id: "", subject_id: "", chapter_id: "", category_id: "", type: "mcq",
    question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "", explanation: "",
  });

  const fetchItems = async () => {
    const { data } = await supabase.from("questions")
      .select("*, classes(name), subjects(name), chapters(name), teachers(full_name)")
      .order("created_at", { ascending: false }).limit(100);
    setItems(data || []);
  };

  useEffect(() => {
    fetchItems();
    supabase.from("classes").select("id, name").order("name").then(({ data }) => setClasses(data || []));
    supabase.from("question_categories").select("id, name").order("name").then(({ data }) => setCategories(data || []));
  }, []);

  useEffect(() => {
    if (!form.class_id) return;
    supabase.from("subjects").select("id, name").eq("class_id", Number(form.class_id)).order("name")
      .then(({ data }) => setSubjects(data || []));
  }, [form.class_id]);

  useEffect(() => {
    if (!form.subject_id) return;
    supabase.from("chapters").select("id, name").eq("subject_id", Number(form.subject_id)).order("name")
      .then(({ data }) => setChapters(data || []));
  }, [form.subject_id]);

  const openCreate = () => {
    setEditItem(null);
    setForm({ class_id: "", subject_id: "", chapter_id: "", category_id: "", type: "mcq", question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "", explanation: "" });
    setDialogOpen(true);
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setForm({
      class_id: String(item.class_id), subject_id: String(item.subject_id),
      chapter_id: String(item.chapter_id), category_id: item.category_id ? String(item.category_id) : "",
      type: item.type, question: item.question, option_a: item.option_a || "", option_b: item.option_b || "",
      option_c: item.option_c || "", option_d: item.option_d || "", correct_answer: item.correct_answer || "",
      explanation: item.explanation || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.question || !form.class_id || !form.subject_id || !form.chapter_id) {
      toast.error("প্রশ্ন, শ্রেণী, বিষয় ও অধ্যায় আবশ্যক");
      return;
    }
    const payload: any = {
      class_id: Number(form.class_id), subject_id: Number(form.subject_id), chapter_id: Number(form.chapter_id),
      type: form.type, question: form.question, option_a: form.option_a || null, option_b: form.option_b || null,
      option_c: form.option_c || null, option_d: form.option_d || null, correct_answer: form.correct_answer || null,
      explanation: form.explanation || null,
    };
    if (form.category_id) payload.category_id = Number(form.category_id);

    if (editItem) {
      const { error } = await supabase.from("questions").update(payload).eq("id", editItem.id);
      if (error) { toast.error("আপডেট ব্যর্থ: " + error.message); return; }
      toast.success("আপডেট হয়েছে");
    } else {
      // Admin inserts need a teacher_id - use current user
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
                  <TableCell className="max-w-[200px] truncate">{item.question}</TableCell>
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
                <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value, subject_id: "", chapter_id: "" })}>
                  <option value="">নির্বাচন করুন</option>
                  {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <Label>বিষয়</Label>
                <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value, chapter_id: "" })}>
                  <option value="">নির্বাচন করুন</option>
                  {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <Label>অধ্যায়</Label>
                <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" value={form.chapter_id} onChange={(e) => setForm({ ...form, chapter_id: e.target.value })}>
                  <option value="">নির্বাচন করুন</option>
                  {chapters.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <Label>টাইপ</Label>
                <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {typeOptions.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label>প্রশ্ন</Label>
              <Textarea value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} rows={3} />
            </div>
            {form.type === "mcq" && (
              <div className="grid grid-cols-2 gap-3">
                <div><Label>অপশন ক</Label><Input value={form.option_a} onChange={(e) => setForm({ ...form, option_a: e.target.value })} /></div>
                <div><Label>অপশন খ</Label><Input value={form.option_b} onChange={(e) => setForm({ ...form, option_b: e.target.value })} /></div>
                <div><Label>অপশন গ</Label><Input value={form.option_c} onChange={(e) => setForm({ ...form, option_c: e.target.value })} /></div>
                <div><Label>অপশন ঘ</Label><Input value={form.option_d} onChange={(e) => setForm({ ...form, option_d: e.target.value })} /></div>
              </div>
            )}
            <div><Label>সঠিক উত্তর</Label><Input value={form.correct_answer} onChange={(e) => setForm({ ...form, correct_answer: e.target.value })} /></div>
            <div><Label>ব্যাখ্যা (ঐচ্ছিক)</Label><Textarea value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} rows={2} /></div>
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
