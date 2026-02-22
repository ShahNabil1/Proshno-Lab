import { useEffect, useState } from "react";
import { ChevronRight, Folder } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface ClassGroup {
  class_id: number;
  class_name: string;
  count: number;
}

export default function MyQuestions() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassGroup[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("questions")
      .select("class_id, classes(name)")
      .eq("teacher_id", user.id)
      .then(({ data }) => {
        if (!data) return;
        const grouped: Record<number, ClassGroup> = {};
        data.forEach((q: any) => {
          const cid = q.class_id;
          if (!grouped[cid]) grouped[cid] = { class_id: cid, class_name: q.classes?.name || "", count: 0 };
          grouped[cid].count++;
        });
        setClasses(Object.values(grouped).sort((a, b) => a.class_name.localeCompare(b.class_name)));
      });
  }, [user]);

  return (
    <div>
      <div className="gradient-hero rounded-2xl p-6 text-center text-white mb-6">
        <h1 className="font-heading text-xl font-bold">ক্লাউড ব্যাকআপ</h1>
      </div>

      <p className="text-sm text-muted-foreground text-center mb-6">
        আপনার তৈরী সকল প্রশ্ন আমাদের সার্ভারে অত্যন্ত নিরাপত্তায় সংরক্ষিত আছে। সকল প্রশ্ন শ্রেণী, বিষয়, অধ্যায় অনুযায়ী সাজানো আছে।
      </p>

      <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
        {classes.length === 0 ? (
          <p className="text-center text-muted-foreground py-10">কোনো প্রশ্ন পাওয়া যায়নি</p>
        ) : (
          classes.map((cls) => (
            <button key={cls.class_id} className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted transition-colors text-left">
              <div className="flex items-center gap-3">
                <Folder className="w-5 h-5 text-foreground" />
                <span className="font-medium text-foreground">{cls.class_name}</span>
                <span className="text-xs text-muted-foreground">({cls.count})</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
