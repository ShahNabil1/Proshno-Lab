import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { mongoQuery } from "@/hooks/useMongo";

interface Category {
  _id: string;
  count: number;
  type: string;
}

export default function QuestionBank() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    // Get categories grouped by class from all collections
    mongoQuery({
      action: "aggregate",
      collection: "mcq",
      pipeline: [
        { $group: { _id: "$class", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ],
    }).then((r) => {
      setCategories(r?.documents?.map((d: any) => ({ ...d, type: "MCQ" })) || []);
    }).catch(() => {});
  }, []);

  const colors = [
    "bg-accent/60 border-primary/20",
    "bg-secondary border-border",
  ];

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-center mb-6">প্রশ্নব্যাংক</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {categories.map((cat, i) => (
          <Card key={cat._id} className={`hover-lift cursor-pointer ${colors[i % 2]}`}>
            <CardContent className="p-6 text-center">
              <h3 className="font-heading font-bold text-lg">{cat._id}</h3>
              <p className="text-sm text-muted-foreground mt-1">{cat.count} প্রশ্ন</p>
            </CardContent>
          </Card>
        ))}
        {categories.length === 0 && (
          <p className="col-span-full text-center text-muted-foreground py-10">ক্যাটাগরি লোড হচ্ছে...</p>
        )}
      </div>
    </div>
  );
}
