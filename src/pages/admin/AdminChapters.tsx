import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Filter } from "lucide-react";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";

interface ClassItem { id: number; name: string; }
interface SubjectItem { id: number; name: string; class_id: number; }
interface ChapterItem {
  id: number;
  name: string;
  subject_id: number;
  is_free: boolean;
  created_at: string;
  subjects?: { name: string; class_id: number; classes?: { name: string } };
}

export default function AdminChapters() {
  const { hasFullAccess, isSubjectAllowed, loading: permLoading } = useAdminPermissions();

  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);

  // Filters
  const [filterClassId, setFilterClassId] = useState("");
  const [filterSubjectId, setFilterSubjectId] = useState("");

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<ChapterItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formClassId, setFormClassId] = useState("");
  const [formSubjectId, setFormSubjectId] = useState("");

  useEffect(() => {
    if (permLoading) return;
    supabase.from("classes").select("id, name").order("name").then(({ data }) => setClasses(data || []));
    supabase.from("subjects").select("id, name, class_id").order("name").then(({ data }) => setSubjects(data || []));
    fetchChapters();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permLoading]);

  const fetchChapters = async () => {
    const { data } = await supabase
      .from("chapters")
      .select("*, subjects(name, class_id, classes(name))")
      .order("created_at", { ascending: false });
    let filtered = data || [];
    if (!hasFullAccess) {
      filtered = filtered.filter((ch: any) =>
        isSubjectAllowed(ch.subjects?.class_id, ch.subject_id)
      );
    }
    setChapters(filtered as ChapterItem[]);
  };

  // Filtered display
  const displayChapters = chapters.filter((ch) => {
    const classId = (ch as any).subjects?.class_id;
    if (filterClassId && String(classId) !== filterClassId) return false;
    if (filterSubjectId && String(ch.subject_id) !== filterSubjectId) return false;
    return true;
  });

  const filteredSubjectsForFilter = filterClassId
    ? subjects.filter((s) => String(s.class_id) === filterClassId)
    : subjects;

  const filteredSubjectsForForm = formClassId
    ? subjects.filter((s) => String(s.class_id) === formClassId)
    : [];

  const openCreate = () => {
    setEditItem(null);
    setFormName("");
    setFormClassId("");
    setFormSubjectId("");
    setDialogOpen(true);
  };

  const openEdit = (item: ChapterItem) => {
    setEditItem(item);
    setFormName(item.name);
    const classId = (item as any).subjects?.class_id;
    setFormClassId(classId ? String(classId) : "");
    setFormSubjectId(String(item.subject_id));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) { toast.error("নাম লিখুন"); return; }
    if (!formSubjectId) { toast.error("বিষয় নির্বাচন করুন"); return; }

    // Duplicate check: same name + same subject
    const { data: existing } = await supabase
      .from("chapters")
      .select("id")
      .eq("name", formName.trim())
      .eq("subject_id", Number(formSubjectId));

    if (existing && existing.length > 0) {
      if (!editItem || existing.some((e) => e.id !== editItem.id)) {
        toast.error("এই বিষয়ে একই নামের অধ্যায় আগে থেকে আছে!");
        return;
      }
    }

    const payload = { name: formName.trim(), subject_id: Number(formSubjectId) };

    if (editItem) {
      const { error } = await supabase.from("chapters").update(payload).eq("id", editItem.id);
      if (error) { toast.error("আপডেট ব্যর্থ"); return; }
      toast.success("আপডেট হয়েছে");
    } else {
      const { error } = await supabase.from("chapters").insert(payload);
      if (error) { toast.error("তৈরি ব্যর্থ: " + error.message); return; }
      toast.success("তৈরি হয়েছে");
    }
    setDialogOpen(false);
    fetchChapters();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("মুছে ফেলতে চান?")) return;
    const { error } = await supabase.from("chapters").delete().eq("id", id);
    if (error) { toast.error("ডিলিট ব্যর্থ: " + error.message); return; }
    toast.success("মুছে ফেলা হয়েছে");
    fetchChapters();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-bold">অধ্যায় ম্যানেজমেন্ট</h1>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> নতুন যোগ করুন</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <select
          className="border border-border rounded-md px-3 py-2 text-sm bg-background"
          value={filterClassId}
          onChange={(e) => { setFilterClassId(e.target.value); setFilterSubjectId(""); }}
        >
          <option value="">সকল শ্রেণী</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          className="border border-border rounded-md px-3 py-2 text-sm bg-background"
          value={filterSubjectId}
          onChange={(e) => setFilterSubjectId(e.target.value)}
        >
          <option value="">সকল বিষয়</option>
          {filteredSubjectsForFilter.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {(filterClassId || filterSubjectId) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterClassId(""); setFilterSubjectId(""); }}>
            ফিল্টার রিসেট
          </Button>
        )}
        <span className="text-sm text-muted-foreground ml-auto">
          মোট: {displayChapters.length}টি অধ্যায়
        </span>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>নাম</TableHead>
                <TableHead>শ্রেণী</TableHead>
                <TableHead>বিষয়</TableHead>
                <TableHead className="text-center">ফ্রি/ডেমো</TableHead>
                <TableHead className="text-right">অ্যাকশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayChapters.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.id}</TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{(item as any).subjects?.classes?.name || "—"}</TableCell>
                  <TableCell>{(item as any).subjects?.name || "—"}</TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={item.is_free}
                      onCheckedChange={async (checked) => {
                        await supabase.from("chapters").update({ is_free: checked } as any).eq("id", item.id);
                        setChapters(prev => prev.map(ch => ch.id === item.id ? { ...ch, is_free: checked } : ch));
                        toast.success(checked ? "ফ্রি/ডেমো সক্রিয়" : "ফ্রি/ডেমো নিষ্ক্রিয়");
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {displayChapters.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">কোনো ডাটা নেই</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? "সম্পাদনা" : "নতুন অধ্যায় যোগ করুন"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Input placeholder="অধ্যায়ের নাম" value={formName} onChange={(e) => setFormName(e.target.value)} />
            <select
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
              value={formClassId}
              onChange={(e) => { setFormClassId(e.target.value); setFormSubjectId(""); }}
            >
              <option value="">শ্রেণী নির্বাচন করুন</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
              value={formSubjectId}
              onChange={(e) => setFormSubjectId(e.target.value)}
              disabled={!formClassId}
            >
              <option value="">{formClassId ? "বিষয় নির্বাচন করুন" : "আগে শ্রেণী নির্বাচন করুন"}</option>
              {filteredSubjectsForForm.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
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
