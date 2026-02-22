import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

interface ClassCount {
  id: number;
  name: string;
  count: number;
}

export default function QuestionBank() {
  const [classCounts, setClassCounts] = useState<ClassCount[]>([]);

  useEffect(() => {
    // Get all classes and count questions per class
    Promise.all([
      supabase.from("classes").select("id, name").order("name"),
      supabase.from("questions").select("class_id"),
    ]).then(([classRes, qRes]) => {
      const classes = classRes.data || [];
      const questions = qRes.data || [];
      const countMap: Record<number, number> = {};
      questions.forEach((q: any) => { countMap[q.class_id] = (countMap[q.class_id] || 0) + 1; });
      setClassCounts(classes.map(c => ({ id: c.id, name: c.name, count: countMap[c.id] || 0 })));
    });
  }, []);

  const colors = ["bg-accent/60 border-primary/20", "bg-secondary border-border"];

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-center mb-6">প্রশ্নব্যাংক</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {classCounts.map((cat, i) => (
          <Card key={cat.id} className={`hover-lift cursor-pointer ${colors[i % 2]}`}>
            <CardContent className="p-6 text-center">
              <h3 className="font-heading font-bold text-lg">{cat.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">{cat.count} প্রশ্ন</p>
            </CardContent>
          </Card>
        ))}
        {classCounts.length === 0 && (
          <p className="col-span-full text-center text-muted-foreground py-10">ক্যাটাগরি লোড হচ্ছে...</p>
        )}
      </div>
    </div>
  );
}
