import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export default function AdminTeachers() {
  const [teachers, setTeachers] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("teachers").select("*").order("created_at", { ascending: false })
      .then(({ data }) => setTeachers(data || []));
  }, []);

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">শিক্ষক ম্যানেজমেন্ট</h1>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>নাম</TableHead>
                <TableHead>ইমেইল</TableHead>
                <TableHead>যোগদান</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.full_name || "—"}</TableCell>
                  <TableCell>{t.email}</TableCell>
                  <TableCell>{new Date(t.created_at).toLocaleDateString("bn-BD")}</TableCell>
                </TableRow>
              ))}
              {teachers.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">কোনো শিক্ষক নেই</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
