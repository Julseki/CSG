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
    session.profile?.role ??
    session.departmentSession?.role ??
    session.departmentSession?.user?.role ??
    "";
  return String(rawRole).toLowerCase().trim();
}

export function getGovernorScopeFromRole(role) {
  const normalized = String(role || "").toLowerCase().trim();
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

