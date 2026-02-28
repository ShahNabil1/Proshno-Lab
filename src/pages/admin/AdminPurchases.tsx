import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Check, X, Search, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

interface SelectedPkg {
  id: number;
  class_name: string;
  subject_name: string;
  price: number;
}

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
  selected_packages: SelectedPkg[] | null;
}

const paymentLabels: Record<string, string> = {
  bkash: "বিকাশ", nagad: "নগদ", rocket: "রকেট", upay: "উপায়",
};

export default function AdminPurchases() {
  const [items, setItems] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase.from("purchase_requests").select("*").order("created_at", { ascending: false });
    setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleAction = async (id: number, action: "approved" | "rejected", item: PurchaseRequest) => {
    const { error } = await supabase
      .from("purchase_requests")
      .update({ status: action, reviewed_at: new Date().toISOString() } as any)
      .eq("id", id);

    if (error) { toast.error("সমস্যা হয়েছে"); return; }

    if (action === "approved" && item.teacher_id) {
      const teacherId = item.teacher_id;
      const endsAt = new Date();
      endsAt.setFullYear(endsAt.getFullYear() + 1);

      const selectedPkgs: SelectedPkg[] = (item.selected_packages && Array.isArray(item.selected_packages) && item.selected_packages.length > 0)
        ? item.selected_packages
        : [{ id: 0, class_name: item.package_classes, subject_name: item.package_name, price: item.package_price }];

      // Create subscriptions and permissions for each selected package
      for (const pkg of selectedPkgs) {
        const planName = `${pkg.class_name} - ${pkg.subject_name}`;

        // Insert subscription for each package
        await supabase.from("subscriptions").insert({
          teacher_id: teacherId,
          plan: planName,
          status: "active",
          starts_at: new Date().toISOString(),
          ends_at: endsAt.toISOString(),
        });

        // Resolve class
        const { data: classRow } = await supabase.from("classes").select("id").eq("name", pkg.class_name).maybeSingle();
        if (!classRow) continue;

        if (pkg.subject_name === "সকল বিষয়" || pkg.subject_name.includes("সকল বিষয়")) {
          const { data: allSubjects } = await supabase.from("subjects").select("id").eq("class_id", classRow.id);
          if (allSubjects) {
            for (const sub of allSubjects) {
              const { data: existing } = await supabase.from("user_permissions").select("id")
                .eq("user_id", teacherId).eq("class_id", classRow.id).eq("subject_id", sub.id).maybeSingle();
              if (!existing) {
                await supabase.from("user_permissions").insert({ user_id: teacherId, class_id: classRow.id, subject_id: sub.id });
              }
            }
          }
        } else {
          const { data: subjectRow } = await supabase.from("subjects").select("id")
            .eq("class_id", classRow.id).eq("name", pkg.subject_name).maybeSingle();
          if (subjectRow) {
            const { data: existing } = await supabase.from("user_permissions").select("id")
              .eq("user_id", teacherId).eq("class_id", classRow.id).eq("subject_id", subjectRow.id).maybeSingle();
            if (!existing) {
              await supabase.from("user_permissions").insert({ user_id: teacherId, class_id: classRow.id, subject_id: subjectRow.id });
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
      return item.teacher_name.toLowerCase().includes(s) || item.teacher_email.toLowerCase().includes(s) ||
        item.teacher_phone.includes(s) || item.transaction_id.toLowerCase().includes(s);
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
        <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="w-4 h-4 mr-1" /> রিফ্রেশ</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="নাম, ইমেইল, ফোন, ট্রাঞ্জ. আইডি..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1">
          {(["pending", "approved", "rejected", "all"] as const).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="text-xs">
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
              {filtered.map((item) => {
                const hasMultiple = item.selected_packages && Array.isArray(item.selected_packages) && item.selected_packages.length > 1;
                const isExpanded = expandedId === item.id;
                return (
                  <>
                    <TableRow key={item.id} className={hasMultiple ? "cursor-pointer" : ""} onClick={() => hasMultiple && setExpandedId(isExpanded ? null : item.id)}>
                      <TableCell className="font-medium whitespace-nowrap">{item.teacher_name}</TableCell>
                      <TableCell className="text-xs">
                        <div>{item.teacher_email}</div>
                        <div className="text-muted-foreground">{item.teacher_phone}</div>
                      </TableCell>
                      <TableCell className="text-xs">{item.institute_name}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        <div className="font-medium flex items-center gap-1">
                          {item.package_classes}
                          {hasMultiple && (
                            <>
                              <Badge variant="outline" className="text-[9px] ml-1">{(item.selected_packages as SelectedPkg[]).length} টি</Badge>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </>
                          )}
                        </div>
                        <div className="text-muted-foreground truncate max-w-[200px]">{item.package_name}</div>
                      </TableCell>
                      <TableCell className="font-semibold whitespace-nowrap">
                        <div>৳{item.total_price}</div>
                        {item.discount > 0 && <div className="text-[10px] text-muted-foreground">(-৳{item.discount})</div>}
                      </TableCell>
                      <TableCell className="text-xs">{paymentLabels[item.payment_method] || item.payment_method}</TableCell>
                      <TableCell className="font-mono text-xs">{item.transaction_id}</TableCell>
                      <TableCell>{statusBadge(item.status)}</TableCell>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        {item.status === "pending" ? (
                          <div className="flex gap-1 justify-center">
                            <Button size="sm" className="gradient-green text-white border-0 h-7 text-xs px-2"
                              onClick={() => handleAction(item.id, "approved", item)}>
                              <Check className="w-3 h-3 mr-1" /> অ্যাপ্রুভ
                            </Button>
                            <Button size="sm" variant="destructive" className="h-7 text-xs px-2"
                              onClick={() => handleAction(item.id, "rejected", item)}>
                              <X className="w-3 h-3 mr-1" /> রিজেক্ট
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">{item.status === "approved" ? "✅" : "❌"}</span>
                        )}
                      </TableCell>
                    </TableRow>
                    {hasMultiple && isExpanded && (
                      <TableRow key={`${item.id}-details`}>
                        <TableCell colSpan={9} className="bg-muted/30 p-4">
                          <p className="text-xs font-heading font-bold mb-2">নির্বাচিত প্যাকেজসমূহ:</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {(item.selected_packages as SelectedPkg[]).map((pkg, i) => (
                              <div key={i} className="bg-card rounded-lg border px-3 py-2 text-xs flex justify-between items-center">
                                <div>
                                  <span className="font-medium">{pkg.class_name}</span>
                                  <span className="text-muted-foreground mx-1">—</span>
                                  <span>{pkg.subject_name}</span>
                                </div>
                                <span className="font-semibold">৳{pkg.price}</span>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
