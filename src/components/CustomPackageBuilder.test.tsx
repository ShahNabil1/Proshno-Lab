import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BuilderClass } from "@/lib/customPackages";
import CustomPackageBuilder from "./CustomPackageBuilder";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/customPackages", async importOriginal => ({ ...(await importOriginal<typeof import("@/lib/customPackages")>()), builderRpc: rpc }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/components/InlineCheckout", () => ({ default: () => <div data-testid="checkout">Checkout</div> }));
const subject = (id: number, name: string, groups: string[] = []) => ({ subject_id:id,class_id:11,name,price:449,individual_price:null,is_special:false,groups,is_active:true,sort_order:0 });
const config: BuilderClass = { class_id:11,version:"bangla",name:"SSC",class_level:"9-10",all_package_id:15,all_price:1499,normal_price:449,special_price:490,caps:{"2":849},groups:["Science","Business Studies"],is_active:true,sort_order:0,subjects:[subject(71,"Common"),subject(104,"Physics",["Science"]),subject(109,"Accounting",["Business Studies"])] };
const catalog: BuilderClass[] = [config,{...config,class_id:34,name:"Class 6",class_level:"6",groups:[],subjects:[subject(159,"Math")]},{...config,class_id:31,version:"english",name:"EV SSC",subjects:[subject(212,"EV Physics",["Science"])]}];

beforeEach(() => {
  rpc.mockReset();
  rpc.mockImplementation(async (name, args) => name === "custom_package_catalog" ? catalog : {
    ...args.selection,kind:"custom",class_name:"SSC",subject_name:"Selected",regular_total:898,price:849,savings:49,all_price:1499,all_package_id:15,upgrade_difference:650,owned_subject_ids:[],duration_days:365,
  });
});
afterEach(cleanup);
async function chooseScience() {
  render(<CustomPackageBuilder />);
  fireEvent.click(await screen.findByRole("button",{name:"শ্রেণি বেছে নিন"}));
  fireEvent.click(screen.getByRole("radio",{name:"SSC"}));
  choose("বিভাগ বেছে নিন","Science");
}
function choose(field:string, value:string) {
  fireEvent.click(screen.getByRole("button",{name:field}));
  fireEvent.click(screen.getByRole("radio",{name:value}));
}
function openSubjects() { fireEvent.click(screen.getByRole("button",{name:"বিষয় বেছে নিন"})); }
function closeSubjects() { fireEvent.click(screen.getByRole("button",{name:"সম্পন্ন"})); }

describe("Custom Package Builder", () => {
  it("keeps common subjects while removing incompatible subjects on a group change", async () => {
    await chooseScience();
    openSubjects();
    fireEvent.click(screen.getByRole("checkbox",{name:/Common/}));
    fireEvent.click(screen.getByRole("checkbox",{name:/Physics/}));
    closeSubjects();
    await screen.findByRole("button",{name:"এই প্যাকেজ নিন"});
    choose("বিভাগ বেছে নিন","Business Studies");
    openSubjects();
    expect(screen.getByRole("checkbox",{name:/Common/})).toBeChecked();
    expect(screen.queryByRole("checkbox",{name:/Physics/})).toBeNull();
    expect(screen.getByRole("checkbox",{name:/Accounting/})).not.toBeChecked();
    await waitFor(() => expect(rpc).toHaveBeenLastCalledWith("quote_custom_package",{selection:{version:"bangla",class_id:11,group:"Business Studies",subject_ids:[71]}}));
  });
  it("clears subjects and checkout on version changes", async () => {
    await chooseScience();
    openSubjects();
    fireEvent.click(screen.getByRole("checkbox",{name:/Physics/}));
    closeSubjects();
    fireEvent.click(await screen.findByRole("button",{name:"এই প্যাকেজ নিন"}));
    expect(screen.getByTestId("checkout")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Close"}));
    choose("ভার্সন বেছে নিন","English Version");
    expect(screen.queryByTestId("checkout")).toBeNull();
    expect(screen.queryByRole("checkbox",{name:/Physics/})).toBeNull();
    choose("শ্রেণি বেছে নিন","EV SSC");
    choose("বিভাগ বেছে নিন","Science");
    openSubjects();
    expect(screen.getByRole("checkbox",{name:/EV Physics/})).not.toBeChecked();
  });
  it("clears the group and selected subjects on class changes", async () => {
    await chooseScience();
    openSubjects();
    fireEvent.click(screen.getByRole("checkbox",{name:/Physics/}));
    closeSubjects();
    choose("শ্রেণি বেছে নিন","Class 6");
    openSubjects();
    expect(screen.queryByRole("button",{name:"Science"})).toBeNull();
    expect(screen.getByRole("checkbox",{name:/Math/})).not.toBeChecked();
    expect(screen.queryByRole("button",{name:"এই প্যাকেজ নিন"})).toBeNull();
  });
  it("shows a safe fallback when the catalog cannot load", async () => {
    rpc.mockRejectedValue(new Error("offline"));
    render(<CustomPackageBuilder />);
    expect(await screen.findByText(/কাস্টম প্যাকেজ এখনো চালু হয়নি/)).toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"এই প্যাকেজ নিন"})).toBeNull();
  });
});
