import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

export default function Subscription() {
  const { user } = useAuth();
  const [sub, setSub] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { setSub(data); setLoading(false); });
  }, [user]);

  if (loading) return null;

  if (!sub || sub.status !== "active") {
    return (
      <div className="max-w-md mx-auto mt-10 text-center">
        <h2 className="font-heading text-xl font-bold text-destructive mb-2">কোনো সাবস্ক্রিপশন নেই!</h2>
        <p className="text-sm text-muted-foreground mb-4">সাবস্ক্রিপশন নিয়ে প্রিমিয়াম সুবিধা উপভোগ করুন</p>
        <Link to="/pricing">
          <Button className="gradient-green text-primary-foreground border-0">সাবস্ক্রিপশন দিন</Button>
        </Link>
      </div>
    );
  }

  return (
    <Card className="max-w-md mx-auto mt-10">
      <CardContent className="p-6 text-center">
        <h2 className="font-heading text-xl font-bold mb-2">আপনার সাবস্ক্রিপশন</h2>
        <p className="text-sm text-muted-foreground capitalize">প্ল্যান: {sub.plan}</p>
        <p className="text-sm text-muted-foreground">স্ট্যাটাস: সক্রিয়</p>
        {sub.expires_at && (
          <p className="text-sm text-muted-foreground">
            মেয়াদ শেষ: {new Date(sub.expires_at).toLocaleDateString("bn-BD")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
