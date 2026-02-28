import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Star, Trash2, Check, X, Eye } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

interface Review {
  id: number;
  name: string;
  designation: string;
  institution: string;
  image_url: string;
  rating: number;
  text: string;
  status: string;
  created_at: string;
}

export default function AdminReviews() {
  const [items, setItems] = useState<Review[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  const fetchReviews = async () => {
    let query = supabase.from("reviews").select("*").order("created_at", { ascending: false });
    if (filter !== "all") query = query.eq("status", filter);
    const { data } = await query;
    if (data) setItems(data as any);
  };

  useEffect(() => { fetchReviews(); }, [filter]);

  const updateStatus = async (id: number, status: string) => {
    await supabase.from("reviews").update({ status } as any).eq("id", id);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
    toast.success(status === "approved" ? "অনুমোদিত হয়েছে" : "প্রত্যাখ্যান হয়েছে");
  };

  const handleDelete = async (id: number) => {
    await supabase.from("reviews").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast.success("মুছে ফেলা হয়েছে");
  };

  const statusBadge = (s: string) => {
    if (s === "approved") return <Badge className="bg-green-100 text-green-700 border-0">অনুমোদিত</Badge>;
    if (s === "rejected") return <Badge variant="destructive">প্রত্যাখ্যাত</Badge>;
    return <Badge variant="outline" className="border-yellow-400 text-yellow-600">অপেক্ষমান</Badge>;
  };

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold">রিভিউ ম্যানেজমেন্ট</h1>

      <div className="flex gap-2 flex-wrap">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
            {f === "pending" ? "অপেক্ষমান" : f === "approved" ? "অনুমোদিত" : f === "rejected" ? "প্রত্যাখ্যাত" : "সব"}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.id}>
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                {item.image_url ? (
                  <img src={item.image_url} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                    {item.name.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-heading font-semibold text-sm">{item.name}</span>
                    {statusBadge(item.status)}
                  </div>
                  <p className="text-xs text-muted-foreground">{item.designation}{item.institution ? `, ${item.institution}` : ""}</p>
                  <div className="flex items-center gap-0.5 my-1">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} className={`w-3.5 h-3.5 ${j < item.rating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/20"}`} />
                    ))}
                  </div>
                  <p className="text-sm text-foreground mt-1">"{item.text}"</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(item.created_at).toLocaleDateString("bn-BD")}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {item.status === "pending" && (
                    <>
                      <Button size="sm" variant="outline" className="gap-1 text-green-600 border-green-300 hover:bg-green-50" onClick={() => updateStatus(item.id, "approved")}>
                        <Check className="w-3.5 h-3.5" /> অনুমোদন
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => updateStatus(item.id, "rejected")}>
                        <X className="w-3.5 h-3.5" /> প্রত্যাখ্যান
                      </Button>
                    </>
                  )}
                  {item.status === "approved" && (
                    <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => updateStatus(item.id, "rejected")}>
                      <X className="w-3.5 h-3.5" /> প্রত্যাখ্যান
                    </Button>
                  )}
                  {item.status === "rejected" && (
                    <Button size="sm" variant="outline" className="gap-1 text-green-600" onClick={() => updateStatus(item.id, "approved")}>
                      <Check className="w-3.5 h-3.5" /> অনুমোদন
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>রিভিউ মুছে ফেলবেন?</AlertDialogTitle>
                        <AlertDialogDescription>"{item.name}" এর রিভিউ স্থায়ীভাবে মুছে যাবে।</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>বাতিল</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(item.id)}>মুছে ফেলুন</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && (
          <p className="text-center text-muted-foreground py-8 text-sm">কোনো রিভিউ নেই</p>
        )}
      </div>
    </div>
  );
}
