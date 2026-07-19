import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Shield, ShieldOff, Settings, Ban, Trash2, UserCheck, Search, X, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ADMIN_PAGE_GROUPS = [
  {
    label: "একাডেমিক ম্যানেজমেন্ট",
    pages: [
      { value: "/admin", label: "ড্যাশবোর্ড" },
      { value: "/admin/classes", label: "শ্রেণী" },
      { value: "/admin/subjects", label: "বিষয়" },
      { value: "/admin/chapters", label: "অধ্যায়" },
      { value: "/admin/questions", label: "প্রশ্ন" },
      { value: "/admin/topics", label: "টপিক" },
      { value: "/admin/suggestions", label: "সাজেশন" },
    ],
  },
  {
    label: "কন্টেন্ট ম্যানেজমেন্ট",
    pages: [
      { value: "/admin/announcements", label: "অ্যানাউন্সমেন্ট" },
      { value: "/admin/faqs", label: "FAQ" },
      { value: "/admin/reviews", label: "রিভিউ" },
      { value: "/admin/coupons", label: "কুপন" },
      { value: "/admin/packages", label: "প্যাকেজ" },
    ],
  },
  {
    label: "রিপোর্ট ম্যানেজমেন্ট",
    pages: [
      { value: "/admin/question-reports", label: "প্রশ্নের রিপোর্ট" },
      { value: "/admin/feedback", label: "মতামত" },
    ],
  },
  {
    label: "ইউজার ম্যানেজমেন্ট",
    pages: [
      { value: "/admin/teachers", label: "শিক্ষক" },
      { value: "/admin/institutes", label: "প্রতিষ্ঠান" },
      { value: "/admin/subscriptions", label: "সাবস্ক্রিপশন ও পেমেন্ট" },
    ],
  },
];

const ADMIN_PAGES = ADMIN_PAGE_GROUPS.flatMap(g => g.pages);

