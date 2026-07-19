import { motion } from "framer-motion";

export default function PrivacyPage() {
  return (
    <div className="pt-24 pb-16 bg-background min-h-screen">
      <div className="container max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-2">প্রাইভেসি পলিসি</h1>
          <p className="text-muted-foreground text-sm mb-10">সর্বশেষ আপডেট: ১ জানুয়ারি, ২০২৬</p>

          <div className="space-y-8 text-muted-foreground text-sm leading-relaxed">
            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground mb-3">১. তথ্য সংগ্রহ</h2>
              <p>আমরা নিম্নলিখিত তথ্য সংগ্রহ করতে পারি:</p>
              <ul className="list-disc list-inside space-y-2 ml-2 mt-2">
                <li>Google অ্যাকাউন্টের নাম, ইমেইল ও প্রোফাইল ছবি (লগইনের সময়)</li>
                <li>ডিভাইস ও ব্রাউজারের তথ্য</li>
                <li>প্ল্যাটফর্ম ব্যবহারের পরিসংখ্যান (পেজ ভিজিট, প্রশ্ন দেখা ইত্যাদি)</li>
                <li>পেমেন্ট সংক্রান্ত তথ্য (তৃতীয় পক্ষের পেমেন্ট গেটওয়ের মাধ্যমে)</li>
              </ul>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground mb-3">২. তথ্যের ব্যবহার</h2>
              <p>সংগৃহীত তথ্য নিম্নলিখিত উদ্দেশ্যে ব্যবহৃত হয়:</p>
              <ul className="list-disc list-inside space-y-2 ml-2 mt-2">
                <li>আপনার অ্যাকাউন্ট পরিচালনা ও নিরাপত্তা নিশ্চিতকরণ</li>
                <li>ব্যক্তিগতকৃত শিক্ষা অভিজ্ঞতা প্রদান</li>
                <li>সেবার মান উন্নয়ন ও নতুন ফিচার তৈরি</li>
                <li>গ্রাহক সহায়তা প্রদান</li>
                <li>পেমেন্ট প্রক্রিয়াকরণ</li>
              </ul>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground mb-3">৩. তথ্যের নিরাপত্তা</h2>
              <p>
                আমরা আপনার ব্যক্তিগত তথ্য সুরক্ষিত রাখতে শিল্প-মানসম্পন্ন নিরাপত্তা ব্যবস্থা গ্রহণ করি। আমাদের ডেটাবেস এনক্রিপ্টেড এবং SSL/TLS প্রটোকল ব্যবহার করা হয়। তবে ইন্টারনেটে সম্পূর্ণ নিরাপত্তা নিশ্চিত করা সম্ভব নয়।
              </p>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground mb-3">৪. তৃতীয় পক্ষের সেবা</h2>
              <p>
                আমরা নিম্নলিখিত তৃতীয় পক্ষের সেবা ব্যবহার করি:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-2 mt-2">
                <li>Google OAuth — প্রমাণীকরণের জন্য</li>
                <li>পেমেন্ট গেটওয়ে (bKash, Nagad) — পেমেন্ট প্রক্রিয়াকরণের জন্য</li>
                <li>Analytics সেবা — ব্যবহার পরিসংখ্যানের জন্য</li>
              </ul>
              <p className="mt-2">এই তৃতীয় পক্ষগুলোর নিজস্ব প্রাইভেসি পলিসি রয়েছে।</p>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground mb-3">৫. কুকিজ</h2>
              <p>
                আমরা সেশন পরিচালনা ও ব্যবহারকারী অভিজ্ঞতা উন্নত করতে কুকিজ ব্যবহার করি। আপনি ব্রাউজার সেটিংস থেকে কুকিজ নিষ্ক্রিয় করতে পারেন, তবে এতে কিছু ফিচার সঠিকভাবে কাজ নাও করতে পারে।
              </p>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground mb-3">৬. তথ্য মুছে ফেলা</h2>
              <p>
                আপনি যেকোনো সময় আপনার অ্যাকাউন্ট মুছে ফেলার অনুরোধ করতে পারেন। অ্যাকাউন্ট মুছে ফেলা হলে আপনার সমস্ত ব্যক্তিগত তথ্য ৩০ দিনের মধ্যে মুছে ফেলা হবে।
              </p>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground mb-3">৭. যোগাযোগ</h2>
              <p>
                প্রাইভেসি সম্পর্কে কোনো প্রশ্ন বা উদ্বেগ থাকলে আমাদের সাথে যোগাযোগ করুন:
              </p>
              <p className="mt-2">ইমেইল: hello@proshnolab.com</p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
