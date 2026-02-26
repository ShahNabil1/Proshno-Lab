import { useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, Search, Package, User, Mail, Phone, CreditCard, Calendar, Hash } from "lucide-react";

interface TeacherRow {
  id: string;
  full_name: string;
  email: string;
}

interface SubscriptionRow {
  id: number;
  teacher_id: string;
  plan: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

interface PurchaseRow {
  id: number;
  teacher_id: string | null;
  teacher_name: string;
  teacher_email: string;
  teacher_phone: string;
  institute_name: string;
  package_name: string;
  package_classes: string;
  package_price: number;
  total_price: number;
  discount: number;
  payment_method: string;
  transaction_id: string;
  coupon_code: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  admin_note: string | null;
}

interface GroupedUser {
  teacher: TeacherRow;
  subscriptions: SubscriptionRow[];
  purchases: PurchaseRow[];
  latestPhone: string;
  latestPackagePrice: number;
  activeCount: number;
}

function getSubStatus(sub: SubscriptionRow): "active" | "expired" | "queued" | "inactive" {
  if (sub.status === "inactive") return "inactive";
  const now = new Date();
  const start = sub.starts_at ? new Date(sub.starts_at) : null;
  const end = sub.ends_at ? new Date(sub.ends_at) : null;
  if (end && end < now) return "expired";
  if (start && start > now) return "queued";
  if (sub.status === "active") return "active";
  return "inactive";
}

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: "সক্রিয়", className: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  expired: { label: "মেয়াদোত্তীর্ণ", className: "bg-red-100 text-red-700 border-red-300" },
  queued: { label: "অপেক্ষমান", className: "bg-amber-100 text-amber-800 border-amber-300" },
  inactive: { label: "নিষ্ক্রিয়", className: "bg-gray-100 text-gray-600 border-gray-300" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] || statusConfig.inactive;
  return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>;
}

