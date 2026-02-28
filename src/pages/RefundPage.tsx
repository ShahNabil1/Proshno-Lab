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
              <p>1. eExamapp-এর সাবস্ক্রিপশন ক্রয়ের পর কোনো অবস্থাতেই অর্থ ফেরতযোগ্য নয়।</p>
              <p className="mt-2">2. রিফান্ড শুধুমাত্র মূল পেমেন্ট মাধ্যমেই প্রদান করা হবে (bKash, Nagad, Rocket ও Upay)।</p>
              <p className="mt-2">3. ভিন্ন মাধ্যমে রিফান্ড গ্রহণের ক্ষেত্রে তা আলোচনা সাপেক্ষে বিবেচনা করা হবে।</p>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground mb-3">⚠️ পেমেন্ট সংক্রান্ত গুরুত্বপূর্ণ নির্দেশনা</h2>
              <p>1. শুধুমাত্র আমাদের অফিসিয়াল নম্বর 01930709532 এ পেমেন্ট করতে হবে।</p>
              <p className="mt-2">2. উক্ত নম্বর ব্যতীত অন্য কোনো নম্বরে পেমেন্ট করলে কর্তৃপক্ষ কোনোভাবেই দায়ী থাকবে না।</p>
              <p className="mt-2">3. ভুল নম্বরে টাকা প্রেরণ করলে তার সম্পূর্ণ দায় প্রেরণকারীকেই বহন করতে হবে।</p>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold text-foreground mb-3">৬. যোগাযোগ</h2>
              <p>
                ৩. যোগাযোগ
              </p>
              <p className="mt-2">ইমেইল: hello@eexamapp.com</p>
              <p>মোবাইল: ০১৭১১-০০০০০০</p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>);
}