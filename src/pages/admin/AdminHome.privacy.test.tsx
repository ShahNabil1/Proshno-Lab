import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OWNER_USER_ID, isBusinessOwner, isOwnerOnlyAdminPath } from '@/lib/ownerAccess';
const state = vi.hoisted(() => ({ user: { id: 'other-admin', email: 'admin@example.com' }, from: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock('@/components/admin/MarketingOverview', () => ({ default: () => <div>Private marketing report</div> }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: state.from } }));
import AdminHome from './AdminHome';
afterEach(cleanup);
function prepare(owner: boolean) {
  state.user = owner ? { id: OWNER_USER_ID, email: 'jmajharul@gmail.com' } : { id: 'other-admin', email: 'admin@example.com' };
  state.from.mockReset().mockImplementation(() => {
    const query = { select: () => query, eq: () => query, or: () => query, gte: () => query, then: Promise.resolve({ count: 5 }).then.bind(Promise.resolve({ count: 5 })) };
    return query;
  });
}
describe('Owner financial privacy', () => {
  it('requires both owner identity and email', () => {
    expect(isBusinessOwner({ id: 'other', email: 'jmajharul@gmail.com' })).toBe(false);
    expect(isBusinessOwner({ id: OWNER_USER_ID, email: 'other@example.com' })).toBe(false);
    expect(isBusinessOwner(null)).toBe(false);
    expect(isBusinessOwner({ id: OWNER_USER_ID, email: 'JMAJHARUL@gmail.com' })).toBe(true);
  });
  it('protects financial routes including nested paths', () => {
    expect(isOwnerOnlyAdminPath('/admin/subscriptions/123')).toBe(true);
    expect(isOwnerOnlyAdminPath('/admin/analytics')).toBe(true);
    expect(isOwnerOnlyAdminPath('/admin/questions')).toBe(false);
  });
  it('keeps academic stats without rendering or fetching financial data for admins', async () => {
    prepare(false); render(<AdminHome />);
    await waitFor(() => expect(screen.getAllByText('5').length).toBeGreaterThan(0));
    expect(screen.queryByText('Private marketing report')).toBeNull();
    expect(state.from.mock.calls.some(([table]) => ['bkash_payments', 'subscriptions'].includes(table))).toBe(false);
    expect(screen.queryByText('পারচেজ')).toBeNull();
  });
  it('retains the business dashboard for the owner', async () => {
    prepare(true); render(<AdminHome />);
    await waitFor(() => expect(screen.getAllByText('5').length).toBeGreaterThan(0));
    expect(screen.getByText('Private marketing report')).toBeTruthy();
    expect(screen.getByText('পারচেজ')).toBeTruthy();
    expect(state.from.mock.calls.some(([table]) => table === 'bkash_payments')).toBe(true);
  });
});
