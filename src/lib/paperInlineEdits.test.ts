import {describe,it,expect} from "vitest";
import {capturePaperInlineEdit,restorePaperInlineEdits,safePaperEditHtml} from "./paperInlineEdits";
const paper=(html:string)=>{const el=document.createElement("div");el.innerHTML=html;return el;};
describe("saved paper inline edits",()=>{
 it("reopens a rich edited question after a fresh source render",()=>{
  const html='<div data-editable="cq-42"><span>Original</span><img src="diagram.webp"><table><tbody><tr><td>Data</td></tr></tbody></table></div>';
  const edited=paper(html);const target=edited.querySelector("span")!;
  target.innerHTML='<b>Edited question</b>';
  const saved=JSON.parse(JSON.stringify(capturePaperInlineEdit(edited,target,{})));
  const reopened=paper(html);restorePaperInlineEdits(reopened,saved);
  expect(reopened.querySelector("b")?.textContent).toBe("Edited question");
  expect(reopened.querySelector("img")?.getAttribute("src")).toBe("diagram.webp");
  expect(reopened.querySelector("td")?.textContent).toBe("Data");
  expect(paper(html).textContent).toContain("Original");
 });
 it("keeps edits associated with question IDs after reordering",()=>{
  const source=paper('<div data-editable="mcq-1">One</div><div data-editable="mcq-2">Two</div>');
  const q=source.children[1] as HTMLElement;q.innerHTML="Edited Two";
  const saved=capturePaperInlineEdit(source,q,{});
  const reordered=paper('<div data-editable="mcq-2">Two</div><div data-editable="mcq-1">One</div>');
  restorePaperInlineEdits(reordered,saved);expect(reordered.children[0].textContent).toBe("Edited Two");expect(reordered.children[1].textContent).toBe("One");
 });
 it("persists header text and formatting and supports further edits",()=>{
  const source=paper('<h1 data-editable="institute">School</h1>');const header=source.children[0] as HTMLElement;
  header.innerHTML="New School";header.style.color="red";
  const edits=capturePaperInlineEdit(source,header,{});const next=paper('<h1 data-editable="institute">School</h1>');restorePaperInlineEdits(next,edits);
  expect((next.children[0] as HTMLElement).style.color).toBe("red");next.children[0].textContent="Third School";
  restorePaperInlineEdits(next,capturePaperInlineEdit(next,next.children[0] as HTMLElement,edits));expect(next.textContent).toBe("Third School");
 });
 it("retains formulas but removes executable markup and editable state",()=>{
  const html=safePaperEditHtml('<script>alert(1)</script><img src="diagram.webp" onerror="bad()"><a href="javascript:bad()">x</a><span contenteditable="true" data-editable="paper-field"><math><mi>x</mi></math></span>');
  expect(html).not.toMatch(/script|onerror|javascript|contenteditable|paper-field/);
  expect(html).toContain("<math>");expect(html).toContain("diagram.webp");
 });
 it("ignores stale or malformed edits without replacing other questions",()=>{
  const source=paper('<p data-editable="short-2">Unchanged</p>');restorePaperInlineEdits(source,{'invalid':{html:"Bad",style:null},'{"anchor":"short-1"}':{html:"Deleted",style:null}});
  expect(source.textContent).toBe("Unchanged");
 });
});
