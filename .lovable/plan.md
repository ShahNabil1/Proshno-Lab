## লক্ষ্য

Admin (এবং future-এ teacher) একবারে অনেক প্রশ্ন যোগ করতে পারবে — শ্রেণী, বিষয়, অধ্যায়, টাইপ context একবার সিলেক্ট করে, তারপর ৪টা path-এর যেকোনো একটা দিয়ে প্রশ্ন feed করবে। সবগুলা path শেষে একই **Preview → Validate → Bulk Insert** স্টেপে গিয়ে মিশবে, যাতে code duplication না হয়।

---

## Architecture (এক পেইজ, tabbed)

নতুন route: `/admin/questions/bulk` (AdminQuestions পেইজের "+" বাটনের পাশে "বাল্ক আপলোড" বাটন)।

```text
┌─ Step 1: Context (সবার জন্য common) ──────────────┐
│  শ্রেণী * → বিষয় * → অধ্যায় * → টপিক (opt)      │
│  প্রশ্নের ধরন *  [MCQ | CQ | SQ | Descriptive]     │
│  উদ্দীপক-ভিত্তিক? [checkbox]                        │
│  বোর্ড / বছর (optional, default)                    │
└────────────────────────────────────────────────────┘
                     ↓
┌─ Step 2: Input Method (tabs) ─────────────────────┐
│  [📊 Excel]  [📝 Paste]  [🤖 AI]  [➕ Manual]     │
└────────────────────────────────────────────────────┘
                     ↓
┌─ Step 3: Preview & Edit (common) ─────────────────┐
│  Editable table — প্রতি row-এ inline edit,        │
│  ✓/✗ validation badge, remove button              │
│  Errors summary + "সব ঠিক করে দাও" AI fix button  │
└────────────────────────────────────────────────────┘
                     ↓
┌─ Step 4: Confirm & Insert ────────────────────────┐
│  Total: N | Valid: X | Invalid: Y                 │
│  [বাল্ক সেভ করুন] → progress bar → success        │
└────────────────────────────────────────────────────┘
```

Context একবার সিলেক্ট হলে ৪টা method-ই সেই context inherit করবে — CSV-তে বারবার class/subject লেখা লাগবে না, শুধু question content-ই থাকবে।

---

## Method 1: 📊 Excel/CSV টেমপ্লেট (dynamic per-type)

**Step 1-এ সিলেক্ট করা টাইপ অনুযায়ী আলাদা টেমপ্লেট download হবে** — একটাই generic template না। `xlsx` skill (SheetJS/openpyxl-ভিত্তিক) দিয়ে বানানো টেমপ্লেটে column headers Bangla-তে, sample row, dropdown validation থাকবে।

### MCQ template (`mcq_template.xlsx`)
| উদ্দীপক (HTML/opt) | প্রশ্ন* | অপশন ক* | অপশন খ* | অপশন গ* | অপশন ঘ* | সঠিক উত্তর* (ক/খ/গ/ঘ) | ব্যাখ্যা | ছবি URL (Cloudinary) | বোর্ড | বছর |

### CQ template (`cq_template.xlsx`)
| উদ্দীপক* | প্রশ্ন ক (জ্ঞান)* | মান ক | প্রশ্ন খ (অনুধাবন)* | মান খ | প্রশ্ন গ (প্রয়োগ)* | মান গ | প্রশ্ন ঘ (উচ্চতর)* | মান ঘ | ছবি URL |

### SQ template
| উদ্দীপক (opt) | প্রশ্ন* | উত্তর | মান | ছবি URL |

### Descriptive template
| প্রশ্ন* | উত্তর | মান | ছবি URL |

**Rules:**
- HTML/LaTeX cell-এ সরাসরি লেখা যাবে (যেমন `<img src="cloudinary-url">`, `$x^2$`, `<table>...`)। গণিত/টেবিল/ছবি সব cover হবে।
- ছবি URL কলামে Cloudinary URL দিলে system auto `<img>` tag বসিয়ে stimulus/prompt-এ যোগ করবে।
- Upload হওয়ার পর `xlsx` লাইব্রেরি দিয়ে parse → preview table-এ যাবে।
- Row-wise validation: required field missing, MCQ-এ ৪টা option না থাকা, সঠিক উত্তর ক/খ/গ/ঘ-এর বাইরে ইত্যাদি ধরা পড়বে।

---

## Method 2: 📝 Structured Paste (auto-parser)

একটা বড় textarea, নিচে example format দেখানো থাকবে (type অনুযায়ী চেঞ্জ হবে)। Parser regex/pattern দিয়ে detect করবে।

**MCQ format:**
```text
১. বাংলাদেশের রাজধানী কোথায়?
ক) চট্টগ্রাম
খ) ঢাকা
গ) রাজশাহী
ঘ) সিলেট
উত্তর: খ
ব্যাখ্যা: ঢাকা বাংলাদেশের রাজধানী।

২. ...
```

