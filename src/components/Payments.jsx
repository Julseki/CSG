import { useEffect, useMemo, useRef, useState } from "react";
import { Chart as ChartJS } from "chart.js/auto";
import { Line } from "react-chartjs-2";
import SidebarNavIcon from "./SidebarNavIcon";
import UserCircleIcon from "./UserCircleIcon";
import { useGovernorScope } from "../hooks/useGovernorScope";
import { getDashboardRoleLabel } from "../utils/roles";
import { formatDateTimeShort, formatEventDateForDisplay, formatSqlTimeForDisplay } from "../hooks/useGetEvents";
import PaginationBar from "./PaginationBar";
import SearchMagnifierIcon from "./SearchMagnifierIcon";
import { useGetPayments } from "../hooks/useGetPayments";
import { useRecordPayment } from "../hooks/useRecordPayment";
import { useUpdateFineAmount } from "../hooks/useUpdateFineAmount";
import { useSetStudentBalance } from "../hooks/useSetStudentBalance";
import { formatCourseWithMajor } from "../utils/courseMajorDisplay";

void ChartJS;


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

function getEventAttendanceStatus(event) {
  const kind = String(event?.sessionKind ?? "whole").toLowerCase();
  if (kind === "am") {
    return hasRecordedTime(event?.amIn) || hasRecordedTime(event?.amOut) ? "Attended" : "Absent";
  }
  if (kind === "pm") {
    return hasRecordedTime(event?.pmIn) || hasRecordedTime(event?.pmOut) ? "Attended" : "Absent";
  }
  const attended =
    hasRecordedTime(event?.amIn) ||
    hasRecordedTime(event?.amOut) ||
    hasRecordedTime(event?.pmIn) ||
    hasRecordedTime(event?.pmOut);
  return attended ? "Attended" : "Absent";
}

function ModalTimeSlot({ value }) {
  const v = String(value ?? "").trim();
  if (!v || v.toLowerCase() === "no record") {
    return (
      <span className="text-xs font-medium text-amber-800">
        No record
      </span>
    );
  }
  const display = formatSqlTimeForDisplay(v) ?? v;
  return <span className="text-xs text-[#07713c]">{display}</span>;
}

function ModalPeriodSlot({ event, period, value }) {
  const kind = String(event?.sessionKind ?? "whole").toLowerCase();
  const isNotApplicable = (kind === "am" && period === "pm") || (kind === "pm" && period === "am");
  if (isNotApplicable) return <span className="font-medium text-[#07713c]">—</span>;
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

function inferCollegeFromCourse(courseRaw) {
  const course = String(courseRaw ?? "").toUpperCase();
  if (course.startsWith("BEED") || course.startsWith("BSED")) return "College of Education, Arts and Sciences";
  if (course.startsWith("BSIT")) return "College of Information Technology";
  if (course.startsWith("BSCRIM")) return "College of Criminal Justice Education";
  if (course.startsWith("BSHM")) return "College of Hospitality Management";
  if (course.startsWith("BSBA")) return "College of Business Administration";
  return "Unassigned";
}

function makeReceiptNumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  return `RCP-${y}${m}${d}-${h}${min}${s}${ms}`;
}

