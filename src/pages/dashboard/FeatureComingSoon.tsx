import { useLocation, Link } from "react-router-dom";
import {
  Tv, GraduationCap, PlayCircle, Grid, KeyRound, CheckCircle2,
  Clock, ArrowRight, Phone, MessageSquare, PlusCircle, Layers, ShieldCheck, Gift
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface FeatureInfo {
  title: string;
  englishTitle: string;
  icon: any;
  tagline: string;
  description: string;
  highlights: string[];
  badge: string;
}

const FEATURE_CONFIG: Record<string, FeatureInfo> = {
  "/dashboard/smartboard": {
    title: "স্মার্টবোর্ড মোড",
    englishTitle: "Smartboard Classroom Mode",
    icon: Tv,
    tagline: "ক্লাসরুমের প্রজেক্টর ও ডিজিটাল বোর্ডে সহজে প্রশ্ন প্রদর্শনের আধুনিক সমাধান",
    description: "শিক্ষকদের জন্য বিশেষ ফুল-স্ক্রিন স্মার্টবোর্ড ইন্টারফেস, যেখানে স্লাইড মোডে প্রশ্ন দেখানো, উত্তর লুকানো/দেখানো এবং সরাসরি ক্লাসরুমে কুইজ পরিচালনা করা যাবে।",
    highlights: [
      "প্রজেক্টর বা স্মার্ট টিভির সাথে মানানসই বড় ও পরিষ্কার ফন্ট",
      "এক ক্লিকে সঠিক উত্তর ও ব্যাখ্যা প্রদর্শন বা গোপন করার সুবিধা",
      "চ্যাপ্টার ও টপিক ভিত্তিক ইন্টারেক্টিভ কুইজ প্রেজেন্টেশন",
      "শিক্ষার্থীদের রিয়েল-টাইম অংশগ্রহণের উপযোগী ডিসপ্লে",
    ],
    badge: "উন্নয়নাধীন",
  },
  "/dashboard/students": {
    title: "শিক্ষার্থী ব্যবস্থাপনা",
    englishTitle: "Student Management",
    icon: GraduationCap,
    tagline: "প্রতিষ্ঠানের সকল শিক্ষার্থী ও ব্যাচের তথ্য এক প্ল্যাটফর্মে",
    description: "শ্রেণী ও সেকশন অনুযায়ী শিক্ষার্থীদের ডাটাবেজ সংরক্ষণ, পরীক্ষার উপস্থিতি এবং পারফরম্যান্স ট্র্যাকিং এর পূর্ণাঙ্গ সুবিধা খুব শীঘ্রই যুক্ত হচ্ছে।",
    highlights: [
      "শ্রেণী ও শাখা অনুযায়ী শিক্ষার্থী তালিকা তৈরি ও এক্সেল ইম্পোর্ট",
      "রোল নম্বর এবং ইউনিক আইডি অনুযায়ী স্টুডেন্ট প্রোফাইল",
      "প্রতিটি পরীক্ষার প্রাপ্ত নম্বর ও প্রগ্রেস রিপোর্ট সংরক্ষণ",
      "অভিভাবকদের কাছে এসএমএস বা রেজাল্ট শিট পাঠানোর সুবিধা",
    ],
    badge: "শীঘ্রই আসছে",
  },
  "/dashboard/omr-tutorial": {
    title: "OMR টিউটোরিয়াল",
    englishTitle: "OMR Video & User Guide",
    icon: PlayCircle,
    tagline: "সহজে OMR শিট তৈরি, প্রিন্ট ও মূল্যায়ন করার ভিডিও নির্দেশিকা",
    description: "প্রশ্নল্যাবের স্মার্ট OMR শিট কিভাবে প্রিন্ট করবেন এবং সাধারণ স্মার্টফোন ক্যামেরা বা স্ক্যানার দিয়ে কয়েক সেকেন্ডে খাতা মূল্যায়ন করবেন তার পূর্ণাঙ্গ টিউটোরিয়াল।",
    highlights: [
      "OMR পেপার সেটআপ ও সাধারণ প্রিন্টারে প্রিন্ট করার নিয়মাবলী",
      "স্মার্টফোন ক্যামেরা দিয়ে নির্ভুল স্ক্যানিং করার টিপস",
      "ভুল দাগানো বা ডাবল মার্ক হ্যান্ডেল করার উপায়",
      "ধাপে ধাপে ভিডিও গাইড ও সাধারণ জিজ্ঞাসার সমাধান",
    ],
    badge: "টিউটোরিয়াল",
  },
  "/dashboard/omr-create": {
    title: "OMR শিট তৈরি",
    englishTitle: "Create Custom OMR Sheet",
    icon: Grid,
    tagline: "যে কোনো বিষয়ের জন্য কাস্টম প্রশ্ন সংখ্যার OMR শিট ডিজাইন ও প্রিন্ট",
    description: "২৫, ৩০, ৪০, ৫০ বা ১০০ নম্বরের নৈর্ব্যক্তিক পরীক্ষার জন্য স্বয়ংক্রিয় OMR শিট জেনারেটর। আপনার প্রতিষ্ঠানের নাম ও লোগোসহ সরাসরি প্রিন্ট করুন।",
    highlights: [
      "কাস্টম প্রশ্ন সংখ্যা (১০ থেকে ১০০ পর্যন্ত যেকোনো সংখ্যা)",
      "প্রতিষ্ঠানের নাম, লোগো, পরীক্ষার নাম ও রোল ঘরসহ ফরম্যাট",
      "A4 সাইজে প্রতি পাতায় ২ বা ৪টি OMR শিট সেটিং",
      "স্ট্যান্ডার্ড ও হাই-অ্যাকিউরেসি বাবল লেআউট",
    ],
    badge: "শীঘ্রই আসছে",
  },
  "/dashboard/omr-tokens": {
    title: "OMR টোকেন ও ব্যালেন্স",
    englishTitle: "OMR Scan Credits & Tokens",
    icon: KeyRound,
    tagline: "OMR খাতা মূল্যায়নের টোকেন ও ব্যালেন্স হিসেব",
    description: "আপনার সাবস্ক্রিপশন প্যাকেজের সাথে নির্ধারিত ফ্রি OMR স্ক্যান টোকেন ব্যবহার করুন অথবা প্রয়োজনমতো অতিরিক্ত টোকেন রিচার্জ করুন।",
    highlights: [
      "প্রতিটি মূল্যায়িত খাতার স্বচ্ছ হিসাব ও ব্যবহারের লগ",
      "প্যাকেজের সাথে পাওয়া বোনাস টোকেনের মেয়াদ ও পরিমাণ",
      "সহজ বিকাশ/নগদ পেমেন্টে সাশ্রয়ী মূল্যে টোকেন রিচার্জ",
      "প্রাতিষ্ঠানিক আনলিমিটেড স্ক্যান প্যাকের সুবিধা",
    ],
    badge: "টোকেন সিস্টেম",
  },
  "/dashboard/omr-evaluation": {
    title: "OMR শিট মূল্যায়ন",
    englishTitle: "Automated OMR Sheet Evaluation",
    icon: CheckCircle2,
    tagline: "ক্যামেরা স্ক্যানিংয়ের মাধ্যমে চোখের পলকে শত শত খাতা মূল্যায়ন",
    description: "প্রশ্নল্যাব আধুনিক অপটিক্যাল রিডিং ও ইমেজ প্রসেসিং প্রযুক্তির মাধ্যমে উত্তরপত্র স্ক্যান করে সেকেন্ডে ফলাফল ও মেরিট লিস্ট তৈরি করার যুগান্তকারী ফিচার।",
    highlights: [
      "সাধারণ মোবাইল ক্যামেরা বা ফ্ল্যাটবেড স্ক্যানারে দ্রুত স্ক্যান",
      "৯৯.৯% নির্ভুল বাবল রিডিং ও তাৎক্ষণিক ভুল নির্ণয়",
      "অটোমেটিক মেরিট লিস্ট, গড় নম্বর ও সর্বোচ্চ নম্বরের রিপোর্ট",
      "এক ক্লিকে রেজাল্ট এক্সেল ও পিডিএফ আকারে ডাউনলোড",
    ],
    badge: "শীঘ্রই উন্মুক্ত হচ্ছে",
  },
  "/dashboard/affiliate": {
    title: "প্রশ্নল্যাব এফিলিয়েট প্রোগ্রাম",
    englishTitle: "ProshnoLab Affiliate & Partner Program",
    icon: Gift,
    tagline: "অন্যান্য শিক্ষক ও প্রতিষ্ঠানকে রেফার করে নিয়মিত আকর্ষণীয় আয় করুন",
    description: "আপনি যদি একজন শিক্ষক, এডুকেটর বা শিক্ষা উদ্যোক্তা হন, তবে প্রশ্নল্যাবের পার্টনার হয়ে অন্যান্য শিক্ষক ও শিক্ষাপ্রতিষ্ঠানকে প্ল্যাটফর্মে যুক্ত করে উপভোগ করুন লাইফটাইম কমিশন।",
    highlights: [
      "প্রতিটি সফল সাবস্ক্রিপশন ও রিনিউয়ালে আকর্ষণীয় কমিশন",
      "ব্যক্তিগত রেফারেল লিঙ্ক ও কুপন কোড সুবিধা",
      "লাইভ ড্যাশবোর্ডে রেফারেল ও উপার্জনের স্বচ্ছ হিসেব",
      "প্রতি মাসের উপার্জিত টাকা সরাসরি বিকাশ বা ব্যাংক একাউন্টে ট্রান্সফার",
    ],
    badge: "পার্টনারশিপ প্রোগ্রাম",
  },
};

export default function FeatureComingSoon() {
  const location = useLocation();
  const currentConfig = FEATURE_CONFIG[location.pathname] || {
    title: "নতুন ফিচার প্রস্তুত হচ্ছে",
    englishTitle: "Feature In Development",
    icon: Clock,
    tagline: "আমরা এই ফিচারটিকে আরও উন্নত ও শিক্ষার্থীবান্ধব করতে কাজ করছি",
    description: "শীঘ্রই এই সেকশনটি আপনার ড্যাশবোর্ডে যুক্ত হবে। যেকোনো মতামত বা পরামর্শ থাকলে আমাদের জানাতে পারেন।",
    highlights: [
      "দ্রুত ও নির্ভুল পারফরম্যান্স",
      "সহজ ও ব্যবহারকারীবান্ধব ইন্টারফেস",
      "শিক্ষক ও প্রতিষ্ঠানের চাহিদামতো কাস্টমাইজেশন",
    ],
    badge: "শীঘ্রই আসছে",
  };

  const Icon = currentConfig.icon;

  return (
    <div className="max-w-4xl mx-auto py-4 sm:py-8 space-y-6">
      {/* Top Banner Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0B1E38] via-[#102B4E] to-[#174682] p-6 sm:p-8 text-white shadow-xl border border-white/10">
        <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-8 -top-8 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
            <Icon className="w-8 h-8 text-[#00B4BC]" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <h1 className="text-2xl sm:text-3xl font-heading font-bold text-white tracking-tight">
                {currentConfig.title}
              </h1>
              <Badge className="bg-[#00B4BC] text-[#0A1E38] hover:bg-[#00B4BC] font-semibold text-xs px-2.5 py-0.5">
                {currentConfig.badge}
              </Badge>
            </div>
            <p className="text-blue-100 text-sm sm:text-base font-medium">
              {currentConfig.tagline}
            </p>
          </div>
        </div>
      </div>

      {/* Main Details Card */}
      <Card className="border border-border/80 shadow-md">
        <CardContent className="p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-lg font-heading font-bold text-foreground mb-2 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              ফিচার পরিচিতি
            </h2>
            <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">
              {currentConfig.description}
            </p>
          </div>

          {/* Highlights */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 font-heading">
              আসন্ন সুবিধাসমূহ:
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentConfig.highlights.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3.5 rounded-xl bg-muted/40 border border-border/60 hover:bg-muted/70 transition-colors"
                >
                  <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                    ✓
                  </div>
                  <span className="text-sm text-foreground/90 font-medium leading-snug">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Action CTAs */}
          <div className="pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Link to="/dashboard/create">
                <Button className="btn-gold font-heading font-bold gap-2 text-sm h-10 px-5 shadow-sm">
                  <PlusCircle className="w-4 h-4" />
                  প্রশ্ন তৈরি করুন
                </Button>
              </Link>
              <Link to="/dashboard/packages">
                <Button variant="outline" className="gap-2 text-sm h-10 px-4">
                  <Layers className="w-4 h-4" />
                  প্রশ্নব্যাংক দেখুন
                </Button>
              </Link>
            </div>

            <Link to="/dashboard/contact">
              <Button variant="ghost" className="gap-2 text-primary hover:text-primary hover:bg-primary/10 text-sm h-10">
                <MessageSquare className="w-4 h-4" />
                মতামত বা পরামর্শ দিন
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
