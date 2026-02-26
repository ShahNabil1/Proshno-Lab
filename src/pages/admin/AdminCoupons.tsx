import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";

const allPackageOptions = [
  "ষষ্ঠ - দশম__সকল বিষয়",
  "ষষ্ঠ - দ্বাদশ__সকল বিষয়",
  "ষষ্ঠ শ্রেণি__সকল বিষয়", "ষষ্ঠ শ্রেণি__গণিত", "ষষ্ঠ শ্রেণি__বিজ্ঞান", "ষষ্ঠ শ্রেণি__তথ্য ও যোগাযোগ প্রযুক্তি",
  "সপ্তম শ্রেণি__সকল বিষয়", "সপ্তম শ্রেণি__গণিত", "সপ্তম শ্রেণি__বিজ্ঞান", "সপ্তম শ্রেণি__তথ্য ও যোগাযোগ প্রযুক্তি",
  "অষ্টম শ্রেণি__সকল বিষয়", "অষ্টম শ্রেণি__গণিত", "অষ্টম শ্রেণি__বিজ্ঞান", "অষ্টম শ্রেণি__তথ্য ও যোগাযোগ প্রযুক্তি",
  "নবম-দশম শ্রেণি__সকল বিষয়", "নবম-দশম শ্রেণি__গণিত", "নবম-দশম শ্রেণি__বিজ্ঞান", "নবম-দশম শ্রেণি__তথ্য ও যোগাযোগ প্রযুক্তি",
  "একাদশ শ্রেণি__সকল বিষয়", "একাদশ শ্রেণি__গণিত", "একাদশ শ্রেণি__বিজ্ঞান", "একাদশ শ্রেণি__তথ্য ও যোগাযোগ প্রযুক্তি",
  "দ্বাদশ শ্রেণি__সকল বিষয়", "দ্বাদশ শ্রেণি__গণিত", "দ্বাদশ শ্রেণি__বিজ্ঞান", "দ্বাদশ শ্রেণি__তথ্য ও যোগাযোগ প্রযুক্তি",
];

