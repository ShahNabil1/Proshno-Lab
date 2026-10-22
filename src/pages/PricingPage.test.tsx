import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import PricingPage from "./PricingPage";
vi.mock("@/components/CustomPackageBuilder",()=>({default:()=> <div>Custom builder</div>}));
vi.mock("@/components/packages/PackageCheckoutDialog",()=>({default:()=>null}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{from:()=>({select:()=>({eq:()=>({order:()=>Promise.resolve({data:[],error:null})})})})}}));
afterEach(cleanup);
it("opens with the price list and a small custom package button",async()=>{
 render(<MemoryRouter><PricingPage/></MemoryRouter>);
 expect(screen.getByRole("heading",{name:/শিক্ষক\/টিউটর প্যাকেজ/})).toBeVisible();
 expect(screen.queryByText("Custom builder")).toBeNull();
 expect(screen.getAllByRole("table")).toHaveLength(5);
 fireEvent.click(screen.getByRole("button",{name:/নিজের ইচ্ছে মতো প্যাকেজ বানান/}));
 expect(screen.getByText("Custom builder")).toBeVisible();
 fireEvent.click(screen.getByRole("button",{name:"মূল্য তালিকা"}));
 expect(screen.getAllByRole("table")).toHaveLength(5);
});
