export type PaperInlineEdits = Record<string, { html: string; style: string | null }>;
type Address = {anchor?:string; index?:number; path?:number[]};
const stable = (el:HTMLElement) => Boolean(el.dataset.editable && el.dataset.editable !== "paper-field");
function editRoot(paper:HTMLElement,target:HTMLElement) {
  let root=target;
  for(let el:HTMLElement|null=target;el&&el!==paper;el=el.parentElement) if(stable(el))root=el;
  return root;
}
function address(paper:HTMLElement,el:HTMLElement):Address {
  if(stable(el))return {anchor:el.dataset.editable,index:Array.from(paper.querySelectorAll<HTMLElement>("[data-editable]")).filter(x=>x.dataset.editable===el.dataset.editable).indexOf(el)};
  const path:number[]=[];
  for(let node:HTMLElement|null=el;node&&node!==paper;node=node.parentElement){if(!node.parentElement)break;path.unshift(Array.from(node.parentElement.children).indexOf(node));}
  return {path};
}
function locate(paper:HTMLElement,a:Address):HTMLElement|null {
  if(a.anchor)return Array.from(paper.querySelectorAll<HTMLElement>("[data-editable]")).filter(x=>x.dataset.editable===a.anchor)[a.index||0]||null;
  let node:Element=paper;
  for(const index of a.path||[]){if(!node.children[index])return null;node=node.children[index];}
  return node instanceof HTMLElement&&node!==paper?node:null;
}
/** Strip active content while retaining rich text, tables, KaTeX/MathML and images. */
export function safePaperEditHtml(html:string):string {
  const template=document.createElement("template");template.innerHTML=html;
  template.content.querySelectorAll("script,iframe,object,embed,link,meta,style,base,form,input,button,textarea,select").forEach(el=>el.remove());
  template.content.querySelectorAll("*").forEach(el=>{
    for(const attr of Array.from(el.attributes)){
      if(/^on/i.test(attr.name)||["srcdoc","contenteditable","autofocus"].includes(attr.name)||
        (["href","src","xlink:href"].includes(attr.name)&&/^\s*(?:javascript|vbscript|data:text\/html):/i.test(attr.value))||
        (attr.name==="style"&&/expression\s*\(|javascript\s*:/i.test(attr.value)))el.removeAttribute(attr.name);
    }
    if(el.getAttribute("data-editable")==="paper-field")el.removeAttribute("data-editable");
  });
  return template.innerHTML;
}
export function capturePaperInlineEdit(paper:HTMLElement,target:HTMLElement,previous:PaperInlineEdits):PaperInlineEdits {
  if(!paper.contains(target)||target===paper)return previous;
  const root=editRoot(paper,target),key=JSON.stringify(address(paper,root));
  const edit={html:safePaperEditHtml(root.innerHTML),style:root.getAttribute("style")};
  if(previous[key]?.html===edit.html&&previous[key]?.style===edit.style)return previous;
  return {...previous,[key]:edit};
}
export function restorePaperInlineEdits(paper:HTMLElement,edits:PaperInlineEdits){
  for(const [key,edit] of Object.entries(edits||{})){
    try{
      const target=locate(paper,JSON.parse(key));if(!target||typeof edit.html!=="string")continue;
      const html=safePaperEditHtml(edit.html);
      if(safePaperEditHtml(target.innerHTML)!==html)target.innerHTML=html;
      if(edit.style!==null && !/expression\s*\(|javascript\s*:/i.test(edit.style))target.setAttribute("style",edit.style);
    }catch{/* Ignore corrupt or no-longer-present optional fields. */}
  }
}
