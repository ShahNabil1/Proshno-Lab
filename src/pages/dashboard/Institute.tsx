import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Pencil } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Institute() {
  const { user } = useAuth();
  const [institute, setInstitute] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", upazila: "", district: "", division: "" });

  useEffect(() => {
    if (!user) return;
    supabase.from("institutes").select("*").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setInstitute(data);
          setForm({ name: data.name, upazila: data.upazila || "", district: data.district || "", division: data.division || "" });
        }
      });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    if (institute) {
      const { error } = await supabase.from("institutes").update(form).eq("id", institute.id);
      if (error) { toast.error("আপডেট ব্যর্থ"); return; }
      setInstitute({ ...institute, ...form });
    } else {
      const { data, error } = await supabase.from("institutes").insert({ ...form, user_id: user.id }).select().single();
      if (error) { toast.error("সংরক্ষণ ব্যর্থ"); return; }
      setInstitute(data);
    }
    setEditing(false);
    toast.success("সংরক্ষিত হয়েছে!");
  };

  const avatarUrl = user?.user_metadata?.avatar_url;
  const fullName = user?.user_metadata?.full_name || "শিক্ষক";
  const email = user?.email;

  return (
    <div className="space-y-6">
      {/* Institute Banner */}
      <div className="gradient-hero rounded-2xl p-8 text-center text-white">
        <h1 className="font-heading text-2xl font-bold">
          {institute?.name || "আপনার প্রতিষ্ঠান"}
        </h1>
        {institute?.joined_at && (
          <p className="text-white/60 text-sm mt-1">
            Joined: {new Date(institute.joined_at).toLocaleDateString("bn-BD")}
          </p>
        )}
      </div>

      {/* Teacher Card */}
      <div>
        <h2 className="font-heading text-xl font-bold text-center mb-4">আমাদের শিক্ষকবৃন্দ</h2>
        <Card className="max-w-xs mx-auto">
          <CardContent className="p-6 text-center">
            {avatarUrl ? (
              <img src={avatarUrl} alt={fullName} className="w-20 h-20 rounded-full mx-auto mb-3 object-cover ring-2 ring-primary/20" />
            ) : (
              <div className="w-20 h-20 rounded-full gradient-green mx-auto flex items-center justify-center mb-3">
                <User className="w-10 h-10 text-primary-foreground" />
              </div>
            )}
            <h3 className="font-heading font-bold">{fullName}</h3>
            <p className="text-sm text-muted-foreground">{email}</p>
            <span className="inline-block mt-2 text-xs font-medium text-primary border border-primary/30 rounded-full px-3 py-0.5">Owner</span>
          </CardContent>
        </Card>
      </div>

      {/* Address */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold text-center flex-1">ঠিকানা</h3>
            <Button variant="ghost" size="icon" onClick={() => setEditing(!editing)}>
              <Pencil className="w-4 h-4" />
            </Button>
          </div>

          {editing ? (
            <div className="space-y-3">
              <div>
                <Label>প্রতিষ্ঠানের নাম</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>উপজেলা</Label>
                <Input value={form.upazila} onChange={(e) => setForm({ ...form, upazila: e.target.value })} />
              </div>
              <div>
                <Label>জেলা</Label>
                <Input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} />
              </div>
              <div>
                <Label>বিভাগ</Label>
                <Input value={form.division} onChange={(e) => setForm({ ...form, division: e.target.value })} />
              </div>
              <Button onClick={handleSave} className="gradient-green text-primary-foreground border-0">সংরক্ষণ করুন</Button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-border">
                  <td className="py-2.5 text-muted-foreground w-28">উপজেলা</td>
                  <td className="py-2.5 font-medium">{institute?.upazila || "—"}</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2.5 text-muted-foreground">জেলা</td>
                  <td className="py-2.5 font-medium">{institute?.district || "—"}</td>
                </tr>
                <tr>
                  <td className="py-2.5 text-muted-foreground">বিভাগ</td>
                  <td className="py-2.5 font-medium">{institute?.division || "—"}</td>
                </tr>
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
