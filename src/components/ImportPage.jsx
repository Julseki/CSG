import { useMemo, useRef, useState } from "react";
import SidebarNavIcon from "./SidebarNavIcon";
import UserCircleIcon from "./UserCircleIcon";
import PaginationBar from "./PaginationBar";
import { getAppNavItems } from "../utils/appNav";
import { getDashboardRoleLabel } from "../utils/roles";
import { useGovernorScope } from "../hooks/useGovernorScope";
import { useImportStudentsCsv } from "../hooks/useImportStudentsCsv";
import {
  detectStudentCsvFormat,
  STUDENT_CSV_OPTIONAL_LEGACY_HEADERS,
  validateStudentCsvHeaders,
} from "../utils/studentCsvImport";

function parseCsvPreview(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };
  const split = (line) => {
    const values = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        const next = line[i + 1];
        if (inQuotes && next === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (ch === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
        continue;
      }
      current += ch;
    }
    values.push(current.trim());
    return values;
  };
  const rawHeaders = split(lines[0]);
  let lastNonEmptyHeaderIndex = rawHeaders.length - 1;
  while (lastNonEmptyHeaderIndex >= 0 && !String(rawHeaders[lastNonEmptyHeaderIndex] || "").trim()) {
    lastNonEmptyHeaderIndex -= 1;
  }
  const maxColumns = Math.max(lastNonEmptyHeaderIndex + 1, 0);
  const headers = rawHeaders.slice(0, maxColumns);
  const rows = lines.slice(1).map((line) => split(line).slice(0, maxColumns));

  return { headers, rows };
}

