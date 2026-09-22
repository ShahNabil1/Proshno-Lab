import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";
import SmartBoard from "./SmartBoard";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, session: null, loading: false, signInWithGoogle: vi.fn(), signOut: vi.fn() }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
        }),
      }),
    }),
    rpc: () => Promise.resolve({ data: null }),
  },
}));

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as any).ResizeObserver = ResizeObserverStub;
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <SmartBoard />
    </MemoryRouter>,
  );

describe("SmartBoard page", () => {
  it("mounts with the board shell and an empty whiteboard", () => {
    renderPage();

    expect(screen.getByText(/ইন্টারেক্টিভ স্মার্টবোর্ড/)).toBeInTheDocument();
    expect(screen.getByText("স্মার্টবোর্ড প্রস্তুত")).toBeInTheDocument();
    expect(screen.getByText("উত্তর দেখান")).toBeInTheDocument();
    // The question list stays hidden so the board owns the screen.
    expect(screen.queryByText("Questions (০)")).not.toBeInTheDocument();
  });

  it("reveals the question list from the header toggle", () => {
    renderPage();

    fireEvent.click(screen.getByTitle("প্রশ্ন তালিকা দেখান"));

    expect(screen.getByText("Questions (০)")).toBeInTheDocument();
    expect(screen.getByTitle("প্রশ্ন তালিকা লুকান")).toBeInTheDocument();
  });

  it("switches the active tool", () => {
    renderPage();

    const eraserButton = screen.getByTitle("ইরেজার (E)");
    fireEvent.click(eraserButton);

    expect(eraserButton.className).toContain("bg-primary");
  });

  it("toggles answer visibility", () => {
    renderPage();

    fireEvent.click(screen.getByText("উত্তর দেখান"));

    expect(screen.getByText("উত্তর লুকান")).toBeInTheDocument();
  });

  it("opens the load-paper dialog", () => {
    renderPage();

    fireEvent.click(screen.getAllByText("প্রশ্নপত্র লোড করুন")[0]);

    expect(screen.getByText("এই সেশনের প্রশ্নপত্র")).toBeInTheDocument();
  });
});
