import { useEffect, useMemo, useRef, useState } from "react";
import { Chart as ChartJS } from "chart.js/auto";
import { Line } from "react-chartjs-2";
import SidebarNavIcon from "./SidebarNavIcon";
import { useGovernorScope } from "../hooks/useGovernorScope";
import { canOpenCreateUser, getDashboardRoleLabel } from "../utils/roles";
import { formatEventDateForDisplay } from "../hooks/useGetEvents";
import PaginationBar from "./PaginationBar";

void ChartJS;

function addDaysYmd(baseYmd, daysToAdd) {
  const d = new Date(`${baseYmd}T00:00:00`);
  d.setDate(d.getDate() + daysToAdd);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildMockEvents(seed, count, baseYmd) {
  const names = [
    "Foundation Day Assembly",
    "Leadership Forum",
    "Department Meeting",
    "Campus Clean-up",
    "NSTP Assembly",
    "General Orientation",
    "Student Congress",
    "Unity Walk",
    "College Program Briefing",
    "Skills Workshop",
  ];

  return Array.from({ length: count }, (_, i) => {
    const idx = i + 1;
    const sessionKind = idx % 7 === 0 ? "am" : idx % 5 === 0 ? "pm" : "whole";
    const lateAm = (idx + seed) % 4 === 0;
    const absentPm = (idx + seed) % 6 === 0;
    const fine = sessionKind === "pm" ? (absentPm ? 50 : 0) : lateAm ? 25 : 0;
    const amIn = sessionKind === "pm" ? null : lateAm ? "8:18 AM" : "8:03 AM";
    const amOut = sessionKind === "pm" ? null : "11:45 AM";
    const pmIn = sessionKind === "am" ? null : absentPm ? "No record" : "1:06 PM";
    const pmOut = sessionKind === "am" ? null : absentPm ? "No record" : "4:58 PM";
    return {
      id: `E-${seed}${String(idx).padStart(2, "0")}`,
      name: `${names[i % names.length]} ${idx}`,
      date: addDaysYmd(baseYmd, i),
      sessionKind,
      amIn,
      amOut,
      pmIn,
      pmOut,
      fine,
    };
  });
}

const MOCK_STUDENT_PAYMENTS = [
  {
    studentId: "2023-0012",
    studentName: "Marasigan, Alex",
    course: "BSIT",
    year: "2nd Year",
    paidAmount: 200,
    waivedAmount: 0,
    events: buildMockEvents(11, 30, "2026-04-01"),
  },
  {
    studentId: "2022-0191",
    studentName: "Aguilar, Diane",
    course: "BSED",
    year: "3rd Year",
    paidAmount: 240,
    waivedAmount: 0,
    events: buildMockEvents(22, 30, "2026-04-02"),
  },
  {
    studentId: "2021-0334",
    studentName: "Uy, Kenneth",
    course: "BSBA",
    year: "4th Year",
    paidAmount: 0,
    waivedAmount: 100,
    events: buildMockEvents(33, 30, "2026-04-03"),
  },
  {
    studentId: "2024-0023",
    studentName: "Bautista, Kara",
    course: "BSHM",
    year: "1st Year",
    paidAmount: 0,
    waivedAmount: 160,
    events: buildMockEvents(44, 30, "2026-04-04"),
  },
  ...Array.from({ length: 30 }, (_, i) => {
    const idx = i + 1;
    const seed = 100 + idx;
    const courses = ["BSIT", "BSED", "BSBA", "BSHM", "BSCrim", "BEED"];
    const years = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
    const totalFine = buildMockEvents(seed, 30, "2026-04-05").reduce((sum, ev) => sum + ev.fine, 0);
    const paidAmount = idx % 5 === 0 ? 0 : Math.min(totalFine, (idx % 7) * 75);
    const waivedAmount = idx % 6 === 0 ? Math.min(totalFine - paidAmount, 100) : 0;
    return {
      studentId: `2026-${String(1000 + idx)}`,
      studentName: `Mock Student ${idx}`,
      course: courses[idx % courses.length],
      year: years[idx % years.length],
      paidAmount,
      waivedAmount,
      events: buildMockEvents(seed, 30, "2026-04-05"),
    };
  }),
];

function formatPhp(n) {
  const v = Math.max(0, Number(n) || 0);
  return `₱${v.toLocaleString("en-PH")}`;
}

function badgeClass(status) {
  if (status === "Paid") return "bg-[#07713c]/10 text-[#07713c]";
  if (status === "Waived") return "bg-gray-200 text-gray-700";
  if (status === "Partial") return "bg-orange-100 text-orange-800";
  return "bg-red-100 text-red-800";
}

function hasRecordedTime(value) {
  const v = String(value ?? "").trim().toLowerCase();
  return v !== "" && v !== "no record";
}

function getPaymentAttendanceTier(row) {
  if (!row || !Array.isArray(row.events) || row.events.length === 0) {
    return { key: "inactive", label: "Inactive", emoji: "🔴", range: "<70%", rate: 0 };
  }
  const attendedCount = row.events.reduce((count, event) => {
    const kind = String(event?.sessionKind ?? "whole").toLowerCase();
    // Attendance-based status: treat an event as attended when any expected slot was recorded.
    if (kind === "am") {
      return count + (hasRecordedTime(event?.amIn) || hasRecordedTime(event?.amOut) ? 1 : 0);
    }
    if (kind === "pm") {
      return count + (hasRecordedTime(event?.pmIn) || hasRecordedTime(event?.pmOut) ? 1 : 0);
    }
    const attendedWholeDay =
      hasRecordedTime(event?.amIn) ||
      hasRecordedTime(event?.amOut) ||
      hasRecordedTime(event?.pmIn) ||
      hasRecordedTime(event?.pmOut);
    return count + (attendedWholeDay ? 1 : 0);
  }, 0);
  const rate = Math.round((attendedCount / row.events.length) * 100);
  if (rate >= 90) return { key: "active", label: "Active", emoji: "🟢", range: "90–100%", rate };
  if (rate >= 70) return { key: "moderate", label: "Moderate", emoji: "🟡", range: "70–89%", rate };
  return { key: "inactive", label: "Inactive", emoji: "🔴", range: "<70%", rate };
}

function ModalTimeSlot({ value }) {
  const v = String(value ?? "").trim();
  if (!v || v.toLowerCase() === "no record") {
    return <span className="text-amber-700">No record</span>;
  }
  return <span className="font-mono text-xs text-[#07713c]">{v}</span>;
}

function ModalPeriodSlot({ event, period, value }) {
  const kind = String(event?.sessionKind ?? "whole").toLowerCase();
  const isNotApplicable = (kind === "am" && period === "pm") || (kind === "pm" && period === "am");
  if (isNotApplicable) return <span className="text-[#07713c]/60">—</span>;
  return <ModalTimeSlot value={value} />;
}

function sessionLabel(kindRaw) {
  const kind = String(kindRaw ?? "whole").toLowerCase();
  if (kind === "am") return "AM Session";
  if (kind === "pm") return "PM Session";
  return "Whole day";
}

function parseMoneyInput(raw) {
  const cleaned = String(raw ?? "").replace(/,/g, "").trim();
  if (!cleaned) return Number.NaN;
  return Number(cleaned);
}

function makeReceiptNumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `RCP-${y}${m}${d}-${h}${min}${s}`;
}

