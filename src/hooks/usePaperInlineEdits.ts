import {useCallback,useEffect,useLayoutEffect,useRef,type RefObject} from "react";
import {capturePaperInlineEdit,restorePaperInlineEdits,type PaperInlineEdits} from "@/lib/paperInlineEdits";
export function usePaperInlineEdits(paperRef:RefObject<HTMLElement>,active:HTMLElement|null,edits:PaperInlineEdits,onChange:(edits:PaperInlineEdits)=>void,renderKey:unknown){
  const latest=useRef(edits);latest.current=edits;
  const capture=useCallback(()=>{
    const paper=paperRef.current;if(!paper||!active)return latest.current;
    const next=capturePaperInlineEdit(paper,active,latest.current);
    if(next!==latest.current){latest.current=next;onChange(next);}
    return next;
  },[paperRef,active,onChange]);
  useLayoutEffect(()=>{if(paperRef.current)restorePaperInlineEdits(paperRef.current,edits);},[paperRef,edits,renderKey]);
  useEffect(()=>{
    const paper=paperRef.current;if(!paper||!active)return;
    const observer=new MutationObserver(records=>{
      if(records.some(r=>active.contains(r.target)))capture();
    });
    observer.observe(active,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:["style","class"]});
    paper.addEventListener("input",capture,true);
    return ()=>{capture();observer.disconnect();paper.removeEventListener("input",capture,true);};
  },[paperRef,active,capture]);
  return capture;
}
