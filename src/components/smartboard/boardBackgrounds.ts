import type { CSSProperties } from "react";

export interface BoardBackground {
  id: string;
  label: string;
  /** True when the surface is dark, so the toolbar can suggest chalk ink. */
  dark: boolean;
  style: CSSProperties;
}

const lineGrid = (size: number, color: string): CSSProperties => ({
  backgroundColor: "#ffffff",
  backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`,
  backgroundSize: `${size}px ${size}px`,
});

export const BOARD_BACKGROUNDS: BoardBackground[] = [
  { id: "white", label: "সাদা বোর্ড", dark: false, style: { backgroundColor: "#ffffff" } },

  { id: "grid", label: "গ্রিড", dark: false, style: lineGrid(30, "#e2e8f0") },

  {
    id: "dots",
    label: "ডট",
    dark: false,
    style: {
      backgroundColor: "#ffffff",
      backgroundImage: "radial-gradient(circle, #94a3b8 1.4px, transparent 1.4px)",
      backgroundSize: "28px 28px",
    },
  },

  {
    id: "graph",
    label: "গ্রাফ",
    dark: false,
    style: {
      backgroundColor: "#ffffff",
      backgroundImage:
        "linear-gradient(#eef2f7 1px, transparent 1px), linear-gradient(90deg, #eef2f7 1px, transparent 1px), linear-gradient(#cbd5e1 1px, transparent 1px), linear-gradient(90deg, #cbd5e1 1px, transparent 1px)",
      backgroundSize: "20px 20px, 20px 20px, 100px 100px, 100px 100px",
    },
  },

  {
    id: "coordinate",
    label: "কো-অর্ডিনেট",
    dark: false,
    style: {
      backgroundColor: "#ffffff",
      backgroundImage:
        "linear-gradient(#cbd5e1 1.5px, transparent 1.5px), linear-gradient(90deg, #cbd5e1 1.5px, transparent 1.5px), linear-gradient(#e2e8f0 0.8px, transparent 0.8px), linear-gradient(90deg, #e2e8f0 0.8px, transparent 0.8px)",
      backgroundSize: "100px 100px, 100px 100px, 25px 25px, 25px 25px",
    },
  },

  {
    id: "notebook",
    label: "নোটবুক",
    dark: false,
    style: {
      backgroundColor: "#fffdf7",
      backgroundImage:
        "linear-gradient(90deg, transparent 84px, #f2a6a6 84px, #f2a6a6 86px, transparent 86px), repeating-linear-gradient(#dfe7f1 0 1px, transparent 1px 38px)",
    },
  },

  {
    id: "handwriting",
    label: "হাতের লেখা",
    dark: false,
    style: {
      backgroundColor: "#fffef9",
      backgroundImage: "repeating-linear-gradient(#dbe3ee 0 1px, transparent 1px 44px), repeating-linear-gradient(transparent 0 21px, #eef2f8 21px 22px, transparent 22px 44px)",
    },
  },

  {
    id: "exam",
    label: "পরীক্ষা",
    dark: false,
    style: { backgroundColor: "#fffef7" },
  },

  {
    id: "isometric",
    label: "আইসোমেট্রিক",
    dark: false,
    style: {
      backgroundColor: "#ffffff",
      backgroundImage:
        "linear-gradient(30deg, #e8eef6 1px, transparent 1px), linear-gradient(150deg, #e8eef6 1px, transparent 1px), linear-gradient(90deg, #dfe7f1 1px, transparent 1px)",
      backgroundSize: "44px 26px, 44px 26px, 44px 26px",
    },
  },

  {
    id: "circuit",
    label: "সার্কিট",
    dark: false,
    style: {
      backgroundColor: "#f8fafc",
      backgroundImage:
        "radial-gradient(circle, #cbd5e1 2px, transparent 2px), linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)",
      backgroundSize: "40px 40px, 40px 40px, 40px 40px",
    },
  },

  {
    id: "biology",
    label: "বায়োলজি",
    dark: false,
    style: {
      backgroundColor: "#f8fffa",
      backgroundImage: "radial-gradient(circle, #bbf7d0 1.6px, transparent 1.6px)",
      backgroundSize: "34px 34px",
    },
  },

  {
    id: "chemistry",
    label: "কেমিস্ট্রি",
    dark: false,
    style: {
      backgroundColor: "#fbfdff",
      backgroundImage:
        "radial-gradient(circle, #bfdbfe 1.6px, transparent 1.6px), radial-gradient(circle, #dbeafe 1.2px, transparent 1.2px)",
      backgroundSize: "40px 40px, 20px 20px",
      backgroundPosition: "0 0, 10px 10px",
    },
  },

  {
    id: "physics",
    label: "ফিজিক্স",
    dark: false,
    style: lineGrid(34, "#e6edf6"),
  },

  {
    id: "omr",
    label: "ওএমআর",
    dark: false,
    style: {
      backgroundColor: "#ffffff",
      backgroundImage:
        "radial-gradient(circle, #cbd5e1 7px, transparent 7px), radial-gradient(circle, #f1f5f9 9px, transparent 9px)",
      backgroundSize: "52px 52px, 52px 52px",
      backgroundPosition: "0 0, 0 0",
    },
  },

  {
    id: "chalkboard",
    label: "চকবোর্ড",
    dark: true,
    style: { backgroundColor: "#203a2e" },
  },

  {
    id: "dark",
    label: "ডার্ক",
    dark: true,
    style: { backgroundColor: "#0f172a" },
  },

  {
    id: "presentation",
    label: "প্রেজেন্টেশন",
    dark: false,
    style: { backgroundColor: "#ffffff", backgroundImage: "linear-gradient(135deg, #ffffff, #f1f5f9)" },
  },

  {
    id: "presentation-dark",
    label: "প্রেজেন্টেশন ডার্ক",
    dark: true,
    style: { backgroundColor: "#0f172a", backgroundImage: "linear-gradient(135deg, #0f172a, #1e293b)" },
  },
];

export const DEFAULT_BACKGROUND_ID = "white";

export function getBackground(id: string): BoardBackground {
  return BOARD_BACKGROUNDS.find((bg) => bg.id === id) ?? BOARD_BACKGROUNDS[0];
}
