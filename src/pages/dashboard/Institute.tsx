import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { User, Pencil, Lock, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getDivisions, getDistricts, getUpazilas } from "@/data/bangladeshGeo";
import { normalizeBdPhone, isValidBdPhone, BD_PHONE_ERROR } from "@/lib/phone";

export default function Institute() {
  const { user } = useAuth();
  const [institute, setInstitute] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [form, setForm] = useState({ name: "", upazila: "", district: "", division: "", phone: "", specific_address: "" });

  const isEditLocked = (): { locked: boolean; daysLeft: number } => {
    if (!institute?.last_edited_at) return { locked: false, daysLeft: 0 };
    const lastEdit = new Date(institute.last_edited_at);
    const now = new Date();
    const diffMs = now.getTime() - lastEdit.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const daysLeft = 30 - diffDays;
    return { locked: daysLeft > 0, daysLeft: Math.max(0, daysLeft) };
  };

  const handleEditClick = () => {
    const { locked, daysLeft } = isEditLocked();
    if (locked) {
      toast.error(`আপনি আরও ${daysLeft} দিন পর তথ্য পরিবর্তন করতে পারবেন।`);
      return;
    }
    setShowWarning(true);
  };

  useEffect(() => {
    if (!user) return;
    supabase.from("institutes").select("*").eq("owner_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setInstitute(data);
          setForm({
            name: data.name,
            upazila: data.upazila || "",
            district: data.district || "",
            division: data.division || "",
            phone: (data as any).phone || "",
            specific_address: (data as any).specific_address || "",
          });
        }
      });
  }, [user]);

  const divisions = getDivisions();
  const districts = form.division ? getDistricts(form.division) : [];
  const upazilas = form.division && form.district ? getUpazilas(form.division, form.district) : [];

  const handleDivisionChange = (val: string) => {
    setForm(prev => ({ ...prev, division: val, district: "", upazila: "" }));
  };

  const handleDistrictChange = (val: string) => {
    setForm(prev => ({ ...prev, district: val, upazila: "" }));
  };

  const handleSave = async () => {
    if (!user) return;
    const updateData = { ...form, last_edited_at: new Date().toISOString() };
    if (institute) {
      const { error } = await supabase.from("institutes").update(updateData).eq("id", institute.id);
      if (error) { toast.error("আপডেট ব্যর্থ"); return; }
      setInstitute({ ...institute, ...updateData });
    } else {
      const { data, error } = await supabase.from("institutes").insert({ ...updateData, owner_id: user.id }).select().single();
      if (error) { toast.error("সংরক্ষণ ব্যর্থ"); return; }
      setInstitute(data);
    }
    setEditing(false);
    toast.success("সংরক্ষিত হয়েছে!");
  };

  const avatarUrl = user?.user_metadata?.avatar_url;
  const fullName = user?.user_metadata?.full_name || "শিক্ষক";
  const email = user?.email;

  return (
    <div className="space-y-6">
      <div className="gradient-hero rounded-2xl p-8 text-center text-white">
        <h1 className="font-heading text-2xl font-bold">{institute?.name || "আপনার প্রতিষ্ঠান"}</h1>
      </div>

      <div>
        <h2 className="font-heading text-xl font-bold text-center mb-4">আমাদের শিক্ষকবৃন্দ</h2>
        <Card className="max-w-xs mx-auto">
          <CardContent className="p-6 text-center">
            {avatarUrl ? (
              <img src={avatarUrl} alt={fullName} className="w-20 h-20 rounded-full mx-auto mb-3 object-cover ring-2 ring-primary/20" />
            ) : (
              <div className="w-20 h-20 rounded-full gradient-green mx-auto flex items-center justify-center mb-3">
                <User className="w-10 h-10 text-primary-foreground" />
              </div>
            )}
            <h3 className="font-heading font-bold">{fullName}</h3>
            <p className="text-sm text-muted-foreground">{email}</p>
            <span className="inline-block mt-2 text-xs font-medium text-primary border border-primary/30 rounded-full px-3 py-0.5">Owner</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold text-center flex-1">ঠিকানা</h3>
            {!editing && (
              <Button variant="ghost" size="icon" onClick={handleEditClick} title={isEditLocked().locked ? `আরও ${isEditLocked().daysLeft} দিন পর এডিট করতে পারবেন` : "এডিট করুন"}>
                {isEditLocked().locked ? <Lock className="w-4 h-4 text-muted-foreground" /> : <Pencil className="w-4 h-4" />}
              </Button>
            )}
          </div>
          {isEditLocked().locked && !editing && (
            <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
              <Lock className="w-3 h-3" /> আরও {isEditLocked().daysLeft} দিন পর তথ্য পরিবর্তন করতে পারবেন
            </p>
          )}
          {editing ? (
            <div className="space-y-3">
              <div><Label>প্রতিষ্ঠানের নাম</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div>
                <Label>বিভাগ</Label>
                <Select value={form.division} onValueChange={handleDivisionChange}>
                  <SelectTrigger><SelectValue placeholder="বিভাগ" /></SelectTrigger>
                  <SelectContent>{divisions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>জেলা</Label>
                <Select value={form.district} onValueChange={handleDistrictChange} disabled={!form.division}>
                  <SelectTrigger><SelectValue placeholder="জেলা" /></SelectTrigger>
                  <SelectContent>{districts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>উপজেলা</Label>
                <Select value={form.upazila} onValueChange={(val) => setForm({ ...form, upazila: val })} disabled={!form.district}>
                  <SelectTrigger><SelectValue placeholder="উপজেলা" /></SelectTrigger>
                  <SelectContent>{upazilas.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>ফোন নম্বর</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>নির্দিষ্ট ঠিকানা</Label><Textarea value={form.specific_address} onChange={(e) => setForm({ ...form, specific_address: e.target.value })} rows={2} /></div>
              <Button onClick={handleSave} className="gradient-green text-primary-foreground border-0">সংরক্ষণ করুন</Button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-border"><td className="py-2.5 text-muted-foreground w-28">উপজেলা</td><td className="py-2.5 font-medium">{institute?.upazila || "—"}</td></tr>
                <tr className="border-b border-border"><td className="py-2.5 text-muted-foreground">জেলা</td><td className="py-2.5 font-medium">{institute?.district || "—"}</td></tr>
                <tr className="border-b border-border"><td className="py-2.5 text-muted-foreground">বিভাগ</td><td className="py-2.5 font-medium">{institute?.division || "—"}</td></tr>
                <tr className="border-b border-border"><td className="py-2.5 text-muted-foreground">ফোন</td><td className="py-2.5 font-medium">{(institute as any)?.phone || "—"}</td></tr>
                <tr><td className="py-2.5 text-muted-foreground">ঠিকানা</td><td className="py-2.5 font-medium">{(institute as any)?.specific_address || "—"}</td></tr>
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              সতর্কতা
            </AlertDialogTitle>
            <AlertDialogDescription>
              আপনি যদি এখন প্রতিষ্ঠানের তথ্য পরিবর্তন করেন, তাহলে আগামী <strong>৩০ দিন</strong> আর কোনো পরিবর্তন করতে পারবেন না। আপনি কি নিশ্চিত?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction onClick={() => setEditing(true)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              হ্যাঁ, এডিট করতে চাই
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
