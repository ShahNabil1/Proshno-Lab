import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save, GripVertical } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Faq {
  id: number;
  question: string;
  answer: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export default function AdminFaqs() {
  const [items, setItems] = useState<Faq[]>([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [newOrder, setNewOrder] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchFaqs = async () => {
    const { data } = await supabase
      .from("faqs")
      .select("*")
      .order("sort_order", { ascending: true });
    if (data) setItems(data as Faq[]);
  };

  useEffect(() => { fetchFaqs(); }, []);

  const handleAdd = async () => {
    if (!newQuestion.trim() || !newAnswer.trim()) return toast.error("প্রশ্ন ও উত্তর উভয়ই লিখুন");
    setLoading(true);
    const { error } = await supabase.from("faqs").insert({
      question: newQuestion.trim(),
      answer: newAnswer.trim(),
      sort_order: newOrder,
    } as any);
    setLoading(false);
    if (error) return toast.error("যোগ করা যায়নি");
    toast.success("FAQ যোগ হয়েছে");
    setNewQuestion("");
    setNewAnswer("");
    setNewOrder(0);
    fetchFaqs();
  };

  const toggleActive = async (id: number, val: boolean) => {
    await supabase.from("faqs").update({ is_active: val } as any).eq("id", id);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, is_active: val } : i)));
    toast.success(val ? "সক্রিয় করা হয়েছে" : "নিষ্ক্রিয় করা হয়েছে");
  };

  const handleDelete = async (id: number) => {
    await supabase.from("faqs").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast.success("মুছে ফেলা হয়েছে");
  };

  const handleUpdate = async (id: number, question: string, answer: string, sort_order: number) => {
    await supabase.from("faqs").update({ question, answer, sort_order } as any).eq("id", id);
    fetchFaqs();
    toast.success("আপডেট হয়েছে");
  };

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold">FAQ ম্যানেজমেন্ট</h1>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="font-heading font-semibold text-sm">নতুন FAQ যোগ করুন</h3>
          <Input
            placeholder="প্রশ্ন..."
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
          />
          <Textarea
            placeholder="উত্তর..."
            value={newAnswer}
            onChange={(e) => setNewAnswer(e.target.value)}
            rows={2}
          />
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-xs">ক্রম:</Label>
              <Input
                type="number"
                className="w-20 h-8 text-sm"
                value={newOrder}
                onChange={(e) => setNewOrder(Number(e.target.value))}
                min={0}
              />
            </div>
            <Button size="sm" onClick={handleAdd} disabled={loading} className="gap-1.5">
              <Plus className="w-4 h-4" /> যোগ করুন
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {items.map((item) => (
          <FaqRow
            key={item.id}
            item={item}
            onToggle={toggleActive}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
          />
        ))}
        {items.length === 0 && (
          <p className="text-center text-muted-foreground py-8 text-sm">কোনো FAQ নেই</p>
        )}
      </div>
    </div>
  );
}

function FaqRow({
  item,
  onToggle,
  onDelete,
  onUpdate,
}: {
  item: Faq;
  onToggle: (id: number, val: boolean) => void;
  onDelete: (id: number) => void;
  onUpdate: (id: number, q: string, a: string, order: number) => void;
}) {
  const [question, setQuestion] = useState(item.question);
  const [answer, setAnswer] = useState(item.answer);
  const [order, setOrder] = useState(item.sort_order);
  const dirty = question !== item.question || answer !== item.answer || order !== item.sort_order;

  return (
    <Card className={!item.is_active ? "opacity-60" : ""}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start gap-3">
          <GripVertical className="w-4 h-4 text-muted-foreground mt-2.5 shrink-0" />
          <div className="flex-1 space-y-2">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="text-sm font-medium"
              placeholder="প্রশ্ন"
            />
            <Textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={2}
              className="text-sm resize-none"
              placeholder="উত্তর"
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs">ক্রম:</Label>
              <Input
                type="number"
                className="w-16 h-7 text-xs"
                value={order}
                onChange={(e) => setOrder(Number(e.target.value))}
                min={0}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            {dirty && (
              <Button size="sm" variant="outline" className="gap-1" onClick={() => onUpdate(item.id, question, answer, order)}>
                <Save className="w-3.5 h-3.5" /> সেভ
              </Button>
            )}
            <div className="flex items-center gap-1.5">
              <Switch checked={item.is_active} onCheckedChange={(v) => onToggle(item.id, v)} />
              <span className="text-xs">{item.is_active ? "সক্রিয়" : "নিষ্ক্রিয়"}</span>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>FAQ মুছে ফেলবেন?</AlertDialogTitle>
                  <AlertDialogDescription>এটি স্থায়ীভাবে মুছে যাবে।</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>বাতিল</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(item.id)}>মুছে ফেলুন</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
