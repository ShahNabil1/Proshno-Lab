import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star, Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function ReviewModal({ onSuccess }: { onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [institution, setInstitution] = useState("");
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("ছবির সাইজ ২MB এর কম হতে হবে"); return; }

    setUploading(true);
    try {
      const { data: config } = await supabase.functions.invoke("cloudinary-config");
      if (!config?.cloudName || !config?.uploadPreset) throw new Error("Cloudinary not configured");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", config.uploadPreset);
      formData.append("folder", "reviews");

      const res = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`, {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      if (result.secure_url) {
        setImageUrl(result.secure_url);
        toast.success("ছবি আপলোড হয়েছে");
      } else throw new Error("Upload failed");
    } catch (err: any) {
      toast.error("ছবি আপলোড ব্যর্থ: " + (err.message || ""));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !text.trim()) { toast.error("নাম ও রিভিউ লিখুন"); return; }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("reviews").insert({
        teacher_id: null,
        name: name.trim(),
        designation: designation.trim(),
        institution: institution.trim(),
        image_url: imageUrl,
        rating,
        text: text.trim(),
      } as any);
      if (error) throw error;
      toast.success("আপনার রিভিউ জমা হয়েছে! অ্যাডমিন অনুমোদনের পর প্রদর্শিত হবে।");
      setOpen(false);
      setText("");
      setName("");
      setDesignation("");
      setInstitution("");
      setImageUrl("");
      setRating(5);
      onSuccess?.();
    } catch (err: any) {
      toast.error("রিভিউ জমা ব্যর্থ: " + (err.message || ""));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground font-heading font-semibold rounded-xl px-6">
          <Star className="w-4 h-4 mr-2" /> আপনার মতামত দিন
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">রিভিউ দিন</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs">আপনার নাম *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="নাম" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">পদবি</Label>
              <Input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="যেমন: সহকারী শিক্ষক" />
            </div>
            <div>
              <Label className="text-xs">প্রতিষ্ঠান</Label>
              <Input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="প্রতিষ্ঠানের নাম" />
            </div>
          </div>

          {/* Image upload */}
          <div>
            <Label className="text-xs">প্রোফাইল ছবি (ঐচ্ছিক)</Label>
            <div className="flex items-center gap-3 mt-1">
              {imageUrl ? (
                <img src={imageUrl} alt="preview" className="w-12 h-12 rounded-full object-cover border" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                  <Upload className="w-4 h-4" />
                </div>
              )}
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                <span className="text-sm text-primary hover:underline">
                  {uploading ? <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> আপলোড হচ্ছে...</span> : "ছবি আপলোড করুন"}
                </span>
              </label>
            </div>
          </div>

          {/* Star rating */}
          <div>
            <Label className="text-xs">রেটিং *</Label>
            <div className="flex items-center gap-1 mt-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onMouseEnter={() => setHoverRating(s)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(s)}
                  className="p-0.5"
                >
                  <Star
                    className={`w-6 h-6 transition-colors ${
                      s <= (hoverRating || rating) ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30"
                    }`}
                  />
                </button>
              ))}
              <span className="text-sm text-muted-foreground ml-2">{"০১২৩৪৫৬৭৮৯"[rating]}/৫</span>
            </div>
          </div>

          <div>
            <Label className="text-xs">আপনার মতামত *</Label>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="আপনার অভিজ্ঞতা শেয়ার করুন..." rows={3} />
          </div>

          <Button onClick={handleSubmit} disabled={submitting} className="w-full gradient-green text-white border-0 font-heading">
            {submitting ? "জমা হচ্ছে..." : "রিভিউ জমা দিন"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
