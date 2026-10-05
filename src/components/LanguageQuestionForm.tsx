import RichTextEditor from '@/components/RichTextEditor';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { questionTypeLabel } from '@/lib/languageQuestionTypes';

export default function LanguageQuestionForm({type, question, answer, stimulus, marks, onChange}: {
  type: string; question: string; answer: string; stimulus: string; marks: number;
  onChange: (field: 'question' | 'correct_answer' | 'stimulus' | 'marks', value: string | number) => void;
}) {
  const isPassage = ['seen_passage','seen_passage_1','seen_passage_2','unseen_passage'].includes(type);
  return <div className="space-y-4 border rounded-lg p-4">
    <p className="font-semibold">{questionTypeLabel(type)}</p>
    <p className="text-sm text-muted-foreground">একই প্যাসেজের উপপ্রশ্ন বা ফাঁকা স্থানগুলো একসঙ্গে লিখুন। শব্দের বক্স, Matching ও Substitution Table-এর জন্য টেবিল ব্যবহার করুন।</p>
    <div><Label>{isPassage ? 'শিরোনাম / নির্দেশনা (ঐচ্ছিক)' : 'প্যাসেজ / নির্দেশনা / শব্দের বক্স (ঐচ্ছিক)'}</Label><RichTextEditor value={stimulus} onChange={v=>onChange('stimulus',v)} placeholder="নির্দেশনা বা প্রয়োজনীয় তথ্য লিখুন..." minHeight="120px" /></div>
    <div><Label>{isPassage ? 'প্যাসেজের সম্পূর্ণ পাঠ' : 'সম্পূর্ণ প্রশ্ন / প্রশ্নসেট'}</Label><RichTextEditor value={question} onChange={v=>onChange('question',v)} placeholder={isPassage ? 'সম্পূর্ণ প্যাসেজ লিখুন...' : 'উপপ্রশ্নসহ সম্পূর্ণ প্রশ্নসেট লিখুন...'} minHeight="160px" /></div>
    <div><Label>উত্তর / নমুনা উত্তর (ঐচ্ছিক)</Label><RichTextEditor value={answer} onChange={v=>onChange('correct_answer',v)} placeholder="প্রতিটি উপপ্রশ্নের উত্তর বা নমুনা উত্তর লিখুন..." minHeight="120px" /></div>
    <div><Label htmlFor="language-marks">প্রশ্নসেটের মোট নম্বর (প্যাসেজ হলে ০)</Label><Input id="language-marks" type="number" min="0" step="0.5" value={marks} onChange={e=>onChange('marks',Math.max(0,Number(e.target.value)||0))} /></div>
  </div>;
}
