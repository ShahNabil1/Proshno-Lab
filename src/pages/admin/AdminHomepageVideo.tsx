import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import YouTubePlayer, { extractYouTubeId } from "@/components/YouTubePlayer";
import { Youtube } from "lucide-react";

export default function AdminHomepageVideo() {
  const [videoUrl, setVideoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "homepage_video_url")
      .maybeSingle()
      .then(({ data }) => {
        setVideoUrl(typeof data?.value === "string" ? (data.value as string) : "");
        setLoading(false);
      });
  }, []);

  const saveVideoUrl = async () => {
    const id = extractYouTubeId(videoUrl);
    if (!id) {
      toast.error("সঠিক ইউটিউব লিংক দিন");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        { key: "homepage_video_url", value: videoUrl.trim() as any, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
    setSaving(false);
    if (error) {
      toast.error("ভিডিও লিংক সেভ করতে সমস্যা হয়েছে");
      return;
    }
    toast.success("হোমপেজের ভিডিও আপডেট হয়েছে");
  };

  if (loading) return null;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
        <Youtube className="w-6 h-6" /> হোমপেজ ভিডিও
      </h1>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <Label className="font-heading font-bold text-base">ইউটিউব লিংক</Label>
            <p className="text-sm text-muted-foreground mt-0.5">
              হোম পেইজে দেখানো ইউটিউব ভিডিওর লিংক এখানে আপডেট করুন।
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="flex-1"
            />
            <Button onClick={saveVideoUrl} disabled={saving}>
              {saving ? "সেভ হচ্ছে..." : "সেভ করুন"}
            </Button>
          </div>

          {extractYouTubeId(videoUrl) ? (
            <div className="max-w-xl">
              <YouTubePlayer videoId={extractYouTubeId(videoUrl)!} title="প্রিভিউ" autoPlayOnView={false} />
            </div>
          ) : (
            videoUrl && <p className="text-sm text-destructive">লিংকটি সঠিক ইউটিউব লিংক নয়।</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
