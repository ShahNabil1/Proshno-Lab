import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { sortClasses } from "@/lib/classOrder";
import markup from "./ReferenceHome.html?raw";
import "./ReferenceHome.css";
export default function ReferenceHome(){
 const ref=useRef<HTMLDivElement>(null); const navigate=useNavigate();
 useEffect(()=>{
 const host=ref.current!; let alive=true;
 const onClick=(event: MouseEvent)=>{const el=event.target as HTMLElement;
 const faq=el.closest<HTMLButtonElement>('.faq-item button');
 if(faq){const item=faq.parentElement!;const open=!item.classList.contains('open');host.querySelectorAll('.faq-item').forEach(x=>{x.classList.remove('open');x.querySelector('button')?.setAttribute('aria-expanded','false')});item.classList.toggle('open',open);faq.setAttribute('aria-expanded',String(open));}
 const link=el.closest<HTMLAnchorElement>('a[href]');if(link?.getAttribute('href')?.startsWith('/')){event.preventDefault();navigate(link.getAttribute('href')!);}
 };
 host.addEventListener('click',onClick);
 host.querySelectorAll('.faq-item button').forEach(b=>b.setAttribute('aria-expanded','false'));
 supabase.from('classes').select('id,name').then(({data})=>{
 if(!alive)return;const grid=host.querySelector('#classGrid')!;
 const classes=sortClasses((data||[]).filter(c=>!/^class\s/i.test(c.name)));grid.replaceChildren();
 classes.forEach((c,i)=>{const card=document.createElement('a');card.className='home-class-card';card.href='/dashboard/create';card.style.setProperty('--class-delay',`${i*70}ms`);
 const number=document.createElement('span');number.className='home-class-number';number.textContent=String(i+1).replace(/\d/g,d=>String.fromCharCode(0x09e6+Number(d)));
 const title=document.createElement('strong');title.textContent=c.name;
 const arrow=document.createElement('span');arrow.className='home-class-arrow';arrow.textContent='\u2197';arrow.setAttribute('aria-hidden','true');card.append(number,title,arrow);grid.append(card)});
 });
 const sampleData = [
  ['মডেল প্রশ্ন','বাংলা ১ম পত্র','১. অনুচ্ছেদটি পড়ে প্রশ্নের উত্তর দাও।','ক. লেখকের মূল বক্তব্য কী?','খ. ব্যাখ্যা কর।'],
  ['গণিত','নবম শ্রেণি','১. সেট A ও B এর ছেদ নির্ণয় কর।','২. সমীকরণটির সমাধান কর।','৩. নিচের চিত্রের মান নির্ণয় কর।'],
  ['পদার্থবিজ্ঞান','দশম শ্রেণি','১. স্কেলার ও ভেক্টর রাশির পার্থক্য লিখ।','২. বলের SI একক কী?','৩. গ্রাফটি ব্যাখ্যা কর।'],
  ['জীববিজ্ঞান','দশম শ্রেণি','১. কোষ কী?','২. টিস্যুর কাজ লিখ।','৩. চিত্রসহ বর্ণনা কর।'],
  ['রসায়ন','নবম শ্রেণি','১. পরমাণুর গঠন ব্যাখ্যা কর।','২. পর্যায় সারণি কী?','৩. উদাহরণ দাও।']
];
let sampleOffset = 0;
const sampleTrack=host.querySelector<HTMLElement>('#sampleTrack')!;
function paperCard(d: string[],i: number){return `<article class="sample-paper"><h4>${d[0]}</h4><small>${d[1]} • পূর্ণমান ১০০</small><p><b>ক. বহুনির্বাচনী প্রশ্ন</b></p><p>${d[2]}</p><div class="mini-options"><span>○ ক. উত্তর</span><span>○ খ. উত্তর</span><span>○ গ. উত্তর</span><span>○ ঘ. উত্তর</span></div><div class="rule"></div><p><b>খ. সংক্ষিপ্ত প্রশ্ন</b></p><p>${d[3]}</p><p>${d[4]}</p>${i===2?'<div class="diagram"></div>':''}<div class="rule"></div><p>৪. নিচের প্রশ্নটির বিস্তারিত উত্তর লিখ।</p><p>.......................................................................</p><p>.......................................................................</p></article>`}
function renderSamples(){
  const ordered=[...sampleData.slice(sampleOffset),...sampleData.slice(0,sampleOffset)];
  sampleTrack.innerHTML=ordered.slice(0,4).map(paperCard).join('');
}
renderSamples();
host.querySelector<HTMLElement>('#nextSample')!.onclick=()=>{sampleOffset=(sampleOffset+1)%sampleData.length;renderSamples()};
host.querySelector<HTMLElement>('#prevSample')!.onclick=()=>{sampleOffset=(sampleOffset-1+sampleData.length)%sampleData.length;renderSamples()};
 const motionPreference=window.matchMedia('(prefers-reduced-motion: reduce)');
 const tiltTargets=Array.from(host.querySelectorAll<HTMLElement>('.highlight-card, .hero-visual'));
 const tilt=(event:PointerEvent)=>{if(motionPreference.matches||event.pointerType==='touch')return;const el=event.currentTarget as HTMLElement;const rect=el.getBoundingClientRect();const x=(event.clientX-rect.left)/rect.width-.5;const y=(event.clientY-rect.top)/rect.height-.5;el.style.setProperty('--tilt-x',`${-y*7}deg`);el.style.setProperty('--tilt-y',`${x*9}deg`);el.style.setProperty('--light-x',`${(x+.5)*100}%`);el.style.setProperty('--light-y',`${(y+.5)*100}%`);el.classList.add('is-tilting');};
 const resetTilt=(event:PointerEvent)=>{const el=event.currentTarget as HTMLElement;el.style.setProperty('--tilt-x','0deg');el.style.setProperty('--tilt-y','0deg');el.classList.remove('is-tilting');};
 tiltTargets.forEach(el=>{el.addEventListener('pointermove',tilt);el.addEventListener('pointerleave',resetTilt)});
 return()=>{alive=false;host.removeEventListener('click',onClick);tiltTargets.forEach(el=>{el.removeEventListener('pointermove',tilt);el.removeEventListener('pointerleave',resetTilt)})};
 },[navigate]);
 return <div className="plh" ref={ref} dangerouslySetInnerHTML={{__html:markup}}/>;
}
