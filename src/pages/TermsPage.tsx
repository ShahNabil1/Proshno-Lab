import { motion } from "framer-motion";

export default function TermsPage() {
  return (
    <div className="pt-24 pb-16 bg-background min-h-screen">
      <div className="container max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-2">টার্মস এন্ড কন্ডিশন</h1>
          <p className="text-muted-foreground text-sm mb-10">সর্বশেষ আপডেট: ১ জানুয়ারি, ২০২৬</p>

          <div className="prose-custom space-y-8 text-muted-foreground text-sm leading-relaxed">
            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground mb-3">১. সেবার শর্তাবলী</h2>
              <p>
                eExamapp ("আমরা", "আমাদের") একটি ডিজিটাল প্রশ্নব্যাংক ও পরীক্ষা প্রস্তুতি প্ল্যাটফর্ম। আমাদের ওয়েবসাইট ও সেবা ব্যবহার করার মাধ্যমে আপনি এই শর্তাবলী মেনে চলতে সম্মত হচ্ছেন। আপনি যদি এই শর্তাবলীর সাথে একমত না হন, তাহলে দয়া করে আমাদের সেবা ব্যবহার থেকে বিরত থাকুন।
              </p>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground mb-3">২. অ্যাকাউন্ট নিবন্ধন</h2>
              <p>
                আমাদের সেবা ব্যবহার করতে আপনাকে Google অ্যাকাউন্টের মাধ্যমে নিবন্ধন করতে হবে। আপনার অ্যাকাউন্টের নিরাপত্তা বজায় রাখা আপনার দায়িত্ব। অ্যাকাউন্টের মাধ্যমে সংঘটিত যেকোনো কার্যকলাপের জন্য আপনি দায়ী থাকবেন।
              </p>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground mb-3">৩. সেবা ব্যবহারের নীতিমালা</h2>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>আমাদের কন্টেন্ট বাণিজ্যিক উদ্দেশ্যে পুনর্বিতরণ করা যাবে না।</li>
                <li>প্ল্যাটফর্মে অশ্লীল, আপত্তিকর বা বেআইনি কন্টেন্ট আপলোড করা নিষিদ্ধ।</li>
                <li>অন্য ব্যবহারকারীর অ্যাকাউন্টে অননুমোদিত প্রবেশ করা যাবে না।</li>
                <li>স্বয়ংক্রিয় স্ক্র্যাপিং বা ডেটা সংগ্রহ নিষিদ্ধ।</li>
              </ul>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground mb-3">৪. মেধাস্বত্ব</h2>
              <p>
                eExamapp-এ প্রকাশিত সকল প্রশ্ন, উত্তর, ডিজাইন, লোগো এবং অন্যান্য কন্টেন্ট আমাদের মেধাস্বত্বের অন্তর্ভুক্ত। পূর্বানুমতি ব্যতীত এগুলো কপি, পরিবর্তন বা বিতরণ করা যাবে না।
              </p>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground mb-3">৫. সাবস্ক্রিপশন ও পেমেন্ট</h2>
              <p>
                প্রিমিয়াম সেবা ব্যবহারের জন্য সাবস্ক্রিপশন ক্রয় করতে হবে। পেমেন্ট সম্পন্ন হলে তা ফেরতযোগ্য নয়, তবে আমাদের রিফান্ড পলিসি অনুযায়ী ব্যতিক্রম প্রযোজ্য হতে পারে। সাবস্ক্রিপশন মেয়াদ শেষে স্বয়ংক্রিয়ভাবে নবায়ন হতে পারে।
              </p>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground mb-3">৬. দায়বদ্ধতার সীমাবদ্ধতা</h2>
              <p>
                আমরা সর্বোচ্চ চেষ্টা করি সঠিক ও মানসম্মত কন্টেন্ট প্রদান করতে। তবে কোনো প্রশ্ন বা উত্তরে ত্রুটি থাকলে তার জন্য আমরা দায়ী নই। পরীক্ষার ফলাফলের জন্য eExamapp কোনো দায়ভার বহন করে না।
              </p>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground mb-3">৭. শর্তাবলী পরিবর্তন</h2>
              <p>
                আমরা যেকোনো সময় এই শর্তাবলী পরিবর্তন করার অধিকার সংরক্ষণ করি। পরিবর্তন হলে ওয়েবসাইটে আপডেট প্রকাশ করা হবে। পরিবর্তনের পরেও সেবা ব্যবহার অব্যাহত রাখলে আপনি নতুন শর্তাবলী মেনে নিচ্ছেন বলে গণ্য হবে।
              </p>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground mb-3">৮. যোগাযোগ</h2>
              <p>
                এই শর্তাবলী সম্পর্কে কোনো প্রশ্ন থাকলে আমাদের সাথে যোগাযোগ করুন:
              </p>
              <p className="mt-2">ইমেইল: hello@eexamapp.com</p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
