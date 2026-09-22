import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CheckCircle2, Grid, KeyRound, PlayCircle, Printer, ShieldCheck } from "lucide-react";
import OmrEngineBanner from "@/components/omr/OmrEngineBanner";
import { useOmrEngine } from "@/hooks/useOmrEngine";
import { toBn } from "@/lib/omrLayout";

const STEPS = [
  {
    icon: Grid,
    title: "১। OMR শীট তৈরি ও প্রিন্ট",
    to: "/dashboard/omr-create",
    action: "শীট তৈরি করুন",
    points: [
      "প্রতিষ্ঠানের নাম, ঠিকানা ও পরীক্ষার নাম দিন",
      "কলাম (২/৩/৪) ও প্রশ্ন সংখ্যা (১০-১০০) বাছুন",
      "প্রিন্ট ডায়ালগে Paper = A4, Margins = None, Scale = Default",
      "শীটে ওঠা OMR CODE (যেমন 14120) খেয়াল করে রাখুন",
      "যত শিক্ষার্থী, তত ফটোকপি",
      "শিক্ষার্থীদের বৃত্ত সম্পূর্ণ কালো করে ভরাট করতে বলুন (আধা-ভরাট দাগ পড়া যায় না)",
    ],
  },
  {
    icon: KeyRound,
    title: "২। টোকেন ও উত্তরপত্র (চাবি)",
    to: "/dashboard/omr-tokens",
    action: "টোকেন বানান",
    points: [
      "পরীক্ষার টাইটেল ও শীটের OMR CODE দিন",
      "ভুলের জন্য নেগেটিভ মার্কিং বাছুন (নেই / ০.২৫ / ০.৫০)",
      "টোকেন তৈরি করে শীটের বাবলে ক্লিক করে সঠিক উত্তর বসান",
      "অনেক উত্তর একসাথে দিতে \"উত্তর পেস্ট\" ব্যবহার করুন (ক খ গ ঘ / 1 2 3 4)",
      "সেভ না করলে মূল্যায়ন শুরু করা যাবে না",
      "উত্তরপত্র আপনার অ্যাকাউন্টে জমা থাকে - ফোন থেকে করলেও একই টোকেন পাবেন",
    ],
  },
  {
    icon: CheckCircle2,
    title: "৩। ছবি তুলে মূল্যায়ন",
    to: "/dashboard/omr-evaluation",
    action: "মূল্যায়ন করুন",
    points: [
      "শিক্ষার্থীর পূরণ করা শীটের ছবি তুলুন (একসাথে অনেকগুলো দেওয়া যায়)",
      "মূল্যায়ন চাপলেই নম্বর, ভুলের তালিকা ও দাগানো কপি তৈরি হবে",
      "ছবি পড়া হয় আপনার ডিভাইসেই - ইনস্টল বা সেটআপ কিছুই লাগে না",
      "সবুজ = সঠিক, লাল = ভুল, কমলা = একাধিক দাগ",
      "প্রয়োজনে CSV নামিয়ে এক্সেলে রাখুন",
    ],
  },
];

const FAQ = [
  {
    q: "\"OMR এখনো চালু করা যায়নি\" দেখাচ্ছে",
    a: "টোকেন ও ফলাফল আপনার অ্যাকাউন্টে জমা থাকে, তাই ইন্টারনেট সংযোগ দরকার। ইন্টারনেট ঠিক থাকলে পাতাটি রিফ্রেশ করুন। শীট তৈরি ও প্রিন্ট করতে কিছুই লাগে না - ইন্টারনেট ছাড়াও চলে।",
  },
  {
    q: "\"OMR Area খুঁজে পাওয়া যায়নি\" (BORDER_NOT_FOUND)",
    a: "শীটের চার দিকের কালো বর্ডার পুরোটা ছবিতে আসেনি। সোজা করে পুরো শীটসহ আবার ছবি তুলুন — শীট কাটবেন না, ভাঁজ করবেন না।",
  },
  {
    q: "\"Mismatch OMR Token and OMR Sheet\"",
    a: "শীটের কোড আর টোকেনের কোড মিলছে না, অথবা শীটের উপরের মার্কার-ব্লকে দাগ/ছায়া পড়েছে। সঠিক টোকেন বাছুন এবং মার্কার অংশে কালি বা ছায়া যেন না পড়ে খেয়াল রাখুন।",
  },
  {
    q: "নম্বর কম/বেশি মনে হচ্ছে",
    a: "টোকেনের উত্তরপত্র (চাবি) প্রশ্নপত্রের সাথে মিলিয়ে দেখুন। ভুল হলে টোকেন পাতায় গিয়ে বাবলে সঠিক উত্তর বসিয়ে আবার সেভ করুন, তারপর শীটটি আবার মূল্যায়ন করুন।",
  },
  {
    q: "ছবি কেমন হবে?",
    a: "শীট সমতল জায়গায় রেখে উপর থেকে সোজা ছবি তুলুন। দিনের আলো বা ভালো টিউবলাইটে তুলুন, ছায়া/ফ্ল্যাশ এড়িয়ে চলুন। ঝাপসা হলে CamScanner জাতীয় অ্যাপে স্ক্যান করে (Auto enhance) নিতে পারেন।",
  },
  {
    q: "বাবল ঠিকভাবে ভরাট না করলে কী হয়?",
    a: "সিস্টেম বাবলের ভেতরটা কালো হয়ে ভরা আছে কি না তা দেখে উত্তর পড়ে; পেনসিলের হালকা টান বা আধা-ভরাট বৃত্ত ধরতে পারে না। এমন বাবলকে ভুল নয়, 'উত্তর নেই' হিসেবে দেখানো হয় — তাই দাগানো কপিতে সহজেই চোখে পড়ে। শিক্ষার্থীদের বৃত্তটা সম্পূর্ণ কালো করে ভরাট করতে বলুন।",
  },
  {
    q: "আমার তথ্য কোথায় যায়?",
    a: "শিক্ষার্থীর ছবি কোথাও জমা হয় না - আপনার ব্রাউজারে পড়া হয়ে সাথে সাথে মুছে যায়। শুধু টোকেন (উত্তরপত্র) ও প্রাপ্ত নম্বর আপনার অ্যাকাউন্টে সংরক্ষিত থাকে, যাতে পরে বা অন্য ডিভাইস থেকেও দেখতে পারেন।",
  },
];

