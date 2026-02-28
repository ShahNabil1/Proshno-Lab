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