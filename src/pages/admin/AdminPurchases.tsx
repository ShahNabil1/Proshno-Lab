import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Check, X, Search, RefreshCw } from "lucide-react";

interface PurchaseRequest {
  id: number;
  teacher_name: string;
  teacher_email: string;
  teacher_phone: string;
  institute_name: string;
  package_name: string;
  package_classes: string;
  package_price: number;
  total_price: number;
  discount: number;
  coupon_code: string;
  payment_method: string;
  transaction_id: string;
  status: string;
  created_at: string;
  teacher_id: string | null;
}

const paymentLabels: Record<string, string> = {
  bkash: "বিকাশ",
  nagad: "নগদ",
  rocket: "রকেট",
  upay: "উপায়",
};

export default function AdminPurchases() {
  const [items, setItems] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("purchase_requests")
      .select("*")
      .order("created_at", { ascending: false });
    setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleAction = async (id: number, action: "approved" | "rejected", teacherId: string | null, plan: string, classes: string) => {
    // Update purchase request status
    const { error } = await supabase
      .from("purchase_requests")
      .update({ status: action, reviewed_at: new Date().toISOString() } as any)
      .eq("id", id);

    if (error) { toast.error("সমস্যা হয়েছে"); return; }

    // If approved and teacher exists, activate subscription + grant permissions
    if (action === "approved" && teacherId) {
      const endsAt = new Date();
      endsAt.setFullYear(endsAt.getFullYear() + 1);

      // Upsert subscription
      const { data: existingSub } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("teacher_id", teacherId)
        .maybeSingle();

      if (existingSub) {
        await supabase.from("subscriptions").update({
          plan: `${classes} - ${plan}`,
          status: "active",
          starts_at: new Date().toISOString(),
          ends_at: endsAt.toISOString(),
        }).eq("teacher_id", teacherId);
      } else {
        await supabase.from("subscriptions").insert({
          teacher_id: teacherId,
          plan: `${classes} - ${plan}`,
          status: "active",
          starts_at: new Date().toISOString(),
          ends_at: endsAt.toISOString(),
        });
      }

      // Grant user_permissions for the purchased class + subject(s)
      // Resolve class_name to class_id
      const { data: classRow } = await supabase
        .from("classes")
        .select("id")
        .eq("name", classes)
        .maybeSingle();

      if (classRow) {
        // If "সকল বিষয়" → grant all subjects in that class
        if (plan === "সকল বিষয়" || plan.includes("সকল বিষয়")) {
          const { data: allSubjects } = await supabase
            .from("subjects")
            .select("id")
            .eq("class_id", classRow.id);

          if (allSubjects) {
            for (const sub of allSubjects) {
              // Upsert to avoid duplicates
              const { data: existing } = await supabase
                .from("user_permissions")
                .select("id")
                .eq("user_id", teacherId)
                .eq("class_id", classRow.id)
                .eq("subject_id", sub.id)
                .maybeSingle();

              if (!existing) {
                await supabase.from("user_permissions").insert({
                  user_id: teacherId,
                  class_id: classRow.id,
                  subject_id: sub.id,
                });
              }
            }
          }
        } else {
          // Single subject — resolve subject_name to subject_id
          const { data: subjectRow } = await supabase
            .from("subjects")
            .select("id")
            .eq("class_id", classRow.id)
            .eq("name", plan)
            .maybeSingle();

          if (subjectRow) {
            const { data: existing } = await supabase
              .from("user_permissions")
              .select("id")
              .eq("user_id", teacherId)
              .eq("class_id", classRow.id)
              .eq("subject_id", subjectRow.id)
              .maybeSingle();

            if (!existing) {
              await supabase.from("user_permissions").insert({
                user_id: teacherId,
                class_id: classRow.id,
                subject_id: subjectRow.id,
              });
            }
          }
        }
      }
    }

    toast.success(action === "approved" ? "অ্যাপ্রুভ করা হয়েছে!" : "রিজেক্ট করা হয়েছে");
    fetchData();
  };

  const filtered = items.filter((item) => {
    if (filter !== "all" && item.status !== filter) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      return (
        item.teacher_name.toLowerCase().includes(s) ||
        item.teacher_email.toLowerCase().includes(s) ||
        item.teacher_phone.includes(s) ||
        item.transaction_id.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const statusBadge = (status: string) => {
    if (status === "approved") return <Badge className="bg-primary/10 text-primary border-primary/20">অ্যাপ্রুভড</Badge>;
    if (status === "rejected") return <Badge variant="destructive">রিজেক্টেড</Badge>;
    return <Badge variant="secondary">পেন্ডিং</Badge>;
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <h1 className="font-heading text-xl font-bold text-foreground">পারচেজ রিকুয়েস্ট</h1>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-1" /> রিফ্রেশ
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="নাম, ইমেইল, ফোন, ট্রাঞ্জ. আইডি..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {(["pending", "approved", "rejected", "all"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
              className="text-xs"
            >
              {f === "all" ? "সব" : f === "pending" ? "পেন্ডিং" : f === "approved" ? "অ্যাপ্রুভড" : "রিজেক্টেড"}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-center py-10">লোড হচ্ছে...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-10">কোনো রিকুয়েস্ট নেই</p>
      ) : (
        <div className="rounded-xl border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-heading font-semibold">নাম</TableHead>
                <TableHead className="font-heading font-semibold">ইমেইল / ফোন</TableHead>
                <TableHead className="font-heading font-semibold">প্রতিষ্ঠান</TableHead>
                <TableHead className="font-heading font-semibold">প্যাকেজ</TableHead>
                <TableHead className="font-heading font-semibold">মূল্য</TableHead>
                <TableHead className="font-heading font-semibold">পেমেন্ট</TableHead>
                <TableHead className="font-heading font-semibold">ট্রাঞ্জ. আইডি</TableHead>
                <TableHead className="font-heading font-semibold">স্ট্যাটাস</TableHead>
                <TableHead className="font-heading font-semibold text-center">পদক্ষেপ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium whitespace-nowrap">{item.teacher_name}</TableCell>
                  <TableCell className="text-xs">
                    <div>{item.teacher_email}</div>
                    <div className="text-muted-foreground">{item.teacher_phone}</div>
                  </TableCell>
                  <TableCell className="text-xs">{item.institute_name}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    <div className="font-medium">{item.package_classes}</div>
                    <div className="text-muted-foreground">{item.package_name}</div>
                  </TableCell>
                  <TableCell className="font-semibold whitespace-nowrap">৳{item.total_price}</TableCell>
                  <TableCell className="text-xs">{paymentLabels[item.payment_method] || item.payment_method}</TableCell>
                  <TableCell className="font-mono text-xs">{item.transaction_id}</TableCell>
                  <TableCell>{statusBadge(item.status)}</TableCell>
                  <TableCell className="text-center">
                    {item.status === "pending" ? (
                      <div className="flex gap-1 justify-center">
                        <Button
                          size="sm"
                          className="gradient-green text-white border-0 h-7 text-xs px-2"
                          onClick={() => handleAction(item.id, "approved", item.teacher_id, item.package_name, item.package_classes)}
                        >
                          <Check className="w-3 h-3 mr-1" /> অ্যাপ্রুভ
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 text-xs px-2"
                          onClick={() => handleAction(item.id, "rejected", item.teacher_id, item.package_name, item.package_classes)}
                        >
                          <X className="w-3 h-3 mr-1" /> রিজেক্ট
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {item.status === "approved" ? "✅" : "❌"}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