function downloadTextFile(filename, text, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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
      .row-divider { border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 8px; }
      .new-balance { font-size: 18px; font-weight: 700; color: #07713C; }
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
          <div><span class="label">Date:</span> <span class="value">${formatDateTimeShort(receipt.createdAt)}</span></div>
          <div><span class="label">Student ID:</span> <span class="value">${receipt.studentId}</span></div>
          <div><span class="label">Student Name:</span> <span class="value">${receipt.studentName}</span></div>
          <div><span class="label">Course / Year:</span> <span class="value">${receipt.course} · ${receipt.year}</span></div>
          <div><span class="label">Encoded By:</span> <span class="value">${receipt.encodedBy}</span></div>
        </div>
        <div class="summary">
          <div class="row"><span>Previous Balance</span><strong>${formatPhp(receipt.previousBalance)}</strong></div>
          <div class="row row-divider"><span>Amount Paid</span><strong>${formatPhp(receipt.amountPaid)}</strong></div>
          <div class="row new-balance"><span>New Balance</span><strong>${formatPhp(receipt.newBalance)}</strong></div>
        </div>
        ${receipt.note ? `<div class="foot"><strong>Note:</strong> ${receipt.note}</div>` : ""}
      </div>
    </div>
  </body>
</html>`;
}

export default function Payments({ onNavigate, onLogout }) {
  const { role, isGovernor, governorScope } = useGovernorScope();
  const roleLabel = getDashboardRoleLabel(isGovernor, governorScope, role);
  const { data: paymentRowsFromApi = [], isLoading: isPaymentsLoading, isError: isPaymentsError } = useGetPayments();
  const recordPaymentMutation = useRecordPayment();
  const updateFineAmountMutation = useUpdateFineAmount();
  const setStudentBalanceMutation = useSetStudentBalance();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [studentsPage, setStudentsPage] = useState(1);
  const [studentsPageSize, setStudentsPageSize] = useState(10);
  const [selectedStudentId, setSelectedStudentId] = useState("");
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
  const [exportOpen, setExportOpen] = useState(false);
  const [exportSearch, setExportSearch] = useState("");
  const [exportStatusFilter, setExportStatusFilter] = useState("All");
  const [exportCollegeFilter, setExportCollegeFilter] = useState("all");
  const [exportCourseFilter, setExportCourseFilter] = useState("all");
  const [exportYearFilter, setExportYearFilter] = useState("all");
  const [exportBalanceFilter, setExportBalanceFilter] = useState("all");
  const [showLogout, setShowLogout] = useState(false);
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

  useEffect(() => {
    if (!selectedStudentId && paymentRowsFromApi.length > 0) {
      setSelectedStudentId(paymentRowsFromApi[0].studentId);
    }
  }, [paymentRowsFromApi, selectedStudentId]);

  const studentRows = useMemo(() => {
    return paymentRowsFromApi.map((student) => {
      const totalFine = Math.max(0, Number(student.totalFine) || 0);
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
      const courseDisplay = formatCourseWithMajor(student.course, student.major ?? null);
      return { ...student, totalFine, paidAmount, waivedAmount, remaining, status, courseDisplay };
    });
  }, [paymentRowsFromApi]);

  const applyStudentFilters = (rows, filters) => {
    const q = String(filters.search ?? "").trim().toLowerCase();
    return rows.filter((row) => {
      const matchesStatus = filters.status === "All" || row.status === filters.status;
      const rowCollege = row.college || inferCollegeFromCourse(row.course);
      const matchesCollege = filters.college === "all" || rowCollege === filters.college;
      const matchesCourse = filters.course === "all" || row.course === filters.course;
      const matchesYear = filters.year === "all" || String(row.year ?? "") === String(filters.year);
      const matchesBalance =
        filters.balance === "all" ||
        (filters.balance === "with_balance" && row.remaining > 0) ||
        (filters.balance === "zero_balance" && row.remaining <= 0);
      const majorQ = (row.major ?? "").toLowerCase();
      const matchesSearch =
        !q ||
        row.studentName.toLowerCase().includes(q) ||
        row.studentId.toLowerCase().includes(q) ||
        row.course.toLowerCase().includes(q) ||
        majorQ.includes(q) ||
        (row.courseDisplay ?? "").toLowerCase().includes(q) ||
        row.events.some((event) => event.name.toLowerCase().includes(q));
      return matchesStatus && matchesCollege && matchesCourse && matchesYear && matchesBalance && matchesSearch;
    });
  };

  const exportCollegeOptions = useMemo(
    () =>
      Array.from(new Set(studentRows.map((row) => row.college || inferCollegeFromCourse(row.course)).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [studentRows],
  );

  const exportCourseOptions = useMemo(
    () => Array.from(new Set(studentRows.map((row) => row.course).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [studentRows],
  );

  const exportYearOptions = useMemo(
    () =>
      Array.from(new Set(studentRows.map((row) => String(row.year ?? "")).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
      ),
    [studentRows],
  );

  const filteredRows = useMemo(() => {
    return applyStudentFilters(studentRows, {
      search,
      status: statusFilter,
      college: "all",
      course: "all",
      year: "all",
      balance: "all",
    });
  }, [search, statusFilter, studentRows]);

  const exportFilteredRows = useMemo(
    () =>
      applyStudentFilters(studentRows, {
        search: exportSearch,
        status: exportStatusFilter,
        college: exportCollegeFilter,
        course: exportCourseFilter,
        year: exportYearFilter,
        balance: exportBalanceFilter,
      }),
    [studentRows, exportSearch, exportStatusFilter, exportCollegeFilter, exportCourseFilter, exportYearFilter, exportBalanceFilter],
  );

  useEffect(() => {
    if (!exportOpen) return;
    setExportSearch(search);
    setExportStatusFilter(statusFilter);
    setExportCollegeFilter("all");
    setExportCourseFilter("all");
    setExportYearFilter("all");
    setExportBalanceFilter("all");
  }, [exportOpen, search, statusFilter]);

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
  const modalTableColCount = 4 + (showAmColumns ? 2 : 0) + (showPmColumns ? 2 : 0) + 1;
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
  const studentsWithBalance = useMemo(
    () => filteredRows.filter((row) => row.remaining > 0).length,
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

  const openRecordPaymentModal = (rowOverride = null) => {
    const targetRow = rowOverride ?? selectedRow;
    if (!targetRow) return;
    if (rowOverride?.studentId) {
      setSelectedStudentId(rowOverride.studentId);
    }
    setIsPaymentEditMode(false);
    setPaymentAmountInput("");
    setRemainingBalanceInput("");
    setPaymentError("");
    setShowPaymentModal(true);
  };

  const handleSubmitPayment = async () => {
    if (!selectedRow) return;
    const maxPayable = Math.max(0, selectedRow.totalFine - selectedRow.waivedAmount);
    const maxTotalFine = Math.max(0, selectedRow.totalFine);
    const previousBalance = selectedRow.remaining;
    let roundedAmount = 0;
    let newBalance = previousBalance;

    if (isPaymentEditMode) {
      const parsedBalance = parseMoneyInput(remainingBalanceInput);
      if (!Number.isFinite(parsedBalance) || parsedBalance < 0 || parsedBalance > maxTotalFine) {
        setPaymentError("Balance must be between 0 and Total Fine.");
        return;
      }
      try {
        const response = await setStudentBalanceMutation.mutateAsync({
          studentId: selectedRow.studentId,
          targetBalance: Math.round(parsedBalance * 100) / 100,
        });
        setLastReceipt(null);
        setIsPaymentEditMode(false);
        setRemainingBalanceInput("");
        setShowPaymentModal(false);
        setPaymentError("");
        if (response?.newBalance != null) {
          newBalance = Number(response.newBalance);
        }
      } catch (error) {
        setPaymentError(error?.response?.data?.message || "Unable to update balance right now.");
      }
      return;
    } else {
      const amount = parseMoneyInput(paymentAmountInput);
      if (!Number.isFinite(amount) || amount <= 0) {
        setPaymentError("Enter a valid amount greater than zero.");
        return;
      }
      if (amount > selectedRow.remaining) {
        setPaymentError("Amount cannot be greater than remaining balance.");
        return;
      }
      roundedAmount = Math.round(amount * 100) / 100;
      newBalance = Math.max(0, previousBalance - roundedAmount);
    }

    if (roundedAmount > maxPayable) {
      setPaymentError("Amount cannot be greater than total payable balance.");
      return;
    }

    try {
      const response = await recordPaymentMutation.mutateAsync({
        studentId: selectedRow.studentId,
        amountPaid: roundedAmount,
        paymentMethod: "Cash",
        remarks: "",
      });
      setLastReceipt({
        receiptNo: response?.receiptNo || makeReceiptNumber(),
        createdAt: new Date().toISOString(),
        encodedBy: roleLabel || "CSG/Governor",
        studentId: selectedRow.studentId,
        studentName: selectedRow.studentName,
        course: formatCourseWithMajor(selectedRow.course, selectedRow.major ?? null),
        year: selectedRow.year,
        previousBalance: response?.previousBalance ?? previousBalance,
        amountPaid: response?.amountPaid ?? roundedAmount,
        newBalance: response?.newBalance ?? newBalance,
        note: "",
      });
      setIsPaymentEditMode(false);
      setRemainingBalanceInput("");
      setShowPaymentModal(false);
      setPaymentError("");
    } catch (error) {
      setPaymentError(error?.response?.data?.message || "Unable to save payment right now.");
    }
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

  const createReceiptFromSelectedRow = (row) => {
    if (!row) return null;
    const previousBalance = Math.max(0, (Number(row.remaining) || 0) + (Number(row.paidAmount) || 0));
    return {
      receiptNo: makeReceiptNumber(),
      createdAt: new Date().toISOString(),
      encodedBy: roleLabel || "CSG/Governor",
      studentId: row.studentId,
      studentName: row.studentName,
      course: formatCourseWithMajor(row.course, row.major ?? null),
      year: row.year,
      previousBalance,
      amountPaid: Number(row.paidAmount) || 0,
      newBalance: Number(row.remaining) || 0,
      note: "",
    };
  };

  const openEditFineModal = (event) => {
    if (!modalStudent) return;
    setEditingFine({
      studentId: modalStudent.studentId,
      eventId: event.id,
      fineId: event.fineId ?? null,
      eventName: event.name,
    });
    setEditFineAmountInput(String(Number(event.fine) || 0));
    setEditFineError("");
  };

  const exportPaymentsCsv = () => {
    const header = ["Student ID", "Student Name", "Course", "Year", "Total Events", "Total Fine", "Paid Amount", "Remaining", "Status"];
    const body = exportFilteredRows.map((row) => [
      `"${row.studentId}"`,
      `"${String(row.studentName || "").replace(/"/g, '""')}"`,
      `"${String(row.courseDisplay || row.course || "").replace(/"/g, '""')}"`,
      `"${String(row.year ?? "")}"`,
      String(row.totalEvents ?? row.events?.length ?? 0),
      String(Number(row.totalFine) || 0),
      String(Number(row.paidAmount) || 0),
      String(Number(row.remaining) || 0),
      `"${row.status}"`,
    ]);
    downloadTextFile(
      `payments-${new Date().toISOString().slice(0, 10)}.csv`,
      [header.join(","), ...body.map((r) => r.join(","))].join("\n"),
    );
  };

  const mockPdfExport = () => {
    window.alert("Mock: PDF report would be generated for current payment filters.");
  };

  const handleSaveFineEdit = async () => {
    if (!editingFine) return;
    const amount = parseMoneyInput(editFineAmountInput);
    if (!Number.isFinite(amount) || amount < 0) {
      setEditFineError("Fine amount must be zero or higher.");
      return;
    }
    const rounded = Math.round(amount * 100) / 100;
    if (!editingFine.fineId) {
      setEditFineError("Fine cannot be edited because fine id is missing.");
      return;
    }
    try {
      await updateFineAmountMutation.mutateAsync({ fineId: editingFine.fineId, amount: rounded });
      setEditingFine(null);
      setEditFineError("");
    } catch (error) {
      setEditFineError(error?.response?.data?.message || "Unable to update fine amount.");
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50 [&_button]:cursor-pointer">
      <aside className="sticky top-0 h-screen max-h-screen w-64 shrink-0 self-start overflow-y-auto bg-[#07713C] text-white flex flex-col">
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
            { id: "events", label: "Manage Event" },
            ...(role === "admin" ? [{ id: "import", label: "Import" }, { id: "users", label: "Users" }] : []),
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
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-[#07713c]/30 px-6 py-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[30px] font-extrabold font-[Inter,sans-serif] text-[#07713c] leading-tight">Payments</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setExportOpen(true)}
              className="rounded-lg border border-[#07713c] bg-[#07713c]/10 px-3 py-2 text-sm font-medium text-[#07713c] hover:bg-[#07713c]/15"
            >
              Export / Reports
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLogout((prev) => !prev)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[#07713c] hover:bg-[#07713c]/10"
                aria-label="Account menu"
                aria-expanded={showLogout}
                aria-haspopup="true"
                title="Profile"
              >
                <UserCircleIcon />
              </button>
              {showLogout && (
                <div className="absolute right-0 top-full mt-1 min-w-[100px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setShowLogout(false);
                      onLogout?.();
                    }}
                    className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
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
              <p className="text-2xl font-bold text-[#07713c]">{studentsWithBalance}</p>
              <p className="text-sm font-medium text-[#07713c]">Students with Balance</p>
            </div>
          </div>

          <section className="bg-white rounded-lg border border-[#07713c]/30 shadow-sm overflow-hidden">
              <div className="px-4 pt-4">
                <h2 className="text-lg font-bold text-[#07713c]">Students</h2>
              </div>
              <div className="p-4 border-b border-[#07713c]/30 flex flex-wrap gap-3 items-end">
                <div className="relative min-w-[240px] flex-1">
                  <SearchMagnifierIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#07713c]" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search student, ID, course, major, event"
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
                    className="px-4 py-2 border border-[#07713c]/40 rounded-lg text-sm focus:outline-none focus:ring-0 focus:border-[#07713c]/40"
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
                <table className="w-full min-w-[1080px] table-fixed border-collapse text-sm">
                  <thead className="border-b border-[#07713c]/30 bg-[#07713c]">
                    <tr>
                      <th className="w-[22%] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white">Student</th>
                      <th className="w-[15%] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white">Course</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-white">Year</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-white">Total Events</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-white">Total Fine</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-white">Remaining</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-white">Status</th>
                      <th className="min-w-[104px] px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide text-white">Attendance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isPaymentsLoading ? (
                      <tr>
                        <td colSpan={8} className="py-8 px-4 text-center text-[#07713c]/85 text-sm">Loading payment records...</td>
                      </tr>
                    ) : isPaymentsError ? (
                      <tr>
                        <td colSpan={8} className="py-8 px-4 text-center text-red-700 text-sm">Unable to load payment records right now.</td>
                      </tr>
                    ) : paginatedStudents.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 px-4 text-center text-[#07713c]/85 text-sm">No payment records found for this filter.</td>
                      </tr>
                    ) : (
                      paginatedStudents.map((row) => (
                        <tr
                          key={row.studentId}
                          onClick={() => openRecordPaymentModal(row)}
                          className={`cursor-pointer border-b border-[#07713c]/15 ${
                            selectedRow?.studentId === row.studentId ? "bg-[#07713c]/10" : "hover:bg-[#07713c]/[0.04]"
                          }`}
                        >
                          <td
                            className="py-3 px-3 overflow-hidden"
                            onMouseEnter={(e) => {
                              cancelHide();
                              scheduleShow(row.studentId, e.clientX + 10, e.clientY + 10);
                            }}
                            onMouseLeave={scheduleHide}
                          >
                            <p
                              className="truncate font-medium whitespace-nowrap text-[#07713c] hover:underline underline-offset-2 decoration-[#07713c]"
                              title={row.studentName}
                            >
                              {row.studentName}
                            </p>
                          </td>
                          <td className="py-3 px-3 overflow-hidden">
                            <p
                              className="truncate font-medium whitespace-nowrap text-[#07713c] hover:underline underline-offset-2 decoration-[#07713c]"
                              title={row.courseDisplay}
                            >
                              {row.courseDisplay}
                            </p>
                          </td>
                          <td className="py-3 px-3 overflow-hidden">
                            <div className="flex justify-center">
                              <p
                                className="min-w-0 truncate font-medium whitespace-nowrap tabular-nums text-[#07713c] hover:underline underline-offset-2 decoration-[#07713c]"
                                title={String(row.year ?? "")}
                              >
                                {row.year}
                              </p>
                            </div>
                          </td>
                          <td className="py-3 px-3 overflow-hidden">
                            <div className="flex justify-center">
                              <p
                                className="min-w-0 truncate font-medium whitespace-nowrap tabular-nums text-[#07713c] hover:underline underline-offset-2 decoration-[#07713c]"
                                title={String(row.totalEvents ?? row.events?.length ?? "")}
                              >
                                {row.totalEvents ?? row.events.length}
                              </p>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center font-medium tabular-nums text-red-700">{formatPhp(row.totalFine)}</td>
                          <td className="py-3 px-3 text-center font-medium tabular-nums text-red-700">{formatPhp(row.remaining)}</td>
                          <td className="py-3 px-3 text-center">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass(row.status)}`}>{row.status}</span>
                          </td>
                          <td className="py-3 px-2 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStudentId(row.studentId);
                                setModalStudentId(row.studentId);
                              }}
                              className="rounded-lg border border-[#07713c]/40 bg-white px-2.5 py-0.5 text-xs font-medium text-[#07713c] hover:bg-[#07713c]/[0.04] focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]"
                            >
                              Select
                            </button>
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
          <div className="mt-2 flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => setModalStudentId(hoverStudent.studentId)}
              className="w-full rounded-lg bg-[#07713c] px-3 py-2 text-xs font-medium text-white hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-[#07713c]/40"
            >
              View Attendance
            </button>
            <button
              type="button"
              onClick={() => {
                openRecordPaymentModal(hoverStudent);
                setHoverCard(null);
              }}
              className="w-full rounded-lg border border-[#07713c]/40 px-3 py-2 text-xs font-medium text-[#07713c] hover:bg-[#07713c]/10"
            >
              Select
            </button>
          </div>
        </div>
      )}

      {modalStudent && (
        <div className="fixed inset-0 z-[61] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-[92rem] rounded-2xl bg-white shadow-2xl overflow-hidden">
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
            <div className="max-h-[75vh] overflow-y-auto p-4 [scrollbar-width:thin] [scrollbar-color:rgba(7,113,60,0.28)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#07713c]/30 [&::-webkit-scrollbar-thumb]:hover:bg-[#07713c]/40 [&::-webkit-scrollbar-track]:bg-transparent">
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
              <div className="overflow-x-auto [scrollbar-width:thin] [scrollbar-color:rgba(7,113,60,0.28)_transparent] [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#07713c]/30 [&::-webkit-scrollbar-thumb]:hover:bg-[#07713c]/40 [&::-webkit-scrollbar-track]:bg-transparent">
                <div className="rounded-lg border border-[#07713c]/30 overflow-hidden">
                  <table className="w-full min-w-[980px] table-fixed text-sm">
                    <thead className="border-b border-[#07713c]/30 bg-gray-50 text-center text-xs font-medium text-[#07713c]">
                    <tr>
                      <th className={`border-r border-[#07713c]/30 px-4 py-2 align-bottom whitespace-nowrap text-left ${eventNameHeaderWidthClass}`}>Event name</th>
                      <th className="border-r border-[#07713c]/30 pl-4 pr-6 py-2 align-bottom whitespace-nowrap">Date</th>
                      <th className="border-r border-[#07713c]/30 px-4 py-2 align-bottom whitespace-nowrap">Session</th>
                      <th className="border-r border-[#07713c]/30 px-3 py-2 align-bottom text-center whitespace-nowrap">Status</th>
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
                          <td className="border-r border-[#07713c]/30 pl-4 pr-6 py-2.5 text-center whitespace-nowrap text-[#07713c]">{formatEventDateForDisplay(event.date)}</td>
                          <td className="border-r border-[#07713c]/30 px-4 py-2.5 text-center whitespace-nowrap text-[#07713c]">{sessionLabel(event.sessionKind)}</td>
                          <td className="border-r border-[#07713c]/30 px-3 py-2.5 text-center whitespace-nowrap">
                            {getEventAttendanceStatus(event) === "Attended" ? (
                              <span className="inline-flex rounded-full bg-[#07713c]/10 px-2.5 py-0.5 text-xs font-medium text-[#07713c]">
                                Attended
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                                Absent
                              </span>
                            )}
                          </td>
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 bg-[#07713C] px-5 py-3">
              <h3 className="min-w-0 text-xl font-semibold text-white">Payment</h3>
              <button
                type="button"
                onClick={() => {
                  setShowPaymentModal(false);
                  setIsPaymentEditMode(false);
                  setRemainingBalanceInput("");
                }}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-yellow-300 text-[#07713c] hover:bg-yellow-400"
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
                    <p><span className="font-semibold">Course:</span> {selectedRow.courseDisplay}</p>
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
        <div className="fixed inset-0 z-[54] flex items-center justify-center bg-black/40 px-4">
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

      {exportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-[#07713c]">Export / reports</h3>
            <p className="mt-2 text-sm text-[#07713c]">
              Apply filters below for export.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-[#07713c] sm:col-span-2">
                Search
                <input
                  type="search"
                  value={exportSearch}
                  onChange={(e) => setExportSearch(e.target.value)}
                  placeholder="Search student, ID, course, major, event"
                  className="h-9 rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm text-[#07713c] placeholder:text-[#07713c]/45 focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-[#07713c]">
                Status
                <select
                  value={exportStatusFilter}
                  onChange={(e) => setExportStatusFilter(e.target.value)}
                  className="h-9 rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                >
                  <option>All</option>
                  <option>Unpaid</option>
                  <option>Partial</option>
                  <option>Paid</option>
                  <option>Waived</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-[#07713c]">
                College
                <select
                  value={exportCollegeFilter}
                  onChange={(e) => setExportCollegeFilter(e.target.value)}
                  className="h-9 rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                >
                  <option value="all">All colleges</option>
                  {exportCollegeOptions.map((college) => (
                    <option key={college} value={college}>
                      {college}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-[#07713c]">
                Course
                <select
                  value={exportCourseFilter}
                  onChange={(e) => setExportCourseFilter(e.target.value)}
                  className="h-9 rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                >
                  <option value="all">All courses</option>
                  {exportCourseOptions.map((course) => (
                    <option key={course} value={course}>
                      {course}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-[#07713c]">
                Year
                <select
                  value={exportYearFilter}
                  onChange={(e) => setExportYearFilter(e.target.value)}
                  className="h-9 rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                >
                  <option value="all">All years</option>
                  {exportYearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-[#07713c]">
                Balance
                <select
                  value={exportBalanceFilter}
                  onChange={(e) => setExportBalanceFilter(e.target.value)}
                  className="h-9 rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                >
                  <option value="all">All balances</option>
                  <option value="with_balance">With balance</option>
                  <option value="zero_balance">Zero balance</option>
                </select>
              </label>
            </div>
            <p className="mt-3 text-xs text-[#07713c]/85">
              {exportFilteredRows.length} student record(s) will be exported.
            </p>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => {
                  exportPaymentsCsv();
                  setExportOpen(false);
                }}
                className="w-full rounded-lg bg-[#07713c] px-4 py-2.5 text-sm font-medium text-white hover:brightness-95"
              >
                Export CSV — filtered payments
              </button>
              <button
                type="button"
                onClick={() => {
                  mockPdfExport();
                  setExportOpen(false);
                }}
                className="w-full rounded-lg border border-[#07713c]/40 px-4 py-2.5 text-sm font-medium text-[#07713c] hover:bg-[#07713c]/10"
              >
                Export PDF (mock)
              </button>
              <button
                type="button"
                onClick={() => {
                  setExportSearch(search);
                  setExportStatusFilter(statusFilter);
                  setExportCollegeFilter("all");
                  setExportCourseFilter("all");
                  setExportYearFilter("all");
                  setExportBalanceFilter("all");
                }}
                className="w-full rounded-lg border border-[#07713c]/30 px-4 py-2 text-sm font-medium text-[#07713c] hover:bg-[#07713c]/8"
              >
                Reset export filters
              </button>
            </div>
            <button
              type="button"
              onClick={() => setExportOpen(false)}
              className="mt-4 w-full rounded-lg border border-[#07713c]/30 py-2 text-sm text-[#07713c] hover:bg-[#07713c]/10"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
