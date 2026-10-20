import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Subscription from "./Subscription";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/contexts/AuthContext",()=>{
  const user={id:"test-teacher"};
  return {useAuth:()=>({user})};
});
vi.mock("@/components/CustomPackageBuilder",()=>({default:()=> <div>Custom builder</div>}));
vi.mock("@/components/InlineCheckout",()=>({default:()=> <div>Checkout form</div>}));
vi.mock("@/lib/adminExperiencePreview",()=>({isNoPackagePreview:()=>false}));
const packages=[
  {id:1,type:"class",class_name:"ষষ্ঠ শ্রেণি",subject_name:"সকল বিষয়",price:999,is_coming_soon:false},
  {id:2,type:"class",class_name:"ষষ্ঠ শ্রেণি",subject_name:"গণিত",price:249,is_coming_soon:false},
  {id:3,type:"class",class_name:"ষষ্ঠ শ্রেণি",subject_name:"বিজ্ঞান",price:249,is_coming_soon:false},
  {id:4,type:"class",class_name:"Class 8 (Eglish Version)",subject_name:"সকল বিষয়",price:999,is_coming_soon:false},
  {id:5,type:"bundle",class_name:"ষষ্ঠ - দশম",subject_name:"সকল বিষয়",price:3499,is_coming_soon:false},
];
vi.mock("@/integrations/supabase/client",()=>({supabase:{from:(name:string)=>({select:()=>({eq:()=>({order:()=>Promise.resolve({data:name==="subscriptions"?[]:packages,error:null})})})})}}));
afterEach(cleanup);
function choose(field:string,value:string) {
  fireEvent.click(screen.getByRole("button",{name:field}));
  fireEvent.click(screen.getByRole("radio",{name:value}));
}
async function fixed() {
  render(<MemoryRouter><Subscription /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("tab",{name:"রেডিমেড প্যাকেজ"}));
}
describe("compact subscription workspace",()=>{
  it("shows one workspace at a time instead of all package sections",async()=>{
    render(<MemoryRouter><Subscription /></MemoryRouter>);
    expect(await screen.findByRole("tabpanel",{name:"প্যাকেজ ও মূল্য"})).toBeVisible();
    expect(screen.getByRole("heading",{name:"১। শিক্ষক/টিউটর প্যাকেজ"})).toBeVisible();
    expect(screen.queryByRole("tabpanel",{name:"রেডিমেড প্যাকেজ"})).toBeNull();
    fireEvent.click(screen.getByRole("tab",{name:"আমার প্ল্যান"}));
    expect(screen.getByRole("tabpanel",{name:"আমার প্ল্যান"})).toBeVisible();
    expect(screen.queryByRole("tabpanel",{name:"নিজের প্যাকেজ"})).toBeNull();
  });
  it("removes individual selections when All Subjects is selected",async()=>{
    await fixed();choose("প্যাকেজের শ্রেণি বেছে নিন","ষষ্ঠ শ্রেণি");
    fireEvent.click(screen.getByRole("checkbox",{name:"ষষ্ঠ শ্রেণি — গণিত"}));
    expect(screen.getByRole("checkbox",{name:"ষষ্ঠ শ্রেণি — গণিত"})).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox",{name:"ষষ্ঠ শ্রেণি — সকল বিষয়"}));
    expect(screen.getByRole("checkbox",{name:"ষষ্ঠ শ্রেণি — গণিত"})).not.toBeChecked();
    expect(screen.getByRole("checkbox",{name:"ষষ্ঠ শ্রেণি — গণিত"})).toBeDisabled();
    fireEvent.click(screen.getByRole("button",{name:"চেকআউট করুন"}));
    expect(screen.getByRole("dialog",{name:"প্যাকেজ চেকআউট"})).toBeVisible();
  });
  it("filters fixed package classes by version",async()=>{
    await fixed();choose("প্যাকেজের ভার্সন বেছে নিন","English Version");
    fireEvent.click(screen.getByRole("button",{name:"প্যাকেজের শ্রেণি বেছে নিন"}));
    expect(screen.queryByRole("radio",{name:"ষষ্ঠ শ্রেণি"})).toBeNull();
    fireEvent.click(screen.getByRole("radio",{name:"Class 8 (Eglish Version)"}));
    expect(screen.getByRole("checkbox",{name:"Class 8 (Eglish Version) — সকল বিষয়"})).toBeVisible();
  });
  it("retains bundle purchases through the same checkout dialog",async()=>{
    await fixed();choose("প্যাকেজের ধরন বেছে নিন","বান্ডেল প্যাকেজ");
    fireEvent.click(screen.getByRole("checkbox",{name:"ষষ্ঠ - দশম — সকল বিষয়"}));
    fireEvent.click(screen.getByRole("button",{name:"চেকআউট করুন"}));
    expect(screen.getByRole("dialog",{name:"প্যাকেজ চেকআউট"})).toBeVisible();
  });
  it("replaces covered class selections when a bundle is selected",async()=>{
    await fixed();choose("প্যাকেজের শ্রেণি বেছে নিন","ষষ্ঠ শ্রেণি");
    fireEvent.click(screen.getByRole("checkbox",{name:"ষষ্ঠ শ্রেণি — সকল বিষয়"}));
    choose("প্যাকেজের ধরন বেছে নিন","বান্ডেল প্যাকেজ");
    fireEvent.click(screen.getByRole("checkbox",{name:"ষষ্ঠ - দশম — সকল বিষয়"}));
    expect(screen.queryByRole("button",{name:"ষষ্ঠ শ্রেণি — সকল বিষয় সরান"})).toBeNull();
    expect(screen.getByRole("button",{name:"ষষ্ঠ - দশম — সকল বিষয় সরান"})).toBeVisible();
  });
});
