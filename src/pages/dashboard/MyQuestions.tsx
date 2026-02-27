import { useEffect, useState } from "react";
import { ChevronRight, Folder, FileText, Trash2, Calendar } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface SavedPaper {
  id: string;
  institution_name: string;
  exam_name: string;
  class_name: string;
  subject_name: string;
  chapter_names: string[];
  question_ids: number[];
  created_at: string;
}

interface ClassGroup {
  class_name: string;
  papers: SavedPaper[];
}

const toBanglaNum = (n: number): string => {
  const digits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(n).split("").map(d => digits[parseInt(d)] ?? d).join("");
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  const day = toBanglaNum(d.getDate());
  const months = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
  const month = months[d.getMonth()];
  const year = toBanglaNum(d.getFullYear());
  return `${day} ${month}, ${year}`;
};

export default function MyQuestions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [papers, setPapers] = useState<SavedPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedClass, setExpandedClass] = useState<string | null>(null);

  const fetchPapers = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("saved_papers")
      .select("id, institution_name, exam_name, class_name, subject_name, chapter_names, question_ids, created_at")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false });
    setPapers((data as SavedPaper[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchPapers();
  }, [user]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("saved_papers").delete().eq("id", id);
    if (error) {
      toast.error("মুছে ফেলতে সমস্যা হয়েছে");
      return;
    }
    setPapers(prev => prev.filter(p => p.id !== id));
    toast.success("প্রশ্নপত্র মুছে ফেলা হয়েছে");
  };

  // Group papers by class_name
  const grouped: ClassGroup[] = [];
  const classMap = new Map<string, SavedPaper[]>();
  papers.forEach(p => {
    const cls = p.class_name || "অশ্রেণীবদ্ধ";
    if (!classMap.has(cls)) classMap.set(cls, []);
    classMap.get(cls)!.push(p);
  });
  classMap.forEach((papers, class_name) => {
    grouped.push({ class_name, papers });
  });

  return (
    <div>
      <div className="gradient-hero rounded-2xl p-6 text-center text-white mb-6">
        <h1 className="font-heading text-xl font-bold">ক্লাউড ব্যাকআপ</h1>
      </div>

      <p className="text-sm text-muted-foreground text-center mb-6">
        আপনার সেভ করা সকল প্রশ্নপত্র এখানে নিরাপদে সংরক্ষিত আছে। যেকোনো সময় খুলুন, এডিট করুন বা ডাউনলোড করুন।
      </p>

      {loading ? (
        <div className="text-center py-10">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">লোড হচ্ছে...</p>
        </div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-muted-foreground mb-4">কোনো সেভ করা প্রশ্নপত্র পাওয়া যায়নি</p>
          <Button onClick={() => navigate("/dashboard/create")} className="gradient-green text-primary-foreground border-0">
            প্রশ্ন তৈরি করুন
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map((group) => (
            <div key={group.class_name} className="border border-border rounded-xl overflow-hidden">
              {/* Class folder header */}
              <button
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted transition-colors text-left bg-card"
                onClick={() => setExpandedClass(expandedClass === group.class_name ? null : group.class_name)}
              >
                <div className="flex items-center gap-3">
                  <Folder className="w-5 h-5 text-primary" />
                  <span className="font-heading font-bold text-foreground">{group.class_name}</span>
                  <Badge variant="secondary" className="text-xs">{toBanglaNum(group.papers.length)}টি প্রশ্নপত্র</Badge>
                </div>
                <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${expandedClass === group.class_name ? "rotate-90" : ""}`} />
              </button>

              {/* Expanded papers list */}
              {expandedClass === group.class_name && (
                <div className="divide-y divide-border border-t border-border">
                  {group.papers.map((paper) => (
                    <div key={paper.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50 transition-colors">
                      <button
                        className="flex-1 flex items-start gap-3 text-left min-w-0"
                        onClick={() => navigate(`/dashboard/view-paper?paper_id=${paper.id}`)}
                      >
                        <FileText className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {paper.exam_name || paper.subject_name || "প্রশ্নপত্র"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {paper.subject_name} • {paper.chapter_names?.join(", ") || ""} • {toBanglaNum(paper.question_ids?.length || 0)}টি প্রশ্ন
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3" /> {formatDate(paper.created_at)}
                          </p>
                        </div>
                      </button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>প্রশ্নপত্র মুছে ফেলবেন?</AlertDialogTitle>
                            <AlertDialogDescription>
                              এই প্রশ্নপত্রটি স্থায়ীভাবে মুছে ফেলা হবে। এটি পূর্বাবস্থায় ফেরানো সম্ভব হবে না।
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>বাতিল</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => handleDelete(paper.id)}
                            >
                              মুছে ফেলুন
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
