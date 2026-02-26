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
import { Shield, ShieldOff, Settings, Ban, Trash2, UserCheck, Search, Loader2, BookOpen, X, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ADMIN_PAGES = [
  { value: "/admin", label: "ড্যাশবোর্ড" },
  { value: "/admin/classes", label: "শ্রেণী" },
  { value: "/admin/subjects", label: "বিষয়" },
  { value: "/admin/chapters", label: "অধ্যায়" },
  { value: "/admin/categories", label: "প্রশ্নের ক্যাটাগরি" },
  { value: "/admin/questions", label: "প্রশ্ন" },
  { value: "/admin/teachers", label: "শিক্ষক" },
  { value: "/admin/institutes", label: "প্রতিষ্ঠান" },
  { value: "/admin/subscriptions", label: "সাবস্ক্রিপশন" },
  { value: "/admin/topics", label: "টপিক" },
  { value: "/admin/feedback", label: "মতামত" },
];

interface Permission {
  id: number;
  user_id: string;
  class_id: number;
  subject_id: number;
}

export default function AdminTeachers() {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [classes, setClasses] = useState<{ id: number; name: string }[]>([]);
  const [allSubjects, setAllSubjects] = useState<{ id: number; name: string; class_id: number }[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [dialogMode, setDialogMode] = useState<"promote" | "permissions" | "subject_permissions" | null>(null);
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: "ban" | "unban" | "delete"; teacher: any } | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Subject permission modal state
  const [permClassId, setPermClassId] = useState("");
  const [permSubjectId, setPermSubjectId] = useState("");
  const [teacherPermissions, setTeacherPermissions] = useState<Permission[]>([]);
  const [savingPerm, setSavingPerm] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [filteredSubjects, setFilteredSubjects] = useState<{ id: number; name: string; class_id: number }[]>([]);

  const fetchData = async () => {
    const [{ data: t }, { data: r }, { data: p }, { data: c }, { data: s }] = await Promise.all([
      supabase.from("teachers").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*"),
      supabase.from("user_permissions").select("*"),
      supabase.from("classes").select("id, name").order("name"),
      supabase.from("subjects").select("id, name, class_id").order("name"),
    ]);
    setTeachers(t || []);
    setRoles(r || []);
    setPermissions(p || []);
    setClasses(c || []);
    setAllSubjects(s || []);
  };

  useEffect(() => { fetchData(); }, []);

  // Filter subjects when class changes in permission modal
  useEffect(() => {
    if (permClassId) {
      setLoadingSubjects(true);
      const filtered = allSubjects.filter(s => s.class_id === Number(permClassId));
      setFilteredSubjects(filtered);
      setLoadingSubjects(false);
      setPermSubjectId("");
    } else {
      setFilteredSubjects([]);
      setPermSubjectId("");
    }
  }, [permClassId, allSubjects]);

  const getRole = (userId: string) => roles.find(r => r.user_id === userId);
  const isAdmin = (userId: string) => getRole(userId)?.role === "admin";

  const getUserPermissions = (userId: string) => permissions.filter(p => p.user_id === userId);

  const getPermissionLabel = (perm: Permission) => {
    const cls = classes.find(c => c.id === perm.class_id);
    const sub = allSubjects.find(s => s.id === perm.subject_id);
    return `${cls?.name || "?"}: ${sub?.name || "?"}`;
  };

  // Search filter
  const filteredTeachers = searchQuery.trim()
    ? teachers.filter(t => t.email?.toLowerCase().includes(searchQuery.toLowerCase().trim()))
    : teachers;

  const openPromoteDialog = (teacher: any) => {
    setSelectedTeacher(teacher);
    setSelectedPages(ADMIN_PAGES.map(p => p.value));
    setDialogMode("promote");
  };

  const openPermissionsDialog = (teacher: any) => {
    setSelectedTeacher(teacher);
    const role = getRole(teacher.id);
    const pages = role?.allowed_pages || ADMIN_PAGES.map(p => p.value);
    setSelectedPages(pages);
    setDialogMode("permissions");
  };

  const openSubjectPermissionsDialog = (teacher: any) => {
    setSelectedTeacher(teacher);
    setTeacherPermissions(getUserPermissions(teacher.id));
    setPermClassId("");
    setPermSubjectId("");
    setDialogMode("subject_permissions");
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

  // Subject permission handlers
  const handleAddPermission = async () => {
    if (!selectedTeacher || !permClassId || !permSubjectId) {
      toast.error("শ্রেণী ও বিষয় সিলেক্ট করুন");
      return;
    }
    // Check duplicate
    const exists = teacherPermissions.some(
      p => p.class_id === Number(permClassId) && p.subject_id === Number(permSubjectId)
    );
    if (exists) {
      toast.error("এই পারমিশন ইতিমধ্যে আছে");
      return;
    }
    setSavingPerm(true);
    const { data, error } = await supabase.from("user_permissions").insert({
      user_id: selectedTeacher.id,
      class_id: Number(permClassId),
      subject_id: Number(permSubjectId),
    }).select().single();
    if (error) {
      toast.error("পারমিশন যোগ ব্যর্থ: " + error.message);
    } else if (data) {
      setTeacherPermissions(prev => [...prev, data as Permission]);
      toast.success("পারমিশন যোগ হয়েছে");
    }
    setPermClassId("");
    setPermSubjectId("");
    setSavingPerm(false);
    fetchData();
  };

  const handleRemovePermission = async (permId: number) => {
    const { error } = await supabase.from("user_permissions").delete().eq("id", permId);
    if (error) {
      toast.error("পারমিশন মুছতে ব্যর্থ");
    } else {
      setTeacherPermissions(prev => prev.filter(p => p.id !== permId));
      toast.success("পারমিশন সরানো হয়েছে");
      fetchData();
    }
  };

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">শিক্ষক ম্যানেজমেন্ট</h1>

      {/* Search Box */}
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
              {filteredTeachers.map((t) => {
                return (
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
                );
              })}
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "promote" ? "এ্যাডমিন বানান" : "পেইজ পারমিশন পরিবর্তন"}
            </DialogTitle>
            <DialogDescription>
              {selectedTeacher?.full_name || selectedTeacher?.email} — কোন কোন পেইজে অ্যাক্সেস থাকবে সিলেক্ট করুন
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-[50vh] overflow-y-auto">
            {ADMIN_PAGES.map((page) => (
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
          <div className="flex items-center gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedPages(ADMIN_PAGES.map(p => p.value))}>সব সিলেক্ট</Button>
            <Button variant="outline" size="sm" onClick={() => setSelectedPages([])}>সব বাদ দিন</Button>
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

      {/* Subject-wise Permissions Dialog */}
      <Dialog open={dialogMode === "subject_permissions"} onOpenChange={() => setDialogMode(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>বিষয় পারমিশন দিন</DialogTitle>
            <DialogDescription>
              {selectedTeacher?.full_name || selectedTeacher?.email} — নির্দিষ্ট শ্রেণী ও বিষয়ে অ্যাক্সেস দিন
            </DialogDescription>
          </DialogHeader>

          {/* Current permissions list */}
          {teacherPermissions.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">বর্তমান পারমিশনসমূহ:</Label>
              <div className="flex flex-wrap gap-2">
                {teacherPermissions.map(p => (
                  <Badge key={p.id} variant="outline" className="border-primary/30 text-primary gap-1 pr-1">
                    {getPermissionLabel(p)}
                    <button
                      onClick={() => handleRemovePermission(p.id)}
                      className="ml-1 rounded-full hover:bg-destructive/10 p-0.5"
                    >
                      <X className="w-3 h-3 text-destructive" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Add new permission */}
          <div className="space-y-3 pt-2 border-t">
            <Label className="text-sm font-medium">নতুন পারমিশন যোগ করুন:</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">শ্রেণী</Label>
                <select
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                  value={permClassId}
                  onChange={(e) => setPermClassId(e.target.value)}
                >
                  <option value="">শ্রেণী নির্বাচন</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">বিষয়</Label>
                {loadingSubjects ? (
                  <div className="flex items-center justify-center h-9">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  </div>
                ) : (
                  <select
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background disabled:opacity-50"
                    value={permSubjectId}
                    onChange={(e) => setPermSubjectId(e.target.value)}
                    disabled={!permClassId}
                  >
                    <option value="">বিষয় নির্বাচন</option>
                    {filteredSubjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <Button
              onClick={handleAddPermission}
              disabled={savingPerm || !permClassId || !permSubjectId}
              size="sm"
              className="gap-1"
            >
              {savingPerm ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              পারমিশন যোগ করুন
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)}>বন্ধ করুন</Button>
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
