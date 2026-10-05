import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, CheckCircle2, FileText, BookOpen, Printer, Monitor, PenLine, MousePointer2, Eraser, Play, ChevronDown } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import "./TeacherHome.css";

const subjects = [
  { name: "গণিত", question: "একটি ত্রিভুজের তিন কোণের সমষ্টি কত?", answers: ["৯০°", "১৮০°", "২৭০°", "৩৬০°"] },
  { name: "বাংলা", question: "‘আমাদের ছোট নদী’ কবিতার রচয়িতা কে?", answers: ["কাজী নজরুল ইসলাম", "রবীন্দ্রনাথ ঠাকুর", "জসীমউদ্‌দীন", "সুকান্ত ভট্টাচার্য"] },
  { name: "বিজ্ঞান", question: "উদ্ভিদ কোন প্রক্রিয়ায় খাদ্য তৈরি করে?", answers: ["শ্বসন", "সালোকসংশ্লেষণ", "প্রস্বেদন", "অভিস্রবণ"] },
];
const features = [
  { icon: BookOpen, title: "প্রশ্নপত্র তৈরি", text: "শ্রেণি, বিষয় ও অধ্যায় বেছে প্রশ্ন সাজান। নম্বর ও সময় ঠিক করুন আপনার মতো।", color: "lavender", link: "/dashboard/create", action: "প্রশ্ন তৈরি করুন" },
  { icon: Monitor, title: "ডিজিটাল হোয়াইটবোর্ড", text: "লিখে, এঁকে ও প্রশ্ন দেখিয়ে ক্লাস নিন। কঠিন বিষয় বোঝান আরও সহজে।", color: "peach", link: "/dashboard/smartboard", action: "হোয়াইটবোর্ড খুলুন" },
  { icon: Printer, title: "সংরক্ষণ ও প্রিন্ট", text: "তৈরি প্রশ্নপত্র এক জায়গায় রাখুন। প্রয়োজনমতো ডাউনলোড ও প্রিন্ট করুন।", color: "mint", link: "/dashboard/my-questions", action: "আমার প্রশ্নপত্র দেখুন" },
];
export default function TeacherHome() {
  const { user } = useAuth();
  const reduced = useReducedMotion();
  const [subject, setSubject] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [faq, setFaq] = useState<number | null>(0);
  const start = user ? "/dashboard/create" : "/login";
  const current = subjects[subject];
  const faqs = [
    ["কোন শ্রেণির প্রশ্ন তৈরি করা যায়?", "ষষ্ঠ থেকে দ্বাদশ শ্রেণির জন্য বিষয় ও অধ্যায় বেছে প্রশ্নপত্র তৈরি করতে পারবেন।"],
    ["কীভাবে শুরু করব?", "‘প্রশ্ন তৈরি করুন’ বাটনে ক্লিক করে লগইন করুন। এরপর শ্রেণি, বিষয় ও প্রশ্নের ধরন বেছে নিন।"],
    ["হোয়াইটবোর্ডে কীভাবে ক্লাস নেব?", "লগইন করে ‘হোয়াইটবোর্ড খুলুন’ বাটনে ক্লিক করুন। কলম, রং ও আকার ব্যবহার করে বোঝান অথবা সংরক্ষিত প্রশ্নপত্র খুলে প্রশ্ন আলোচনা করুন।"],
    ["তৈরি করা প্রশ্ন কি সম্পাদনা করা যাবে?", "হ্যাঁ। প্রশ্ন তৈরির সময় নিজের প্রয়োজন অনুযায়ী প্রশ্ন নির্বাচন ও সম্পাদনা করতে পারবেন।"],
  ];
  return <div className="teacher-home">
    <section className="th-hero">
      <div className="th-container th-hero-grid">
        <motion.div initial={reduced ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6 }}>
          <div className="th-eyebrow"><span /> বাংলাদেশের শিক্ষকদের জন্য <span className="th-grade-badge">ষষ্ঠ–দ্বাদশ শ্রেণি</span></div>
          <h1>প্রস্তুতি হোক সহজ।<br />ক্লাস হোক <span>প্রাণবন্ত।</span></h1>
          <p className="th-lead">পরীক্ষার প্রশ্নপত্র থেকে হোয়াইটবোর্ডে পাঠদান—শিক্ষকতার প্রতিদিনের কাজ, এখন এক জায়গায়। সময় বাঁচান প্রস্তুতিতে, মন দিন শিক্ষার্থীদের।</p>
          <div className="th-actions"><Link className="th-button" to={start}>প্রশ্ন তৈরি করুন <ArrowRight size={18} /></Link><Link className="th-secondary-button" to={user ? "/dashboard/smartboard" : "/login"}><Monitor size={18} /> হোয়াইটবোর্ড খুলুন</Link></div>
          <div className="th-assurances"><span><CheckCircle2 size={16} /> সহজ বাংলা ইন্টারফেস</span><span><CheckCircle2 size={16} /> নিজের মতো প্রশ্নপত্র</span></div>
          <a className="th-video-link th-hero-guide" href="#how-it-works"><Play size={14} /> প্রথমবার? কীভাবে কাজ করে দেখুন <ArrowRight size={14} /></a>
        </motion.div>
        <motion.div className="th-preview-wrap" initial={reduced ? false : { opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7, delay: .15 }}>
          <div className="th-preview">
            <div className="th-preview-bar"><span className="th-mini-logo"><FileText size={18} /> আপনার প্রশ্নপত্র</span><span className="th-live"><span /> ইন্টার‌্যাকটিভ নমুনা</span></div>
            <div className="th-preview-body"><div className="th-preview-title"><div><small>আপনার পরবর্তী প্রশ্নপত্র</small><h3>অর্ধবার্ষিক পরীক্ষা</h3></div><span className="th-class">অষ্টম শ্রেণি</span></div>
              <div className="th-tabs" role="tablist" aria-label="নমুনা প্রশ্নের বিষয়">{subjects.map((s, i) => <button type="button" key={s.name} role="tab" aria-selected={i === subject} aria-controls="sample-question" id={`subject-${i}`} onClick={() => { setSubject(i); setAnswer(null); }} className={i === subject ? "active" : ""}>{s.name}</button>)}</div>
              <div className="th-paper" id="sample-question" role="tabpanel" aria-labelledby={`subject-${subject}`}><div className="th-paper-meta"><span>{current.name} · বহুনির্বাচনি</span><span>পূর্ণমান: ১</span></div><h4>১। {current.question}</h4><div className="th-options">{current.answers.map((option, i) => <button type="button" aria-pressed={answer === i} key={option} className={answer === i ? "selected" : ""} onClick={() => setAnswer(i)}><span>{["ক", "খ", "গ", "ঘ"][i]}</span>{option}{answer === i && <Check size={14} />}</button>)}</div></div>
              <div className="th-preview-bottom"><span><CheckCircle2 size={15} /> {answer === null ? "বিষয় বদলে নমুনা দেখুন" : "আপনার পছন্দ নির্বাচন করা হয়েছে"}</span><span>নমুনা প্রশ্নপত্র</span></div>
            </div>
          </div>
          <div className="th-floating-note"><span><Printer size={21} /></span><div><strong>আপনার প্রশ্ন, আপনার বিন্যাস</strong><small>সম্পাদনা · ডাউনলোড · প্রিন্ট</small></div><CheckCircle2 size={18} /></div>
        </motion.div>
      </div>
      <div className="th-container th-levels"><span><BookOpen size={20} /> স্কুল থেকে কলেজ, আপনার প্রতিদিনের সঙ্গী</span><div><span>ষষ্ঠ – অষ্টম <small>মাধ্যমিক প্রস্তুতি</small></span><i /><span>নবম – দশম <small>এসএসসি প্রস্তুতি</small></span><i /><span>একাদশ – দ্বাদশ <small>এইচএসসি প্রস্তুতি</small></span></div></div>
    </section>
    <section className="th-features th-container"><div className="th-section-heading"><span className="th-kicker">এক প্ল্যাটফর্ম, প্রতিদিনের সমাধান</span><h2>প্রশ্ন তৈরি থেকে ক্লাস নেওয়া—সবই সহজ।</h2><p>আপনি পড়াবেন। প্রস্তুতির কাজটা হোক আরও গোছানো।</p></div><div className="th-feature-grid">{features.map(({ icon: Icon, title, text, color, link, action }, i) => <article key={title} className={`th-feature ${color}`}><div className="th-feature-top"><div className="th-feature-icon"><Icon size={25} /></div><span>০{i + 1}</span></div><h3>{title}</h3><p>{text}</p><Link className="th-text-link" to={user ? link : "/login"}>{action}<ArrowRight size={17} /></Link></article>)}</div></section>
    <section className="th-board-section th-container"><div className="th-board-copy"><span className="th-kicker">আপনার ডিজিটাল শ্রেণিকক্ষ</span><h2>বোঝান লিখে, এঁকে।<br />শেখান আরও সহজে।</h2><p>গণিতের সমাধান হোক বা বিজ্ঞানের চিত্র—ডিজিটাল হোয়াইটবোর্ডে ধাপে ধাপে বুঝিয়ে দিন। তৈরি প্রশ্নপত্র খুলেও আলোচনা করতে পারবেন।</p><ul><li><Check size={17} /> কলম, রং ও আকার দিয়ে বোঝান</li><li><Check size={17} /> প্রশ্নপত্র থেকে প্রশ্ন দেখিয়ে পড়ান</li><li><Check size={17} /> পূর্ণ পর্দায় ক্লাসের মনোযোগ ধরে রাখুন</li></ul><Link className="th-button" to={user ? "/dashboard/smartboard" : "/login"}>হোয়াইটবোর্ডে ক্লাস নিন<ArrowRight size={18} /></Link></div><div className="th-board-demo"><div className="th-board-top"><span><Monitor size={17} /> স্মার্ট বোর্ড</span><small>নমুনা পাঠ · গণিত</small></div><div className="th-board-content"><span className="th-board-label">আজকের পাঠ: পিথাগোরাসের উপপাদ্য</span><svg viewBox="0 0 390 210" role="img" aria-label="সমকোণী ত্রিভুজের ভূমি ৩, উচ্চতা ৪ ও অতিভুজ ৫; ৩ বর্গ যোগ ৪ বর্গ সমান ৫ বর্গ"><path d="M75 30 V170 H270 Z" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinejoin="round"/><path d="M75 151 H94 V170" fill="none" stroke="#cbd5e1" strokeWidth="2"/><g fill="#f4f8f5" fontSize="22" fontFamily="sans-serif"><text x="43" y="109">4</text><text x="160" y="199">3</text><text x="187" y="92">5</text><text x="283" y="155" fontSize="16">a² + b² = c²</text></g></svg><p>৩² + ৪² = ৯ + ১৬ = ২৫ = ৫² <CheckCircle2 size={20} /></p></div><div className="th-board-tools" aria-hidden="true"><PenLine size={19}/><Eraser size={19}/><MousePointer2 size={19}/><i/><b/><b/><b/><span>লিখুন। আঁকুন। বোঝান।</span></div></div></section>
    <section className="th-container th-process" id="how-it-works"><div><span className="th-kicker">শুরু করা খুব সহজ</span><h2>তিন ধাপেই<br />আপনার প্রশ্নপত্র।</h2><Link to={start} className="th-text-link">এখনই শুরু করুন <ArrowRight size={17} /></Link></div><ol>{[["শ্রেণি ও বিষয় বেছে নিন", "আপনার ক্লাসের বিষয় ও অধ্যায় নির্বাচন করুন।"], ["প্রশ্নপত্র সাজান", "প্রশ্ন বাছাই করুন, নম্বর দিন ও প্রয়োজনমতো সম্পাদনা করুন।"], ["ডাউনলোড ও প্রিন্ট করুন", "তৈরি প্রশ্নপত্র দেখে নিন, তারপর প্রিন্টের জন্য ডাউনলোড করুন।"]].map(([title, text], i) => <li key={title}><span className="th-step">{["০১", "০২", "০৩"][i]}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol></section>
    <section className="th-container th-faq"><div className="th-section-heading"><span className="th-kicker">আরও কিছু জানতে চান?</span><h2>আপনার প্রশ্ন, সহজ উত্তর।</h2></div><div>{faqs.map(([q, a], i) => <div className="th-faq-item" key={q}><button type="button" aria-expanded={faq === i} aria-controls={`faq-${i}`} onClick={() => setFaq(faq === i ? null : i)}>{q}<ChevronDown size={18} className={faq === i ? "open" : ""} /></button>{faq === i && <p id={`faq-${i}`}>{a}</p>}</div>)}</div></section>
  </div>;
}
