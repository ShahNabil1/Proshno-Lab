import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Announcement {
  id: number;
  text: string;
  is_active: boolean;
  priority: number;
  created_at: string;
}

export default function AdminAnnouncements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [newText, setNewText] = useState("");
  const [newPriority, setNewPriority] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetch = async () => {
    const { data } = await supabase
      .from("announcements")
      .select("*")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });
    if (data) setItems(data);
  };

  useEffect(() => { fetch(); }, []);

  const handleAdd = async () => {
    if (!newText.trim()) return toast.error("টেক্সট লিখুন");
    setLoading(true);
    const { error } = await supabase.from("announcements").insert({ text: newText.trim(), priority: newPriority });
    setLoading(false);
    if (error) return toast.error("যোগ করা যায়নি");
    toast.success("অ্যানাউন্সমেন্ট যোগ হয়েছে");
    setNewText("");
    setNewPriority(0);
    fetch();
  };

  const toggleActive = async (id: number, val: boolean) => {
    await supabase.from("announcements").update({ is_active: val }).eq("id", id);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, is_active: val } : i)));
    toast.success(val ? "সক্রিয় করা হয়েছে" : "নিষ্ক্রিয় করা হয়েছে");
  };

  const handleDelete = async (id: number) => {
    await supabase.from("announcements").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast.success("মুছে ফেলা হয়েছে");
  };

  const handleUpdateText = async (id: number, text: string) => {
    await supabase.from("announcements").update({ text }).eq("id", id);
    toast.success("আপডেট হয়েছে");
  };

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold">অ্যানাউন্সমেন্ট ম্যানেজমেন্ট</h1>

      {/* Add new */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="font-heading font-semibold text-sm">নতুন অ্যানাউন্সমেন্ট যোগ করুন</h3>
          <Textarea
            placeholder="অ্যানাউন্সমেন্ট টেক্সট (বাংলায়)..."
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            rows={2}
          />
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-xs">প্রাধান্য:</Label>
              <Input
                type="number"
                className="w-20 h-8 text-sm"
                value={newPriority}
                onChange={(e) => setNewPriority(Number(e.target.value))}
                min={0}
                max={99}
              />
            </div>
            <Button size="sm" onClick={handleAdd} disabled={loading} className="gap-1.5">
              <Plus className="w-4 h-4" /> যোগ করুন
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <div className="space-y-3">
        {items.map((item) => (
          <AnnouncementRow
            key={item.id}
            item={item}
            onToggle={toggleActive}
            onDelete={handleDelete}
            onUpdate={handleUpdateText}
          />
        ))}
        {items.length === 0 && (
          <p className="text-center text-muted-foreground py-8 text-sm">কোনো অ্যানাউন্সমেন্ট নেই</p>
        )}
      </div>
    </div>
  );
}

function AnnouncementRow({
  item,
  onToggle,
  onDelete,
  onUpdate,
}: {
  item: Announcement;
  onToggle: (id: number, val: boolean) => void;
  onDelete: (id: number) => void;
  onUpdate: (id: number, text: string) => void;
}) {
  const [text, setText] = useState(item.text);
  const dirty = text !== item.text;

  return (
    <Card className={!item.is_active ? "opacity-60" : ""}>
      <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={1}
            className="text-sm resize-none"
          />
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>প্রাধান্য: {item.priority}</span>
            <span>তৈরি: {new Date(item.created_at).toLocaleDateString("bn-BD")}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {dirty && (
            <Button size="sm" variant="outline" className="gap-1" onClick={() => onUpdate(item.id, text)}>
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
                <AlertDialogTitle>অ্যানাউন্সমেন্ট মুছে ফেলবেন?</AlertDialogTitle>
                <AlertDialogDescription>এটি স্থায়ীভাবে মুছে যাবে।</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>বাতিল</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(item.id)}>মুছে ফেলুন</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
