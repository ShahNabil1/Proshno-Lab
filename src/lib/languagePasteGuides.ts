// Original practice examples following the class 8 reference structures.
import { ENGLISH_FIRST_VARIANTS } from './englishFirstTemplates';
export type LanguagePasteVariant = { id: string; label: string; desc: string; sample: string };
export const languagePasteVariants = (type:string, englishFirst=false) => (englishFirst ? ENGLISH_FIRST_VARIANTS[type] : undefined) || LANGUAGE_PASTE_VARIANTS[type] || ENGLISH_FIRST_VARIANTS[type];
export const withPasteReferences = (sample: string) => `${sample}\nব্যাখ্যা: প্রয়োজন হলে উত্তরের ব্যাখ্যা লিখুন।\nবোর্ড: ঢাকা-২০২৩, যশোর-২০২২\nস্কুল: উদাহরণ উচ্চ বিদ্যালয়-২০২৪`;
export const LANGUAGE_PASTE_RULES = [
  "একটি সম্পূর্ণ প্রশ্নসেট ও তার উত্তর একসঙ্গে দিন। পরের প্রশ্নসেটের আগে আলাদা লাইনে --- দিন; শুধু নম্বর বা ফাঁকা লাইন দিয়ে সেট ভাগ হবে না।",
  "প্রশ্ন: দিয়ে প্রশ্ন শুরু করুন এবং উত্তর: দিয়ে উত্তর শুরু করুন। (a)–(j), নম্বরযুক্ত বাক্য ও ফাঁকা লাইন একই সেটের অংশ থাকবে।",
  "শব্দের বক্স/টেবিল কপি করলে কলামের মাঝের Tab রাখুন, অথবা নমুনার মতো | দিয়ে কলাম আলাদা করুন। HTML টেবিলও দেওয়া যাবে।",
  "উত্তরের (a), (b) লাইন, পুরো Narration, Letter ও Composition হুবহু লিখুন। Preview-তে প্রশ্ন ও উত্তর মিলিয়ে তারপর সেভ করুন।",
  "ব্যাখ্যা: ... দিয়ে একাধিক লাইনের ব্যাখ্যা লিখুন। বোর্ড: ঢাকা-২০২৩ এবং স্কুল: উদাহরণ উচ্চ বিদ্যালয়-২০২৪ দিন। কমা দিয়ে একাধিক রেফারেন্স দেওয়া যাবে; সবগুলো ঐচ্ছিক।",
  "নম্বর আলাদা ঘরে দিন। নমুনার বোর্ড/স্কুল রেফারেন্স নিজের তথ্য দিয়ে বদলান অথবা লাইনগুলো মুছে ফেলুন।",
];
const v = (id: string, label: string, desc: string, sample: string): LanguagePasteVariant => ({id,label,desc,sample});
export const LANGUAGE_PASTE_VARIANTS: Record<string, LanguagePasteVariant[]> = {
  gap_filling: [
    v('with-clues','With clues','শব্দের বক্স এবং (a)–(j) ফাঁকসহ পুরো passage দিন; উত্তরে প্রতিটি ফাঁকের শব্দ দিন। নিচেরটি ছোট অনুশীলন নমুনা।',`প্রশ্ন: Fill in the gaps with words from the box.
| school | learn | friends | helpful | daily |

We go to (a) _____ every day. We (b) _____ new things there. Our (c) _____ study with us. Our teachers are (d) _____. We practise English (e) _____.
উত্তর:
(a) school
(b) learn
(c) friends
(d) helpful
(e) daily`),
    v('without-clues','Without clues','শব্দের বক্স লাগবে না। সম্পূর্ণ passage ও প্রতিটি ফাঁকের উত্তর লিখুন।',`প্রশ্ন: Fill in the gaps without clues.
A library is (a) _____ useful place. Students go (b) _____ the library to read books. Reading helps (c) _____ learn new things.
উত্তর:
(a) a
(b) to
(c) us`),
  ],
  substitution_table: [v('table','Substitution table','তিন কলামের সম্পূর্ণ টেবিল দিন। উত্তর হিসেবে তৈরি করা বাক্যগুলো লিখুন। কলাম | অথবা Tab দিয়ে আলাদা করুন।',`প্রশ্ন: Make five sentences using the substitution table.
| A student | should | attentive in class. |
| Teachers | are | help students. |
| We | must | respect our teachers. |
| Education | is | important for everyone. |
| They | can | learn every day. |
উত্তর:
(a) A student should learn every day.
(b) Teachers can help students.
(c) We must respect our teachers.
(d) Education is important for everyone.
(e) They are attentive in class.`)],
  right_forms_of_verbs: [v('verbs','Right form of verbs','Verb box ও ফাঁকসহ passage একসঙ্গে দিন। উত্তরে verb-এর সঠিক রূপ লিখুন।',`প্রশ্ন: Complete the passage with the right forms of the verbs.
| be | go | read | help | play |
Rina (a) _____ a student. She (b) _____ to school every day. She (c) _____ a book now. Yesterday she (d) _____ her mother. Her friends (e) _____ in the field now.
উত্তর:
(a) is
(b) goes
(c) is reading
(d) helped
(e) are playing`)],
  narration: [v('passage','Passage Narration','কথোপকথনের উদ্ধৃতিচিহ্নসহ সম্পূর্ণ passage এবং direct/indirect পরিবর্তনের নির্দেশনা দিন। উত্তর পুরো paragraph হবে।',`প্রশ্ন: Change the following passage into indirect speech.
The teacher said to Rafi, "Are you ready?" Rafi said, "Yes, I am ready." The teacher said, "Open your book."
উত্তর: The teacher asked Rafi if he was ready. Rafi replied in the affirmative and said that he was ready. The teacher told him to open his book.`)],
  changing_sentences: [v('sentences','Changing sentences','(a)–(e) বাক্য ও প্রতিটির পরিবর্তনের নির্দেশনা একই প্রশ্নসেটে রাখুন; উত্তরেও একই লেবেল রাখুন।',`প্রশ্ন: Change the sentences as directed.
(a) Rina is a good student. (Negative)
(b) He reads a book. (Passive)
(c) The letter was written by Mina. (Active)
(d) The flower is very beautiful. (Exclamatory)
(e) We should respect our elders. (Interrogative)
উত্তর:
(a) Rina is not a bad student.
(b) A book is read by him.
(c) Mina wrote the letter.
(d) How beautiful the flower is!
(e) Should we not respect our elders?`)],
  punctuation: [v('punctuation','Punctuation and Capitalization','প্রশ্নের ভুল capitalization ও punctuation সংশোধন করবেন না। সংশোধিত passage শুধু উত্তর অংশে লিখুন।',`প্রশ্ন: Use capitals and punctuation marks where necessary.
where are you going asked rina i am going to school replied mina
উত্তর: "Where are you going?" asked Rina. "I am going to school," replied Mina.`)],
  letter_application: [
    v('formal','Formal letter/application','পরিস্থিতি, প্রাপক ও কী বিষয়ে লিখতে হবে দিন। উত্তর অংশে তারিখ, বিষয়, সম্বোধনসহ পূর্ণ application দিন।',`প্রশ্ন: Suppose you are Rafi, a student of Class VIII. Write an application to your headteacher for a seat in the school hostel.
উত্তর:
2 October 2026
The Headteacher
Green School
Subject: Application for a seat in the school hostel.
Sir,
I am a student of Class VIII. My home is far from school. I request you to grant me a seat in the school hostel.
Yours obediently,
Rafi
Class VIII`),
    v('email','Formal e-mail','প্রশ্নে প্রাপক ও উদ্দেশ্য দিন। উত্তরে To, Subject ও সম্পূর্ণ email রাখুন।',`প্রশ্ন: Write an e-mail to the railway clerk requesting a seat reservation.
উত্তর:
To: clerk@example.com
Subject: Request for a seat reservation
Dear Sir or Madam,
Please reserve one seat on the morning train next Friday. Please let me know the fare and payment process.
Yours faithfully,
Rafi`),
    v('informal','Informal letter/e-mail','বন্ধু বা আত্মীয়কে লেখার পরিস্থিতি এবং পূর্ণ উত্তর দিন। উত্তরের ফাঁকা লাইন একই সেটের মধ্যে থাকবে।',`প্রশ্ন: Write a letter to your friend about your preparation for the examination.
উত্তর:
Dear Mina,
I hope you are well. I am preparing for my examination. I revise my lessons every day and practise English regularly.

Please write to me about your preparation.
Yours,
Rina`),
  ],
  short_composition: [v('composition','Short Composition','রেফারেন্সে শুধু শিরোনামও আছে। শিরোনাম/নির্দেশনা এবং উত্তর হিসেবে পুরো রচনা দিন। একাধিক paragraph নতুন প্রশ্ন হবে না।',`প্রশ্ন: Write a short composition on "Physical Exercise".
উত্তর:
Physical exercise means moving our body to keep it healthy. Walking, running and swimming are common forms of exercise.

Regular exercise keeps us fit and refreshes our mind. Students should exercise regularly and choose activities suitable for their health.`)],
};
