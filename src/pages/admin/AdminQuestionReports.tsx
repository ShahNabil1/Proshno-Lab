import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Search, MessageSquareReply, Pencil, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import LatexRenderer from "@/components/LatexRenderer";

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: "অপেক্ষমান", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  resolved: { label: "সমাধান হয়েছে", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
};

export default function AdminQuestionReports() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [replyDialog, setReplyDialog] = useState<any>(null);
  const [replyText, setReplyText] = useState("");
  const [previewDialog, setPreviewDialog] = useState<any>(null);

  const fetchReports = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("question_reports" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (!data) { setReports([]); setLoading(false); return; }

    // Fetch related data for each report
    const questionIds = [...new Set((data as any[]).map((r: any) => r.question_id))];
    const teacherIds = [...new Set((data as any[]).map((r: any) => r.teacher_id))];

    const [questionsRes, teachersRes] = await Promise.all([
      supabase.from("questions").select("id, question, type, class_id, subject_id, chapter_id, topic_id, classes(name), subjects(name), chapters(name)").in("id", questionIds),
      supabase.from("teachers").select("id, full_name, email").in("id", teacherIds),
    ]);

    const qMap = new Map((questionsRes.data || []).map((q: any) => [q.id, q]));
    const tMap = new Map((teachersRes.data || []).map((t: any) => [t.id, t]));

    const enriched = (data as any[]).map((r: any) => ({
      ...r,
      questionData: qMap.get(r.question_id),
      teacherData: tMap.get(r.teacher_id),
    }));

    setReports(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchReports(); }, []);

  const handleResolve = async (report: any) => {
    const { error } = await supabase
      .from("question_reports" as any)
      .update({ status: "resolved", resolved_at: new Date().toISOString(), admin_reply: replyText || null } as any)
      .eq("id", report.id);
    if (error) { toast.error("আপডেট ব্যর্থ"); return; }
    toast.success("রিপোর্ট সমাধান হয়েছে");
    setReplyDialog(null);
    setReplyText("");
    fetchReports();
  };

  const filtered = reports.filter(r => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return r.questionData?.question?.toLowerCase().includes(q) ||
      r.teacherData?.full_name?.toLowerCase().includes(q) ||
      r.error_type?.toLowerCase().includes(q);
  });

  const typeLabels: Record<string, string> = { mcq: "MCQ", short: "সংক্ষিপ্ত", cq: "সৃজনশীল", descriptive: "বর্ণনামূলক" };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-bold">প্রশ্নের রিপোর্ট</h1>
        <Badge variant="outline" className="text-sm">{filtered.length}টি রিপোর্ট</Badge>
      </div>

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="অনুসন্ধান করুন..." className="pl-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>শিক্ষক</TableHead>
                <TableHead>প্রশ্ন</TableHead>
                <TableHead>ভুলের ধরন</TableHead>
                <TableHead>মেটাডেটা</TableHead>
                <TableHead>স্ট্যাটাস</TableHead>
                <TableHead>তারিখ</TableHead>
                <TableHead className="text-right">অ্যাকশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">লোড হচ্ছে...</TableCell></TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">কোনো রিপোর্ট নেই</TableCell></TableRow>
              )}
              {filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="text-sm font-medium">{r.teacherData?.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.teacherData?.email || ""}</div>
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <p className="text-sm truncate">{r.questionData?.question || "—"}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">{r.error_type}</Badge>
                    {r.comment && <p className="text-xs text-muted-foreground mt-1 truncate max-w-[150px]">{r.comment}</p>}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs space-y-0.5">
                      <div>{r.questionData?.classes?.name || ""}</div>
                      <div>{r.questionData?.subjects?.name || ""}</div>
                      <div>{typeLabels[r.questionData?.type] || r.questionData?.type || ""}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusMap[r.status]?.color || statusMap.pending.color}`}>
                      {statusMap[r.status]?.label || r.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(r.created_at).toLocaleDateString("bn-BD")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => setPreviewDialog(r)} title="প্রশ্ন দেখুন">
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      {r.status !== "resolved" && (
                        <Button size="sm" variant="outline" className="text-emerald-600 hover:text-emerald-700" onClick={() => { setReplyDialog(r); setReplyText(""); }} title="সমাধান করুন">
                          <CheckCircle className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Question Preview Dialog */}
      <Dialog open={!!previewDialog} onOpenChange={() => setPreviewDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">প্রশ্ন প্রিভিউ</DialogTitle>
          </DialogHeader>
          {previewDialog?.questionData && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground space-x-2">
                <span>{previewDialog.questionData.classes?.name}</span>
                <span>•</span>
                <span>{previewDialog.questionData.subjects?.name}</span>
                <span>•</span>
                <span>{typeLabels[previewDialog.questionData.type] || previewDialog.questionData.type}</span>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <LatexRenderer text={previewDialog.questionData.question} />
              </div>
              <div className="border-t pt-3">
                <p className="text-sm"><strong>ভুলের ধরন:</strong> {previewDialog.error_type}</p>
                {previewDialog.comment && <p className="text-sm mt-1"><strong>মন্তব্য:</strong> {previewDialog.comment}</p>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Resolve Dialog */}
      <Dialog open={!!replyDialog} onOpenChange={() => setReplyDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">রিপোর্ট সমাধান করুন</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">শিক্ষককে জানাতে একটি উত্তর লিখুন (ঐচ্ছিক):</p>
            <Textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="উত্তর লিখুন..." rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplyDialog(null)}>বাতিল</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleResolve(replyDialog)}>
              <CheckCircle className="w-4 h-4 mr-1" /> সমাধান করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
