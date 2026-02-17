import { useState } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { UserPlus } from "lucide-react";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-xl gradient-yellow mx-auto flex items-center justify-center mb-4">
              <UserPlus className="w-7 h-7 text-secondary-foreground" />
            </div>
            <h1 className="font-heading text-2xl font-bold text-foreground">রেজিস্ট্রেশন</h1>
            <p className="text-muted-foreground text-sm mt-1">নতুন অ্যাকাউন্ট তৈরি করুন</p>
          </div>

          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div>
              <Label htmlFor="name">নাম</Label>
              <Input id="name" placeholder="আপনার নাম" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="email">ইমেইল</Label>
              <Input id="email" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="password">পাসওয়ার্ড</Label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button className="w-full font-heading font-semibold" size="lg">
              রেজিস্ট্রেশন করুন
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            ইতিমধ্যে অ্যাকাউন্ট আছে?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">
              লগইন করুন
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
