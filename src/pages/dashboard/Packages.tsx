import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export default function Packages() {
  const { user } = useAuth();
  const [hasSubscription, setHasSubscription] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()
      .then(({ data }) => setHasSubscription(!!data));
  }, [user]);

  if (hasSubscription === null) return null;

  if (!hasSubscription) {
    return (
      <Card className="max-w-md mx-auto mt-10">
        <CardContent className="p-8 text-center">
          <Lock className="w-10 h-10 text-destructive mx-auto mb-3" />
          <h2 className="font-heading font-bold text-lg text-destructive mb-2">
            কোনো রেডি প্রশ্ন/সাজেশন প্যাকেজ নেই
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            প্যাকেজ ক্রয় করুন, অথবা ক্রয় করার পরেও এই মেসেজ দেখে থাকলে আমাদের মেসেজ দিন
          </p>
          <Button variant="outline">Messenger</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-center mb-6">রেডি প্রশ্ন/সাজেশন</h1>
      <p className="text-center text-muted-foreground">আপনার প্যাকেজগুলো এখানে দেখাবে।</p>
    </div>
  );
}
