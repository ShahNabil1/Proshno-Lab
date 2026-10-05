import { ArrowUpRight, Headphones, Mail, Phone } from "lucide-react";
import WhatsAppIcon from "@/components/icons/WhatsAppIcon";
import MessengerIcon from "@/components/icons/MessengerIcon";

const channels = [
  { title: "ফোনে কথা বলুন", detail: "+880 9696-638867", action: "কল করুন", href: "tel:+8809696638867", icon: Phone },
  { title: "WhatsApp", detail: "প্রশ্ন বা সমস্যার বিস্তারিত পাঠান", action: "মেসেজ দিন", href: "https://wa.me/8801758018668", icon: WhatsAppIcon, external: true },
  { title: "Messenger", detail: "আমাদের Facebook পেজে যোগাযোগ করুন", action: "মেসেজ দিন", href: "https://m.me/proshnolab", icon: MessengerIcon, external: true },
  { title: "ইমেইল", detail: "support@proshnolab.com", action: "ইমেইল করুন", href: "mailto:support@proshnolab.com", icon: Mail },
];

export default function Contact() {
  return (
    <section className="helpline-page">
      <div className="helpline-content">
          <div className="helpline-heading">
            <Headphones aria-hidden="true" />
            <h1>যোগাযোগ করুন</h1>
            <p>প্রশ্ন তৈরি, প্যাকেজ বা পেমেন্টের সহায়তায় আমরা পাশে আছি।</p>
          </div>
            <div className="helpline-channels">
              {channels.map(({ title, detail, action, href, icon: Icon, external }) => (
                <a key={href} href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} className="helpline-channel">
                  <span className="helpline-icon"><Icon /></span>
                  <span className="helpline-details"><strong>{title}</strong><span>{detail}</span></span>
                  <span className="helpline-action"><span>{action}</span><ArrowUpRight /></span>
                </a>
              ))}
            </div>
      </div>
    </section>
  );
}
