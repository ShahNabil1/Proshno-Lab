import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import PrintableDocument from "./PrintableDocument";

it("moves the existing logo immediately without replacing paginated content", () => {
  const pages = ['<div><img data-paper-first-page-only style="position:absolute;left:10%;top:8%"><p>Question</p></div>'];
  const props = { pages, visible: true, widthMm: 210, heightMm: 297, showPageNumbers: false };
  const { container, rerender } = render(<PrintableDocument {...props} logoPosition={{ absolute: true, x: 10, y: 8, opacity: 100 }} />);
  const logo = container.querySelector('img')!;
  const question = container.querySelector('p');
  rerender(<PrintableDocument {...props} logoPosition={{ absolute: true, x: 70, y: 25, opacity: 50 }} />);
  expect(container.querySelector('img')).toBe(logo);
  expect(container.querySelector('p')).toBe(question);
  expect(logo.style.left).toBe('70%');
  expect(logo.style.top).toBe('25%');
  expect(logo.style.transform).toBe('translate(-50%, -25%)');
  expect(logo.style.opacity).toBe('0.5');
});

it("hides a removed logo immediately even while old paginated sheets remain", () => {
  const pages = ['<img data-paper-first-page-only src="old.png"><p>Question</p>'];
  const props = { pages, visible: true, widthMm: 210, heightMm: 297, showPageNumbers: false };
  const position = { absolute: true, x: 10, y: 20, opacity: 100 };
  const { container, rerender } = render(<PrintableDocument {...props} logoPosition={{ ...position, enabled: true, src: 'old.png' }} />);
  const logo = container.querySelector('img')!;
  rerender(<PrintableDocument {...props} logoPosition={{ ...position, enabled: false, src: '' }} />);
  expect(logo.style.display).toBe('none');
  rerender(<PrintableDocument {...props} logoPosition={{ ...position, enabled: true, src: 'new.png' }} />);
  expect(logo.style.display).toBe('');
  expect(logo.getAttribute('src')).toBe('new.png');
});
