/**
 * Line icons for governor/admin sidebar nav — distinct shapes per section.
 */
const common = {
  className: "h-5 w-5 shrink-0",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

function IconDashboard(props) {
  return (
    <svg {...common} {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function IconAttendance(props) {
  return (
    <svg {...common} {...props}>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function IconEvents(props) {
  return (
    <svg {...common} {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 11h18" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <circle cx="8" cy="16" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="12" cy="16" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="16" cy="16" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconDepartment(props) {
  return (
    <svg {...common} {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

/** Single-student silhouette — used for Attendance → Students filter view (distinct from Department). */
function IconStudents(props) {
  return (
    <svg {...common} {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20v-1a7 7 0 0 1 14 0v1" />
    </svg>
  );
}

function IconAnalytics(props) {
  return (
    <svg {...common} {...props}>
      <path d="M4 20V8 M10 20V5 M16 20V12 M22 20V3" />
    </svg>
  );
}

const MAP = {
  dashboard: IconDashboard,
  attendance: IconAttendance,
  attendance2: IconAnalytics,
  events: IconEvents,
  students: IconDepartment,
  attendance_students: IconStudents,
};

export default function SidebarNavIcon({ navId }) {
  const Cmp = MAP[navId] ?? IconDashboard;
  return <Cmp />;
}
