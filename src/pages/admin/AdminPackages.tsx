import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Loader2, Package, Filter, Clock } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { ALL_SUBJECTS_LABEL, planCoversSelection } from "@/lib/subscriptionMatcher";

interface PricingPackage {
  id: number;
  duration_days: number | null;
  subject_ids: number[] | null;
  type: string;
  class_name: string;
  subject_name: string;
  price: number;
  sort_order: number;
  is_active: boolean;
  is_coming_soon: boolean;
}

const emptyForm = {
  duration_days: 365,
  subject_ids: [] as number[],
  type: "class" as string,
  class_name: "",
  subject_name: "সকল বিষয়",
  price: 0,
  sort_order: 0,
  is_active: true,
  is_coming_soon: false,
};

export default function AdminPackages() {
  const [packages, setPackages] = useState<PricingPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PricingPackage | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [classes, setClasses] = useState<{id:number;name:string}[]>([]);
  const [subjects, setSubjects] = useState<{id:number;name:string;class_id:number}[]>([]);
  const [allSubjects, setAllSubjects] = useState(true);
  const [subjectsChanged, setSubjectsChanged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterClass, setFilterClass] = useState("");

  const fetchPackages = async () => {
    const { data } = await supabase.from("pricing_packages").select("*").order("sort_order");
    setPackages(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchPackages();
    Promise.all([
      supabase.from("classes").select("id,name").order("id"),
      supabase.from("subjects").select("id,name,class_id").order("id"),
    ]).then(([c,s]) => {
      if (c.error || s.error) toast.error("বিষয়ের তালিকা লোড হয়নি, পেজ রিফ্রেশ করুন");
      setClasses(c.data || []); setSubjects(s.data || []);
    });
  }, []);
  const availableSubjects = subjects.filter(subject => {
    const cls = classes.find(c => c.id === subject.class_id);
    return cls && form.class_name.trim() && planCoversSelection(`${form.class_name} - ${ALL_SUBJECTS_LABEL}`, cls.name, subject.name);
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setAllSubjects(true); setSubjectsChanged(false); setModalOpen(true); };

  const openEdit = (pkg: PricingPackage) => {
    setEditing(pkg);
    setSubjectsChanged(false);
    setAllSubjects(pkg.subject_name === ALL_SUBJECTS_LABEL);
    setForm({
      duration_days: pkg.duration_days || 365,
      subject_ids: pkg.subject_ids || subjects.filter(s => pkg.subject_name.split(", ").includes(s.name)).map(s => s.id),
      type: pkg.type, class_name: pkg.class_name, subject_name: pkg.subject_name,
      price: pkg.price, sort_order: pkg.sort_order, is_active: pkg.is_active,
      is_coming_soon: pkg.is_coming_soon,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.class_name.trim()) { toast.error("শ্রেণির নাম দিন"); return; }
    if (form.price <= 0) { toast.error("মূল্য সঠিক নয়"); return; }
    if (!Number.isInteger(form.duration_days) || form.duration_days < 1 || form.duration_days > 36500) {
      toast.error("মেয়াদ ১ থেকে ৩৬৫০০ দিনের মধ্যে দিন"); return;
    }
    const chosen = availableSubjects.filter(s => form.subject_ids.includes(s.id));
    const preserveLegacySubject = editing && editing.subject_ids === null &&
      form.class_name === editing.class_name && !subjectsChanged;
    if (!allSubjects && !chosen.length && !preserveLegacySubject) { toast.error("অন্তত একটি বিষয় নির্বাচন করুন"); return; }
    setSaving(true);
    try {
      const payload = {
        type: form.type, class_name: form.class_name.trim(),
        subject_name: allSubjects ? ALL_SUBJECTS_LABEL : preserveLegacySubject ? editing.subject_name : [...new Set(chosen.map(s => s.name))].join(", "),
        subject_ids: allSubjects || preserveLegacySubject ? null : chosen.map(s => s.id),
        duration_days: form.duration_days,
        price: form.price, sort_order: form.sort_order,
        is_active: form.is_active, is_coming_soon: form.is_coming_soon,
      };
      if (editing) {
        const { error } = await supabase.from("pricing_packages").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("প্যাকেজ আপডেট হয়েছে");
      } else {
        const { error } = await supabase.from("pricing_packages").insert(payload);
        if (error) throw error;
        toast.success("নতুন প্যাকেজ যোগ হয়েছে");
      }
      setModalOpen(false);
      fetchPackages();
    } catch (err: any) { toast.error(err.message || "সমস্যা হয়েছে"); } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("এই প্যাকেজটি মুছে ফেলতে চান?")) return;
    const { error } = await supabase.from("pricing_packages").delete().eq("id", id);
    if (error) { toast.error(error.message); } else { toast.success("মুছে ফেলা হয়েছে"); fetchPackages(); }
  };

  const toggleActive = async (pkg: PricingPackage) => {
    await supabase.from("pricing_packages").update({ is_active: !pkg.is_active }).eq("id", pkg.id);
    fetchPackages();
  };

  const toggleComingSoon = async (pkg: PricingPackage) => {
    await supabase.from("pricing_packages").update({ is_coming_soon: !pkg.is_coming_soon } as any).eq("id", pkg.id);
    fetchPackages();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
          <Package className="w-6 h-6 text-primary" /> প্যাকেজ ম্যানেজমেন্ট
        </h1>
        <Button onClick={openCreate} className="gradient-green text-white border-0 gap-2">
          <Plus className="w-4 h-4" /> নতুন প্যাকেজ
        </Button>
      </div>

      {(() => {
        const uniqueClasses = [...new Set(packages.map(p => p.class_name))].sort();
        return uniqueClasses.length > 0 ? (
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select className="border border-border rounded-md px-3 py-2 text-sm bg-background" value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
              <option value="">সকল শ্রেণী</option>
              {uniqueClasses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        ) : null;
      })()}

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-heading font-semibold">ধরন</TableHead>
              <TableHead className="font-heading font-semibold">শ্রেণি</TableHead>
              <TableHead className="font-heading font-semibold">বিষয়</TableHead>
              <TableHead className="font-heading font-semibold">মূল্য</TableHead>
              <TableHead className="font-heading font-semibold">মেয়াদ</TableHead>
              <TableHead className="font-heading font-semibold">ক্রম</TableHead>
              <TableHead className="font-heading font-semibold">স্ট্যাটাস</TableHead>
              <TableHead className="font-heading font-semibold">Coming Soon</TableHead>
              <TableHead className="font-heading font-semibold text-center">অ্যাকশন</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(filterClass ? packages.filter(p => p.class_name === filterClass) : packages).map((pkg) => (
              <TableRow key={pkg.id}>
                <TableCell>
                  <Badge variant={pkg.type === "bundle" ? "default" : "secondary"}>
                    {pkg.type === "bundle" ? "বান্ডেল" : "শ্রেণি"}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">{pkg.class_name}</TableCell>
                <TableCell>{pkg.subject_name}</TableCell>
                <TableCell className="font-semibold">৳{pkg.price}</TableCell>
                <TableCell>{pkg.duration_days ? `${pkg.duration_days.toLocaleString("bn-BD")} দিন` : "১ বছর"}</TableCell>
                <TableCell>{pkg.sort_order}</TableCell>
                <TableCell><Switch checked={pkg.is_active} onCheckedChange={() => toggleActive(pkg)} /></TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch checked={pkg.is_coming_soon} onCheckedChange={() => toggleComingSoon(pkg)} />
                    {pkg.is_coming_soon && <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px]"><Clock className="w-3 h-3 mr-1" />Soon</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex justify-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(pkg)}><Pencil className="w-4 h-4 text-primary" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(pkg.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">{editing ? "প্যাকেজ এডিট করুন" : "নতুন প্যাকেজ যোগ করুন"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">ধরন</label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bundle">বান্ডেল</SelectItem>
                  <SelectItem value="class">শ্রেণি</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">শ্রেণি নাম</label>
              <Input value={form.class_name} list="package-class-options" onChange={(e) => { setSubjectsChanged(true); setForm({ ...form, class_name: e.target.value, subject_ids: [] }); }} placeholder="যেমন: ষষ্ঠ শ্রেণি" />
            </div>
            <datalist id="package-class-options">{classes.map(c => <option key={c.id} value={c.name} />)}</datalist>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={allSubjects} onCheckedChange={v => { setSubjectsChanged(true); setAllSubjects(v === true); }} />{ALL_SUBJECTS_LABEL}</label>
              {!allSubjects && <div className="max-h-48 overflow-y-auto rounded-md border p-3 space-y-2">
                {availableSubjects.map(subject => <label key={subject.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form.subject_ids.includes(subject.id)} onCheckedChange={checked => { setSubjectsChanged(true); setForm(previous => ({ ...previous, subject_ids: checked ? [...previous.subject_ids, subject.id] : previous.subject_ids.filter(id => id !== subject.id) })); }} />
                  {subject.name}<span className="text-xs text-muted-foreground">({classes.find(c => c.id === subject.class_id)?.name})</span>
                </label>)}
                {!availableSubjects.length && <p className="text-sm text-muted-foreground">উপরে শ্রেণি নির্বাচন করুন</p>}
              </div>}
            </div>
            <div>
              <label htmlFor="package-duration" className="text-sm font-medium mb-1 block">মেয়াদ (দিন)</label>
              <Input id="package-duration" type="number" min={1} max={36500} value={form.duration_days} onChange={e => setForm({ ...form, duration_days: Number(e.target.value) })} />
              <div className="flex gap-2 mt-2">{[30,90,180,365].map(days => <Button key={days} type="button" size="sm" variant="outline" onClick={() => setForm({ ...form, duration_days: days })}>{days.toLocaleString("bn-BD")} দিন</Button>)}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">মূল্য (টাকা)</label>
                <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">সর্ট ক্রম</label>
                <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <span className="text-sm">সক্রিয়</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_coming_soon} onCheckedChange={(v) => setForm({ ...form, is_coming_soon: v })} />
                <span className="text-sm">Coming Soon</span>
              </div>
            </div>
            <Button className="w-full gradient-green text-white border-0" onClick={handleSave} disabled={saving}>
              {saving ? "সেভ হচ্ছে..." : editing ? "আপডেট করুন" : "যোগ করুন"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
