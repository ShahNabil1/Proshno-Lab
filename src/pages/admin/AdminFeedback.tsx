import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export default function AdminFeedback() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("feedback").select("*, teachers(full_name)").order("created_at", { ascending: false })
      .then(({ data }) => setItems(data || []));
  }, []);

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">মতামত সমূহ</h1>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>শিক্ষক</TableHead>
                <TableHead>ক্যাটাগরি</TableHead>
                <TableHead>বিষয়</TableHead>
                <TableHead>বিস্তারিত</TableHead>
                <TableHead>গুরুত্ব</TableHead>
                <TableHead>তারিখ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>{(f as any).teachers?.full_name || "—"}</TableCell>
                  <TableCell>{f.category}</TableCell>
                  <TableCell className="font-medium">{f.subject}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{f.details}</TableCell>
                  <TableCell>
                    <Badge variant={f.priority === "high" ? "destructive" : "secondary"}>{f.priority}</Badge>
                  </TableCell>
                  <TableCell>{new Date(f.created_at).toLocaleDateString("bn-BD")}</TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">কোনো মতামত নেই</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
