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
 const motionPreference=window.matchMedia('(prefers-reduced-motion: reduce)');
 const tiltTargets=Array.from(host.querySelectorAll<HTMLElement>('.highlight-card, .hero-visual'));
 const tilt=(event:PointerEvent)=>{if(motionPreference.matches||event.pointerType==='touch')return;const el=event.currentTarget as HTMLElement;const rect=el.getBoundingClientRect();const x=(event.clientX-rect.left)/rect.width-.5;const y=(event.clientY-rect.top)/rect.height-.5;el.style.setProperty('--tilt-x',`${-y*7}deg`);el.style.setProperty('--tilt-y',`${x*9}deg`);el.style.setProperty('--light-x',`${(x+.5)*100}%`);el.style.setProperty('--light-y',`${(y+.5)*100}%`);el.classList.add('is-tilting');};
 const resetTilt=(event:PointerEvent)=>{const el=event.currentTarget as HTMLElement;el.style.setProperty('--tilt-x','0deg');el.style.setProperty('--tilt-y','0deg');el.classList.remove('is-tilting');};
 tiltTargets.forEach(el=>{el.addEventListener('pointermove',tilt);el.addEventListener('pointerleave',resetTilt)});
 return()=>{alive=false;host.removeEventListener('click',onClick);tiltTargets.forEach(el=>{el.removeEventListener('pointermove',tilt);el.removeEventListener('pointerleave',resetTilt)})};
 },[navigate]);
 return <div className="plh" ref={ref} dangerouslySetInnerHTML={{__html:markup}}/>;
}
