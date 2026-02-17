import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, PenTool, FileText, AlignLeft, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const questionTypes = [
  {
    title: "বহুনির্বাচনি (MCQ)",
    subtitle: "Multiple Choice Questions",
    icon: BookOpen,
    path: "/questions/mcq",
    color: "gradient-purple",
    textColor: "text-primary-foreground",
    description: "প্রতিটি প্রশ্ন ১ নম্বর, চারটি অপশন থেকে সঠিক উত্তর নির্বাচন করুন",
  },
  {
    title: "সৃজনশীল (CQ)",
    subtitle: "Creative Questions",
    icon: PenTool,
    path: "/questions/cq",
    color: "gradient-yellow",
    textColor: "text-secondary-foreground",
    description: "ক, খ, গ, ঘ চারটি অংশে বিভক্ত, মোট ১০ নম্বর",
  },
  {
    title: "সংক্ষিপ্ত প্রশ্ন",
    subtitle: "Short Questions",
    icon: FileText,
    path: "/questions/short",
    color: "gradient-purple",
    textColor: "text-primary-foreground",
    description: "প্রতিটি প্রশ্ন ২ নম্বর, পাঁচটি প্রশ্নের সেট, মোট ১০ নম্বর",
  },
  {
    title: "বর্ণনামূলক প্রশ্ন",
    subtitle: "Descriptive Questions",
    icon: AlignLeft,
    path: "/questions/descriptive",
    color: "gradient-yellow",
    textColor: "text-secondary-foreground",
    description: "বিস্তারিত উত্তরের জন্য বর্ণনামূলক প্রশ্ন",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.5, ease: "easeOut" as const },
  }),
};

export default function Index() {
  return (
    <div>
      {/* Hero */}
      <section className="gradient-hero py-20 md:py-32 overflow-hidden relative">
        {/* Decorative shapes */}
        <div className="absolute top-10 right-10 w-40 h-40 rounded-full bg-purple/20 blur-3xl animate-float" />
        <div className="absolute bottom-10 left-10 w-52 h-52 rounded-full bg-yellow/20 blur-3xl animate-float" style={{ animationDelay: "1.5s" }} />

        <div className="container relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl mx-auto text-center"
          >
            <div className="inline-flex items-center gap-2 bg-accent px-4 py-2 rounded-full text-accent-foreground text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              ডিজিটাল প্রশ্নব্যাংক প্ল্যাটফর্ম
            </div>

            <h1 className="font-heading text-4xl md:text-6xl font-extrabold text-foreground leading-tight mb-6">
              <span className="text-gradient-purple">eExam</span>app
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground mb-8 font-body leading-relaxed">
              পরীক্ষার প্রশ্ন প্রস্তুত ও পরিচালনা করার সবচেয়ে সহজ উপায়।
              <br className="hidden md:block" />
              শিক্ষক ও শিক্ষার্থীদের জন্য একটি সম্পূর্ণ ডিজিটাল সমাধান।
            </p>

            <div className="flex flex-wrap gap-4 justify-center">
              <Link to="/questions/mcq">
                <Button size="lg" className="font-heading font-semibold text-base px-8">
                  প্রশ্নব্যাংক দেখুন
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link to="/register">
                <Button size="lg" variant="outline" className="font-heading font-semibold text-base px-8">
                  রেজিস্ট্রেশন করুন
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Question Types */}
      <section className="py-16 md:py-24">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-3">
              প্রশ্নের ধরন
            </h2>
            <p className="text-muted-foreground text-lg">
              আপনার প্রয়োজন অনুযায়ী প্রশ্নের ধরন নির্বাচন করুন
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {questionTypes.map((qt, i) => (
              <motion.div
                key={qt.path}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
              >
                <Link to={qt.path} className="block group">
                  <div className="rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300">
                    <div className={`${qt.color} p-6 ${qt.textColor}`}>
                      <qt.icon className="w-8 h-8 mb-3" />
                      <h3 className="font-heading font-bold text-lg">{qt.title}</h3>
                      <p className="text-sm opacity-80">{qt.subtitle}</p>
                    </div>
                    <div className="bg-card p-5">
                      <p className="text-sm text-muted-foreground font-body leading-relaxed">
                        {qt.description}
                      </p>
                      <span className="inline-flex items-center text-primary text-sm font-medium mt-3 group-hover:gap-2 transition-all">
                        দেখুন <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-muted/50">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: "ডিজিটাল প্রশ্নব্যাংক", desc: "সকল শ্রেণি ও বিষয়ের প্রশ্ন এক জায়গায়" },
              { title: "ভূমিকা-ভিত্তিক অ্যাক্সেস", desc: "শিক্ষক ও প্রশাসকদের জন্য আলাদা অনুমতি" },
              { title: "ক্লাউড ইমেজ হোস্টিং", desc: "Cloudinary-তে নিরাপদ ইমেজ স্টোরেজ" },
            ].map((f, i) => (
              <motion.div
                key={i}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="bg-card rounded-xl p-6 shadow-sm"
              >
                <h3 className="font-heading font-bold text-lg text-foreground mb-2">{f.title}</h3>
                <p className="text-muted-foreground font-body">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
