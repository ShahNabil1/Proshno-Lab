import { User, Mail, Phone, Edit, Award, BookOpen, Users, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

const stats = [
  { label: "প্রশ্ন তৈরি", value: "১২৫", icon: FileText, color: "gradient-purple" },
  { label: "প্যাকেজ", value: "৮", icon: BookOpen, color: "gradient-yellow" },
  { label: "শিক্ষক", value: "৪৫", icon: Users, color: "gradient-purple" },
];

export default function Profile() {
  return (
    <div className="py-10">
      <div className="container max-w-3xl">
        {/* Profile Card */}
        <div className="bg-card rounded-2xl shadow-lg p-8 text-center">
          <div className="w-24 h-24 rounded-full gradient-purple mx-auto flex items-center justify-center mb-4">
            <User className="w-12 h-12 text-primary-foreground" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground">মোহাম্মদ আলী</h1>
          <p className="text-muted-foreground">ক্লাস টিচার • ঢাকা বিদ্যালয়</p>

          <div className="flex justify-center gap-3 mt-5">
            <Button variant="outline" size="sm">
              <Edit className="w-4 h-4 mr-1.5" /> প্রোফাইল সম্পাদনা
            </Button>
            <Button variant="outline" size="sm">
              <Award className="w-4 h-4 mr-1.5" /> সার্টিফিকেট
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-8">
          {stats.map((s) => (
            <div key={s.label} className="bg-card rounded-xl shadow-sm p-5 text-center">
              <div className={`w-14 h-14 rounded-full ${s.color} mx-auto flex items-center justify-center mb-3`}>
                <s.icon className="w-6 h-6 text-primary-foreground" />
              </div>
              <p className="font-heading text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-muted-foreground text-sm">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Contact */}
        <div className="bg-card rounded-xl shadow-sm p-6 mt-8">
          <h2 className="font-heading font-bold text-lg text-foreground mb-4">যোগাযোগ</h2>
          <div className="space-y-3 text-muted-foreground">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-primary" />
              <span>ali@example.com</span>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-primary" />
              <span>+880 1712-345678</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
