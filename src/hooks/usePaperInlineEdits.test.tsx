import {useRef,useState,useCallback} from "react";
import {render,fireEvent,screen,waitFor,cleanup} from "@testing-library/react";
import {afterEach,describe,it,expect,vi} from "vitest";
import {usePaperInlineEdits} from "./usePaperInlineEdits";
import type {PaperInlineEdits} from "@/lib/paperInlineEdits";
afterEach(cleanup);
function Editor({initial={},save,source="Original"}:{initial?:PaperInlineEdits;save:(edits:PaperInlineEdits)=>void;source?:string}){
 const ref=useRef<HTMLDivElement>(null);const [active,setActive]=useState<HTMLElement|null>(null);const [edits,setEdits]=useState(initial);
 const update=useCallback((value:PaperInlineEdits)=>{setEdits(value);save(value);},[save]);
 usePaperInlineEdits(ref,active,edits,update,source);
 return <div ref={ref}><div data-editable="cq-5" data-testid="question" onClick={e=>setActive(e.currentTarget)}><span data-testid="text">{source}</span></div></div>;
}
describe("paper editor persistence",()=>{
 it("captures typing, restores after reopening, and saves a subsequent edit",async()=>{
  const save=vi.fn();const view=render(<Editor save={save}/>);fireEvent.click(screen.getByTestId("question"));
  screen.getByTestId("text").textContent="User edited question";fireEvent.input(screen.getByTestId("text"));
  await waitFor(()=>expect(save).toHaveBeenCalled());const snapshot=save.mock.calls.at(-1)![0];
  view.unmount();render(<Editor initial={snapshot} save={save}/>);
  expect(screen.getByTestId("text").textContent).toBe("User edited question");
  fireEvent.click(screen.getByTestId("question"));screen.getByTestId("text").textContent="Edited again";fireEvent.input(screen.getByTestId("text"));
  await waitFor(()=>expect(JSON.stringify(save.mock.calls.at(-1)![0])).toContain("Edited again"));
 });
 it("preserves saved edits when source hydration renders again",()=>{
  const initial={'{"anchor":"cq-5","index":0}':{html:'<span data-testid="text">Saved edit</span>',style:null}};
  const save=vi.fn();const view=render(<Editor initial={initial} save={save}/>);view.rerender(<Editor initial={initial} save={save} source="Hydrated source"/>);
  expect(screen.getByTestId("text").textContent).toBe("Saved edit");
 });
});
