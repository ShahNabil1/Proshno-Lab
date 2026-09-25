import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, BookOpen, RotateCcw, Loader2 } from "lucide-react";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { sortClasses, sortChapters } from "@/lib/classOrder";

export default function AdminTopics() {
  const navigate = useNavigate();
  const { filterClasses, filterSubjects, loading: permLoading } = useAdminPermissions();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filter states — initialized from URL so they persist across navigations
  const [filterClassId, setFilterClassId] = useState(() => searchParams.get("class_id") || "");
  const [filterSubjectId, setFilterSubjectId] = useState(() => searchParams.get("subject_id") || "");
  const [filterChapterId, setFilterChapterId] = useState(() => searchParams.get("chapter_id") || "");

  // Data for filters
  const [allClasses, setAllClasses] = useState<any[]>([]);
  const [allSubjects, setAllSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingChapters, setLoadingChapters] = useState(false);

  const classes = filterClasses(allClasses);

  // Topics
  const [topics, setTopics] = useState<any[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [selectedTopicIds, setSelectedTopicIds] = useState<Set<number>>(new Set());
  const [deleteSelectedOpen, setDeleteSelectedOpen] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [formName, setFormName] = useState("");
  const [bulkNames, setBulkNames] = useState("");
  // Modal hierarchy
  const [modalClassId, setModalClassId] = useState("");
  const [modalSubjectId, setModalSubjectId] = useState("");
  const [modalChapterId, setModalChapterId] = useState("");
  const [modalSubjects, setModalSubjects] = useState<any[]>([]);
  const [modalChapters, setModalChapters] = useState<any[]>([]);
  const [modalLoadingSub, setModalLoadingSub] = useState(false);
  const [modalLoadingCh, setModalLoadingCh] = useState(false);

  // Load classes & subjects once
  useEffect(() => {
    supabase.from("classes").select("id, name").order("name")
      .then(({ data }) => setAllClasses(sortClasses(data || [])));
    supabase.from("subjects").select("id, name, class_id").order("name")
      .then(({ data }) => setAllSubjects(data || []));
  }, []);

  // Sync filters → URL so they persist across back-navigation
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (filterClassId) params.set("class_id", filterClassId); else params.delete("class_id");
    if (filterSubjectId) params.set("subject_id", filterSubjectId); else params.delete("subject_id");
    if (filterChapterId) params.set("chapter_id", filterChapterId); else params.delete("chapter_id");
    setSearchParams(params, { replace: true });
  }, [filterClassId, filterSubjectId, filterChapterId]);

  // Filter: load subjects when class changes (filtered by permissions)
  const [subjects, setSubjects] = useState<any[]>([]);
  useEffect(() => {
    if (!filterClassId) { setSubjects([]); return; }
    setLoadingSubjects(true);
    const filtered = filterSubjects(allSubjects.filter(s => String(s.class_id) === filterClassId) as any);
    setSubjects(filtered);
    setLoadingSubjects(false);
  }, [filterClassId, allSubjects, permLoading]);

  // Filter: load chapters when subject changes
  useEffect(() => {
    if (!filterSubjectId) { setChapters([]); return; }
    setLoadingChapters(true);
    supabase.from("chapters").select("id, name").eq("subject_id", Number(filterSubjectId)).order("name")
      .then(({ data }) => { setChapters(sortChapters(data || [])); setLoadingChapters(false); });
  }, [filterSubjectId]);

  // Load topics when chapter is selected
  useEffect(() => {
    setSelectedTopicIds(new Set());
    if (!filterChapterId) { setTopics([]); return; }
    setLoadingTopics(true);
    supabase.from("topics").select("*").eq("chapter_id", Number(filterChapterId)).order("created_at", { ascending: false })
      .then(({ data }) => { setTopics(data || []); setLoadingTopics(false); });
  }, [filterChapterId]);

  // Modal: load subjects
  useEffect(() => {
    if (!modalClassId) { setModalSubjects([]); setModalSubjectId(""); return; }
    setModalLoadingSub(true);
    setModalSubjectId("");
    setModalChapterId("");
    supabase.from("subjects").select("id, name").eq("class_id", Number(modalClassId)).order("name")
      .then(({ data }) => { setModalSubjects(data || []); setModalLoadingSub(false); });
  }, [modalClassId]);

  // Modal: load chapters
  useEffect(() => {
    if (!modalSubjectId) { setModalChapters([]); setModalChapterId(""); return; }
    setModalLoadingCh(true);
    setModalChapterId("");
    supabase.from("chapters").select("id, name").eq("subject_id", Number(modalSubjectId)).order("name")
      .then(({ data }) => { setModalChapters(sortChapters(data || [])); setModalLoadingCh(false); });
  }, [modalSubjectId]);

  const resetFilters = () => {
    setFilterClassId("");
    setFilterSubjectId("");
    setFilterChapterId("");
    setTopics([]);
  };

  const openCreate = () => {
    setEditItem(null);
    setFormName("");
    setBulkNames("");
    setModalClassId(filterClassId);
    setModalSubjectId(filterSubjectId);
    setModalChapterId(filterChapterId);
    if (filterClassId) setModalSubjects(subjects);
    if (filterSubjectId) setModalChapters(chapters);
    setDialogOpen(true);
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setFormName(item.name);
    setBulkNames("");
    setModalClassId(filterClassId);
    setModalSubjectId(filterSubjectId);
    setModalChapterId(filterChapterId);
    if (filterClassId) setModalSubjects(subjects);
    if (filterSubjectId) setModalChapters(chapters);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (editItem) {
      if (!formName.trim()) { toast.error("নাম লিখুন"); return; }
      const chapterId = Number(filterChapterId);
      if (!chapterId) { toast.error("অধ্যায় নির্বাচন করুন"); return; }
      const { error } = await supabase.from("topics").update({ name: formName.trim() }).eq("id", editItem.id);
      if (error) { toast.error("আপডেট ব্যর্থ"); return; }
      toast.success("আপডেট হয়েছে");
      setDialogOpen(false);
      if (filterChapterId && Number(filterChapterId) === chapterId) {
        setLoadingTopics(true);
        supabase.from("topics").select("*").eq("chapter_id", chapterId).order("created_at", { ascending: false })
          .then(({ data }) => { setTopics(data || []); setLoadingTopics(false); });
      }
    } else {
      const chapterId = Number(modalChapterId);
      if (!chapterId) { toast.error("অধ্যায় নির্বাচন করুন"); return; }
      const names = bulkNames.split("\n").map((s) => s.trim()).filter(Boolean);
      if (names.length === 0) { toast.error("অন্তত একটি টপিকের নাম লিখুন"); return; }
      const rows = names.map((name) => ({ name, chapter_id: chapterId }));
      const { error } = await supabase.from("topics").insert(rows);
      if (error) { toast.error("তৈরি ব্যর্থ: " + error.message); return; }
      toast.success(`${names.length} টি টপিক যোগ হয়েছে`);
      setDialogOpen(false);
      if (filterChapterId && Number(filterChapterId) === chapterId) {
        setLoadingTopics(true);
        supabase.from("topics").select("*").eq("chapter_id", chapterId).order("created_at", { ascending: false })
          .then(({ data }) => { setTopics(data || []); setLoadingTopics(false); });
      }
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("মুছে ফেলতে চান?")) return;
    const { error } = await supabase.from("topics").delete().eq("id", id);
    if (error) { toast.error("ডিলিট ব্যর্থ: " + error.message); return; }
    toast.success("মুছে ফেলা হয়েছে");
    setTopics(prev => prev.filter(t => t.id !== id));
    setSelectedTopicIds(prev => { const next = new Set(prev); next.delete(id); return next; });
  };

  const toggleTopic = (id: number, checked: boolean) => {
    setSelectedTopicIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };

  const toggleAllTopics = (checked: boolean) => {
    setSelectedTopicIds(checked ? new Set(topics.map(topic => topic.id)) : new Set());
  };

  const handleDeleteSelected = async () => {
    const ids = [...selectedTopicIds];
    if (ids.length === 0) return;
    setDeletingSelected(true);
    const { error } = await supabase.from("topics").delete().in("id", ids);
    setDeletingSelected(false);
    if (error) { toast.error("নির্বাচিত টপিক ডিলিট ব্যর্থ: " + error.message); return; }
    setTopics(prev => prev.filter(topic => !selectedTopicIds.has(topic.id)));
    setSelectedTopicIds(new Set());
    setDeleteSelectedOpen(false);
    toast.success(`${ids.length}টি নির্বাচিত টপিক মুছে ফেলা হয়েছে`);
  };

  const handleDeleteAll = async () => {
    const chapterId = Number(filterChapterId);
    if (!chapterId || topics.length === 0) return;
    setDeletingAll(true);
    const { error } = await supabase.from("topics").delete().eq("chapter_id", chapterId);
    setDeletingAll(false);
    if (error) { toast.error("সব টপিক ডিলিট ব্যর্থ: " + error.message); return; }
    const deletedCount = topics.length;
    setTopics([]);
    setSelectedTopicIds(new Set());
    setDeleteAllOpen(false);
    toast.success(`${deletedCount}টি টপিক মুছে ফেলা হয়েছে`);
  };

  const chapterName = chapters.find(c => String(c.id) === filterChapterId)?.name || "";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-bold">টপিক ম্যানেজমেন্ট</h1>
        <Button onClick={openCreate} className="gap-2 gradient-green text-primary-foreground border-0">
          <Plus className="w-4 h-4" /> নতুন টপিক যোগ করুন
        </Button>
      </div>

      {/* Cascading Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-[150px]">
              <Label className="text-xs mb-1 block">শ্রেণী</Label>
              <Select
                value={filterClassId}
                onValueChange={(v) => {
                  setFilterClassId(v);
                  setFilterSubjectId("");
                  setFilterChapterId("");
                }}
              >
                <SelectTrigger><SelectValue placeholder="শ্রেণী নির্বাচন করুন" /></SelectTrigger>
                <SelectContent>
                  {classes.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <Label className="text-xs mb-1 block">বিষয়</Label>
              <Select
                value={filterSubjectId}
                onValueChange={(v) => {
                  setFilterSubjectId(v);
                  setFilterChapterId("");
                }}
                disabled={!filterClassId}
              >
                <SelectTrigger>
                  {loadingSubjects ? <Loader2 className="w-4 h-4 animate-spin" /> : <SelectValue placeholder="বিষয় নির্বাচন করুন" />}
                </SelectTrigger>
                <SelectContent>
                  {subjects.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <Label className="text-xs mb-1 block">অধ্যায়</Label>
              <Select value={filterChapterId} onValueChange={setFilterChapterId} disabled={!filterSubjectId}>
                <SelectTrigger>
                  {loadingChapters ? <Loader2 className="w-4 h-4 animate-spin" /> : <SelectValue placeholder="অধ্যায় নির্বাচন করুন" />}
                </SelectTrigger>
                <SelectContent>
                  {chapters.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="icon" onClick={resetFilters} title="রিসেট">
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Topics Table */}
      {!filterChapterId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            টপিক দেখতে উপরে শ্রেণী, বিষয় ও অধ্যায় নির্বাচন করুন
          </CardContent>
        </Card>
      ) : loadingTopics ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground mt-2">লোড হচ্ছে...</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
            <p className="text-sm text-muted-foreground">অধ্যায়: <strong>{chapterName}</strong> · {topics.length}টি টপিক</p>
            <div className="flex items-center gap-2 flex-wrap">
              {selectedTopicIds.size > 0 && (
                <Button variant="destructive" size="sm" className="gap-2" onClick={() => setDeleteSelectedOpen(true)}>
                  <Trash2 className="w-4 h-4" /> নির্বাচিত {selectedTopicIds.size}টি ডিলিট
                </Button>
              )}
              {topics.length > 0 && (
                <Button variant="outline" size="sm" className="gap-2 text-destructive border-destructive/40" onClick={() => setDeleteAllOpen(true)}>
                  <Trash2 className="w-4 h-4" /> এই অধ্যায়ের সব টপিক ডিলিট
                </Button>
              )}
            </div>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        aria-label="সব টপিক নির্বাচন করুন"
                        checked={topics.length > 0 && selectedTopicIds.size === topics.length ? true : selectedTopicIds.size > 0 ? "indeterminate" : false}
                        onCheckedChange={(checked) => toggleAllTopics(checked === true)}
                      />
                    </TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>নাম</TableHead>
                    <TableHead className="text-right">অ্যাকশন</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topics.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <Checkbox
                          aria-label={`${t.name} নির্বাচন করুন`}
                          checked={selectedTopicIds.has(t.id)}
                          onCheckedChange={(checked) => toggleTopic(t.id, checked === true)}
                        />
                      </TableCell>
                      <TableCell>{t.id}</TableCell>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => navigate(`/admin/topic-questions?topic_id=${t.id}&topic_name=${encodeURIComponent(t.name)}&chapter_name=${encodeURIComponent(chapterName)}`)}
                        >
                          <BookOpen className="w-3.5 h-3.5" /> প্রশ্ন
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {topics.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">কোনো টপিক নেই</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* Add/Edit Topic Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editItem ? "সম্পাদনা" : "নতুন টপিক যোগ করুন (একসাথে অনেকগুলো)"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {!editItem && (
              <>
                <div>
                  <Label className="text-xs">শ্রেণী *</Label>
                  <Select value={modalClassId} onValueChange={setModalClassId}>
                    <SelectTrigger><SelectValue placeholder="শ্রেণী নির্বাচন করুন" /></SelectTrigger>
                    <SelectContent>
                      {classes.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">বিষয় *</Label>
                  <Select value={modalSubjectId} onValueChange={setModalSubjectId} disabled={!modalClassId}>
                    <SelectTrigger>
                      {modalLoadingSub ? <Loader2 className="w-4 h-4 animate-spin" /> : <SelectValue placeholder="বিষয় নির্বাচন করুন" />}
                    </SelectTrigger>
                    <SelectContent>
                      {modalSubjects.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">অধ্যায় *</Label>
                  <Select value={modalChapterId} onValueChange={setModalChapterId} disabled={!modalSubjectId}>
                    <SelectTrigger>
                      {modalLoadingCh ? <Loader2 className="w-4 h-4 animate-spin" /> : <SelectValue placeholder="অধ্যায় নির্বাচন করুন" />}
                    </SelectTrigger>
                    <SelectContent>
                      {modalChapters.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            {editItem ? (
              <div>
                <Label className="text-xs">টপিকের নাম *</Label>
                <Input placeholder="টপিকের নাম" value={formName} onChange={(e) => setFormName(e.target.value)} />
              </div>
            ) : (
              <div>
                <Label className="text-xs">টপিকের নাম (প্রতি লাইনে একটি)</Label>
                <textarea
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background font-mono min-h-[180px]"
                  placeholder={"টপিক ১\nটপিক ২\nটপিক ৩"}
                  value={bulkNames}
                  onChange={(e) => setBulkNames(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {bulkNames.split("\n").map((s) => s.trim()).filter(Boolean).length} টি এন্ট্রি
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>বাতিল</Button>
            <Button onClick={handleSave} className="gradient-green text-primary-foreground border-0">
              {editItem ? "আপডেট" : "সব যোগ করুন"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteAllOpen} onOpenChange={(open) => { if (!deletingAll) setDeleteAllOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>এই অধ্যায়ের সব টপিক ডিলিট করবেন?</AlertDialogTitle>
            <AlertDialogDescription>
              “{chapterName}” অধ্যায়ের {topics.length}টি টপিক স্থায়ীভাবে মুছে যাবে। প্রশ্নগুলো মুছবে না, তবে সেগুলোর টপিক সংযোগ সরিয়ে যাবে। এই কাজ ফিরিয়ে আনা যাবে না।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAll}>বাতিল</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingAll}
              onClick={(event) => { event.preventDefault(); void handleDeleteAll(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingAll ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> ডিলিট হচ্ছে...</> : `সব ${topics.length}টি ডিলিট করুন`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteSelectedOpen} onOpenChange={(open) => { if (!deletingSelected) setDeleteSelectedOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>নির্বাচিত টপিকগুলো ডিলিট করবেন?</AlertDialogTitle>
            <AlertDialogDescription>
              নির্বাচিত {selectedTopicIds.size}টি টপিক স্থায়ীভাবে মুছে যাবে। প্রশ্নগুলো মুছবে না, তবে সেগুলোর টপিক সংযোগ সরিয়ে যাবে। এই কাজ ফিরিয়ে আনা যাবে না।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingSelected}>বাতিল</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingSelected}
              onClick={(event) => { event.preventDefault(); void handleDeleteSelected(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingSelected ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> ডিলিট হচ্ছে...</> : `নির্বাচিত ${selectedTopicIds.size}টি ডিলিট করুন`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