interface Coupon {
  id: number;
  code: string;
  discount_type: string;
  discount_value: number;
  max_discount: number | null;
  min_purchase: number;
  use_limit: number | null;
  used_count: number;
  applicable_packages: string[] | null;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

const emptyCoupon = {
  code: "",
  discount_type: "fixed",
  discount_value: 0,
  max_discount: null as number | null,
  min_purchase: 0,
  use_limit: null as number | null,
  applicable_packages: null as string[] | null,
  is_active: true,
  expires_at: "",
};

export default function AdminCoupons() {
  const [items, setItems] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyCoupon });
  const [selectedPkgs, setSelectedPkgs] = useState<string[]>([]);
  const [applyToAll, setApplyToAll] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
    setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyCoupon });
    setSelectedPkgs([]);
    setApplyToAll(true);
    setDialogOpen(true);
  };

  const openEdit = (c: Coupon) => {
    setEditingId(c.id);
    setForm({
      code: c.code,
      discount_type: c.discount_type,
      discount_value: c.discount_value,
      max_discount: c.max_discount,
      min_purchase: c.min_purchase,
      use_limit: c.use_limit,
      applicable_packages: c.applicable_packages,
      is_active: c.is_active,
      expires_at: c.expires_at ? c.expires_at.split("T")[0] : "",
    });
    setSelectedPkgs(c.applicable_packages || []);
    setApplyToAll(!c.applicable_packages || c.applicable_packages.length === 0);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.code.trim()) { toast.error("কুপন কোড লিখুন"); return; }
    if (form.discount_value <= 0) { toast.error("ডিসকাউন্ট ভ্যালু দিন"); return; }

    const payload: any = {
      code: form.code.trim().toUpperCase(),
      discount_type: form.discount_type,
      discount_value: form.discount_value,
      max_discount: form.discount_type === "percentage" ? form.max_discount : null,
      min_purchase: form.min_purchase,
      use_limit: form.use_limit,
      applicable_packages: applyToAll ? null : selectedPkgs.length > 0 ? selectedPkgs : null,
      is_active: form.is_active,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
    };

    if (editingId) {
      const { error } = await supabase.from("coupons").update(payload).eq("id", editingId);
      if (error) { toast.error(error.message); return; }
      toast.success("কুপন আপডেট হয়েছে");
    } else {
      const { error } = await supabase.from("coupons").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("কুপন তৈরি হয়েছে");
    }
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("কুপনটি মুছে ফেলতে চান?")) return;
    await supabase.from("coupons").delete().eq("id", id);
    toast.success("কুপন মুছে ফেলা হয়েছে");
    fetchData();
  };

  const togglePkg = (pkg: string) => {
    setSelectedPkgs((prev) =>
      prev.includes(pkg) ? prev.filter((p) => p !== pkg) : [...prev, pkg]
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-heading text-xl font-bold text-foreground flex items-center gap-2">
          <Tag className="w-5 h-5" /> কুপন ম্যানেজমেন্ট
        </h1>
        <Button size="sm" className="gradient-green text-white border-0" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" /> নতুন কুপন
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-center py-10">লোড হচ্ছে...</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground text-center py-10">কোনো কুপন নেই</p>
      ) : (
        <div className="rounded-xl border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-heading font-semibold">কোড</TableHead>
                <TableHead className="font-heading font-semibold">ডিসকাউন্ট</TableHead>
                <TableHead className="font-heading font-semibold">ন্যূনতম ক্রয়</TableHead>
                <TableHead className="font-heading font-semibold">ব্যবহার</TableHead>
                <TableHead className="font-heading font-semibold">প্যাকেজ</TableHead>
                <TableHead className="font-heading font-semibold">স্ট্যাটাস</TableHead>
                <TableHead className="font-heading font-semibold text-center">পদক্ষেপ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono font-bold">{c.code}</TableCell>
                  <TableCell>
                    {c.discount_type === "percentage"
                      ? `${c.discount_value}%${c.max_discount ? ` (সর্বোচ্চ ৳${c.max_discount})` : ""}`
                      : `৳${c.discount_value}`}
                  </TableCell>
                  <TableCell>৳{c.min_purchase}</TableCell>
                  <TableCell>
                    {c.used_count}/{c.use_limit ?? "∞"}
                  </TableCell>
                  <TableCell className="text-xs max-w-[150px] truncate">
                    {c.applicable_packages ? c.applicable_packages.map(p => p.replace("__", " - ")).join(", ") : "সব প্যাকেজ"}
                  </TableCell>
                  <TableCell>
                    {c.is_active ? (
                      <Badge className="bg-primary/10 text-primary border-primary/20">সক্রিয়</Badge>
                    ) : (
                      <Badge variant="secondary">নিষ্ক্রিয়</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex gap-1 justify-center">
                      <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => openEdit(c)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="destructive" className="h-7 text-xs px-2" onClick={() => handleDelete(c.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">{editingId ? "কুপন এডিট করুন" : "নতুন কুপন তৈরি করুন"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>কুপন কোড</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SAVE50" className="font-mono" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>ডিসকাউন্ট ধরন</Label>
                <Select value={form.discount_type} onValueChange={(v) => setForm({ ...form, discount_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">নির্দিষ্ট পরিমাণ (৳)</SelectItem>
                    <SelectItem value="percentage">শতাংশ (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>ডিসকাউন্ট ভ্যালু</Label>
                <Input type="number" value={form.discount_value || ""} onChange={(e) => setForm({ ...form, discount_value: parseInt(e.target.value) || 0 })} />
              </div>
            </div>

            {form.discount_type === "percentage" && (
              <div>
                <Label>সর্বোচ্চ ডিসকাউন্ট (৳)</Label>
                <Input type="number" value={form.max_discount || ""} onChange={(e) => setForm({ ...form, max_discount: parseInt(e.target.value) || null })} placeholder="খালি রাখলে সীমাহীন" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>ন্যূনতম ক্রয় (৳)</Label>
                <Input type="number" value={form.min_purchase || ""} onChange={(e) => setForm({ ...form, min_purchase: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>ব্যবহার সীমা</Label>
                <Input type="number" value={form.use_limit ?? ""} onChange={(e) => setForm({ ...form, use_limit: e.target.value ? parseInt(e.target.value) : null })} placeholder="খালি = সীমাহীন" />
              </div>
            </div>

            <div>
              <Label>মেয়াদ শেষ তারিখ</Label>
              <Input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>সক্রিয়</Label>
            </div>

            {/* Package selection */}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Switch checked={applyToAll} onCheckedChange={setApplyToAll} />
                <Label>সব প্যাকেজে প্রযোজ্য</Label>
              </div>
              {!applyToAll && (
                <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-1">
                  {allPackageOptions.map((pkg) => (
                    <label key={pkg} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 px-2 py-1 rounded">
                      <input
                        type="checkbox"
                        checked={selectedPkgs.includes(pkg)}
                        onChange={() => togglePkg(pkg)}
                        className="rounded"
                      />
                      {pkg.replace("__", " — ")}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <Button className="w-full gradient-green text-white border-0 font-heading" onClick={handleSave}>
              {editingId ? "আপডেট করুন" : "তৈরি করুন"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