export default function AdminSubscriptions() {
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<GroupedUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [subsRes, teachersRes, purchasesRes] = await Promise.all([
      supabase.from("subscriptions").select("*").order("created_at", { ascending: false }),
      supabase.from("teachers").select("id, full_name, email"),
      supabase.from("purchase_requests").select("*").order("created_at", { ascending: false }),
    ]);
    setSubscriptions((subsRes.data as SubscriptionRow[]) || []);
    setTeachers((teachersRes.data as TeacherRow[]) || []);
    setPurchases((purchasesRes.data as PurchaseRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Group by teacher
  const grouped = useMemo<GroupedUser[]>(() => {
    const teacherMap = new Map<string, TeacherRow>();
    teachers.forEach(t => teacherMap.set(t.id, t));

    // Collect unique teacher IDs from subscriptions
    const teacherIds = new Set<string>();
    subscriptions.forEach(s => teacherIds.add(s.teacher_id));

    return Array.from(teacherIds).map(tid => {
      const teacher = teacherMap.get(tid) || { id: tid, full_name: "—", email: "—" };
      const userSubs = subscriptions.filter(s => s.teacher_id === tid)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const userPurchases = purchases.filter(p => p.teacher_id === tid)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const latestPhone = userPurchases[0]?.teacher_phone || "—";
      const latestPackagePrice = userPurchases[0]?.total_price || 0;
      const activeCount = userSubs.filter(s => getSubStatus(s) === "active").length;

      return { teacher, subscriptions: userSubs, purchases: userPurchases, latestPhone, latestPackagePrice, activeCount };
    });
  }, [teachers, subscriptions, purchases]);

  // Filter
  const filtered = useMemo(() => {
    if (!debouncedSearch.trim()) return grouped;
    const q = debouncedSearch.toLowerCase();
    return grouped.filter(g =>
      g.teacher.full_name.toLowerCase().includes(q) ||
      g.teacher.email.toLowerCase().includes(q) ||
      g.latestPhone.includes(q)
    );
  }, [grouped, debouncedSearch]);

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold">সাবস্ক্রিপশন ম্যানেজমেন্ট</h1>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
            <Input
              placeholder="নাম, ইমেইল বা ফোন নম্বর দিয়ে খুঁজুন..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 border-primary/30 focus-visible:ring-primary"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>নাম</TableHead>
                <TableHead>ইমেইল</TableHead>
                <TableHead>ফোন নম্বর</TableHead>
                <TableHead>প্যাকেজ মূল্য</TableHead>
                <TableHead>স্ট্যাটাস</TableHead>
                <TableHead className="text-right">অ্যাকশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">লোড হচ্ছে...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">কোনো সাবস্ক্রিপশন পাওয়া যায়নি</TableCell></TableRow>
              ) : filtered.map(g => {
                const topSub = g.subscriptions[0];
                const topStatus = topSub ? getSubStatus(topSub) : "inactive";
                return (
                  <TableRow key={g.teacher.id}>
                    <TableCell className="font-medium">{g.teacher.full_name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{g.teacher.email}</TableCell>
                    <TableCell>{g.latestPhone}</TableCell>
                    <TableCell>৳{g.latestPackagePrice.toLocaleString("bn-BD")}</TableCell>
                    <TableCell>
                      <StatusBadge status={topStatus} />
                      {g.subscriptions.length > 1 && (
                        <span className="ml-1.5 text-xs text-muted-foreground">+{g.subscriptions.length - 1}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setSelectedUser(g)} title="বিস্তারিত দেখুন"
                        className="text-primary hover:text-primary hover:bg-primary/10">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Details Modal */}
      <Dialog open={!!selectedUser} onOpenChange={open => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedUser && <DetailsModal data={selectedUser} onRefresh={fetchAll} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Details Modal ─── */
function DetailsModal({ data, onRefresh }: { data: GroupedUser; onRefresh: () => void }) {
  const { teacher, subscriptions: subs, purchases } = data;

  const toggleStatus = async (subId: number, current: string) => {
    const newStatus = current === "active" ? "inactive" : "active";
    const { error } = await supabase.from("subscriptions").update({ status: newStatus }).eq("id", subId);
    if (error) { toast.error("আপডেট ব্যর্থ"); return; }
    toast.success(`স্ট্যাটাস ${newStatus === "active" ? "সক্রিয়" : "নিষ্ক্রিয়"} করা হয়েছে`);
    onRefresh();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-heading text-lg flex items-center gap-2">
          <User className="w-5 h-5 text-primary" /> ব্যবহারকারীর বিস্তারিত
        </DialogTitle>
      </DialogHeader>

      {/* User Info */}
      <div className="rounded-lg border bg-accent/30 p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <User className="w-4 h-4 text-primary shrink-0" />
          <span className="font-medium">নাম:</span> {teacher.full_name}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Mail className="w-4 h-4 text-primary shrink-0" />
          <span className="font-medium">ইমেইল:</span> {teacher.email}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Phone className="w-4 h-4 text-primary shrink-0" />
          <span className="font-medium">ফোন:</span> {data.latestPhone}
        </div>
      </div>

      {/* Subscriptions */}
      <div className="space-y-3">
        <h3 className="font-heading font-semibold text-sm flex items-center gap-2">
          <Package className="w-4 h-4 text-primary" /> প্যাকেজ সমূহ ({subs.length})
        </h3>
        {subs.length === 0 ? (
          <p className="text-sm text-muted-foreground">কোনো প্যাকেজ নেই</p>
        ) : (
          <div className="space-y-2">
            {subs.map(sub => {
              const st = getSubStatus(sub);
              return (
                <div key={sub.id} className="rounded-lg border p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{sub.plan}</span>
                      <StatusBadge status={st} />
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        শুরু: {sub.starts_at ? new Date(sub.starts_at).toLocaleDateString("bn-BD") : "—"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        শেষ: {sub.ends_at ? new Date(sub.ends_at).toLocaleDateString("bn-BD") : "—"}
                      </span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => toggleStatus(sub.id, sub.status)} className="shrink-0">
                    {sub.status === "active" ? "নিষ্ক্রিয় করুন" : "সক্রিয় করুন"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Purchase History */}
      <div className="space-y-3">
        <h3 className="font-heading font-semibold text-sm flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-primary" /> পেমেন্ট ইতিহাস ({purchases.length})
        </h3>
        {purchases.length === 0 ? (
          <p className="text-sm text-muted-foreground">কোনো পেমেন্ট রেকর্ড নেই</p>
        ) : (
          <div className="space-y-2">
            {purchases.map(p => (
              <div key={p.id} className="rounded-lg border p-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{p.package_name || "—"}</span>
                  <Badge variant={p.status === "approved" ? "default" : p.status === "rejected" ? "destructive" : "secondary"}>
                    {p.status === "approved" ? "অনুমোদিত" : p.status === "rejected" ? "প্রত্যাখ্যাত" : "অপেক্ষমান"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Hash className="w-3 h-3" /> TrxID: {p.transaction_id || "—"}</span>
                  <span className="flex items-center gap-1"><CreditCard className="w-3 h-3" /> {p.payment_method || "—"}</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(p.created_at).toLocaleDateString("bn-BD")}</span>
                  <span>মূল্য: ৳{p.total_price.toLocaleString("bn-BD")}</span>
                  {p.coupon_code && <span>কুপন: {p.coupon_code}</span>}
                  {p.discount > 0 && <span>ছাড়: ৳{p.discount.toLocaleString("bn-BD")}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
