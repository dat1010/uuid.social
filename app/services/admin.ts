export const bootstrapAdminUsername = "tannerd";
export const adminUserPageSize = 50;
export const adminRecordPageSize = 25;

export function isBootstrapAdmin(username: string) {
  return username === bootstrapAdminUsername;
}

export function canManageAdmin(actorUsername: string, targetUsername: string) {
  return actorUsername !== targetUsername && !isBootstrapAdmin(targetUsername);
}

export function parseAdminPage(value: string | null) {
  return Math.max(1, Number.parseInt(value ?? "1", 10) || 1);
}
