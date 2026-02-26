import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Lock, ChevronRight, ShieldCheck, Sparkles, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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

interface PricingPackage {
  id: number;
  type: string;
  class_name: string;
  subject_name: string;
  price: number;
}

function toBengaliNum(n: number): string {
  const bn = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return n.toString().split("").map((d) => bn[+d] ?? d).join("");
}

export default function QuestionBank() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [expandedClass, setExpandedClass] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalClass, setModalClass] = useState<ClassItem | null>(null);
  const [modalSubject, setModalSubject] = useState<SubjectItem | null>(null);
  const [packages, setPackages] = useState<PricingPackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const [classRes, qRes, subRes, permRes, freeChapRes] = await Promise.all([
        supabase.from("classes").select("id, name").order("name"),
        supabase.from("questions").select("class_id"),
        supabase.from("subjects").select("id, name, class_id"),
        user
          ? supabase.from("user_permissions").select("class_id, subject_id").eq("user_id", user.id)
          : Promise.resolve({ data: [] }),
        supabase.from("chapters").select("subject_id").eq("is_free", true),
      ]);

      const allClasses = classRes.data || [];
      const questions = qRes.data || [];
      const subjects = subRes.data || [];
      const perms = permRes.data || [];
      const freeChapters = freeChapRes.data || [];

      const freeSubjectIds = new Set(freeChapters.map((fc: any) => fc.subject_id as number));

      const countMap: Record<number, number> = {};
      questions.forEach((q: any) => {
        countMap[q.class_id] = (countMap[q.class_id] || 0) + 1;
      });

      const classItems: ClassItem[] = allClasses.map((c: any) => {
        const classSubjects = subjects
          .filter((s: any) => s.class_id === c.id)
          .map((s: any) => ({
            id: s.id,
            name: s.name,
            hasAccess: perms.some((p: any) => p.class_id === c.id && p.subject_id === s.id),
            isFree: freeSubjectIds.has(s.id),
          }));
        return { id: c.id, name: c.name, count: countMap[c.id] || 0, subjects: classSubjects };
      });

      setClasses(classItems);
      setLoading(false);
    }
    load();
  }, [user]);

  const hasClassAccess = (classItem: ClassItem) =>
    classItem.subjects.some((s) => s.hasAccess || s.isFree);

  const openSubscriptionModal = async (classItem: ClassItem, subject: SubjectItem) => {
    setModalClass(classItem);
    setModalSubject(subject);
    setModalOpen(true);
    setPackagesLoading(true);

    const { data } = await supabase
      .from("pricing_packages")
      .select("id, type, class_name, subject_name, price")
      .eq("class_name", classItem.name)
      .eq("is_active", true)
      .order("sort_order");

    setPackages(data || []);
    setPackagesLoading(false);
  };

  const handleSubjectClick = (classItem: ClassItem, subject: SubjectItem) => {
    if (!subject.hasAccess && !subject.isFree) {
      openSubscriptionModal(classItem, subject);
      return;
    }
    // Accessible subject clicked
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
                              ? "bg-muted/60 text-muted-foreground cursor-pointer hover:bg-muted"
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
                          openSubscriptionModal(cls, cls.subjects[0]);
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

      {/* Subscription Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center mb-2">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="w-7 h-7 text-primary" />
              </div>
            </div>
            <DialogTitle className="text-center font-heading text-xl">
              সাবস্ক্রিপশন প্রয়োজন
            </DialogTitle>
            <DialogDescription className="text-center">
              <span className="font-semibold text-foreground">
                {modalClass?.name} — {modalSubject?.name}
              </span>{" "}
              এক্সেস করতে একটি প্যাকেজ কিনুন
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-3">
            {packagesLoading ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                প্যাকেজ লোড হচ্ছে...
              </div>
            ) : packages.length > 0 ? (
              <>
                {/* Bundle package (সকল বিষয়) */}
                {packages
                  .filter((p) => p.type === "bundle" || p.subject_name === "সকল বিষয়")
                  .map((pkg) => (
                    <div
                      key={pkg.id}
                      className="relative overflow-hidden rounded-xl border-2 border-primary/50 bg-gradient-to-br from-primary/5 to-accent/30 p-4"
                    >
                      <div className="absolute top-0 right-0">
                        <Badge className="rounded-none rounded-bl-lg bg-primary text-primary-foreground text-[10px] px-2">
                          <Sparkles className="w-3 h-3 mr-1" />
                          সেরা অফার
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div>
                          <p className="font-heading font-bold text-base">
                            {pkg.class_name} — সকল বিষয়
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            সকল বিষয়ের সম্পূর্ণ এক্সেস
                          </p>
                        </div>
                        <p className="font-heading font-bold text-xl text-primary">
                          ৳{toBengaliNum(pkg.price)}
                        </p>
                      </div>
                      <Button
                        className="w-full mt-3"
                        size="sm"
                        onClick={() => {
                          setModalOpen(false);
                          navigate(
                            `/checkout?package=${encodeURIComponent(pkg.class_name + " — সকল বিষয়")}&price=${pkg.price}&classes=${encodeURIComponent(pkg.class_name)}&subject=${encodeURIComponent("সকল বিষয়")}`
                          );
                        }}
                      >
                        <ShieldCheck className="w-4 h-4 mr-1.5" />
                        এই প্যাকেজ কিনুন
                      </Button>
                    </div>
                  ))}

                {/* Individual subject packages */}
                <div className="space-y-2">
                  {packages
                    .filter(
                      (p) => p.type !== "bundle" && p.subject_name !== "সকল বিষয়"
                    )
                    .map((pkg) => {
                      const isTarget =
                        modalSubject && pkg.subject_name === modalSubject.name;
                      return (
                        <div
                          key={pkg.id}
                          className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                            isTarget
                              ? "border-primary/40 bg-primary/5"
                              : "border-border bg-card"
                          }`}
                        >
                          <div>
                            <p className="font-medium text-sm">{pkg.subject_name}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-heading font-bold text-base">
                              ৳{toBengaliNum(pkg.price)}
                            </span>
                            <Button
                              variant={isTarget ? "default" : "outline"}
                              size="sm"
                              className="text-xs h-8"
                              onClick={() => {
                                setModalOpen(false);
                                navigate(
                                  `/checkout?package=${encodeURIComponent(pkg.class_name + " — " + pkg.subject_name)}&price=${pkg.price}&classes=${encodeURIComponent(pkg.class_name)}&subject=${encodeURIComponent(pkg.subject_name)}`
                                );
                              }}
                            >
                              কিনুন
                              <ArrowRight className="w-3 h-3 ml-1" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-3">
                  এই শ্রেণির জন্য কোনো প্যাকেজ পাওয়া যায়নি
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setModalOpen(false);
                    navigate("/pricing");
                  }}
                >
                  সকল প্যাকেজ দেখুন
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </div>
            )}
          </div>

          <div className="mt-3 text-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => {
                setModalOpen(false);
                navigate("/pricing");
              }}
            >
              সকল প্যাকেজ দেখুন →
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
