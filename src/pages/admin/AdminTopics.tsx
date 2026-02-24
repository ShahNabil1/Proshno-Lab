import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, BookOpen, ArrowLeft } from "lucide-react";

export default function AdminTopics() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const chapterId = Number(searchParams.get("chapter_id"));
  const chapterName = searchParams.get("chapter_name") || "";

  const [topics, setTopics] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [formName, setFormName] = useState("");

  const fetchTopics = async () => {
    if (!chapterId) return;
    const { data } = await supabase
      .from("topics")
      .select("*")
      .eq("chapter_id", chapterId)
      .order("created_at", { ascending: false });
    setTopics(data || []);
  };

  useEffect(() => {
    fetchTopics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId]);

  const openCreate = () => { setEditItem(null); setFormName(""); setDialogOpen(true); };
  const openEdit = (item: any) => { setEditItem(item); setFormName(item.name); setDialogOpen(true); };

  const handleSave = async () => {
    if (!formName.trim()) { toast.error("নাম লিখুন"); return; }
    const payload = { name: formName.trim(), chapter_id: chapterId };
    if (editItem) {
      const { error } = await supabase.from("topics").update({ name: formName.trim() }).eq("id", editItem.id);
      if (error) { toast.error("আপডেট ব্যর্থ"); return; }
      toast.success("আপডেট হয়েছে");
    } else {
      const { error } = await supabase.from("topics").insert(payload);
      if (error) { toast.error("তৈরি ব্যর্থ: " + error.message); return; }
      toast.success("তৈরি হয়েছে");
    }
    setDialogOpen(false);
    fetchTopics();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("মুছে ফেলতে চান?")) return;
    const { error } = await supabase.from("topics").delete().eq("id", id);
    if (error) { toast.error("ডিলিট ব্যর্থ: " + error.message); return; }
    toast.success("মুছে ফেলা হয়েছে");
    fetchTopics();
  };

  return (
    <div>
      <Button variant="ghost" className="mb-4 gap-2" onClick={() => navigate("/admin/chapters")}>
        <ArrowLeft className="w-4 h-4" /> অধ্যায় ম্যানেজমেন্টে ফিরুন
      </Button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">টপিক ম্যানেজমেন্ট</h1>
          <p className="text-muted-foreground text-sm">অধ্যায়: {chapterName}</p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> নতুন টপিক যোগ করুন</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>নাম</TableHead>
                <TableHead className="text-right">অ্যাকশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topics.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.id}</TableCell>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => navigate(`/admin/topic-questions?topic_id=${t.id}&topic_name=${encodeURIComponent(t.name)}&chapter_name=${encodeURIComponent(chapterName)}`)}
                    >
                      <BookOpen className="w-3.5 h-3.5" /> প্রশ্ন ম্যানেজমেন্ট
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {topics.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">কোনো টপিক নেই</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? "সম্পাদনা" : "নতুন টপিক যোগ করুন"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Input placeholder="টপিকের নাম" value={formName} onChange={(e) => setFormName(e.target.value)} />
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
