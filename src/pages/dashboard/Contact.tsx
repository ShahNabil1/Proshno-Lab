import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Mail } from "lucide-react";
import WhatsAppIcon from "@/components/icons/WhatsAppIcon";
import MessengerIcon from "@/components/icons/MessengerIcon";

export default function Contact() {
  return (
    <section className="min-h-[calc(100vh-64px)] lg:min-h-[calc(100vh-76px)] flex items-center justify-center px-4 py-12 lg:py-16">
      <div className="w-full max-w-lg mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-navy">যোগাযোগ</h1>
          <p className="text-sm md:text-base text-slate-500">
            যেকোনো প্রয়োজনে নিচের মাধ্যমে আমাদের সাথে যোগাযোগ করুন
          </p>
        </div>

        <Card className="shadow-md border-slate-100">
          <CardContent className="p-4 md:p-6 space-y-3">
            <Button variant="outline" className="w-full gap-2 justify-center h-11 md:h-12 text-sm md:text-base rounded-lg" asChild>
              <a href="tel:+8809696638867">
                <Phone className="w-4 h-4 md:w-5 md:h-5 text-navy" />
                <span className="font-medium">+8809696-638867</span>
              </a>
            </Button>

            <Button
              className="w-full gap-2 justify-center h-11 md:h-12 text-sm md:text-base rounded-lg bg-[#25D366] hover:bg-[#128C7E] text-white border-0 shadow-sm transition-colors"
              asChild
            >
              <a href="https://wa.me/8801758018668" target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon className="w-4 h-4 md:w-5 md:h-5" />
                <span className="font-medium">WhatsApp এ মেসেজ দিন</span>
              </a>
            </Button>

            <Button variant="outline" className="w-full gap-2 justify-center h-11 md:h-12 text-sm md:text-base rounded-lg" asChild>
              <a href="https://m.me/proshnolab" target="_blank" rel="noopener noreferrer">
                <MessengerIcon className="w-4 h-4 md:w-5 md:h-5 text-[#0084FF]" />
                <span className="font-medium">Messenger এ মেসেজ দিন</span>
              </a>
            </Button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase text-slate-400">
                <span className="bg-white px-3">অথবা</span>
              </div>
            </div>

            <a
              href="mailto:support@proshnolab.com"
              className="flex items-center justify-center gap-2 h-11 md:h-12 rounded-lg border border-slate-200 bg-slate-50 text-sm md:text-base text-navy hover:bg-slate-100 transition-colors"
            >
              <Mail className="w-4 h-4 md:w-5 md:h-5" />
              <span className="font-medium">support@proshnolab.com</span>
            </a>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
