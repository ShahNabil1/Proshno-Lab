import { useEffect, useState } from "react";
import { ChevronRight, Folder } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { mongoQuery } from "@/hooks/useMongo";

interface ClassGroup {
  _id: string;
  count: number;
}

export default function MyQuestions() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassGroup[]>([]);

  useEffect(() => {
    if (!user) return;
    mongoQuery({
      action: "aggregate",
      collection: "mcq",
      pipeline: [
        { $match: { teacher_id: user.id } },
        { $group: { _id: "$class", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ],
    }).then((r) => setClasses(r?.documents || [])).catch(() => {});
  }, [user]);

  const allClasses = [
    "এইচএসসি", "নবম/দশম", "অষ্টম শ্রেণী", "সপ্তম শ্রেণী",
    "ষষ্ঠ শ্রেণী", "পঞ্চম শ্রেণী", "চতুর্থ শ্রেণী", "তৃতীয় শ্রেণী",
  ];

  return (
    <div>
      {/* Banner */}
      <div className="gradient-hero rounded-2xl p-6 text-center text-white mb-6">
        <h1 className="font-heading text-xl font-bold">ক্লাউড ব্যাকআপ</h1>
      </div>

      <p className="text-sm text-muted-foreground text-center mb-6">
        আপনার তৈরী সকল প্রশ্ন আমাদের সার্ভারে অত্যন্ত নিরাপত্তায় সংরক্ষিত আছে। সকল প্রশ্ন শ্রেণী, বিষয়, অধ্যায় অনুযায়ী সাজানো আছে।
      </p>

      <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
        {allClasses.map((cls) => {
          const match = classes.find((c) => c._id === cls);
          return (
            <button
              key={cls}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <Folder className="w-5 h-5 text-foreground" />
                <span className="font-medium text-foreground">{cls}</span>
                {match && (
                  <span className="text-xs text-muted-foreground">({match.count})</span>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