function buildReceiptHtml(receipt, logoUrl) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Receipt ${receipt.receiptNo}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 0; color: #16331f; }
      .page { max-width: 760px; margin: 24px auto; border: 1px solid #d1d5db; border-radius: 12px; overflow: hidden; }
      .header { background: #07713C; color: #fff; padding: 16px 20px; display: flex; gap: 12px; align-items: center; }
      .logo { width: 52px; height: 52px; border-radius: 9999px; background: rgba(255,255,255,0.15); object-fit: contain; }
      .title { font-weight: 700; font-size: 18px; margin: 0; }
      .subtitle { margin: 2px 0 0 0; font-size: 12px; opacity: 0.95; }
      .content { padding: 18px 20px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; font-size: 14px; }
      .label { color: #4b5563; }
      .value { font-weight: 600; }
      .summary { margin-top: 18px; border-top: 1px solid #e5e7eb; padding-top: 12px; }
      .row { display: flex; justify-content: space-between; margin: 6px 0; font-size: 14px; }
      .total { font-size: 18px; font-weight: 700; color: #07713C; }
      .foot { margin-top: 20px; font-size: 12px; color: #6b7280; }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="header">
        <img class="logo" src="${logoUrl}" alt="Normi logo" />
        <div>
          <p class="title">Payment Receipt</p>
          <p class="subtitle">Northern Mindanao Colleges, Inc.</p>
        </div>
      </div>
      <div class="content">
        <div class="grid">
          <div><span class="label">Receipt No:</span> <span class="value">${receipt.receiptNo}</span></div>
          <div><span class="label">Date:</span> <span class="value">${new Date(receipt.createdAt).toLocaleString()}</span></div>
          <div><span class="label">Student ID:</span> <span class="value">${receipt.studentId}</span></div>
          <div><span class="label">Student Name:</span> <span class="value">${receipt.studentName}</span></div>
          <div><span class="label">Course / Year:</span> <span class="value">${receipt.course} · ${receipt.year}</span></div>
          <div><span class="label">Encoded By:</span> <span class="value">${receipt.encodedBy}</span></div>
        </div>
        <div class="summary">
          <div class="row"><span>Previous Balance</span><strong>${formatPhp(receipt.previousBalance)}</strong></div>
          <div class="row"><span>Amount Paid</span><strong>${formatPhp(receipt.amountPaid)}</strong></div>
          <div class="row"><span>New Balance</span><strong>${formatPhp(receipt.newBalance)}</strong></div>
          <div class="row total"><span>Total Received</span><span>${formatPhp(receipt.amountPaid)}</span></div>
        </div>
        ${receipt.note ? `<div class="foot"><strong>Note:</strong> ${receipt.note}</div>` : ""}
      </div>
    </div>
  </body>
</html>`;
}

export default function Payments({ onNavigate, onOpenCreateUser, isCreateUserOpen }) {
  const { role, isGovernor, governorScope } = useGovernorScope();
  const roleLabel = getDashboardRoleLabel(isGovernor, governorScope, role);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [studentsPage, setStudentsPage] = useState(1);
  const [studentsPageSize, setStudentsPageSize] = useState(10);
  const [paymentRowsState, setPaymentRowsState] = useState(() =>
    MOCK_STUDENT_PAYMENTS.map((row) => ({
      ...row,
      events: row.events.map((event) => ({ ...event })),
    })),
  );
  const [selectedStudentId, setSelectedStudentId] = useState(MOCK_STUDENT_PAYMENTS[0]?.studentId ?? "");
  const [modalStudentId, setModalStudentId] = useState("");
  const [selectedEventRowId, setSelectedEventRowId] = useState("");
  const [modalSessionFilter, setModalSessionFilter] = useState("all");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isPaymentEditMode, setIsPaymentEditMode] = useState(false);
  const [paymentAmountInput, setPaymentAmountInput] = useState("");
  const [remainingBalanceInput, setRemainingBalanceInput] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [editingFine, setEditingFine] = useState(null);
  const [editFineAmountInput, setEditFineAmountInput] = useState("");
  const [editFineError, setEditFineError] = useState("");
  const [lastReceipt, setLastReceipt] = useState(null);
  const [isGraphModalOpen, setIsGraphModalOpen] = useState(false);
  const [hoverCard, setHoverCard] = useState(null);
  const hideTimerRef = useRef(null);
  const showTimerRef = useRef(null);
  const isHoveringCardRef = useRef(false);

  const cancelHide = () => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const cancelShow = () => {
    if (showTimerRef.current) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  };

  const scheduleShow = (studentId, x, y) => {
    cancelShow();
    const id = window.setTimeout(() => {
      setHoverCard({ studentId, x, y });
      showTimerRef.current = null;
    }, 1000);
    showTimerRef.current = id;
  };

  const scheduleHide = () => {
    cancelShow();
    cancelHide();
    const id = window.setTimeout(() => {
      if (isHoveringCardRef.current) return;
      setHoverCard(null);
      hideTimerRef.current = null;
    }, 260);
    hideTimerRef.current = id;
  };

  useEffect(() => {
    return () => {
      if (showTimerRef.current) window.clearTimeout(showTimerRef.current);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, []);

  const studentRows = useMemo(() => {
    return paymentRowsState.map((student) => {
      const totalFine = student.events.reduce((sum, event) => sum + (Number(event.fine) || 0), 0);
      const paidAmount = Math.max(0, Number(student.paidAmount) || 0);
      const waivedAmount = Math.max(0, Number(student.waivedAmount) || 0);
      const remaining = Math.max(0, totalFine - paidAmount - waivedAmount);
      const payableBalance = Math.max(0, totalFine - waivedAmount);
      let status = "Unpaid";
      const hasProgress = paidAmount > 0 || waivedAmount > 0;
      if (payableBalance <= 0 && totalFine > 0) {
        status = "Waived";
      } else if (hasProgress && remaining > 0) {
        status = "Partial";
      } else if (paidAmount > 0 && remaining <= 0 && totalFine > 0) {
        status = "Paid";
      }
      return { ...student, totalFine, paidAmount, waivedAmount, remaining, status };
    });
  }, [paymentRowsState]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return studentRows.filter((row) => {
      const matchesStatus = statusFilter === "All" || row.status === statusFilter;
      const matchesSearch =
        !q ||
        row.studentName.toLowerCase().includes(q) ||
        row.studentId.toLowerCase().includes(q) ||
        row.course.toLowerCase().includes(q) ||
        row.events.some((event) => event.name.toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [search, statusFilter, studentRows]);

  const studentsTotal = filteredRows.length;
  const studentsTotalPages = Math.max(1, Math.ceil(studentsTotal / studentsPageSize) || 1);
  const studentsPageSafe = Math.min(studentsPage, studentsTotalPages);

  const paginatedStudents = useMemo(() => {
    const start = (studentsPageSafe - 1) * studentsPageSize;
    return filteredRows.slice(start, start + studentsPageSize);
  }, [filteredRows, studentsPageSafe, studentsPageSize]);

  useEffect(() => {
    setStudentsPage(1);
  }, [search, statusFilter, studentsPageSize]);

  useEffect(() => {
    setStudentsPage((p) => Math.min(p, studentsTotalPages));
  }, [studentsTotalPages]);

  const selectedRow = useMemo(
    () => filteredRows.find((row) => row.studentId === selectedStudentId) ?? filteredRows[0] ?? null,
    [filteredRows, selectedStudentId],
  );

  const modalStudent = useMemo(
    () => filteredRows.find((row) => row.studentId === modalStudentId) ?? null,
    [filteredRows, modalStudentId],
  );

  const hoverStudent = useMemo(
    () => (hoverCard?.studentId ? filteredRows.find((row) => row.studentId === hoverCard.studentId) ?? null : null),
    [filteredRows, hoverCard],
  );

  const modalEvents = useMemo(() => {
    if (!modalStudent) return [];
    return modalStudent.events.filter((event) => {
      const kind = String(event.sessionKind ?? "whole").toLowerCase();
      const matchesSession =
        modalSessionFilter === "all" ||
        (modalSessionFilter === "whole" && kind === "whole") ||
        (modalSessionFilter === "am" && kind === "am") ||
        (modalSessionFilter === "pm" && kind === "pm");
      return matchesSession;
    });
  }, [modalStudent, modalSessionFilter]);

  const modalFilteredTotalFine = useMemo(
    () => modalEvents.reduce((sum, event) => sum + (Number(event.fine) || 0), 0),
    [modalEvents],
  );
  const showAmColumns = modalSessionFilter !== "pm";
  const showPmColumns = modalSessionFilter !== "am";
  const modalTableColCount = 3 + (showAmColumns ? 2 : 0) + (showPmColumns ? 2 : 0) + 1;
  const eventNameHeaderWidthClass = showAmColumns && showPmColumns ? "w-[34%]" : "w-[44%]";

  const totals = useMemo(
    () =>
      filteredRows.reduce(
        (acc, row) => {
          acc.total += row.totalFine;
          acc.paid += row.paidAmount;
          acc.unpaid += row.remaining;
          acc.waived += row.waivedAmount;
          return acc;
        },
        { total: 0, paid: 0, unpaid: 0, waived: 0 },
      ),
    [filteredRows],
  );

  const selectedStudentLineData = useMemo(() => {
    if (!selectedRow) return null;
    const points = selectedRow.events
      .slice()
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .map((event) => ({
        label: formatEventDateForDisplay(event.date),
        fine: Number(event.fine) || 0,
      }));
    return {
      labels: points.map((p) => p.label),
      datasets: [
        {
          label: "Fine Amount",
          data: points.map((p) => p.fine),
          borderColor: "#07713c",
          backgroundColor: "rgba(7, 113, 60, 0.15)",
          tension: 0.25,
          pointRadius: 2,
          pointHoverRadius: 4,
          fill: false,
        },
      ],
    };
  }, [selectedRow]);

  const selectedStudentLineOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => formatPhp(Number(value)),
          },
          grid: { color: "rgba(7, 113, 60, 0.12)" },
        },
        x: {
          grid: { color: "rgba(7, 113, 60, 0.08)" },
        },
      },
    }),
    [],
  );

  const selectedAttendanceTier = useMemo(
    () => getPaymentAttendanceTier(selectedRow),
    [selectedRow],
  );

  const openRecordPaymentModal = () => {
    if (!selectedRow) return;
    setIsPaymentEditMode(false);
    setPaymentAmountInput("");
    setRemainingBalanceInput("");
    setPaymentError("");
    setShowPaymentModal(true);
  };

  const handleSubmitPayment = () => {
    if (!selectedRow) return;
    const amount = parseMoneyInput(paymentAmountInput);
    const maxPayable = Math.max(0, selectedRow.totalFine - selectedRow.waivedAmount);
    const maxTotalFine = Math.max(0, selectedRow.totalFine);
    if (!Number.isFinite(amount) || amount < 0 || (!isPaymentEditMode && amount <= 0)) {
      setPaymentError(isPaymentEditMode ? "Enter a valid amount (zero or greater)." : "Enter a valid amount greater than zero.");
      return;
    }
    if (amount > (isPaymentEditMode ? maxPayable : selectedRow.remaining)) {
      setPaymentError(
        isPaymentEditMode
          ? "Amount cannot be greater than total payable balance."
          : "Amount cannot be greater than remaining balance.",
      );
      return;
    }
    const roundedAmount = Math.round(amount * 100) / 100;
    const previousBalance = selectedRow.remaining;
    let newBalance = Math.max(0, previousBalance - roundedAmount);
    let nextPaidAmount = (Number(selectedRow.paidAmount) || 0) + roundedAmount;
    if (isPaymentEditMode) {
      const parsedBalance = parseMoneyInput(remainingBalanceInput);
      if (!Number.isFinite(parsedBalance) || parsedBalance < 0 || parsedBalance > maxTotalFine) {
        setPaymentError("Balance must be between 0 and Total Fine.");
        return;
      }
      if (roundedAmount > parsedBalance) {
        setPaymentError("Amount to pay cannot be greater than balance.");
        return;
      }
      newBalance = Math.round((parsedBalance - roundedAmount) * 100) / 100;
      nextPaidAmount = Math.max(0, maxPayable - newBalance);
    }

    setPaymentRowsState((prev) =>
      prev.map((row) =>
        row.studentId === selectedRow.studentId
          ? {
              ...row,
              paidAmount: isPaymentEditMode ? nextPaidAmount : (Number(row.paidAmount) || 0) + roundedAmount,
            }
          : row,
      ),
    );

    if (!isPaymentEditMode) {
      setLastReceipt({
        receiptNo: makeReceiptNumber(),
        createdAt: new Date().toISOString(),
        encodedBy: roleLabel || "CSG/Governor",
        studentId: selectedRow.studentId,
        studentName: selectedRow.studentName,
        course: selectedRow.course,
        year: selectedRow.year,
        previousBalance,
        amountPaid: roundedAmount,
        newBalance,
        note: "",
      });
    }
    setIsPaymentEditMode(false);
    setRemainingBalanceInput("");
    setShowPaymentModal(false);
  };

  const printReceipt = (receipt) => {
    if (!receipt) return;
    const logoUrl = `${window.location.origin}/logo.png`;
    const w = window.open("", "_blank", "width=900,height=900");
    if (!w) return;
    w.document.open();
    w.document.write(buildReceiptHtml(receipt, logoUrl));
    w.document.close();
    w.focus();
    window.setTimeout(() => w.print(), 250);
  };

  const openEditFineModal = (event) => {
    if (!modalStudent) return;
    setEditingFine({ studentId: modalStudent.studentId, eventId: event.id, eventName: event.name });
    setEditFineAmountInput(String(Number(event.fine) || 0));
    setEditFineError("");
  };

  const handleSaveFineEdit = () => {
    if (!editingFine) return;
    const amount = parseMoneyInput(editFineAmountInput);
    if (!Number.isFinite(amount) || amount < 0) {
      setEditFineError("Fine amount must be zero or higher.");
      return;
    }
    const rounded = Math.round(amount * 100) / 100;
    setPaymentRowsState((prev) =>
      prev.map((row) => {
        if (row.studentId !== editingFine.studentId) return row;
        return {
          ...row,
          events: row.events.map((event) =>
            event.id === editingFine.eventId ? { ...event, fine: rounded } : event,
          ),
        };
      }),
    );
    setEditingFine(null);
  };

  return (
    <div className="flex min-h-screen bg-gray-50 [&_button]:cursor-pointer">
      <aside className="w-64 shrink-0 bg-[#07713C] text-white flex flex-col">
        <div className="p-6 space-y-4">
          <img src="/logo.png" alt="NMCI" className="w-16 h-16 rounded-full bg-white/10 object-contain mx-auto" />
          <p className="text-xs text-center font-medium uppercase tracking-wider font-[Inter,sans-serif]">Northern Mindanao Colleges, Inc.</p>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {[
            { id: "dashboard", label: "Dashboard" },
            { id: "attendance", label: "Attendance" },
            { id: "attendance_students", label: "Students" },
            { id: "payment", label: "Payments" },
            { id: "events", label: "Events" },
            { id: "students", label: "Department" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate?.(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm font-medium transition-colors ${
                item.id === "payment" ? "bg-[#055a2e] text-white" : "text-green-100 hover:bg-white/15"
              }`}
            >
              <SidebarNavIcon navId={item.id} />
              {item.label}
            </button>
          ))}
          {canOpenCreateUser(isGovernor, role) && (
            <button
              type="button"
              onClick={() => onOpenCreateUser?.()}
              className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-left text-sm font-semibold text-white transition-colors ${
                isCreateUserOpen ? "bg-white/15 hover:bg-white/25" : "bg-transparent hover:bg-white/15"
              }`}
            >
              <span className="text-base">＋</span>
              Create User
            </button>
          )}
          <div className="pt-4">
            <p className="px-4 text-xs font-medium text-green-200 uppercase tracking-wider">Reports</p>
            <button type="button" className="w-full px-4 py-2 pl-8 rounded-lg text-left text-sm text-green-100 hover:bg-white/15">
              Export payments
            </button>
            <button type="button" className="w-full px-4 py-2 pl-8 rounded-lg text-left text-sm text-green-100 hover:bg-white/15">
              <span className="flex items-center gap-2">
                <span>Settings</span>
                <span className="inline-flex items-center rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white">{roleLabel}</span>
              </span>
            </button>
          </div>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-[#07713c]/30 px-6 py-4">
          <h1 className="text-[30px] font-extrabold font-[Inter,sans-serif] text-[#07713c] leading-tight">Payments</h1>
          <p className="text-sm text-[#07713c]/80">Manual fines and penalty collection (mock data)</p>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-[#07713c]/30 p-4 shadow-sm">
              <p className="text-2xl font-bold text-[#07713c]">{formatPhp(totals.total)}</p>
              <p className="text-sm font-medium text-[#07713c]">Ledger Total</p>
            </div>
            <div className="bg-white rounded-lg border border-[#07713c]/30 p-4 shadow-sm">
              <p className="text-2xl font-bold text-[#07713c]">{formatPhp(totals.paid)}</p>
              <p className="text-sm font-medium text-[#07713c]">Collected</p>
            </div>
            <div className="bg-white rounded-lg border border-[#07713c]/30 p-4 shadow-sm">
              <p className="text-2xl font-bold text-[#07713c]">{formatPhp(totals.unpaid)}</p>
              <p className="text-sm font-medium text-[#07713c]">Outstanding</p>
            </div>
            <div className="bg-white rounded-lg border border-[#07713c]/30 p-4 shadow-sm">
              <p className="text-2xl font-bold text-[#07713c]">{formatPhp(totals.waived)}</p>
              <p className="text-sm font-medium text-[#07713c]">Waived</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.8fr_1fr] gap-6">
            <section className="bg-white rounded-lg border border-[#07713c]/30 shadow-sm overflow-hidden">
              <div className="px-4 pt-4">
                <h2 className="text-lg font-bold text-[#07713c]">Students</h2>
              </div>
              <div className="p-4 border-b border-[#07713c]/30 flex flex-wrap gap-3 items-end">
                <div className="relative min-w-[240px] flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#07713c]">
                    🔍
                  </span>
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search student, ID, course, event"
                    className="w-full rounded-lg border border-[#07713c]/40 bg-white py-2 pl-10 pr-10 text-sm text-[#07713c] placeholder:text-[#07713c]/45 focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c] [&::-webkit-search-cancel-button]:hidden"
                  />
                  {search.trim() !== "" && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-lg leading-none text-[#07713c]/85 hover:bg-gray-100 hover:text-[#07713c] focus:outline-none focus:ring-2 focus:ring-[#07713c]/30"
                      aria-label="Clear payments search"
                    >
                      ×
                    </button>
                  )}
                </div>
                <label className="flex flex-col items-start gap-1 text-xs text-[#07713c]">
                  Status
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="rounded-lg border border-[#07713c]/40 bg-white px-4 py-2 text-sm text-[#07713c] focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                  >
                    <option>All</option>
                    <option>Unpaid</option>
                    <option>Partial</option>
                    <option>Paid</option>
                  </select>
                </label>
                <label className="flex flex-col items-start gap-1 text-xs text-[#07713c] self-end">
                  Students per page
                  <select
                    value={studentsPageSize}
                    onChange={(e) => setStudentsPageSize(Number(e.target.value))}
                    className="h-9 rounded-lg border border-[#07713c]/40 bg-white px-4 text-sm text-[#07713c] focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                  >
                    {[5, 10, 15, 20, 25, 50].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] table-fixed border-collapse text-sm">
                  <thead className="border-b border-[#07713c]/30 bg-[#07713c]">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white">Student</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white">Course</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white">Year</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-white">Total Events</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-white">Total Fine</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-white">Remaining</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-white">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedStudents.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 px-4 text-center text-[#07713c]/85 text-sm">No payment records found for this filter.</td>
                      </tr>
                    ) : (
                      paginatedStudents.map((row) => (
                        <tr
                          key={row.studentId}
                          onClick={() => setSelectedStudentId(row.studentId)}
                          className={`cursor-pointer border-b border-[#07713c]/15 ${
                            selectedRow?.studentId === row.studentId ? "bg-[#07713c]/10" : "hover:bg-[#07713c]/[0.04]"
                          }`}
                        >
                          <td
                            className="py-3 px-3"
                            onMouseEnter={(e) => {
                              cancelHide();
                              scheduleShow(row.studentId, e.clientX + 10, e.clientY + 10);
                            }}
                            onMouseLeave={scheduleHide}
                          >
                            <p className="font-medium text-[#07713c] hover:underline underline-offset-2 decoration-[#07713c]">
                              {row.studentName}
                            </p>
                          </td>
                          <td className="py-3 px-3 text-[#07713c]">{row.course}</td>
                          <td className="py-3 px-3 text-[#07713c]">{row.year}</td>
                          <td className="py-3 px-3 text-center text-[#07713c]">{row.events.length}</td>
                          <td className="py-3 px-3 text-center font-medium tabular-nums text-red-700">{formatPhp(row.totalFine)}</td>
                          <td className="py-3 px-3 text-center font-medium tabular-nums text-red-700">{formatPhp(row.remaining)}</td>
                          <td className="py-3 px-3 text-center">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass(row.status)}`}>{row.status}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <PaginationBar
                totalCount={studentsTotal}
                page={studentsPageSafe}
                pageSize={studentsPageSize}
                onPageChange={setStudentsPage}
                itemLabel="students"
                className="border-t-0"
              />
            </section>

            <aside className="bg-white rounded-lg border border-[#07713c]/30 shadow-sm p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <h2 className="text-lg font-bold text-[#07713c]">Selected Student Payment</h2>
                {selectedRow ? (
                  <div className="px-2.5 py-1.5 text-right">
                    <div className="mt-0.5 inline-flex items-baseline gap-1.5 text-xs font-semibold text-[#07713c]">
                      <span aria-hidden="true">{selectedAttendanceTier.emoji}</span>
                      <span>{selectedAttendanceTier.label}</span>
                      <span className="tabular-nums text-[#07713c]/80">{selectedAttendanceTier.rate}%</span>
                    </div>
                  </div>
                ) : null}
              </div>
              {!selectedRow ? (
                <p className="text-sm text-[#07713c]/85">Select a row to view payment details.</p>
              ) : (
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center justify-between border-b border-[#07713c]/15 py-1.5"><span className="text-[#07713c]/85">Student ID</span><span className="font-medium text-[#07713c]">{selectedRow.studentId}</span></div>
                  <div className="flex items-center justify-between border-b border-[#07713c]/15 py-1.5"><span className="text-[#07713c]/85">Student</span><span className="font-medium text-[#07713c] text-right">{selectedRow.studentName}</span></div>
                  <div className="flex items-center justify-between border-b border-[#07713c]/15 py-1.5"><span className="text-[#07713c]/85">Total events with fines</span><span className="font-medium text-[#07713c]">{selectedRow.events.length}</span></div>
                  <div className="flex items-center justify-between border-b border-[#07713c]/15 py-1.5"><span className="text-[#07713c]/85">Total fine</span><span className="font-semibold text-red-700 tabular-nums">{formatPhp(selectedRow.totalFine)}</span></div>
                  <div className="flex items-center justify-between border-b border-[#07713c]/15 py-1.5"><span className="text-[#07713c]/85">Paid amount</span><span className="font-medium text-red-700 tabular-nums">{formatPhp(selectedRow.paidAmount)}</span></div>
                  <div className="flex items-center justify-between border-b border-[#07713c]/15 py-1.5"><span className="text-[#07713c]/85">Remaining balance</span><span className={`font-semibold tabular-nums ${selectedRow.remaining <= 0 ? "text-[#07713c]" : "text-red-700"}`}>{formatPhp(selectedRow.remaining)}</span></div>
                  <div className="flex items-center justify-between border-b border-[#07713c]/15 py-1.5"><span className="text-[#07713c]/85">Status</span><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass(selectedRow.status)}`}>{selectedRow.status}</span></div>
                  <p className="text-xs text-[#07713c]/75">
                    Attendance activity: {selectedAttendanceTier.rate}% ({selectedAttendanceTier.label})
                  </p>
                  <div className="pt-2 grid grid-cols-2 gap-2">
                    <button type="button" onClick={openRecordPaymentModal} className="px-3 py-2 rounded-lg bg-[#07713C] text-white text-sm hover:bg-[#055a2e]">Record Payment</button>
                    <button type="button" onClick={() => setModalStudentId(selectedRow.studentId)} className="px-3 py-2 rounded-lg border border-[#07713c]/40 text-[#07713c] text-sm hover:bg-gray-50">View Attendance</button>
                  </div>
                  {lastReceipt && lastReceipt.studentId === selectedRow.studentId && (
                    <button
                      type="button"
                      onClick={() => printReceipt(lastReceipt)}
                      className="w-full px-3 py-2 rounded-lg border border-[#07713c]/40 text-[#07713c] text-sm hover:bg-[#07713c]/5"
                    >
                      Print Latest Receipt ({lastReceipt.receiptNo})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsGraphModalOpen(true)}
                    className="mt-3 w-full rounded-lg border border-[#07713c]/30 p-3 text-left hover:bg-[#07713c]/[0.03]"
                  >
                    <p className="mb-2 text-sm font-semibold text-[#07713c]">Fine Trend</p>
                    <div className="h-44">
                      {selectedStudentLineData ? (
                        <Line data={selectedStudentLineData} options={selectedStudentLineOptions} />
                      ) : (
                        <p className="text-xs text-[#07713c]/75">No chart data available.</p>
                      )}
                    </div>
                  </button>
                </div>
              )}
            </aside>
          </div>
        </main>
      </div>

      {hoverCard && hoverStudent && (
        <div
          className="fixed z-40 w-56 rounded-lg border border-[#07713c]/30 bg-white p-2.5 text-xs shadow-lg"
          style={{ left: `${Math.min(hoverCard.x, window.innerWidth - 240)}px`, top: `${Math.min(hoverCard.y, window.innerHeight - 180)}px` }}
          onMouseEnter={() => {
            isHoveringCardRef.current = true;
            cancelHide();
          }}
          onMouseLeave={() => {
            isHoveringCardRef.current = false;
            scheduleHide();
          }}
        >
          <p className="font-semibold text-[#07713c]">{hoverStudent.studentName}</p>
          <p className="text-[#07713c]/80">Total fines: {formatPhp(hoverStudent.totalFine)}</p>
          <p className="text-[#07713c]/80">Remaining: {formatPhp(hoverStudent.remaining)}</p>
          <div className="mt-2 flex gap-1.5">
            <button type="button" onClick={() => setModalStudentId(hoverStudent.studentId)} className="rounded-md bg-[#07713C] px-2 py-1 text-[11px] font-medium text-white hover:bg-[#055a2e]">View Attendance</button>
            <button type="button" onClick={() => setSelectedStudentId(hoverStudent.studentId)} className="rounded-md border border-[#07713c]/40 px-2 py-1 text-[11px] font-medium text-[#07713c] hover:bg-gray-50">Select</button>
          </div>
        </div>
      )}

      {modalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-7xl rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-[#07713C] px-5 py-3 flex items-center justify-between">
              <h3 className="text-white text-xl font-semibold">{modalStudent.studentName} · {modalStudent.studentId}</h3>
              <button
                type="button"
                onClick={() => {
                  setModalStudentId("");
                  setSelectedEventRowId("");
                  setModalSessionFilter("all");
                }}
                className="w-7 h-7 rounded-full bg-yellow-300 flex items-center justify-center text-[#07713c] hover:bg-yellow-400"
                aria-label="Close"
                title="Close"
              >
                ✕
              </button>
            </div>
            <div className="p-4 max-h-[75vh] overflow-y-auto">
              <div className="mb-3 flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-xs text-[#07713c]">
                  Session
                  <select
                    value={modalSessionFilter}
                    onChange={(e) => setModalSessionFilter(e.target.value)}
                    className="h-9 min-w-[9rem] rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm focus:border-[#07713c]/40 focus:outline-none focus:ring-0"
                  >
                    <option value="all">All sessions</option>
                    <option value="whole">Whole day</option>
                    <option value="am">AM Session</option>
                    <option value="pm">PM Session</option>
                  </select>
                </label>
              </div>
              <div className="overflow-x-auto">
                <div className="rounded-lg border border-[#07713c]/30 overflow-hidden">
                  <table className="w-full min-w-[980px] table-fixed text-sm">
                    <thead className="border-b border-[#07713c]/30 bg-gray-50 text-center text-xs font-medium text-[#07713c]">
                    <tr>
                      <th className={`border-r border-[#07713c]/30 px-4 py-2 align-bottom whitespace-nowrap text-left ${eventNameHeaderWidthClass}`}>Event name</th>
                      <th className="border-r border-[#07713c]/30 px-4 py-2 align-bottom whitespace-nowrap">Date</th>
                      <th className="border-r border-[#07713c]/30 px-4 py-2 align-bottom whitespace-nowrap">Session</th>
                      {showAmColumns && (
                        <>
                          <th className="border-r border-[#07713c]/30 px-4 py-2 align-bottom whitespace-nowrap">AM In</th>
                          <th className="border-r border-[#07713c]/30 px-4 py-2 align-bottom whitespace-nowrap">AM Out</th>
                        </>
                      )}
                      {showPmColumns && (
                        <>
                          <th className="border-r border-[#07713c]/30 px-4 py-2 align-bottom whitespace-nowrap">PM In</th>
                          <th className="border-r border-[#07713c]/30 px-4 py-2 align-bottom whitespace-nowrap">PM Out</th>
                        </>
                      )}
                      <th className="w-[10%] px-3 py-2 align-bottom text-right whitespace-nowrap">FINES</th>
                    </tr>
                    </thead>
                    <tbody>
                      {modalEvents.length === 0 ? (
                        <tr className="border-t border-[#07713c]/30">
                          <td colSpan={modalTableColCount} className="px-4 py-8 text-center text-sm text-[#07713c]/85">
                            No events match the current filters.
                          </td>
                        </tr>
                      ) : (
                      modalEvents.map((event) => (
                        <tr
                          key={event.id}
                          onClick={() => setSelectedEventRowId(event.id)}
                          className={`border-t border-[#07713c]/30 cursor-pointer ${
                            selectedEventRowId === event.id ? "bg-[#07713c]/10" : "hover:bg-[#07713c]/[0.04]"
                          }`}
                        >
                          <td className={`border-r border-[#07713c]/30 px-4 py-2.5 text-left font-medium text-[#07713c] whitespace-nowrap ${eventNameHeaderWidthClass}`}>
                            <span className="block w-full overflow-hidden text-ellipsis" title={event.name}>
                              {event.name}
                            </span>
                          </td>
                          <td className="border-r border-[#07713c]/30 px-4 py-2.5 text-center whitespace-nowrap text-[#07713c]">{formatEventDateForDisplay(event.date)}</td>
                          <td className="border-r border-[#07713c]/30 px-4 py-2.5 text-center whitespace-nowrap text-[#07713c]">{sessionLabel(event.sessionKind)}</td>
                          {showAmColumns && (
                            <>
                              <td className="border-r border-[#07713c]/30 px-3 py-2.5 text-center whitespace-nowrap"><ModalPeriodSlot event={event} period="am" value={event.amIn} /></td>
                              <td className="border-r border-[#07713c]/30 px-3 py-2.5 text-center whitespace-nowrap"><ModalPeriodSlot event={event} period="am" value={event.amOut} /></td>
                            </>
                          )}
                          {showPmColumns && (
                            <>
                              <td className="border-r border-[#07713c]/30 px-3 py-2.5 text-center whitespace-nowrap"><ModalPeriodSlot event={event} period="pm" value={event.pmIn} /></td>
                              <td className="border-r border-[#07713c]/30 px-3 py-2.5 text-center whitespace-nowrap"><ModalPeriodSlot event={event} period="pm" value={event.pmOut} /></td>
                            </>
                          )}
                          <td className="w-[10%] px-3 py-2.5 text-right text-red-700 font-semibold tabular-nums whitespace-nowrap">{formatPhp(event.fine)}</td>
                        </tr>
                      ))
                      )}
                    </tbody>
                    <tfoot>
                    <tr className="bg-[#07713c]/[0.07] border-t border-[#07713c]/30">
                        <td colSpan={modalTableColCount - 1} className="border-r border-[#07713c]/30 px-4 py-3 text-right text-sm font-semibold text-[#07713c]">Total fines across all events</td>
                        <td className="w-[10%] px-3 py-3 text-right text-sm font-bold text-red-700 tabular-nums">{formatPhp(modalFilteredTotalFine)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
              <div className="mt-3 text-xs text-[#07713c]/80">
                Paid: {formatPhp(modalStudent.paidAmount)} · Waived: {formatPhp(modalStudent.waivedAmount)} · Remaining: {formatPhp(modalStudent.remaining)}
              </div>
            </div>
          </div>
        </div>
      )}

      {showPaymentModal && selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-[#07713C] px-5 py-3 flex items-center justify-between">
              <h3 className="text-white text-xl font-semibold">Record Payment</h3>
              <button
                type="button"
                onClick={() => {
                  setShowPaymentModal(false);
                  setIsPaymentEditMode(false);
                  setRemainingBalanceInput("");
                }}
                className="w-7 h-7 rounded-full bg-yellow-300 flex items-center justify-center text-[#07713c] hover:bg-yellow-400"
                aria-label="Close"
                title="Close"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4 text-base">
              <div className="grid gap-4">
                <div className="rounded-xl border border-[#07713c]/20 bg-[#07713c]/[0.04] p-3.5">
                  <div className="mt-2 space-y-1.5 text-[#07713c]">
                    <p><span className="font-semibold">Name:</span> {selectedRow.studentName}</p>
                    <p><span className="font-semibold">Student ID:</span> {selectedRow.studentId}</p>
                    <p><span className="font-semibold">Course:</span> {selectedRow.course}</p>
                    <p><span className="font-semibold">Year:</span> {selectedRow.year}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[#07713c]/20 bg-gray-50 p-3">
                <p className="text-base font-semibold uppercase tracking-wide text-[#07713c]/80">Payment Preview</p>
                <div className="mt-2 space-y-1.5 text-base text-[#07713c]">
                  <div className="flex items-center justify-between">
                    <span>Balance</span>
                    {isPaymentEditMode ? (
                      <div className="space-y-1">
                        <div className="grid grid-cols-[18px_minmax(90px,120px)] items-center gap-1">
                          <span className="text-red-700">₱</span>
                          <input
                            value={remainingBalanceInput}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const normalized = raw
                                .replace(/[^\d.]/g, "")
                                .replace(/(\..*)\./g, "$1");
                              const parsed = parseMoneyInput(normalized);
                              if (normalized === "" || !Number.isFinite(parsed)) {
                                setRemainingBalanceInput(normalized);
                              } else {
                                const clamped = Math.min(parsed, Math.max(0, selectedRow.totalFine));
                                setRemainingBalanceInput(String(clamped));
                              }
                              if (paymentError) setPaymentError("");
                            }}
                            placeholder="amount"
                            inputMode="decimal"
                            pattern="^\\d*\\.?\\d*$"
                            className="w-full border-0 border-b border-[#07713c]/20 bg-transparent px-1 py-1 text-right tabular-nums text-red-700 outline-none ring-0 focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
                          />
                        </div>
                        <p className="text-right text-xs text-[#07713c]/75">
                          Max: {formatPhp(selectedRow.totalFine)} (Total Fine)
                        </p>
                      </div>
                    ) : (
                      <span className="font-semibold tabular-nums text-red-700">{formatPhp(selectedRow.remaining)}</span>
                    )}
                  </div>
                  {!isPaymentEditMode && (
                    <div className="grid grid-cols-[1fr_minmax(90px,120px)] items-center gap-3">
                      <label className="text-base font-semibold text-[#07713c]">Amount to pay</label>
                      <div className="flex items-center gap-1 border-0 border-b border-[#07713c]/20">
                        <span className="text-red-700">₱</span>
                        <input
                          value={paymentAmountInput}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const normalized = raw
                              .replace(/[^\d.]/g, "")
                              .replace(/(\..*)\./g, "$1");
                            setPaymentAmountInput(normalized);
                            if (paymentError) setPaymentError("");
                          }}
                          placeholder="amount"
                          inputMode="decimal"
                          pattern="^\d*\.?\d*$"
                          className="w-full border-0 bg-transparent px-1 py-2 text-right tabular-nums text-red-700 outline-none ring-0 focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
                        />
                      </div>
                    </div>
                  )}
                  <p className="flex items-center justify-between border-t border-[#07713c]/20 pt-1.5">
                    <span>Remaining Balance</span>
                    <span className="font-bold tabular-nums text-red-700">
                      {formatPhp(
                        Math.max(
                          0,
                          (isPaymentEditMode
                            ? Math.max(0, Number.isFinite(parseMoneyInput(remainingBalanceInput)) ? parseMoneyInput(remainingBalanceInput) : 0)
                            : selectedRow.remaining) -
                            Math.max(0, Number.isFinite(parseMoneyInput(paymentAmountInput)) ? parseMoneyInput(paymentAmountInput) : 0),
                        ),
                      )}
                    </span>
                  </p>
                </div>
              </div>

              {paymentError ? <p className="text-base font-medium text-red-700">{paymentError}</p> : null}
            </div>
            <div className="px-4 py-3 border-t border-[#07713c]/20 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (isPaymentEditMode) {
                    setIsPaymentEditMode(false);
                    setRemainingBalanceInput("");
                    setPaymentError("");
                    return;
                  }
                  setIsPaymentEditMode(true);
                  setPaymentAmountInput("");
                  setRemainingBalanceInput(String(Number(selectedRow.remaining) || 0));
                  setPaymentError("");
                }}
                className="px-4 py-2 rounded-lg border border-[#07713c]/30 text-lg text-[#07713c] hover:bg-[#07713c]/5"
              >
                {isPaymentEditMode ? "Cancel Edit" : "Edit"}
              </button>
              <button type="button" onClick={handleSubmitPayment} className="px-4 py-2 rounded-lg bg-[#07713C] text-lg text-white">{isPaymentEditMode ? "Save Edit" : "Save Payment"}</button>
            </div>
          </div>
        </div>
      )}

      {editingFine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-[#07713C] px-5 py-3">
              <h3 className="text-white font-semibold">Edit Fine Amount</h3>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <p className="text-[#07713c] font-medium">{editingFine.eventName}</p>
              <div>
                <label className="block mb-1 text-xs font-semibold text-[#07713c]">Fine amount</label>
                <input
                  value={editFineAmountInput}
                  onChange={(e) => {
                    setEditFineAmountInput(e.target.value);
                    if (editFineError) setEditFineError("");
                  }}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-[#07713c]/30 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#07713c]/30"
                />
              </div>
              {editFineError ? <p className="text-xs font-medium text-red-700">{editFineError}</p> : null}
            </div>
            <div className="px-4 py-3 border-t border-[#07713c]/20 flex justify-end gap-2">
              <button type="button" onClick={() => setEditingFine(null)} className="px-4 py-2 rounded-lg border border-[#07713c]/30 text-[#07713c]">Cancel</button>
              <button type="button" onClick={handleSaveFineEdit} className="px-4 py-2 rounded-lg bg-[#07713C] text-white">Save</button>
            </div>
          </div>
        </div>
      )}

      {isGraphModalOpen && selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-[#07713C] px-5 py-3 flex items-center justify-between">
              <h3 className="text-white text-xl font-semibold">
                Fine Trend · {selectedRow.studentName} · {selectedRow.studentId}
              </h3>
              <button
                type="button"
                onClick={() => setIsGraphModalOpen(false)}
                className="w-7 h-7 rounded-full bg-yellow-300 flex items-center justify-center text-[#07713c] hover:bg-yellow-400"
                aria-label="Close"
                title="Close"
              >
                ✕
              </button>
            </div>
            <div className="p-5">
              <div className="h-[420px] rounded-lg border border-[#07713c]/20 p-3">
                {selectedStudentLineData ? (
                  <Line data={selectedStudentLineData} options={selectedStudentLineOptions} />
                ) : (
                  <p className="text-sm text-[#07713c]/75">No chart data available.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
