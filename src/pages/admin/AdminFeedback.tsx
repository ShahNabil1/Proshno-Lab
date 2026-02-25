import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageSquareReply, CheckCircle2, Clock, AlertCircle } from "lucide-react";

const statusOptions = [
  { value: "pending", label: "অপেক্ষমান", icon: Clock, color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  { value: "in_progress", label: "প্রক্রিয়াধীন", icon: AlertCircle, color: "bg-blue-100 text-blue-800 border-blue-300" },
  { value: "resolved", label: "সমাধান হয়েছে", icon: CheckCircle2, color: "bg-green-100 text-green-800 border-green-300" },
];

export default function AdminFeedback() {
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [reply, setReply] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchFeedback = () => {
    supabase.from("feedback").select("*, teachers(full_name)").order("created_at", { ascending: false })
      .then(({ data }) => setItems(data || []));
  };

  useEffect(() => { fetchFeedback(); }, []);

  const openDialog = (item: any) => {
    setSelected(item);
    setReply(item.admin_reply || "");
    setStatus(item.status || "pending");
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase.from("feedback").update({
      status,
      admin_reply: reply,
    }).eq("id", selected.id);
    setSaving(false);
    if (error) {
      toast.error("আপডেট ব্যর্থ হয়েছে");
    } else {
      toast.success("ফিডব্যাক আপডেট হয়েছে!");
      setSelected(null);
      fetchFeedback();
    }
  };

  const getStatusBadge = (s: string) => {
    const opt = statusOptions.find(o => o.value === s) || statusOptions[0];
    const Icon = opt.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${opt.color}`}>
        <Icon className="w-3 h-3" />
        {opt.label}
      </span>
    );
  };

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">মতামত সমূহ</h1>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>শিক্ষক</TableHead>
                <TableHead>ক্যাটাগরি</TableHead>
                <TableHead>বিষয়</TableHead>
                <TableHead>বিস্তারিত</TableHead>
                <TableHead>গুরুত্ব</TableHead>
                <TableHead>স্ট্যাটাস</TableHead>
                <TableHead>তারিখ</TableHead>
                <TableHead>অ্যাকশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>{(f as any).teachers?.full_name || "—"}</TableCell>
                  <TableCell>{f.category}</TableCell>
                  <TableCell className="font-medium">{f.subject}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{f.details}</TableCell>
                  <TableCell>
                    <Badge variant={f.priority === "high" ? "destructive" : "secondary"}>{f.priority}</Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(f.status)}</TableCell>
                  <TableCell>{new Date(f.created_at).toLocaleDateString("bn-BD")}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => openDialog(f)}>
                      <MessageSquareReply className="w-4 h-4 mr-1" /> উত্তর দিন
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">কোনো মতামত নেই</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>মতামতের উত্তর দিন</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="bg-muted p-3 rounded-lg space-y-1">
                <p className="text-sm font-medium">{selected.teachers?.full_name}</p>
                <p className="text-sm text-muted-foreground"><strong>বিষয়:</strong> {selected.subject}</p>
                <p className="text-sm">{selected.details}</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">স্ট্যাটাস পরিবর্তন</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">এ্যাডমিন উত্তর</label>
                <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="উত্তর লিখুন..." rows={4} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>বাতিল</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "সেভ হচ্ছে..." : "সেভ করুন"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
