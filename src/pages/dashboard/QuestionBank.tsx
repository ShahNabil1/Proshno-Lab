import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Lock, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface ClassItem {
  id: number;
  name: string;
  count: number;
  subjects: SubjectItem[];
}

interface SubjectItem {
  id: number;
  name: string;
  hasAccess: boolean;
  isFree: boolean;
}

export default function QuestionBank() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [permissions, setPermissions] = useState<{ class_id: number; subject_id: number }[]>([]);
  const [freeChapterSubjects, setFreeChapterSubjects] = useState<Set<number>>(new Set());
  const [expandedClass, setExpandedClass] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [classRes, qRes, subRes, permRes, freeChapRes] = await Promise.all([
        supabase.from("classes").select("id, name").order("name"),
        supabase.from("questions").select("class_id"),
        supabase.from("subjects").select("id, name, class_id"),
        user
          ? supabase.from("user_permissions").select("class_id, subject_id").eq("user_id", user.id)
          : Promise.resolve({ data: [] }),
        // Find subjects that have at least one free chapter
        supabase.from("chapters").select("subject_id").eq("is_free", true),
      ]);

      const allClasses = classRes.data || [];
      const questions = qRes.data || [];
      const subjects = subRes.data || [];
      const perms = permRes.data || [];
      const freeChapters = freeChapRes.data || [];

      // Set of subject_ids that have free chapters
      const freeSubjectIds = new Set(freeChapters.map((fc: any) => fc.subject_id as number));
      setFreeChapterSubjects(freeSubjectIds);

      setPermissions(perms as any);

      // Count questions per class
      const countMap: Record<number, number> = {};
      questions.forEach((q: any) => {
        countMap[q.class_id] = (countMap[q.class_id] || 0) + 1;
      });

      // Build class items with subjects
      const classItems: ClassItem[] = allClasses.map((c: any) => {
        const classSubjects = subjects
          .filter((s: any) => s.class_id === c.id)
          .map((s: any) => ({
            id: s.id,
            name: s.name,
            hasAccess: perms.some((p: any) => p.class_id === c.id && p.subject_id === s.id),
            isFree: freeSubjectIds.has(s.id),
          }));

        return {
          id: c.id,
          name: c.name,
          count: countMap[c.id] || 0,
          subjects: classSubjects,
        };
      });

      setClasses(classItems);
      setLoading(false);
    }
    load();
  }, [user]);

  const hasClassAccess = (classItem: ClassItem) => {
    return classItem.subjects.some((s) => s.hasAccess || s.isFree);
  };

  const handleSubjectClick = (classItem: ClassItem, subject: SubjectItem) => {
    if (!subject.hasAccess && !subject.isFree) {
      toast.error("সাবস্ক্রিপশন প্রয়োজন", {
        description: `"${classItem.name} - ${subject.name}" এক্সেস করতে সাবস্ক্রিপশন কিনুন।`,
        action: {
          label: "প্যাকেজ দেখুন",
          onClick: () => navigate("/pricing"),
        },
      });
      return;
    }
    // Navigate or expand — for now just toast success
    toast.success(`${subject.name} নির্বাচিত`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">লোড হচ্ছে...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-center mb-6">eExamapp</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {classes.map((cls) => {
          const accessible = hasClassAccess(cls);
          const isExpanded = expandedClass === cls.id;

          return (
            <Card
              key={cls.id}
              className={`transition-all cursor-pointer border ${
                accessible
                  ? "hover:shadow-md hover:border-primary/40 bg-card"
                  : "bg-muted/40 border-border/50"
              }`}
              onClick={() => setExpandedClass(isExpanded ? null : cls.id)}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {!accessible && (
                      <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <div>
                      <h3 className="font-heading font-bold text-lg">{cls.name}</h3>
                      <p className="text-sm text-muted-foreground">{cls.count} প্রশ্ন</p>
                    </div>
                  </div>
                  <ChevronRight
                    className={`w-5 h-5 text-muted-foreground transition-transform ${
                      isExpanded ? "rotate-90" : ""
                    }`}
                  />
                </div>

                {/* Expanded subjects list */}
                {isExpanded && cls.subjects.length > 0 && (
                  <div className="mt-4 space-y-2 border-t pt-3">
                    {cls.subjects.map((sub) => {
                      const locked = !sub.hasAccess && !sub.isFree;
                      return (
                        <div
                          key={sub.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSubjectClick(cls, sub);
                          }}
                          className={`flex items-center justify-between p-2.5 rounded-lg text-sm transition-colors ${
                            locked
                              ? "bg-muted/60 text-muted-foreground cursor-not-allowed"
                              : "bg-accent/40 hover:bg-accent cursor-pointer"
                          }`}
                        >
                          <span className="font-medium">{sub.name}</span>
                          {locked ? (
                            <div className="flex items-center gap-1.5">
                              <Lock className="w-3.5 h-3.5" />
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                লক
                              </Badge>
                            </div>
                          ) : sub.isFree ? (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              ফ্রি
                            </Badge>
                          ) : (
                            <Badge className="text-[10px] px-1.5 py-0 bg-primary/80">
                              সক্রিয়
                            </Badge>
                          )}
                        </div>
                      );
                    })}

                    {cls.subjects.every((s) => !s.hasAccess && !s.isFree) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate("/pricing");
                        }}
                      >
                        সাবস্ক্রিপশন কিনুন
                      </Button>
                    )}
                  </div>
                )}

                {isExpanded && cls.subjects.length === 0 && (
                  <p className="mt-4 text-xs text-muted-foreground text-center border-t pt-3">
                    কোনো বিষয় নেই
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
