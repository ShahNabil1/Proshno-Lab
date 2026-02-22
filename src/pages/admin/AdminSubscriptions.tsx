import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function AdminSubscriptions() {
  const [subs, setSubs] = useState<any[]>([]);

  const fetchSubs = async () => {
    const { data } = await supabase.from("subscriptions").select("*, teachers(full_name, email)").order("created_at", { ascending: false });
    setSubs(data || []);
  };

  useEffect(() => { fetchSubs(); }, []);

  const toggleStatus = async (id: number, current: string) => {
    const newStatus = current === "active" ? "inactive" : "active";
    const { error } = await supabase.from("subscriptions").update({ status: newStatus }).eq("id", id);
    if (error) { toast.error("আপডেট ব্যর্থ"); return; }
    toast.success(`স্ট্যাটাস ${newStatus} করা হয়েছে`);
    fetchSubs();
  };

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">সাবস্ক্রিপশন ম্যানেজমেন্ট</h1>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>শিক্ষক</TableHead>
                <TableHead>প্ল্যান</TableHead>
                <TableHead>স্ট্যাটাস</TableHead>
                <TableHead>মেয়াদ</TableHead>
                <TableHead className="text-right">অ্যাকশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subs.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{(s as any).teachers?.full_name || s.teacher_id}</TableCell>
                  <TableCell>{s.plan}</TableCell>
                  <TableCell>
                    <Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge>
                  </TableCell>
                  <TableCell>{s.ends_at ? new Date(s.ends_at).toLocaleDateString("bn-BD") : "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => toggleStatus(s.id, s.status)}>
                      {s.status === "active" ? "নিষ্ক্রিয়" : "সক্রিয়"} করুন
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {subs.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">কোনো সাবস্ক্রিপশন নেই</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