**CQ format:**
```text
উদ্দীপক: রহিম একজন কৃষক...

ক) জৈব সার কী? [1]
খ) ব্যাখ্যা করো... [2]
গ) উদ্দীপকের আলোকে... [3]
ঘ) মূল্যায়ন করো... [4]
```

Parser Bangla/English numerals, `।`/`.` separator, `উত্তর:`/`Ans:` সব handle করবে। Parse fail হলে সেই block red highlight হয়ে preview-তে যাবে যাতে user manually ঠিক করতে পারে।

---

## Method 3: 🤖 AI-Assisted Extract (best for messy sources)

সবচেয়ে flexible। User দিতে পারবে:
- **PDF আপলোড** (প্রশ্নপত্র/বই)
- **ছবি আপলোড** (multi-image, প্রতিটা একটা page)
- **Raw text paste** (যেকোনো format-এ)

Backend: Supabase Edge Function `bulk-extract-questions` — Lovable AI Gateway → `google/gemini-2.5-flash` (multimodal, cheap, Bangla-তে strong) দিয়ে structured output (zod schema) হিসেবে প্রশ্ন array বের করবে।

System prompt-এ Step 1-এর context (class/subject/chapter/type) inject করা হবে যাতে AI জানে কী extract করছে। MCQ হলে options + answer, CQ হলে ৪টা sub-question with marks — সব schema-enforced।

Output সরাসরি preview table-এ যাবে editable form-এ। AI hallucinate করলেও user review করে ঠিক করতে পারবে। Credit খরচের একটা warning tooltip থাকবে।

---

## Method 4: ➕ Manual Multi-add (existing single-form বড় করা)

Step 1-এর context লক করে একটার পর একটা প্রশ্ন যোগ করার form। "আরেকটা যোগ করুন" বাটনে ক্লিক করলে নতুন blank form নিচে জুড়বে, সবকটা preview list-এ collect হবে, শেষে একসাথে save।

এটা basically existing single-question form-কেই context lock করে repeat mode-এ চালানো — নতুন code minimum।

---

## Common: Preview → Validate → Insert (shared pipeline)

চারটা method-ই একই shape-এর array (`ParsedQuestion[]`) return করে shared preview component-এ পাঠাবে:

```typescript
type ParsedQuestion = {
  tempId: string;
  type: 'MCQ' | 'CQ' | 'SQ' | 'Descriptive';
  stimulus?: string;         // HTML with <img>, <table>, LaTeX
  question: string;          // HTML
  options?: string[];        // MCQ only
  correctAnswer?: string;    // MCQ only
  explanation?: string;
  subQuestions?: { label: 'ক'|'খ'|'গ'|'ঘ'; text: string; marks: number; answer?: string }[];
  answer?: string;           // SQ/Desc
  marks?: number;
  board?: string;
  year?: number;
  errors: string[];          // validation messages
};
```

Preview table-এ:
- প্রতিটা row inline-edit করা যাবে (Tiptap mini editor)
- Invalid rows red border, error tooltip
- Bulk actions: "সব invalid remove করো", "সব save করো"
- Insert-এর সময় Supabase-এ chunk করে (৫০টা করে) insert যাতে timeout না হয়, progress bar-এ real-time count
- React Query cache invalidation যাতে AdminQuestions list auto refresh হয়

---

## Technical Details

**Frontend:**
- `src/pages/admin/AdminQuestionsBulk.tsx` — main page with tabs
- `src/components/admin/bulk/ContextSelector.tsx` — Step 1
- `src/components/admin/bulk/ExcelUploader.tsx` — Method 1 + `xlsx` package
- `src/components/admin/bulk/StructuredPasteInput.tsx` — Method 2 + parser
- `src/components/admin/bulk/AIExtractor.tsx` — Method 3
- `src/components/admin/bulk/ManualMultiAdd.tsx` — Method 4
- `src/components/admin/bulk/PreviewTable.tsx` — shared Step 3
- `src/lib/bulkQuestionParser.ts` — Excel + text parsers, validators
- `src/lib/bulkQuestionTemplates.ts` — per-type template generators

**Backend:**
- Edge function `bulk-extract-questions` — AI extraction (Method 3 only)
- Existing `questions` table + RLS unchanged; bulk insert client-side via `supabase.from('questions').insert([...])` chunked

**Dependencies:**
- `xlsx` (SheetJS) — Excel read/write
- Existing Tiptap for inline preview edit

**Access:** এখন admin-only, পরে teacher-এর জন্য open করলে RLS `has_role` চেক এবং ownership scoping লাগবে।

---

## Rollout (recommended order)

1. **Phase 1** — Context Selector + Method 1 (Excel) + Preview + Insert pipeline → highest ROI, familiar to clients
2. **Phase 2** — Method 4 (Manual Multi-add) → smallest code change, immediate relief
3. **Phase 3** — Method 2 (Structured Paste parser)
4. **Phase 4** — Method 3 (AI Extract) → last কারণ AI credit খরচ হয় ও review overhead আছে

Phase 1 approve করলে সেটা দিয়েই শুরু করব, বাকিগুলা incrementally জুড়ব।
