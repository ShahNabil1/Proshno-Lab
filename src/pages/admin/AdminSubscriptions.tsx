import { useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, Search, Package, User, Mail, Phone, CreditCard, Calendar, Hash, CheckCircle2, RefreshCw, Loader2 } from "lucide-react";
import { planCoversSelection } from "@/lib/subscriptionMatcher";

interface PricingPackageRow { id: number; class_name: string; subject_name: string; is_active: boolean; }
interface TeacherRow { id: string; full_name: string; email: string; }
interface SubscriptionRow {
  id: number; teacher_id: string; plan: string; status: string;
  starts_at: string | null; ends_at: string | null; created_at: string;
  bkash_payment_id: number | null;
}
interface BkashPaymentRow {
  id: number; user_id: string; payment_id: string | null; merchant_invoice_number: string;
  trx_id: string | null; amount: number; discount: number; coupon_code: string | null;
  selected_packages: any; payer_reference: string | null; payer_account: string | null;
  customer_msisdn: string | null; institute_name: string | null; teacher_name: string | null;
  teacher_email: string | null; status: string; bkash_response: any; error_message: string | null;
  environment: string; created_at: string;
}
interface GroupedUser {
  teacher: TeacherRow;
  subscriptions: SubscriptionRow[];
  payments: BkashPaymentRow[];
  latestPhone: string;
  totalPaid: number;
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

const subStatusConfig: Record<string, { label: string; className: string }> = {
  active: { label: "সক্রিয়", className: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  expired: { label: "মেয়াদোত্তীর্ণ", className: "bg-red-100 text-red-700 border-red-300" },
  queued: { label: "অপেক্ষমান", className: "bg-amber-100 text-amber-800 border-amber-300" },
  inactive: { label: "নিষ্ক্রিয়", className: "bg-gray-100 text-gray-600 border-gray-300" },
};

const payStatusConfig: Record<string, { label: string; className: string }> = {
  completed: { label: "সফল", className: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  initiated: { label: "চলমান", className: "bg-amber-100 text-amber-800 border-amber-300" },
  failed: { label: "ব্যর্থ", className: "bg-red-100 text-red-700 border-red-300" },
  cancelled: { label: "বাতিল", className: "bg-gray-100 text-gray-600 border-gray-300" },
};

export default function AdminSubscriptions() {
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [payments, setPayments] = useState<BkashPaymentRow[]>([]);
  const [packages, setPackages] = useState<PricingPackageRow[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<GroupedUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [subsRes, teachersRes, payRes, pkgsRes] = await Promise.all([
      supabase.from("subscriptions").select("*").order("created_at", { ascending: false }),
      supabase.from("teachers").select("id, full_name, email"),
      supabase.from("bkash_payments").select("*").order("created_at", { ascending: false }),
      supabase.from("pricing_packages").select("id, class_name, subject_name, is_active").eq("is_active", true),
    ]);
    setSubscriptions((subsRes.data as SubscriptionRow[]) || []);
    setTeachers((teachersRes.data as TeacherRow[]) || []);
    setPayments((payRes.data as BkashPaymentRow[]) || []);
    setPackages((pkgsRes.data as PricingPackageRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const grouped = useMemo<GroupedUser[]>(() => {
    const teacherMap = new Map<string, TeacherRow>();
    teachers.forEach(t => teacherMap.set(t.id, t));

    const teacherIds = new Set<string>();
    subscriptions.forEach(s => teacherIds.add(s.teacher_id));
    payments.forEach(p => teacherIds.add(p.user_id));

    return Array.from(teacherIds).map(tid => {
      const teacher = teacherMap.get(tid) || { id: tid, full_name: "—", email: "—" };
      const userSubs = subscriptions.filter(s => s.teacher_id === tid);
      const userPayments = payments.filter(p => p.user_id === tid);
      const latestPhone = userPayments[0]?.payer_reference || "—";
      const totalPaid = userPayments.filter(p => p.status === "completed").reduce((s, p) => s + Number(p.amount), 0);
      const activeCount = userSubs.filter(s => getSubStatus(s) === "active").length;
      return { teacher, subscriptions: userSubs, payments: userPayments, latestPhone, totalPaid, activeCount };
    }).sort((a, b) => (b.payments[0]?.created_at || "").localeCompare(a.payments[0]?.created_at || ""));
  }, [teachers, subscriptions, payments]);

  const filtered = useMemo(() => {
    if (!debouncedSearch.trim()) return grouped;
    const q = debouncedSearch.toLowerCase();
    return grouped.filter(g =>
      g.teacher.full_name.toLowerCase().includes(q) ||
      g.teacher.email.toLowerCase().includes(q) ||
      g.latestPhone.includes(q) ||
      g.payments.some(p => p.trx_id?.toLowerCase().includes(q) || p.merchant_invoice_number.toLowerCase().includes(q))
    );
  }, [grouped, debouncedSearch]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-heading text-2xl font-bold">সাবস্ক্রিপশন ও বিকাশ পেমেন্ট</h1>
        <Button variant="outline" size="sm" onClick={fetchAll}><RefreshCw className="w-4 h-4 mr-1.5" /> রিফ্রেশ</Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
            <Input
              placeholder="নাম, ইমেইল, ফোন, TrxID বা invoice দিয়ে খুঁজুন..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 border-primary/30 focus-visible:ring-primary"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>নাম</TableHead>
                <TableHead>ইমেইল</TableHead>
                <TableHead>ফোন</TableHead>
                <TableHead>মোট পরিশোধ</TableHead>
                <TableHead>সাবস্ক্রিপশন</TableHead>
                <TableHead>শেষ পেমেন্ট</TableHead>
                <TableHead className="text-right">অ্যাকশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">লোড হচ্ছে...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">কোনো ডাটা পাওয়া যায়নি</TableCell></TableRow>
              ) : filtered.map(g => {
                const lastPay = g.payments[0];
                return (
                  <TableRow key={g.teacher.id}>
                    <TableCell className="font-medium">{g.teacher.full_name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{g.teacher.email}</TableCell>
                    <TableCell className="text-sm">{g.latestPhone}</TableCell>
                    <TableCell className="text-sm font-semibold">৳{g.totalPaid.toLocaleString("bn-BD")}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300">
                        {g.activeCount} সক্রিয়
                      </Badge>
                      <span className="ml-1.5 text-xs text-muted-foreground">/ {g.subscriptions.length} মোট</span>
                    </TableCell>
                    <TableCell>
                      {lastPay ? (
                        <Badge variant="outline" className={payStatusConfig[lastPay.status]?.className || ""}>
                          {payStatusConfig[lastPay.status]?.label || lastPay.status}
                        </Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setSelectedUser(g)} title="বিস্তারিত"
                        className="text-primary hover:bg-primary/10">
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

      <Dialog open={!!selectedUser} onOpenChange={open => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedUser && <DetailsModal data={selectedUser} packages={packages} onRefresh={fetchAll} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailsModal({ data, packages, onRefresh }: { data: GroupedUser; packages: PricingPackageRow[]; onRefresh: () => void }) {
  const { teacher, subscriptions: subs, payments } = data;
  const [queryingId, setQueryingId] = useState<string | null>(null);

  const toggleStatus = async (subId: number, current: string) => {
    const newStatus = current === "active" ? "inactive" : "active";
    const { error } = await supabase.from("subscriptions").update({ status: newStatus }).eq("id", subId);
    if (error) { toast.error("আপডেট ব্যর্থ"); return; }
    toast.success(`স্ট্যাটাস ${newStatus === "active" ? "সক্রিয়" : "নিষ্ক্রিয়"} করা হয়েছে`);
    onRefresh();
  };

  const queryBkash = async (paymentId: string) => {
    setQueryingId(paymentId);
    try {
      const { data: res, error } = await supabase.functions.invoke("bkash-query-payment", {
        body: { paymentID: paymentId },
      });
      if (error) throw error;
      toast.success(`bKash স্ট্যাটাস: ${res?.data?.transactionStatus || "unknown"}`);
      onRefresh();
    } catch (e: any) { toast.error("যাচাই ব্যর্থ: " + (e.message || "")); }
    finally { setQueryingId(null); }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-heading text-lg flex items-center gap-2">
          <User className="w-5 h-5 text-primary" /> ব্যবহারকারীর বিস্তারিত
        </DialogTitle>
      </DialogHeader>

      <div className="rounded-lg border bg-accent/30 p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm"><User className="w-4 h-4 text-primary" /><span className="font-medium">নাম:</span> {teacher.full_name}</div>
        <div className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4 text-primary" /><span className="font-medium">ইমেইল:</span> {teacher.email}</div>
        <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-primary" /><span className="font-medium">ফোন:</span> {data.latestPhone}</div>
        <div className="flex items-center gap-2 text-sm"><CreditCard className="w-4 h-4 text-primary" /><span className="font-medium">মোট পরিশোধ:</span> ৳{data.totalPaid.toLocaleString("bn-BD")}</div>
      </div>

      {/* Subscriptions */}
      <div className="space-y-3 mt-4">
        <h3 className="font-heading font-semibold text-sm flex items-center gap-2">
          <Package className="w-4 h-4 text-primary" /> সাবস্ক্রিপশন ({subs.length})
        </h3>
        {subs.length === 0 ? <p className="text-sm text-muted-foreground">কোনো সাবস্ক্রিপশন নেই</p> : (
          <div className="space-y-2">
            {subs.map(sub => {
              const st = getSubStatus(sub);
              const cfg = subStatusConfig[st];
              const covered = packages.filter(p => planCoversSelection(sub.plan, p.class_name, p.subject_name));
              return (
                <div key={sub.id} className="rounded-lg border p-3 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{sub.plan}</span>
                        <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>
                        {sub.bkash_payment_id && <Badge variant="outline" className="text-[10px]">bKash #{sub.bkash_payment_id}</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> শুরু: {sub.starts_at ? new Date(sub.starts_at).toLocaleDateString("bn-BD") : "—"}</span>
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> শেষ: {sub.ends_at ? new Date(sub.ends_at).toLocaleDateString("bn-BD") : "—"}</span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => toggleStatus(sub.id, sub.status)} className="shrink-0">
                      {sub.status === "active" ? "নিষ্ক্রিয় করুন" : "সক্রিয় করুন"}
                    </Button>
                  </div>
                  <div className="rounded-md bg-emerald-50 border border-emerald-200 p-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 mb-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> কভার করছে ({covered.length}টি প্যাকেজ)
                    </div>
                    {covered.length === 0 ? <p className="text-xs text-emerald-700/80">কোনো প্যাকেজ কভার করছে না</p> : (
                      <div className="flex flex-wrap gap-1.5">
                        {covered.map(p => (
                          <Badge key={p.id} variant="outline" className="bg-white text-emerald-800 border-emerald-300 text-[11px]">
                            {p.class_name} — {p.subject_name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* bKash Payments */}
      <div className="space-y-3 mt-4">
        <h3 className="font-heading font-semibold text-sm flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-primary" /> বিকাশ পেমেন্ট ইতিহাস ({payments.length})
        </h3>
        {payments.length === 0 ? <p className="text-sm text-muted-foreground">কোনো পেমেন্ট নেই</p> : (
          <div className="space-y-2">
            {payments.map(p => {
              const cfg = payStatusConfig[p.status] || { label: p.status, className: "" };
              const pkgs = Array.isArray(p.selected_packages) ? p.selected_packages : [];
              return (
                <div key={p.id} className="rounded-lg border p-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>
                      <Badge variant="outline" className="text-[10px]">{p.environment}</Badge>
                      <span className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString("bn-BD")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">৳{Number(p.amount).toLocaleString("bn-BD")}</span>
                      {p.status === "initiated" && p.payment_id && (
                        <Button variant="outline" size="sm" onClick={() => queryBkash(p.payment_id!)} disabled={queryingId === p.payment_id}>
                          {queryingId === p.payment_id ? <Loader2 className="w-3 h-3 animate-spin" /> : "যাচাই"}
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Hash className="w-3 h-3" /> TrxID: <span className="font-mono text-foreground">{p.trx_id || "—"}</span></span>
                    <span className="flex items-center gap-1"><Hash className="w-3 h-3" /> Invoice: <span className="font-mono text-foreground">{p.merchant_invoice_number}</span></span>
                    <span>PaymentID: <span className="font-mono text-foreground text-[11px]">{p.payment_id || "—"}</span></span>
                    <span>Payer: <span className="text-foreground">{p.payer_account || p.customer_msisdn || p.payer_reference || "—"}</span></span>
                    {p.coupon_code && <span>কুপন: <span className="text-foreground">{p.coupon_code}</span></span>}
                    {p.discount > 0 && <span>ছাড়: ৳{Number(p.discount).toLocaleString("bn-BD")}</span>}
                    {p.error_message && <span className="col-span-2 text-red-600">এরর: {p.error_message}</span>}
                  </div>

                  {pkgs.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {pkgs.map((pkg: any, i: number) => (
                        <Badge key={i} variant="outline" className="text-[11px] bg-primary/5 border-primary/20">
                          {pkg.class_name} — {pkg.subject_name} <span className="ml-1 opacity-70">৳{pkg.price}</span>
                        </Badge>
                      ))}
                    </div>
                  )}

                  <details className="text-[11px]">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">bKash রেসপন্স JSON</summary>
                    <pre className="mt-1 bg-muted/50 p-2 rounded overflow-x-auto text-[10px]">{JSON.stringify(p.bkash_response, null, 2)}</pre>
                  </details>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
