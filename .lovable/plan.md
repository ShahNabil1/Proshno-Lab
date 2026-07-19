## Goal
`/dashboard/create` পেইজে উপরে ৩টা মোড টগল যোগ করা: **অটো প্রশ্ন তৈরী**, **প্রশ্ন তৈরি**, **রেডি প্রশ্ন** — ক্লায়েন্টের স্ক্রিনশটের navy blue accent সহ।

---

## 1. Route/Layout পরিবর্তন

- `/dashboard/create` এ একটা নতুন wrapper component `QuestionCreateHub.tsx` বসানো হবে, যেখানে উপরে ৩টা pill-style টগল বাটন থাকবে (স্ক্রিনশটের মতো navy outline)।
- URL query param `?mode=auto|manual|ready` দিয়ে টগল persist হবে (রিফ্রেশে মনে রাখবে)।
- Default mode = `auto` (নতুন হাইলাইট ফিচার)।

---

## 2. অটো প্রশ্ন তৈরী (নতুন) — `AutoQuestionCreate.tsx`

**৩ ধাপের wizard**, স্ক্রিনশটের হুবহু UI:

### ধাপ ১: বিষয়
- শ্রেণী dropdown (subscription matcher দিয়ে filtered)
- বিষয় dropdown (permission + active)
- অধ্যায় checkbox list (একাধিক সিলেকশন, is_active=true)

### ধাপ ২: কনফিগ
- ৪টা টাইপ চেকবক্স: MCQ, সৃজনশীল, সংক্ষিপ্ত, বর্ণনামূলক
- চেক করলে সেই টাইপের জন্য একটা slider দেখাবে (১ থেকে সেই selection এ available count পর্যন্ত)
- Live available count fetch করবে সিলেক্টেড chapters থেকে (একই paginated loader প্যাটার্ন যেটা এখন আছে)

### ধাপ ৩: জেনারেট (সামারি)
- Green checkmark সহ "আপনার প্রশ্নপত্র প্রস্তুত!" কার্ড
- সারাংশ box (শ্রেণী, বিষয়, অধ্যায়, প্রতি টাইপে সংখ্যা, মোট মূল্য)
- "আগের ধাপে যান" + "প্রশ্ন তৈরি করুন" বাটন
- Generate করলে: প্রতিটা সিলেক্টেড type থেকে random N টা প্রশ্ন pull → existing `QuestionPaperView` state এ পাঠিয়ে `/dashboard/view-paper` এ navigate

**Random selection logic:** frontend এ `.select().in('chapter_id', ...).eq('type', t).eq('is_active', true)` → shuffle → slice(N)। বড় dataset হলে paginated loader loop।

**Stepper:** উপরে ৩টা tab (স্ক্রিনশটের navy fill active state)। ধাপ change হলে state preserve।

---

## 3. প্রশ্ন তৈরি (existing refactor) — `QuestionCreate.tsx`

- বর্তমান manual selector + filter panel + question picker flow অক্ষুণ্ণ।
- Visual refresh শুধু:
  - Header banner navy accent (`bg-primary` → gradient tweak)
  - Filter section এ subtle card shadow, rounded-2xl
  - "প্রশ্ন তৈরী করুন" বাটন style match with wizard
- Business logic কিছুই বদলাবে না।

---

## 4. রেডি প্রশ্ন

- এই টগলে ক্লিক করলে existing `/dashboard/packages` (Packages.tsx) কেই render করবে — একই component reuse (inline, নতুন route না)।
- Subscription না থাকলে existing lock card দেখাবে।

---

## Technical details

**নতুন ফাইল:**
- `src/pages/dashboard/QuestionCreateHub.tsx` — mode toggle + conditional render
- `src/pages/dashboard/AutoQuestionCreate.tsx` — ৩-ধাপ wizard
- `src/components/dashboard/CreateModeToggle.tsx` — ৩ pill বাটন

**পরিবর্তন:**
- `App.tsx` route: `/dashboard/create` → `QuestionCreateHub`
- `QuestionCreate.tsx` — UI polish only (কোনো logic change না)

**Shared logic:**
- Subscription matcher (`hasActiveAccess`) দুই flow তেই
- Chapter/subject fetching pattern existing `QuestionCreate` থেকেই copy
- Generate করার পরে existing `QuestionPaperView` route ব্যবহার করবে (state pass via `useLocation`)

**Random algorithm:**
```ts
const shuffle = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);
const pickRandom = (pool: Question[], count: number) => shuffle(pool).slice(0, count);
```

**Color tokens:** স্ক্রিনশটের navy = existing `--primary` (emerald) এর জায়গায় কি ব্যবহার করব? স্ক্রিনশট navy blue দেখাচ্ছে কিন্তু project brand emerald green। **Emerald green এ adapt করে সব করব** (memory constraint respect করে), শুধু layout/structure স্ক্রিনশট follow করব। যদি ক্লায়েন্ট literally navy চায় সেটা confirm করতে হবে।

---

## Out of scope
- AI-based smart generation (এখন pure random shuffle)
- Difficulty balancing / topic distribution weights
- Saved auto-templates

Approve করলে build শুরু করব।
