import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Mail } from "lucide-react";
import WhatsAppIcon from "@/components/icons/WhatsAppIcon";
import MessengerIcon from "@/components/icons/MessengerIcon";

export default function Contact() {
  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="font-heading text-2xl font-bold text-center">যোগাযোগ</h1>

      <Card>
        <CardContent className="p-6 space-y-4">
          <Button variant="outline" className="w-full gap-2 justify-start" asChild>
            <a href="tel:+8801758018668">
              <Phone className="w-4 h-4" /> +880 1758-018668
            </a>
          </Button>
          <Button className="w-full gap-2 justify-start bg-[#25D366] hover:bg-[#128C7E] text-white border-0" asChild>
            <a href="https://wa.me/8801758018668" target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon className="w-4 h-4" /> Open WhatsApp
            </a>
          </Button>
          <Button variant="outline" className="w-full gap-2 justify-start" asChild>
            <a href="https://m.me/proshnolab" target="_blank" rel="noopener noreferrer">
              <MessengerIcon className="w-4 h-4" /> Open Messenger
            </a>
          </Button>
          <div className="text-center text-sm text-muted-foreground pt-2">
            <p>OR</p>
            <a href="mailto:support@proshnolab.com" className="flex items-center justify-center gap-2 mt-2 text-primary">
              <Mail className="w-4 h-4" /> support@proshnolab.com
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
