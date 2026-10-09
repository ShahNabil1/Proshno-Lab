import { expect, it } from "vitest";
import { wrappableMathRows, wrappableMathParts } from "./wrappableMathRows";

it("exposes aligned equations as rows without breaking fractions", () => {
  expect(wrappableMathRows(String.raw`\begin{aligned}x&=\frac{1}{y}\\[2pt]&=z+1\end{aligned}`))
    .toEqual([String.raw`x=\frac{1}{y}`, "=z+1"]);
});
it("preserves nested matrices and ordinary math", () => {
  expect(wrappableMathRows(String.raw`\begin{aligned}A&=\begin{matrix}1&2\end{matrix}\end{aligned}`)).toBeNull();
  expect(wrappableMathRows("x=1")).toBeNull();
});
it("wraps only between terms and preserves fractions, powers and delimiters", () => {
  expect(wrappableMathParts(String.raw`x^{-2}+\frac{a+b}{c}=\left(x+y\right)^2`))
    .toEqual([String.raw`x^{-2}`, String.raw`+\frac{a+b}{c}`, String.raw`=\left(x+y\right)^2`]);
  expect(wrappableMathRows(String.raw`x=1\\y=2`)).toEqual(["x=1", "y=2"]);
});

it("wraps imported single-column arrays while preserving actual tables", () => {
  expect(wrappableMathRows(String.raw`\begin{array}{l}=x+1\\=\frac{a+b}{c}\end{array}`))
    .toEqual(["=x+1", String.raw`=\frac{a+b}{c}`]);
  expect(wrappableMathRows(String.raw`\begin{array}{cc}a&b\\c&d\end{array}`)).toBeNull();
});
