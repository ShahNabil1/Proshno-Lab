import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Activity, Eye, Users, MousePointerClick, Search, RefreshCw, Calendar } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

interface AnalyticsEvent {
  id: number;
  event_name: string;
  user_id: string | null;
  page_path: string | null;
  page_url: string | null;
  params: any;
  created_at: string;
  user_agent: string | null;
  referrer: string | null;
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(210, 70%, 50%)",
  "hsl(150, 60%, 45%)",
  "hsl(30, 80%, 55%)",
  "hsl(340, 65%, 50%)",
  "hsl(270, 50%, 55%)",
  "hsl(180, 55%, 45%)",
];

export default function AdminAnalytics() {
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState("7");
  const [eventFilter, setEventFilter] = useState("all");

  const fetchEvents = async () => {
    setLoading(true);
    const fromDate = startOfDay(subDays(new Date(), parseInt(dateRange))).toISOString();
    const toDate = endOfDay(new Date()).toISOString();

    const { data } = await supabase
      .from("analytics_events")
      .select("*")
      .gte("created_at", fromDate)
      .lte("created_at", toDate)
      .order("created_at", { ascending: false })
      .limit(1000);

    setEvents((data as AnalyticsEvent[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, [dateRange]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel("analytics-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "analytics_events" },
        (payload) => {
          const newEvent = payload.new as AnalyticsEvent;
          setEvents((prev) => [newEvent, ...prev].slice(0, 1000));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Unique event names for filter
  const eventNames = useMemo(() => {
    const names = new Set(events.map(e => e.event_name));
    return Array.from(names).sort();
  }, [events]);

  // Filtered events
  const filtered = useMemo(() => {
    let result = events;
    if (eventFilter !== "all") result = result.filter(e => e.event_name === eventFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        e.event_name.toLowerCase().includes(q) ||
        e.page_path?.toLowerCase().includes(q) ||
        e.user_id?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [events, eventFilter, search]);

  // Stats
  const totalEvents = filtered.length;
  const uniqueUsers = new Set(filtered.filter(e => e.user_id).map(e => e.user_id)).size;
  const pageViews = filtered.filter(e => e.event_name === "page_view").length;
  const clicks = filtered.filter(e => e.event_name === "button_click").length;

  // Chart: events by day
  const dailyChart = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(e => {
      const day = format(new Date(e.created_at), "MM/dd");
      map[day] = (map[day] || 0) + 1;
    });
    return Object.entries(map).reverse().map(([date, count]) => ({ date, count }));
  }, [filtered]);

  // Chart: top events pie
  const eventPie = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(e => { map[e.event_name] = (map[e.event_name] || 0) + 1; });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));
  }, [filtered]);

  // Top pages
  const topPages = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.filter(e => e.page_path).forEach(e => { map[e.page_path!] = (map[e.page_path!] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-heading font-bold text-foreground">📊 এনালিটিক্স</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="w-4 h-4 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">আজ</SelectItem>
              <SelectItem value="7">৭ দিন</SelectItem>
              <SelectItem value="30">৩০ দিন</SelectItem>
              <SelectItem value="90">৯০ দিন</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchEvents} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "মোট ইভেন্ট", value: totalEvents, icon: Activity, color: "text-primary" },
          { label: "ইউনিক ইউজার", value: uniqueUsers, icon: Users, color: "text-green-600" },
          { label: "পেইজ ভিউ", value: pageViews, icon: Eye, color: "text-blue-600" },
          { label: "বাটন ক্লিক", value: clicks, icon: MousePointerClick, color: "text-orange-600" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`w-8 h-8 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value.toLocaleString("bn-BD")}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">দৈনিক ইভেন্ট</CardTitle></CardHeader>
          <CardContent className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyChart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">টপ ইভেন্ট</CardTitle></CardHeader>
          <CardContent className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={eventPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                  {eventPie.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Pages */}
      {topPages.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">টপ পেইজ</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topPages.map(([path, count]) => (
                <div key={path} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground truncate max-w-[70%]">{path}</span>
                  <span className="font-semibold text-foreground">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Event Log Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
            <CardTitle className="text-sm">ইভেন্ট লগ</CardTitle>
            <div className="flex gap-2 items-center">
              <Select value={eventFilter} onValueChange={setEventFilter}>
                <SelectTrigger className="w-[180px] h-9 text-xs">
                  <SelectValue placeholder="সব ইভেন্ট" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">সব ইভেন্ট</SelectItem>
                  {eventNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="খুঁজুন..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 w-[180px] text-xs" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-auto max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">সময়</TableHead>
                  <TableHead className="text-xs">ইভেন্ট</TableHead>
                  <TableHead className="text-xs">পেইজ</TableHead>
                  <TableHead className="text-xs">ইউজার ID</TableHead>
                  <TableHead className="text-xs">প্যারামিটার</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">লোড হচ্ছে...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">কোনো ইভেন্ট নেই</TableCell></TableRow>
                ) : (
                  filtered.slice(0, 100).map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs whitespace-nowrap">{format(new Date(e.created_at), "dd MMM, hh:mm a")}</TableCell>
                      <TableCell><span className="text-xs font-medium bg-muted px-2 py-0.5 rounded">{e.event_name}</span></TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{e.page_path || "-"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono max-w-[100px] truncate">{e.user_id?.slice(0, 8) || "anon"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{e.params ? JSON.stringify(e.params) : "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {filtered.length > 100 && <p className="text-xs text-muted-foreground mt-2 text-center">প্রথম ১০০টি দেখানো হচ্ছে (মোট {filtered.length})</p>}
        </CardContent>
      </Card>
    </div>
  );
}
