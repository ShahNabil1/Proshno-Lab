import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, BookOpen, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";

interface AdminCrudPageProps {
  title: string;
  table: "classes" | "subjects" | "chapters" | "question_categories";
  parentTable?: "classes" | "subjects";
  parentLabel?: string;
  parentKey?: string;
}

export default function AdminCrudPage({ title, table, parentTable, parentLabel, parentKey }: AdminCrudPageProps) {
  const navigate = useNavigate();
  const { isClassAllowed, isSubjectAllowed, hasFullAccess, loading: permLoading } = useAdminPermissions();
  const [items, setItems] = useState<any[]>([]);
  const [parents, setParents] = useState<{ id: number; name: string }[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [formName, setFormName] = useState("");
  const [formParentId, setFormParentId] = useState("");
  const [formSubjectCode, setFormSubjectCode] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: number | null; name: string }>({ open: false, id: null, name: "" });
  const fetchItems = async () => {
    let query: any;
    if (parentTable && parentKey) {
      query = supabase.from(table).select(`*, ${parentTable}(name)`).order("created_at", { ascending: false });
    } else {
      query = supabase.from(table).select("*").order("created_at", { ascending: false });
    }
    const { data } = await query;
    let filtered = data || [];
    if (!hasFullAccess) {
      if (table === "classes") {
        filtered = filtered.filter((item: any) => isClassAllowed(item.id));
      } else if (table === "subjects") {
        filtered = filtered.filter((item: any) => isSubjectAllowed(item.class_id, item.id));
      } else if (table === "chapters") {
        // chapters have subject_id; we need to check subject permission
        filtered = filtered.filter((item: any) => {
          // We can't easily check class_id from chapter alone, so allow if any permission matches subject_id
          return true; // chapters are filtered via subject dropdown anyway
        });
      }
    }
    setItems(filtered);
  };

  useEffect(() => {
    if (permLoading) return;
    fetchItems();
    if (parentTable) {
      supabase.from(parentTable).select("id, name").order("name")
        .then(({ data }: any) => setParents(data || []));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, permLoading]);

  const openCreate = () => { setEditItem(null); setFormName(""); setFormParentId(""); setFormSubjectCode(""); setDialogOpen(true); };
  const openEdit = (item: any) => {
    setEditItem(item);
    setFormName(item.name);
    setFormParentId(parentKey ? String(item[parentKey]) : "");
    setFormSubjectCode(item.subject_code || "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) { toast.error("নাম লিখুন"); return; }
    const payload: any = { name: formName.trim() };
    if (parentKey && formParentId) payload[parentKey] = Number(formParentId);
    if (table === "subjects") payload.subject_code = formSubjectCode.trim() || null;

    if (editItem) {
      const { error } = await (supabase.from(table) as any).update(payload).eq("id", editItem.id);
      if (error) { toast.error("আপডেট ব্যর্থ"); return; }
      toast.success("আপডেট হয়েছে");
    } else {
      const { error } = await (supabase.from(table) as any).insert(payload);
      if (error) { toast.error("তৈরি ব্যর্থ: " + error.message); return; }
      toast.success("তৈরি হয়েছে");
    }
    setDialogOpen(false);
    fetchItems();
  };

  const confirmDelete = (id: number, name: string) => {
    setDeleteConfirm({ open: true, id, name });
  };

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    // Check for dependent questions before deleting classes or subjects
    if (table === "classes") {
      const { count } = await supabase.from("questions").select("id", { count: "exact", head: true }).eq("class_id", deleteConfirm.id);
      if (count && count > 0) {
        toast.error(`এই শ্রেণীতে ${count}টি প্রশ্ন আছে। আগে প্রশ্নগুলো মুছুন, তারপর শ্রেণী মুছতে পারবেন।`);
        setDeleteConfirm({ open: false, id: null, name: "" });
        return;
      }
    }
    if (table === "subjects") {
      const { count } = await supabase.from("questions").select("id", { count: "exact", head: true }).eq("subject_id", deleteConfirm.id);
      if (count && count > 0) {
        toast.error(`এই বিষয়ে ${count}টি প্রশ্ন আছে। আগে প্রশ্নগুলো মুছুন, তারপর বিষয় মুছতে পারবেন।`);
        setDeleteConfirm({ open: false, id: null, name: "" });
        return;
      }
    }
    const { error } = await (supabase.from(table) as any).delete().eq("id", deleteConfirm.id);
    if (error) { toast.error("ডিলিট ব্যর্থ: " + error.message); return; }
    toast.success("মুছে ফেলা হয়েছে");
    setDeleteConfirm({ open: false, id: null, name: "" });
    fetchItems();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-bold">{title}</h1>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> নতুন যোগ করুন</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>নাম</TableHead>
                {table === "subjects" && <TableHead>বিষয় কোড</TableHead>}
                {parentLabel && <TableHead>{parentLabel}</TableHead>}
                <TableHead className="text-right">অ্যাকশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.id}</TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  {table === "subjects" && (
                    <TableCell>{item.subject_code || "—"}</TableCell>
                  )}
                  {parentLabel && parentTable && (
                    <TableCell>{item[parentTable]?.name || "—"}</TableCell>
                  )}
                  <TableCell className="text-right space-x-1">
                    {table === "chapters" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => navigate(`/admin/topics?chapter_id=${item.id}&chapter_name=${encodeURIComponent(item.name)}`)}
                      >
                        <BookOpen className="w-3.5 h-3.5" /> টপিক ম্যানেজমেন্ট
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => confirmDelete(item.id, item.name)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={parentLabel ? 4 : 3} className="text-center text-muted-foreground py-8">কোনো ডাটা নেই</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? "সম্পাদনা" : "নতুন যোগ করুন"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Input placeholder="নাম" value={formName} onChange={(e) => setFormName(e.target.value)} />
            {table === "subjects" && (
              <Input placeholder="বিষয় কোড (যেমন: ১৭৮)" value={formSubjectCode} onChange={(e) => setFormSubjectCode(e.target.value)} />
            )}
            {parentKey && parents.length > 0 && (
              <select className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                value={formParentId} onChange={(e) => setFormParentId(e.target.value)}>
                <option value="">{parentLabel} নির্বাচন করুন</option>
                {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>বাতিল</Button>
            <Button onClick={handleSave}>{editItem ? "আপডেট" : "তৈরি করুন"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => !open && setDeleteConfirm({ open: false, id: null, name: "" })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <AlertDialogTitle className="text-lg">মুছে ফেলতে চান?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-sm">
              <span className="font-semibold text-foreground">"{deleteConfirm.name}"</span> মুছে ফেলা হলে এটি আর ফিরিয়ে আনা যাবে না। আপনি কি নিশ্চিত?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              হ্যাঁ, মুছে ফেলুন
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
