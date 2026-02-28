import { motion } from "framer-motion";

export default function RefundPage() {
  return (
    <div className="pt-24 pb-16 bg-background min-h-screen">
      <div className="container max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-2">রিফান্ড পলিসি</h1>
          <p className="text-muted-foreground text-sm mb-10">সর্বশেষ আপডেট: ১ জানুয়ারি, ২০২৬</p>

          <div className="space-y-8 text-muted-foreground text-sm leading-relaxed">
            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground mb-3">১. রিফান্ড নীতি</h2>
              <p>
                eExamapp-এর সাবস্ক্রিপশন ক্রয়ের পর কোনো অবস্থাতেই অর্থ ফেরতযোগ্য নয়।

              </p>
            </section>


            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground mb-3">৩. রিফান্ড অযোগ্য ক্ষেত্রসমূহ</h2>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>৭ দিনের পর রিফান্ড আবেদন করলে।</li>
                <li>সেবার শর্তাবলী লঙ্ঘনের কারণে অ্যাকাউন্ট বন্ধ হলে।</li>
                <li>বিশেষ ছাড় বা প্রোমোশনাল অফারে ক্রয়কৃত সাবস্ক্রিপশন।</li>
                <li>ফ্রি ট্রায়াল থেকে স্বয়ংক্রিয় নবায়নের ক্ষেত্রে (পূর্ব নোটিশ প্রদান সাপেক্ষে)।</li>
              </ul>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground mb-3">৪. রিফান্ড প্রক্রিয়া</h2>
              <p>রিফান্ড আবেদন করতে:</p>
              <ol className="list-decimal list-inside space-y-2 ml-2 mt-2">
                <li>hello@eexamapp.com ইমেইলে রিফান্ড আবেদন পাঠান।</li>
                <li>আবেদনে আপনার নাম, ইমেইল এবং ট্রানজেকশন আইডি উল্লেখ করুন।</li>
                <li>আমরা ৩-৫ কার্যদিবসের মধ্যে আবেদন পর্যালোচনা করব।</li>
                <li>অনুমোদিত হলে ৭-১০ কার্যদিবসের মধ্যে রিফান্ড প্রদান করা হবে।</li>
              </ol>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground mb-3">৫. রিফান্ড মাধ্যম</h2>
              <p>
                রিফান্ড মূল পেমেন্ট মাধ্যমে ফেরত দেওয়া হবে (bKash, Nagad, ব্যাংক ট্রান্সফার)। ভিন্ন মাধ্যমে ফেরত নেওয়ার ক্ষেত্রে আলাদাভাবে আলোচনা করা যাবে।
              </p>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground mb-3">৬. যোগাযোগ</h2>
              <p>
                রিফান্ড সম্পর্কে যেকোনো প্রশ্নে যোগাযোগ করুন:
              </p>
              <p className="mt-2">ইমেইল: hello@eexamapp.com</p>
              <p>মোবাইল: ০১৭১১-০০০০০০</p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>);
}