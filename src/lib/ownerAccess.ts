// UI gating only. Database policies and RPCs enforce the same boundary.
export const OWNER_USER_ID = "b39b767f-be7a-4087-8d92-b9eabf273070";
export function isBusinessOwner(user: { id: string; email?: string } | null | undefined) {
  return user?.id === OWNER_USER_ID && user.email?.toLowerCase() === "jmajharul@gmail.com";
}

export function isOwnerOnlyAdminPath(path: string) {
  return ["/admin/analytics", "/admin/subscriptions"].some(root => path === root || path.startsWith(root + "/"));
}