export default function ImportPage({ onNavigate, onLogout }) {
  const { role, isGovernor, governorScope } = useGovernorScope();
  const roleLabel = getDashboardRoleLabel(isGovernor, governorScope, role);
  const isAdmin = String(role || "").toLowerCase().trim() === "admin";
  const [showLogout, setShowLogout] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportMode, setReportMode] = useState("export");
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);
  const [previewText, setPreviewText] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [existingStudentsPage, setExistingStudentsPage] = useState(1);
  const importMutation = useImportStudentsCsv();
  const EXISTING_STUDENTS_PAGE_SIZE = 20;

  const navItems = getAppNavItems({ isAdmin });

  const preview = useMemo(() => parseCsvPreview(previewText), [previewText]);
  const headerValidation = useMemo(
    () => validateStudentCsvHeaders(preview.headers, preview.rows.length),
    [preview.headers, preview.rows.length],
  );
  const detectedFormat = useMemo(
    () => detectStudentCsvFormat(preview.headers),
    [preview.headers],
  );
  const existingStudents = result?.existingStudents ?? [];
  const existingStudentsTotalPages = Math.max(
    1,
    Math.ceil(existingStudents.length / EXISTING_STUDENTS_PAGE_SIZE) || 1,
  );
  const safeExistingStudentsPage = Math.min(existingStudentsPage, existingStudentsTotalPages);
  const paginatedExistingStudents = useMemo(() => {
    const start = (safeExistingStudentsPage - 1) * EXISTING_STUDENTS_PAGE_SIZE;
    return existingStudents.slice(start, start + EXISTING_STUDENTS_PAGE_SIZE);
  }, [existingStudents, safeExistingStudentsPage]);

  const onFileChange = async (event) => {
    setResult(null);
    setError("");
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    if (!file) {
      setPreviewText("");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please select a .csv file.");
      setPreviewText("");
      return;
    }
    const text = await file.text();
    setPreviewText(text);
  };

  const onImport = () => {
    const fallbackFile = fileInputRef.current?.files?.[0] ?? null;
    const fileToImport = selectedFile ?? fallbackFile;
    if (!fileToImport) {
      setError("");
      fileInputRef.current?.click();
      return;
    }
    if (!headerValidation.valid) {
      setError(headerValidation.message || "CSV is empty.");
      return;
    }
    setError("");
    setResult(null);
    setExistingStudentsPage(1);
    importMutation.mutate(fileToImport, {
      onSuccess: (data) => setResult(data),
      onError: (err) => {
        setError(err?.response?.data?.message || "Import failed.");
      },
      onSettled: () => {
        setSelectedFile(null);
        setPreviewText("");
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
    });
  };

  return (
    <div className="flex min-h-screen bg-gray-50 [&_button]:cursor-pointer">
      <aside className="sticky top-0 h-screen max-h-screen w-64 shrink-0 self-start overflow-y-auto bg-[#07713C] text-white flex flex-col">
        <div className="p-6 space-y-4">
          <img src="/logo.png" alt="NMCI" className="w-16 h-16 rounded-full bg-white/10 object-contain mx-auto" />
          <p className="text-xs text-center font-medium uppercase tracking-wider font-[Inter,sans-serif]">
            Northern Mindanao Colleges, Inc.
          </p>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate?.(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm font-medium transition-colors ${
                item.id === "import" ? "bg-[#055a2e] text-white" : "text-green-100 hover:bg-white/15"
              }`}
            >
              <SidebarNavIcon navId={item.id} />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h1 className="text-[30px] font-extrabold font-[Inter,sans-serif] text-[#07713c] leading-tight">
            Import Students CSV
          </h1>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLogout((prev) => !prev)}
                className="inline-flex h-11 w-11 items-center justify-center text-[#07713c] rounded-lg hover:bg-green-50"
                aria-label="Account menu"
              >
                <UserCircleIcon />
              </button>
              {showLogout && (
                <div className="absolute right-0 top-full mt-1 py-1 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[100px] z-10">
                  <button
                    type="button"
                    onClick={() => {
                      setShowLogout(false);
                      onLogout();
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
          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
              <p className="text-sm text-gray-700">
                Upload a student CSV. Use the new 4-column format, or include legacy columns when you have program and department data.
              </p>
              <div className="rounded-lg border border-green-100 bg-green-50/60 px-3 py-2 text-xs text-gray-700 space-y-1">
                <p>
                  <span className="font-semibold text-[#07713c]">Imports all rows</span> — duplicates are updated, and
                  missing fields are left empty when not provided.
                </p>
                <p>
                  <span className="font-semibold text-gray-600">Typical columns:</span>{" "}
                  <code className="text-[11px]">id_number</code>, <code className="text-[11px]">rfid</code>,{" "}
                  <code className="text-[11px]">full_name</code>, <code className="text-[11px]">level</code>
                </p>
                <p>
                  <span className="font-semibold text-gray-600">Also supported (optional):</span>{" "}
                  {STUDENT_CSV_OPTIONAL_LEGACY_HEADERS.join(", ")}.
                </p>
              </div>
              {preview.headers.length > 0 && headerValidation.valid && (
                <p className="text-xs text-green-700">
                  Ready to import {preview.rows.length} row(s) ({detectedFormat} mapping).
                </p>
              )}
              {preview.headers.length > 0 && !headerValidation.valid && (
                <p className="text-xs text-red-600">{headerValidation.message}</p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={onFileChange}
                className="block w-full text-sm"
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onImport}
                  disabled={importMutation.isPending}
                  className="rounded-lg bg-[#07713c] text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
                >
                  {importMutation.isPending ? "Importing..." : "Start Import"}
                </button>
                {selectedFile && (
                  <p className="text-xs text-gray-500">
                    Selected: <span className="font-medium">{selectedFile.name}</span>
                  </p>
                )}
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <p className="text-xs text-gray-500">Role: {roleLabel}</p>
            </div>

            {preview.headers.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">CSV Preview</h3>
                <p className="mb-3 text-xs text-gray-600">Total students in CSV: {preview.rows.length}</p>
                <div className="overflow-auto">
                  <table className="min-w-full text-xs border-collapse">
                    <thead>
                      <tr>
                        {preview.headers.map((header, idx) => (
                          <th key={`${header}-${idx}`} className="border px-2 py-1 text-left bg-gray-50">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row, rowIdx) => (
                        <tr key={`preview-row-${rowIdx}`}>
                          {preview.headers.map((_, colIdx) => (
                            <td key={`cell-${rowIdx}-${colIdx}`} className="border px-2 py-1">
                              {row[colIdx] || ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {result && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-5">
                <h3 className="text-sm font-semibold text-green-800 mb-2">Import Summary</h3>
                <p className="text-sm text-green-900">Processed: {result.processedRows}</p>
                <p className="text-sm text-green-900">Imported: {result.importedRows}</p>
                <p className="text-sm text-green-900">Skipped: {result.skippedRows}</p>
                <p className="text-sm text-green-900">
                  Inserted - Departments: {result.inserted?.departments ?? 0}, Programs: {result.inserted?.programs ?? 0}, Students:{" "}
                  {result.inserted?.students ?? 0}, Enrollments: {result.inserted?.enrollments ?? 0}
                </p>
                {(result.errors?.length ?? 0) > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-red-700">Row Errors</p>
                    <ul className="text-xs text-red-700 list-disc pl-5">
                      {result.errors.slice(0, 15).map((item, idx) => (
                        <li key={`${item.row}-${idx}`}>Row {item.row}: {item.message}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {(result.skipped?.length ?? 0) > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-amber-700">Skipped Rows and Reasons</p>
                    <ul className="text-xs text-amber-700 list-disc pl-5">
                      {result.skipped.slice(0, 50).map((item, idx) => (
                        <li key={`skip-${item.row}-${idx}`}>Row {item.row}: {item.reason}</li>
                      ))}
                    </ul>
                    {result.skipped.length > 50 && (
                      <p className="mt-1 text-[11px] text-amber-700">Showing first 50 skipped rows.</p>
                    )}
                  </div>
                )}
                {(result.existingStudents?.length ?? 0) > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-blue-700">Updated Existing Students (still imported)</p>
                    <div className="mt-2 overflow-auto rounded-lg border border-blue-200 bg-white">
                      <table className="min-w-full border-collapse text-[11px] text-blue-900">
                        <thead className="bg-blue-50">
                          <tr>
                            <th className="border border-blue-200 px-2 py-1 text-left font-semibold">Row</th>
                            <th className="border border-blue-200 px-2 py-1 text-left font-semibold">Student ID</th>
                            <th className="border border-blue-200 px-2 py-1 text-left font-semibold">Full Name</th>
                            <th className="border border-blue-200 px-2 py-1 text-left font-semibold">RFID</th>
                            <th className="border border-blue-200 px-2 py-1 text-left font-semibold">Level</th>
                            <th className="border border-blue-200 px-2 py-1 text-left font-semibold">Department(s)</th>
                            <th className="border border-blue-200 px-2 py-1 text-left font-semibold">Major(s)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedExistingStudents.map((item, idx) => (
                            <tr key={`existing-${item.row}-${item.studentId}-${idx}`} className="odd:bg-white even:bg-blue-50/30">
                              <td className="border border-blue-100 px-2 py-1 align-top">{item.row}</td>
                              <td className="border border-blue-100 px-2 py-1 align-top font-medium">{item.studentId}</td>
                              <td className="border border-blue-100 px-2 py-1 align-top">{item.fullName}</td>
                              <td className="border border-blue-100 px-2 py-1 align-top">{item.rfid || "—"}</td>
                              <td className="border border-blue-100 px-2 py-1 align-top">{item.yearLevelLabel || item.yearLevel || "—"}</td>
                              <td className="border border-blue-100 px-2 py-1 align-top">{item.departments || "N/A"}</td>
                              <td className="border border-blue-100 px-2 py-1 align-top">{item.majors || "No major"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <PaginationBar
                      totalCount={existingStudents.length}
                      page={safeExistingStudentsPage}
                      pageSize={EXISTING_STUDENTS_PAGE_SIZE}
                      onPageChange={setExistingStudentsPage}
                      itemLabel="existing students"
                      className="border-blue-200 text-blue-800"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-[#07713c] px-5 py-3">
              <h3 className="text-white font-semibold">
                {reportMode === "settings"
                  ? `${roleLabel} Settings`
                  : reportMode === "import"
                    ? "Import Data"
                    : "Export Data"}
              </h3>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <p className="text-gray-600">
                {reportMode === "settings"
                  ? "Settings are not implemented yet (this is a placeholder)."
                  : reportMode === "import"
                    ? "Use the Import page main section to upload and import CSV."
                    : "Export is not implemented in Import page yet."}
              </p>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
