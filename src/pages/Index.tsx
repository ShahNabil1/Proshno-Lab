import ReferenceHome from "@/components/ReferenceHome";
import { motion } from "framer-motion";
import { Users, Star, MessageSquare } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import ReviewModal from "@/components/ReviewModal";
import YouTubePlayer, { extractYouTubeId } from "@/components/YouTubePlayer";
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.55, ease: [0.22, 1, 0.36, 1] as const }
  })
};

export default function Index() {


  const [reviews, setReviews] = useState<{id: number;name: string;designation: string;institution: string;image_url: string;rating: number;text: string;}[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [videoId, setVideoId] = useState<string | null>(null);

  const fetchReviews = async () => {
    try {
      const { data } = await supabase.from("reviews")
        .select("id, name, designation, institution, image_url, rating, text")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(6);
      if (data) setReviews(data);
    } catch {
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  };
  useEffect(() => {
    fetchReviews();
    supabase.from("app_settings").select("value").eq("key", "homepage_video_url").maybeSingle()
      .then(({ data }) => setVideoId(extractYouTubeId(String(data?.value ?? ""))));
  }, []);


  // লগডইন থাকলেও ইউজার হোম পেইজ দেখতে পারবে (হেডারে ড্যাশবোর্ড বাটন থাকে)

  return (
    <div className="overflow-hidden">
      <ReferenceHome />

      {/* ══════ VIDEO SHOWCASE ══════ */}
      <section id="home-video" className="th-video-section" style={{padding: "56px 0", background: "#edf1f4", scrollMarginTop: 90}}>
        <div className="container max-w-4xl">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp} custom={0} className="text-center mb-8"
          >
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-3">
              কীভাবে কাজ করে দেখে নিন
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              মাত্র কয়েক ধাপে প্রিন্ট-প্রস্তুত প্রশ্নপত্র — সম্পূর্ণ প্রক্রিয়াটি ভিডিওতে দেখুন।
            </p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}>
            {videoId ? (
              <YouTubePlayer videoId={videoId} title="প্রশ্নল্যাব টিউটোরিয়াল" />
            ) : (
              <p className="text-center text-muted-foreground py-8">উপরের তিনটি ধাপ অনুসরণ করে সহজেই শুরু করুন।</p>
            )}
          </motion.div>
        </div>
      </section>

      {/* ══════ REVIEWS ══════ */}
      <section className="teacher-review-section py-10 md:py-14 border-t border-border/50">
        <div className="container">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
              <Users className="w-3.5 h-3.5" />
              ব্যবহারকারীদের মতামত
            </div>
            <h2 className="font-heading text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2">সম্মানিত শিক্ষকরা যা বলছেন !</h2>
            <p className="text-muted-foreground text-base md:text-lg">সরাসরি ব্যবহারকারীদের অভিজ্ঞতা</p>
          </motion.div>
          {reviews.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
              {reviews.map((t, i) =>
                <motion.div key={t.id} custom={i + 1} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                  <div className="bg-card rounded-2xl p-6 shadow-premium hover-lift h-full flex flex-col border border-border/60">
                    <div className="flex items-center gap-0.5 mb-3">
                      {Array.from({ length: 5 }).map((_, j) =>
                        <Star key={j} className={`w-4 h-4 ${j < t.rating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/20"}`} />
                      )}
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed flex-1 mb-4">"{t.text}"</p>
                    <div className="flex items-center gap-3 pt-3 border-t border-border">
                      {t.image_url ?
                        <img src={t.image_url} alt="" className="w-10 h-10 rounded-full object-cover" /> :
                        <div className="w-10 h-10 rounded-full gradient-navy flex items-center justify-center text-white font-heading font-bold text-sm">
                          {t.name.charAt(0)}
                        </div>
                      }
                      <div>
                        <p className="font-heading font-semibold text-sm text-foreground">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.designation}{t.institution ? `, ${t.institution}` : ""}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          ) : !reviewsLoading ? (
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={1}
              className="max-w-md mx-auto text-center py-8 px-6 rounded-2xl border border-dashed border-border/80 bg-card/40"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="w-5 h-5" />
              </div>
              <p className="text-foreground font-heading font-semibold text-sm mb-1">
                এখনও কোনো রিভিউ যুক্ত হয়নি
              </p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                প্রশ্নল্যাব সম্পর্কে আপনার মূল্যবান অভিজ্ঞতা সবার সাথে ভাগ করে নিতে নিচে ক্লিক করুন।
              </p>
            </motion.div>
          ) : null}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={4} className="text-center mt-8">
            <ReviewModal onSuccess={fetchReviews} />
          </motion.div>
        </div>
      </section>

    </div>);

}
