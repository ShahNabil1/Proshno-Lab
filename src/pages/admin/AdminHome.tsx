import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export default function AdminHome() {
  const [stats, setStats] = useState({ teachers: 0, questions: 0, classes: 0, subjects: 0 });

  useEffect(() => {
    Promise.all([
      supabase.from("teachers").select("id", { count: "exact", head: true }),
      supabase.from("questions").select("id", { count: "exact", head: true }),
      supabase.from("classes").select("id", { count: "exact", head: true }),
      supabase.from("subjects").select("id", { count: "exact", head: true }),
    ]).then(([t, q, c, s]) => {
      setStats({ teachers: t.count || 0, questions: q.count || 0, classes: c.count || 0, subjects: s.count || 0 });
    });
  }, []);

  const cards = [
    { label: "শিক্ষক", value: stats.teachers },
    { label: "প্রশ্ন", value: stats.questions },
    { label: "শ্রেণী", value: stats.classes },
    { label: "বিষয়", value: stats.subjects },
  ];

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">Admin Dashboard</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-5">
              <p className="text-muted-foreground text-sm">{c.label}</p>
              <p className="text-3xl font-heading font-bold text-primary mt-1">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