export default function OmrTutorial() {
  const { status, loading, refresh } = useOmrEngine();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
          <PlayCircle className="w-6 h-6 text-primary" /> OMR টিউটোরিয়াল
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          তিন ধাপে পুরো OMR কাজ - শীট তৈরি, উত্তরপত্র (চাবি) তৈরি এবং ছবি তুলে স্বয়ংক্রিয় মূল্যায়ন।
        </p>
      </div>

      <OmrEngineBanner status={status} loading={loading} onRetry={refresh} />

      <Card className="border-emerald-200 bg-emerald-50/60">
        <CardContent className="pt-5 flex flex-wrap items-start gap-3 text-sm text-emerald-900">
          <ShieldCheck className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">কিছু ইনস্টল করতে হবে না, ছবি ডিভাইস ছেড়ে যায় না</p>
            <p className="text-emerald-800">
              ছবি বিশ্লেষণ (OpenCV) এখনই আপনার ব্রাউজারে চলে - আলাদা কোনো সফটওয়্যার বা কালো উইন্ডো খোলা রাখতে হয় না।
              শিক্ষার্থীর ছবি কোথাও আপলোড হয় না; শুধু টোকেনের উত্তরপত্র ও প্রাপ্ত নম্বর আপনার অ্যাকাউন্টে জমা থাকে।
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {STEPS.map((step) => (
          <Card key={step.title} className="flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <step.icon className="w-5 h-5 text-primary" /> {step.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
              <ul className="space-y-1.5 text-sm text-muted-foreground list-disc pl-4">
                {step.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <Button asChild variant="outline" className="w-full">
                <Link to={step.to}>{step.action}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">OMR কোড কীভাবে পড়বেন</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="font-heading text-2xl tracking-[0.35em]">১ ৪ ১ ০০</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>প্রথম সংখ্যা - টেমপ্লেট (১ = স্ক্যানযোগ্য, ২ = ডিজিটাল)</li>
              <li>দ্বিতীয় সংখ্যা - কলাম সংখ্যা (২, ৩ বা ৪)</li>
              <li>তৃতীয় সংখ্যা - মার্কার (সবসময় ১)</li>
              <li>শেষের সংখ্যা - প্রশ্ন সংখ্যা (১০ থেকে ১০০)</li>
            </ul>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant="outline">12110 = ২ কলাম / ১০ প্রশ্ন</Badge>
              <Badge variant="outline">14120 = ৪ কলাম / ২০ প্রশ্ন</Badge>
              <Badge variant="outline">141100 = ৪ কলাম / ১০০ প্রশ্ন</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Printer className="w-4 h-4 text-primary" /> প্রিন্ট করার নিয়ম
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              শীট A4 মাপে (২১০ × ২৯৭ মিমি) তৈরি। প্রিন্ট ডায়ালগে Paper <strong>A4</strong>, Margins{" "}
              <strong>None</strong>, Scale <strong>Default (১০০%)</strong> রাখুন।
            </p>
            <p>
              প্রিন্টের আগে প্রিভিউতে দেখে নিন যেন চার দিকের কালো বর্ডার পুরোটা কাগজের ভেতরে থাকে। বর্ডার কাটা পড়লে
              সিস্টেম শীট চিনতে পারবে না।
            </p>
            <p className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
              প্রথমে ২-১ কপি প্রিন্ট করে পরীক্ষা করে নিন, বাবল ও বর্ডার স্পষ্ট এলে তারপর আসল প্রিন্ট দিন।
            </p>
            <p className="text-xs">
              শীটের মোট প্রশ্ন {toBn(100)}টি পর্যন্ত হতে পারে; কলাম বাড়ালে এক পাতায় বেশি প্রশ্ন ধরবে।
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">সমস্যা ও সমাধান</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {FAQ.map((item, index) => (
              <AccordionItem key={item.q} value={`faq-${index}`}>
                <AccordionTrigger className="text-left text-sm font-semibold">{item.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