export default function AdminTeachers() {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [dialogMode, setDialogMode] = useState<"promote" | "permissions" | null>(null);
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: "ban" | "unban" | "delete"; teacher: any } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Subject permission states
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [existingPermissions, setExistingPermissions] = useState<any[]>([]);
  const [newPermClassId, setNewPermClassId] = useState<string>("");
  const [newPermSubjectId, setNewPermSubjectId] = useState<string>("");

  const fetchData = async () => {
    const [{ data: t }, { data: r }, { data: c }, { data: s }] = await Promise.all([
      supabase.from("teachers").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*"),
      supabase.from("classes").select("*").order("name"),
      supabase.from("subjects").select("*").order("name"),
    ]);
    setTeachers(t || []);
    setRoles(r || []);
    setClasses(c || []);
    setSubjects(s || []);
  };

  useEffect(() => { fetchData(); }, []);

  const getRole = (userId: string) => roles.find(r => r.user_id === userId);
  const isAdmin = (userId: string) => getRole(userId)?.role === "admin";
  const isDeveloper = (userId: string) => roles.some(r => r.user_id === userId && r.role === "developer");

  // Hide developer users from the list (stealth mode)
  const visibleTeachers = teachers.filter(t => !isDeveloper(t.id));

  const filteredTeachers = searchQuery.trim()
    ? visibleTeachers.filter(t => t.email?.toLowerCase().includes(searchQuery.toLowerCase().trim()))
    : visibleTeachers;

  const fetchPermissions = async (userId: string) => {
    const { data } = await supabase.from("user_permissions").select("*").eq("user_id", userId);
    setExistingPermissions(data || []);
  };

  const filteredSubjectsForPerm = subjects.filter(s => String(s.class_id) === newPermClassId);

  const openPromoteDialog = (teacher: any) => {
    setSelectedTeacher(teacher);
    setSelectedPages(ADMIN_PAGES.map(p => p.value));
    setExistingPermissions([]);
    setNewPermClassId("");
    setNewPermSubjectId("");
    fetchPermissions(teacher.id);
    setDialogMode("promote");
  };

  const openPermissionsDialog = (teacher: any) => {
    setSelectedTeacher(teacher);
    const role = getRole(teacher.id);
    const pages = role?.allowed_pages || ADMIN_PAGES.map(p => p.value);
    setSelectedPages(pages);
    setNewPermClassId("");
    setNewPermSubjectId("");
    fetchPermissions(teacher.id);
    setDialogMode("permissions");
  };

  const togglePage = (page: string) => {
    setSelectedPages(prev =>
      prev.includes(page) ? prev.filter(p => p !== page) : [...prev, page]
    );
  };

  const handlePromote = async () => {
    if (!selectedTeacher || selectedPages.length === 0) {
      toast.error("অন্তত একটি পেইজ সিলেক্ট করুন");
      return;
    }
    setSaving(true);
    const existingRole = getRole(selectedTeacher.id);
    if (existingRole) {
      await supabase.from("user_roles").update({ role: "admin", allowed_pages: selectedPages }).eq("id", existingRole.id);
    } else {
      await supabase.from("user_roles").insert({ user_id: selectedTeacher.id, role: "admin", allowed_pages: selectedPages });
    }
    toast.success(`${selectedTeacher.full_name || selectedTeacher.email} কে এ্যাডমিন করা হয়েছে`);
    setSaving(false);
    setDialogMode(null);
    fetchData();
  };

  const handleUpdatePermissions = async () => {
    if (!selectedTeacher || selectedPages.length === 0) {
      toast.error("অন্তত একটি পেইজ সিলেক্ট করুন");
      return;
    }
    setSaving(true);
    const role = getRole(selectedTeacher.id);
    if (role) {
      await supabase.from("user_roles").update({ allowed_pages: selectedPages }).eq("id", role.id);
    }
    toast.success("পারমিশন আপডেট হয়েছে");
    setSaving(false);
    setDialogMode(null);
    fetchData();
  };

  const handleAddSubjectPermission = async () => {
    if (!selectedTeacher || !newPermClassId || !newPermSubjectId) {
      toast.error("শ্রেণী ও বিষয় সিলেক্ট করুন");
      return;
    }
    const exists = existingPermissions.some(
      p => String(p.class_id) === newPermClassId && String(p.subject_id) === newPermSubjectId
    );
    if (exists) {
      toast.error("এই পারমিশন আগে থেকেই আছে");
      return;
    }
    const { error } = await supabase.from("user_permissions").insert({
      user_id: selectedTeacher.id,
      class_id: Number(newPermClassId),
      subject_id: Number(newPermSubjectId),
    });
    if (error) { toast.error("যোগ করা যায়নি"); return; }
    toast.success("বিষয় পারমিশন যোগ হয়েছে");
    setNewPermClassId("");
    setNewPermSubjectId("");
    fetchPermissions(selectedTeacher.id);
  };

  const handleRemoveSubjectPermission = async (permId: number) => {
    await supabase.from("user_permissions").delete().eq("id", permId);
    toast.success("বিষয় পারমিশন সরানো হয়েছে");
    if (selectedTeacher) fetchPermissions(selectedTeacher.id);
  };

  const handleDemote = async (teacher: any) => {
    const role = getRole(teacher.id);
    if (role) {
      await supabase.from("user_roles").update({ role: "user", allowed_pages: null }).eq("id", role.id);
      toast.success(`${teacher.full_name || teacher.email} থেকে এ্যাডমিন রোল সরানো হয়েছে`);
      fetchData();
    }
  };

  const handleBanToggle = async () => {
    if (!confirmAction) return;
    const { teacher, type } = confirmAction;
    const newStatus = type === "ban";
    const { error } = await supabase.from("teachers").update({ is_banned: newStatus }).eq("id", teacher.id);
    if (error) { toast.error("ব্যর্থ হয়েছে"); }
    else { toast.success(newStatus ? `${teacher.full_name || teacher.email} ব্যান করা হয়েছে` : `${teacher.full_name || teacher.email} আনব্যান করা হয়েছে`); }
    setConfirmAction(null);
    fetchData();
  };

  const handleDelete = async () => {
    if (!confirmAction) return;
    const { teacher } = confirmAction;
    const { error } = await supabase.rpc("admin_delete_user", { _user_id: teacher.id });
    if (error) { toast.error("ডিলিট ব্যর্থ: " + error.message); }
    else { toast.success(`${teacher.full_name || teacher.email} ডিলিট করা হয়েছে`); }
    setConfirmAction(null);
    fetchData();
  };

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">শিক্ষক ম্যানেজমেন্ট</h1>

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="ইমেইল দিয়ে খুঁজুন..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 border-primary/30 focus-visible:ring-primary/40"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>নাম</TableHead>
                <TableHead>ইমেইল</TableHead>
                <TableHead>রোল</TableHead>
                <TableHead>স্ট্যাটাস</TableHead>
                <TableHead>যোগদান</TableHead>
                <TableHead className="text-right">অ্যাকশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTeachers.map((t) => (
                <TableRow key={t.id} className={t.is_banned ? "opacity-60" : ""}>
                  <TableCell className="font-medium">{t.full_name || "—"}</TableCell>
                  <TableCell>{t.email}</TableCell>
                  <TableCell>
                    {isAdmin(t.id) ? (
                      <Badge className="bg-primary/10 text-primary border-primary/20">এ্যাডমিন</Badge>
                    ) : (
                      <Badge variant="secondary">ইউজার</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {t.is_banned ? (
                      <Badge variant="destructive">ব্যানড</Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-700 border-green-200">সক্রিয়</Badge>
                    )}
                  </TableCell>
                  <TableCell>{new Date(t.created_at).toLocaleDateString("bn-BD")}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {isAdmin(t.id) ? (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => openPermissionsDialog(t)} title="পেইজ পারমিশন">
                            <Settings className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDemote(t)} title="এ্যাডমিন থেকে সরান" className="text-destructive hover:text-destructive">
                            <ShieldOff className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => openPromoteDialog(t)} title="এ্যাডমিন বানান">
                          <Shield className="w-4 h-4" />
                        </Button>
                      )}
                      {t.is_banned ? (
                        <Button variant="ghost" size="sm" onClick={() => setConfirmAction({ type: "unban", teacher: t })} title="আনব্যান করুন" className="text-green-600 hover:text-green-700">
                          <UserCheck className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => setConfirmAction({ type: "ban", teacher: t })} title="ব্যান করুন" className="text-orange-600 hover:text-orange-700">
                          <Ban className="w-4 h-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => setConfirmAction({ type: "delete", teacher: t })} title="ডিলিট করুন" className="text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredTeachers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {searchQuery ? "কোনো ফলাফল পাওয়া যায়নি" : "কোনো শিক্ষক নেই"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Admin Promote / Page Permissions Dialog */}
      <Dialog open={dialogMode === "promote" || dialogMode === "permissions"} onOpenChange={() => setDialogMode(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "promote" ? "এ্যাডমিন বানান" : "পারমিশন পরিবর্তন"}
            </DialogTitle>
            <DialogDescription>
              {selectedTeacher?.full_name || selectedTeacher?.email} — পেইজ ও বিষয় পারমিশন সেট করুন
            </DialogDescription>
          </DialogHeader>

          {/* Page Permissions */}
          <div>
            <h4 className="font-semibold text-sm mb-2">পেইজ পারমিশন</h4>
            <div className="space-y-4">
              {ADMIN_PAGE_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{group.label}</p>
                  <div className="space-y-1.5 pl-1">
                    {group.pages.map((page) => (
                      <div key={page.value} className="flex items-center gap-3">
                        <Checkbox
                          id={page.value}
                          checked={selectedPages.includes(page.value)}
                          onCheckedChange={() => togglePage(page.value)}
                        />
                        <Label htmlFor={page.value} className="cursor-pointer text-sm">{page.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedPages(ADMIN_PAGES.map(p => p.value))}>সব সিলেক্ট</Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedPages([])}>সব বাদ দিন</Button>
            </div>
          </div>

          <Separator />

          {/* Subject Permissions */}
          <div>
            <h4 className="font-semibold text-sm mb-2">বিষয় পারমিশন</h4>
            <p className="text-xs text-muted-foreground mb-3">কোন শ্রেণীর কোন বিষয়ে অ্যাক্সেস থাকবে নির্ধারণ করুন</p>

            {/* Existing permissions list */}
            {existingPermissions.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {existingPermissions.map((perm) => {
                  const cls = classes.find(c => c.id === perm.class_id);
                  const sub = subjects.find(s => s.id === perm.subject_id);
                  return (
                    <div key={perm.id} className="flex items-center justify-between bg-muted/50 rounded px-3 py-1.5 text-sm">
                      <span>{cls?.name || "?"} → {sub?.name || "?"}</span>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => handleRemoveSubjectPermission(perm.id)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add new permission */}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-xs">শ্রেণী</Label>
                <Select value={newPermClassId} onValueChange={(v) => { setNewPermClassId(v); setNewPermSubjectId(""); }}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="শ্রেণী বাছুন" /></SelectTrigger>
                  <SelectContent>
                    {classes.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label className="text-xs">বিষয়</Label>
                <Select value={newPermSubjectId} onValueChange={setNewPermSubjectId} disabled={!newPermClassId}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="বিষয় বাছুন" /></SelectTrigger>
                  <SelectContent>
                    {filteredSubjectsForPerm.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" variant="outline" className="h-9" onClick={handleAddSubjectPermission} disabled={!newPermClassId || !newPermSubjectId}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)}>বাতিল</Button>
            <Button
              onClick={dialogMode === "promote" ? handlePromote : handleUpdatePermissions}
              disabled={saving || selectedPages.length === 0}
            >
              {saving ? "সেভ হচ্ছে..." : "সংরক্ষণ করুন"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Action Dialog */}
      <AlertDialog open={confirmAction !== null} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "delete" ? "ইউজার ডিলিট করুন" : confirmAction?.type === "ban" ? "ইউজার ব্যান করুন" : "ইউজার আনব্যান করুন"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "delete"
                ? `${confirmAction?.teacher?.full_name || confirmAction?.teacher?.email} এর সমস্ত ডেটা (প্রশ্ন, প্রতিষ্ঠান, সাবস্ক্রিপশন) সহ স্থায়ীভাবে মুছে ফেলা হবে। এটি ফিরিয়ে আনা যাবে না!`
                : confirmAction?.type === "ban"
                ? `${confirmAction?.teacher?.full_name || confirmAction?.teacher?.email} কে ব্যান করলে সে আর ড্যাশবোর্ডে প্রবেশ করতে পারবে না।`
                : `${confirmAction?.teacher?.full_name || confirmAction?.teacher?.email} কে আনব্যান করলে সে আবার ড্যাশবোর্ডে প্রবেশ করতে পারবে।`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAction?.type === "delete" ? handleDelete : handleBanToggle}
              className={confirmAction?.type === "unban" ? "" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}
            >
              {confirmAction?.type === "delete" ? "হ্যাঁ, ডিলিট করুন" : confirmAction?.type === "ban" ? "হ্যাঁ, ব্যান করুন" : "হ্যাঁ, আনব্যান করুন"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
