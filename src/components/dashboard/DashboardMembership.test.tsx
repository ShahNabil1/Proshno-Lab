import {cleanup,render,renderHook,screen,waitFor,fireEvent} from "@testing-library/react";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import {MemoryRouter} from "react-router-dom";
import {afterEach,describe,it,expect,vi} from "vitest";
import {useDashboardMembership,MembershipBadge,FreeUpgradeCard} from "./DashboardMembership";
const stub=vi.hoisted(()=>({rows:[] as any[],error:null as any,unlimited:false,preview:false}));
vi.mock("@/hooks/useUnlimitedAccess",()=>({useUnlimitedAccess:()=>({unlimited:stub.unlimited,loading:false,noPackagePreview:stub.preview})}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{from:()=>({select:()=>({eq:()=>({eq:()=>Promise.resolve({data:stub.rows,error:stub.error})})})})}}));
const clients:QueryClient[]=[];
function wrapper({children}:{children:React.ReactNode}) {
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});clients.push(client);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
afterEach(()=>{cleanup();clients.forEach(c=>c.clear());clients.length=0;sessionStorage.clear();stub.rows=[];stub.error=null;stub.unlimited=false;stub.preview=false;});
describe("dashboard membership",()=>{
  it("waits for ownership before showing Free and recognizes a current package",async()=>{
    stub.rows=[{plan:"Math",status:"active",starts_at:null,ends_at:"2099-01-01T00:00:00Z"}];
    const {result}=renderHook(()=>useDashboardMembership("teacher"),{wrapper});
    expect(result.current).toBeNull();
    await waitFor(()=>expect(result.current?.premium).toBe(true));
    expect(result.current?.detail).toContain("Math");
  });
  it("does not label expired or queued subscriptions Premium",async()=>{
    stub.rows=[{plan:"Old",status:"active",starts_at:null,ends_at:"2020-01-01T00:00:00Z"},{plan:"Future",status:"active",starts_at:"2099-01-01T00:00:00Z",ends_at:null}];
    const {result}=renderHook(()=>useDashboardMembership("teacher"),{wrapper});
    await waitFor(()=>expect(result.current?.premium).toBe(false));
  });
  it("shows no upgrade prompt for Premium; Free can open pricing or dismiss the card",()=>{
    const premium={premium:true,detail:"Active Math"};
    const {rerender}=render(<MemoryRouter><MembershipBadge membership={premium}/><FreeUpgradeCard membership={premium} userId="teacher" pathname="/dashboard/create" /></MemoryRouter>);
    expect(screen.getByRole("link",{name:/Premium/})).toBeVisible();
    expect(screen.queryByRole("complementary",{name:"ফ্রি প্ল্যান আপগ্রেড"})).toBeNull();
    rerender(<MemoryRouter><FreeUpgradeCard membership={{premium:false,detail:"Free"}} userId="teacher" pathname="/dashboard/create" /></MemoryRouter>);
    expect(screen.getByRole("link",{name:/প্যাকেজ দেখুন/})).toHaveAttribute("href","/dashboard/subscription");
    fireEvent.click(screen.getByRole("button",{name:"আপগ্রেড কার্ড লুকান"}));
    expect(screen.queryByRole("complementary",{name:"ফ্রি প্ল্যান আপগ্রেড"})).toBeNull();
  });
});
