import { useMemo, useState } from "react";
import { GripHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import katex from "katex";
import "katex/dist/katex.min.css";

type AngleMode = "DEG" | "RAD" | "GRAD";

const factorial = (value: number): number => {
  if (!Number.isInteger(value) || value < 0 || value > 170) return Number.NaN;
  let result = 1;
  for (let n = 2; n <= value; n += 1) result *= n;
  return result;
};
const combination = (n: number, r: number) => factorial(n) / (factorial(r) * factorial(n - r));
const permutation = (n: number, r: number) => factorial(n) / factorial(n - r);

const expressionToLatex = (source: string): string => {
  let latex = source || "0";
  const missingClosers = Math.max(0, (latex.match(/\(/g) || []).length - (latex.match(/\)/g) || []).length);
  latex += ")".repeat(missingClosers);
  // Resolve the calculator's parenthesized roots from the inside out.
  for (let pass = 0; pass < 6; pass += 1) {
    const next = latex.replace(/³√\(([^()]*)\)/g, "\\sqrt[3]{$1}").replace(/√\(([^()]*)\)/g, "\\sqrt{$1}");
    if (next === latex) break;
    latex = next;
  }
  latex = latex
    .replace(/(\d+(?:\.\d+)?|\\sqrt(?:\[3\])?\{[^{}]*\}|\([^()]+\))\/(\d+(?:\.\d+)?|\\sqrt(?:\[3\])?\{[^{}]*\}|\([^()]+\))/g, "\\frac{$1}{$2}")
    .replace(/\^\(([^()]*)\)/g, "^{$1}").replace(/\^([\-\d.]+)/g, "^{$1}")
    .replace(/×/g, "\\times ").replace(/÷/g, "\\div ").replace(/−/g, "-")
    .replace(/π/g, "\\pi ").replace(/\b(sin|cos|tan|log|ln)\b/g, "\\$1")
    .replace(/\b(asin|acos|atan)\b/g, (_, name: string) => `\\${name.slice(1)}^{-1}`)
    .replace(/\b(sinh|cosh|tanh)\b/g, "\\operatorname{$1}")
    .replace(/\s+nCr\s+/g, "\\operatorname{C}").replace(/\s+nPr\s+/g, "\\operatorname{P}");
  return latex;
};

interface Props {
  onClose: () => void;
  onDragStart: (event: React.PointerEvent<HTMLDivElement>) => void;
}

export default function ScientificCalculator({ onClose, onDragStart }: Props) {
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState("0");
  const [answer, setAnswer] = useState(0);
  const [memory, setMemory] = useState(0);
  const [shift, setShift] = useState(false);
  const [hyp, setHyp] = useState(false);
  const [mode, setMode] = useState<AngleMode>("DEG");

  const angleIn = (value: number) => mode === "DEG" ? value * Math.PI / 180 : mode === "GRAD" ? value * Math.PI / 200 : value;
  const angleOut = (value: number) => mode === "DEG" ? value * 180 / Math.PI : mode === "GRAD" ? value * 200 / Math.PI : value;
  const evaluate = (source = expression): number => {
    let js = source
      .replace(/Ans/g, `(${answer})`).replace(/π/g, "PI").replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/\^/g, "**")
      .replace(/√\(/g, "sqrt(").replace(/³√\(/g, "cbrt(").replace(/log\(/g, "log10(").replace(/ln\(/g, "log(")
      .replace(/(\d+(?:\.\d+)?)\s*nCr\s*(\d+(?:\.\d+)?)/g, "nCr($1,$2)")
      .replace(/(\d+(?:\.\d+)?)\s*nPr\s*(\d+(?:\.\d+)?)/g, "nPr($1,$2)");
    if (!/^[0-9+\-*/().,\s*A-Za-z_]+$/.test(js)) throw new Error("Syntax");
    return Function("sin", "cos", "tan", "asin", "acos", "atan", "sinh", "cosh", "tanh", "sqrt", "cbrt", "log10", "log", "fact", "nCr", "nPr", "PI", `"use strict";return (${js})`)(
      (x: number) => Math.sin(angleIn(x)), (x: number) => Math.cos(angleIn(x)), (x: number) => Math.tan(angleIn(x)),
      (x: number) => angleOut(Math.asin(x)), (x: number) => angleOut(Math.acos(x)), (x: number) => angleOut(Math.atan(x)),
      Math.sinh, Math.cosh, Math.tanh, Math.sqrt, Math.cbrt, Math.log10, Math.log, factorial, combination, permutation, Math.PI,
    );
  };
  const solve = () => {
    try {
      const value = evaluate();
      if (!Number.isFinite(value)) throw new Error("Math");
      setAnswer(value); setResult(String(Number(value.toPrecision(12)))); setShift(false);
    } catch (error) { setResult(error instanceof Error && error.message === "Math" ? "Math ERROR" : "Syntax ERROR"); }
  };
  const insert = (value: string) => { setExpression((current) => current + value); setShift(false); };
  const functionKey = (normal: string, shifted: string, hyperbolic?: string) => insert(`${hyp && hyperbolic ? hyperbolic : shift ? shifted : normal}(`);
  const keyClass = "h-9 rounded-[5px] border border-black/70 bg-gradient-to-b from-[#706e68] to-[#3f3d39] text-sm font-bold text-white shadow-[0_2px_1px_#171614] active:translate-y-px active:shadow-none";
  const smallKey = "h-8 rounded-full border border-black/70 bg-gradient-to-b from-[#77746e] to-[#44413d] text-[10px] font-semibold text-white shadow-sm";
  const expressionHtml = useMemo(() => katex.renderToString(expressionToLatex(expression), { throwOnError: false, displayMode: false }), [expression]);

  return (
    <div className="rounded-[22px] border-[3px] border-[#292824] bg-gradient-to-r from-[#56534d] via-[#45423d] to-[#5e5a53] p-3 text-white shadow-[inset_3px_0_3px_#88847b,inset_-3px_0_3px_#262521,0_12px_24px_#0008]">
      <div className="mb-2 flex cursor-move touch-none items-center justify-between select-none" onPointerDown={onDragStart} title="ধরে ক্যালকুলেটর সরান">
        <span className="flex items-center gap-1 text-[10px] text-slate-200"><GripHorizontal className="h-4 w-4" />MOVE</span>
        <button type="button" className="rounded-full bg-black/30 p-1 hover:bg-black/50" onPointerDown={(e) => e.stopPropagation()} onClick={onClose} aria-label="ক্যালকুলেটর বন্ধ করুন"><X className="h-4 w-4" /></button>
      </div>
      <div className="mb-2 flex justify-end px-2">
        <div className="h-10 w-36 rounded-md border-[3px] border-[#302d29] bg-gradient-to-b from-[#271613] to-[#43221e] shadow-inner" />
      </div>
      <div className="my-3 min-h-[142px] rounded-md border-[5px] border-[#565650] bg-[#d8f1f2] px-4 py-3 font-mono text-[#071315] shadow-[inset_0_2px_5px_#55706f]">
        <div className="flex h-5 justify-between text-[11px] font-bold"><span>{shift ? "SHIFT " : ""}{hyp ? "HYP " : ""}{memory ? "M " : ""}{mode}</span><span>▲</span></div>
        <div className="flex min-h-[58px] items-center justify-end overflow-x-auto text-right text-[23px]" dangerouslySetInnerHTML={{ __html: expressionHtml }} />
        <div className="h-10 truncate text-right text-[30px] font-black tracking-wider">{result}</div>
      </div>
      <div className="mb-2 grid grid-cols-5 gap-2 px-1">
        <button className={cn(smallKey, shift && "text-yellow-300 ring-2 ring-yellow-400")} onClick={() => setShift((v) => !v)}>SHIFT</button>
        <button className={smallKey} onClick={() => insert("Ans")}>ALPHA</button>
        <div className="col-span-1 flex items-center justify-center"><span className="h-8 w-8 rounded-full border-4 border-[#77736c] bg-[#393733] shadow-inner" /></div>
        <button className={smallKey} onClick={() => setMode((m) => m === "DEG" ? "RAD" : m === "RAD" ? "GRAD" : "DEG")}>MODE</button>
        <button className={smallKey} onClick={() => { setExpression(""); setResult("0"); }}>ON</button>
      </div>
      <div className="grid grid-cols-5 gap-2">
        <button className={keyClass} onClick={() => insert("fact(")}>x!</button><button className={keyClass} onClick={() => insert(shift ? " nPr " : " nCr ")}>{shift ? "nPr" : "nCr"}</button><button className={keyClass} onClick={() => insert("1/(")}>x⁻¹</button><button className={keyClass} onClick={() => insert("³√(")}>³√</button><button className={keyClass} onClick={() => insert("^3")}>x³</button>
        <button className={keyClass} onClick={() => insert("/")}>a b/c</button><button className={keyClass} onClick={() => insert("√(")}>√</button><button className={keyClass} onClick={() => insert("^2")}>x²</button><button className={keyClass} onClick={() => insert("^")}>xʸ</button><button className={keyClass} onClick={() => insert(shift ? "ln(" : "log(")}>{shift ? "ln" : "log"}</button>
        <button className={keyClass} onClick={() => setResult(String(-Number(result)))}>(−)</button><button className={cn(keyClass, hyp && "text-yellow-300")} onClick={() => setHyp((v) => !v)}>hyp</button><button className={keyClass} onClick={() => functionKey("sin", "asin", "sinh")}>{shift ? "sin⁻¹" : "sin"}</button><button className={keyClass} onClick={() => functionKey("cos", "acos", "cosh")}>{shift ? "cos⁻¹" : "cos"}</button><button className={keyClass} onClick={() => functionKey("tan", "atan", "tanh")}>{shift ? "tan⁻¹" : "tan"}</button>
        <button className={keyClass} onClick={() => { setMemory(answer); setExpression((v) => v + String(memory)); }}>RCL</button><button className={keyClass} onClick={() => setExpression((v) => v + "E")}>ENG</button><button className={keyClass} onClick={() => insert("(")}>(</button><button className={keyClass} onClick={() => insert(")} ")}>)</button><button className={keyClass} onClick={() => setMemory((m) => m + answer)}>M+</button>
        {["7","8","9"].map(k => <button key={k} className={keyClass} onClick={() => insert(k)}>{k}</button>)}<button className={cn(keyClass,"text-rose-300")} onClick={() => setExpression((v) => v.slice(0,-1))}>DEL</button><button className={cn(keyClass,"text-rose-300")} onClick={() => {setExpression("");setResult("0");}}>AC</button>
        {["4","5","6"].map(k => <button key={k} className={keyClass} onClick={() => insert(k)}>{k}</button>)}<button className={keyClass} onClick={() => insert("×")}>×</button><button className={keyClass} onClick={() => insert("÷")}>÷</button>
        {["1","2","3"].map(k => <button key={k} className={keyClass} onClick={() => insert(k)}>{k}</button>)}<button className={keyClass} onClick={() => insert("+")}>＋</button><button className={keyClass} onClick={() => insert("−")}>−</button>
        <button className={keyClass} onClick={() => insert("0")}>0</button><button className={keyClass} onClick={() => insert(".")}>.</button><button className={keyClass} onClick={() => insert("×10^")}>×10ˣ</button><button className={keyClass} onClick={() => insert("Ans")}>Ans</button><button className={cn(keyClass,"bg-gradient-to-b from-[#77746e] to-[#242321]")} onClick={solve}>=</button>
      </div>
    </div>
  );
}
