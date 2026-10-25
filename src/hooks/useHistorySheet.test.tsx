import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { expect, it } from "vitest";
import { useHistorySheet } from "./useHistorySheet";
function TestSheet() {
  const [open, setOpen] = useHistorySheet('settings');
  const location = useLocation();
  const navigate = useNavigate();
  return <><span>{location.pathname + location.search}</span><span>{open ? 'settings-open' : 'question-visible'}</span>
    <button onClick={() => setOpen(true)}>Open</button><button onClick={() => setOpen(false)}>Close</button>
    <button onClick={() => navigate(-1)}>Back</button></>;
}
it('device Back closes settings first and preserves the paper URL', () => {
  render(<MemoryRouter initialEntries={['/dashboard', '/dashboard/view-paper?paper_id=123']} initialIndex={1}><TestSheet /></MemoryRouter>);
  fireEvent.click(screen.getByText('Open'));
  expect(screen.getByText('settings-open')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Back'));
  expect(screen.getByText('question-visible')).toBeInTheDocument();
  expect(screen.getByText('/dashboard/view-paper?paper_id=123')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Open'));
  fireEvent.click(screen.getByText('Close'));
  fireEvent.click(screen.getByText('Back'));
  expect(screen.getByText('/dashboard')).toBeInTheDocument();
});
