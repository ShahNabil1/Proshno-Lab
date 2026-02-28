import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Loader2, Package, Filter } from "lucide-react";
import { toast } from "sonner";

interface PricingPackage {
  id: number;
  type: string;
  class_name: string;
  subject_name: string;
  price: number;
  sort_order: number;
  is_active: boolean;
}

const emptyForm = {
  type: "class" as string,
  class_name: "",
  subject_name: "সকল বিষয়",
  price: 0,
  sort_order: 0,
  is_active: true,
};

export default function AdminPackages() {
  const [packages, setPackages] = useState<PricingPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PricingPackage | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filterClass, setFilterClass] = useState("");

  const fetchPackages = async () => {
    const { data } = await supabase
      .from("pricing_packages")
      .select("*")
      .order("sort_order");
    setPackages((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchPackages(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (pkg: PricingPackage) => {
    setEditing(pkg);
    setForm({
      type: pkg.type,
      class_name: pkg.class_name,
      subject_name: pkg.subject_name,
      price: pkg.price,
      sort_order: pkg.sort_order,
      is_active: pkg.is_active,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.class_name.trim()) {
      toast.error("শ্রেণির নাম দিন");
      return;
    }
    if (form.price <= 0) {
      toast.error("মূল্য সঠিক নয়");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from("pricing_packages")
          .update({
            type: form.type,
            class_name: form.class_name.trim(),
            subject_name: form.subject_name.trim() || "সকল বিষয়",
            price: form.price,
            sort_order: form.sort_order,
            is_active: form.is_active,
          })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("প্যাকেজ আপডেট হয়েছে");
      } else {
        const { error } = await supabase
          .from("pricing_packages")
          .insert({
            type: form.type,
            class_name: form.class_name.trim(),
            subject_name: form.subject_name.trim() || "সকল বিষয়",
            price: form.price,
            sort_order: form.sort_order,
            is_active: form.is_active,
          });
        if (error) throw error;
        toast.success("নতুন প্যাকেজ যোগ হয়েছে");
      }
      setModalOpen(false);
      fetchPackages();
    } catch (err: any) {
      toast.error(err.message || "সমস্যা হয়েছে");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("এই প্যাকেজটি মুছে ফেলতে চান?")) return;
    const { error } = await supabase.from("pricing_packages").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("প্যাকেজ মুছে ফেলা হয়েছে");
      fetchPackages();
    }
  };

  const toggleActive = async (pkg: PricingPackage) => {
    await supabase
      .from("pricing_packages")
      .update({ is_active: !pkg.is_active })
      .eq("id", pkg.id);
    fetchPackages();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
          <Package className="w-6 h-6 text-primary" />
          প্যাকেজ ম্যানেজমেন্ট
        </h1>
        <Button onClick={openCreate} className="gradient-green text-white border-0 gap-2">
          <Plus className="w-4 h-4" /> নতুন প্যাকেজ
        </Button>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-heading font-semibold">ধরন</TableHead>
              <TableHead className="font-heading font-semibold">শ্রেণি</TableHead>
              <TableHead className="font-heading font-semibold">বিষয়</TableHead>
              <TableHead className="font-heading font-semibold">মূল্য</TableHead>
              <TableHead className="font-heading font-semibold">ক্রম</TableHead>
              <TableHead className="font-heading font-semibold">স্ট্যাটাস</TableHead>
              <TableHead className="font-heading font-semibold text-center">অ্যাকশন</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {packages.map((pkg) => (
              <TableRow key={pkg.id}>
                <TableCell>
                  <Badge variant={pkg.type === "bundle" ? "default" : "secondary"}>
                    {pkg.type === "bundle" ? "বান্ডেল" : "শ্রেণি"}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">{pkg.class_name}</TableCell>
                <TableCell>{pkg.subject_name}</TableCell>
                <TableCell className="font-semibold">৳{pkg.price}</TableCell>
                <TableCell>{pkg.sort_order}</TableCell>
                <TableCell>
                  <Switch checked={pkg.is_active} onCheckedChange={() => toggleActive(pkg)} />
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex justify-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(pkg)}>
                      <Pencil className="w-4 h-4 text-primary" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(pkg.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editing ? "প্যাকেজ এডিট করুন" : "নতুন প্যাকেজ যোগ করুন"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">ধরন</label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bundle">বান্ডেল</SelectItem>
                  <SelectItem value="class">শ্রেণি</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">শ্রেণি নাম</label>
              <Input
                value={form.class_name}
                onChange={(e) => setForm({ ...form, class_name: e.target.value })}
                placeholder="যেমন: ষষ্ঠ শ্রেণি"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">বিষয় নাম</label>
              <Input
                value={form.subject_name}
                onChange={(e) => setForm({ ...form, subject_name: e.target.value })}
                placeholder="সকল বিষয়"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">মূল্য (টাকা)</label>
                <Input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">সর্ট ক্রম</label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <span className="text-sm">সক্রিয়</span>
            </div>
            <Button
              className="w-full gradient-green text-white border-0"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "সেভ হচ্ছে..." : editing ? "আপডেট করুন" : "যোগ করুন"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
