/**
 * Department governor roles (scoped to their college). Must match API/session values.
 * Also: csg_president, admin — see helpers below.
 */
export const GOVERNOR_ROLES = [
  "it_governor",
  "cba_governor",
  "ceas_governor",
  "coc_governor",
  "chm_governor",
];

export function getRoleFromSession(session) {
  if (!session || typeof session !== "object") return "";
  const rawRole =
    session.role ??
    session.user?.role ??
    session.data?.role ??
    session.data?.user?.role ??
    session.user?.data?.role ??
    session.profile?.role ??
    session.me?.role ??
    session.claims?.role ??
    session.departmentSession?.role ??
    session.departmentSession?.user?.role ??
    "";
  return String(rawRole).toLowerCase().trim();
}

/** Normalize for comparisons: spaces/underscores/hyphens collapsed. */
export function normalizeRoleKey(role) {
  return String(role ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");
}

/**
 * CSG President — API may send csg_president, "CSG President", CSGPresident, etc.
 */
export function isCsgPresident(role) {
  const n = normalizeRoleKey(role);
  if (!n) return false;
  if (n === "csg_president" || n === "president_csg") return true;
  const compact = n.replace(/_/g, "");
  if (compact === "csgpresident") return true;
  return false;
}

/** System administrator — full access; not a department governor. */
export function isAdminRole(role) {
  return normalizeRoleKey(role) === "admin";
}

/**
 * True when the role should load all departments’ events / attendance (same as server-wide admin view).
 * Department governors (it/cba/ceas/coc/chm_governor) are false here.
 */
export function seesInstitutionWideEventData(role) {
  return isCsgPresident(role) || isAdminRole(role);
}

export function isDepartmentGovernorRole(role) {
  const n = normalizeRoleKey(role);
  return GOVERNOR_ROLES.includes(n);
}

/** Sidebar / reports badge and welcome fallback when session has no email */
export function getDashboardRoleLabel(isGovernor, governorScope, role) {
  if (isGovernor && governorScope?.label) return governorScope.label;
  if (isCsgPresident(role)) return "CSG President";
  return "Admin";
}

/** Create User is restricted to admins only (not department governors, not CSG president). */
export function canOpenCreateUser(isGovernor, role) {
  return isAdminRole(role) && !isGovernor;
}

export function getGovernorScopeFromRole(role) {
  const normalized = normalizeRoleKey(role);
  switch (normalized) {
    case "it_governor":
      return { label: "Governor IT", courses: ["BSIT"] };
    case "cba_governor":
      return { label: "Governor CBA", courses: ["BSBA"] };
    case "ceas_governor":
      return { label: "Governor CEAS", courses: ["BEED", "BSED"] };
    case "coc_governor":
      return { label: "Governor COC", courses: ["BSCrim"] };
    case "chm_governor":
      return { label: "Governor CHM", courses: ["BSHM"] };
    default:
      return null;
  }
}

