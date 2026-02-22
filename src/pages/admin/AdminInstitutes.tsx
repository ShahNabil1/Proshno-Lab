import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

export default function AdminInstitutes() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("institutes").select("*, teachers(full_name)").order("created_at", { ascending: false })
      .then(({ data }) => setItems(data || []));
  }, []);

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">প্রতিষ্ঠান সমূহ</h1>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>নাম</TableHead>
                <TableHead>মালিক</TableHead>
                <TableHead>উপজেলা</TableHead>
                <TableHead>জেলা</TableHead>
                <TableHead>বিভাগ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.name}</TableCell>
                  <TableCell>{(i as any).teachers?.full_name || "—"}</TableCell>
                  <TableCell>{i.upazila || "—"}</TableCell>
                  <TableCell>{i.district || "—"}</TableCell>
                  <TableCell>{i.division || "—"}</TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">কোনো প্রতিষ্ঠান নেই</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
