import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Shield, ShieldOff, Settings } from "lucide-react";
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

export default function AdminTeachers() {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [dialogMode, setDialogMode] = useState<"promote" | "permissions" | null>(null);
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    const [{ data: t }, { data: r }] = await Promise.all([
      supabase.from("teachers").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*"),
    ]);
    setTeachers(t || []);
    setRoles(r || []);
  };

  useEffect(() => { fetchData(); }, []);

  const getRole = (userId: string) => roles.find(r => r.user_id === userId);
  const isAdmin = (userId: string) => getRole(userId)?.role === "admin";

  const openPromoteDialog = (teacher: any) => {
    setSelectedTeacher(teacher);
    setSelectedPages(ADMIN_PAGES.map(p => p.value)); // default all selected
    setDialogMode("promote");
  };

  const openPermissionsDialog = (teacher: any) => {
    setSelectedTeacher(teacher);
    const role = getRole(teacher.id);
    const pages = role?.allowed_pages || ADMIN_PAGES.map(p => p.value);
    setSelectedPages(pages);
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

  const handleDemote = async (teacher: any) => {
    const role = getRole(teacher.id);
    if (role) {
      await supabase.from("user_roles").update({ role: "user", allowed_pages: null }).eq("id", role.id);
      toast.success(`${teacher.full_name || teacher.email} থেকে এ্যাডমিন রোল সরানো হয়েছে`);
      fetchData();
    }
  };

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">শিক্ষক ম্যানেজমেন্ট</h1>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>নাম</TableHead>
                <TableHead>ইমেইল</TableHead>
                <TableHead>রোল</TableHead>
                <TableHead>যোগদান</TableHead>
                <TableHead className="text-right">অ্যাকশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.full_name || "—"}</TableCell>
                  <TableCell>{t.email}</TableCell>
                  <TableCell>
                    {isAdmin(t.id) ? (
                      <Badge className="bg-primary/10 text-primary border-primary/20">এ্যাডমিন</Badge>
                    ) : (
                      <Badge variant="secondary">ইউজার</Badge>
                    )}
                  </TableCell>
                  <TableCell>{new Date(t.created_at).toLocaleDateString("bn-BD")}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {isAdmin(t.id) ? (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => openPermissionsDialog(t)} title="পারমিশন পরিবর্তন">
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
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {teachers.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">কোনো শিক্ষক নেই</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogMode !== null} onOpenChange={() => setDialogMode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "promote" ? "এ্যাডমিন বানান" : "পারমিশন পরিবর্তন"}
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
    </div>
  );
}
