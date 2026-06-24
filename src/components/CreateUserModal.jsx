import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import api from "../api/axiosInstance";
import { useAuthSession } from "../hooks/auth";

/** Create User modal content text. */
const CREATE_USER_TEXT = "text-black";

function useCreateUserDebugMutation() {
  return useMutation({
    mutationFn: async ({
      username,
      fullName,
      password,
      department,
      major,
      role = "department",
    }) => {
      const requestBody = {
        username,
        fullName,
        password,
        department,
        major,
        role,
      };

      // Debug logging: show exactly what we're sending (mask password for safety).
      console.log("[CreateUserModal] POST /signup request body:", {
        ...requestBody,
        password: requestBody.password ? "[REDACTED]" : requestBody.password,
      });
      console.log(
        "[CreateUserModal] password length:",
        requestBody.password?.length ?? 0,
      );

      const response = await api.post("/create-account", requestBody);
      return response.data;
    },
  });
}

const DEPARTMENT_OPTIONS = [
  {
    value: "College of Information Technology",
    code: "BSIT",
    majors: [],
  },
  {
    value: "College of Business Administration",
    code: "CBA",
    majors: [
      "Marketing Management",
      "Financial Management",
      "Human Resource Management",
    ],
  },
  {
    value: "College of Education, Arts and Sciences",
    code: "CEAS",
    majors: ["English", "Filipino", "Mathematics", "BEED"],
  },
  {
    value: "College of Criminal Justice Education",
    code: "CCJE",
    majors: [],
  },
  {
    value: "College of Hospitality Management",
    code: "CHM",
    majors: [],
  },
];

/** Governor role sent to API — keyed by `code` on each DEPARTMENT_OPTIONS row (avoids label typos). */
const DEPARTMENT_CODE_TO_GOVERNOR_ROLE = {
  BSIT: "it_governor",
  CBA: "cba_governor",
  CEAS: "ceas_governor",
  CCJE: "coc_governor",
  CHM: "chm_governor",
};

const DEPARTMENT_USERNAME_BASE = {
  "College of Information Technology": "gov-IT",
  "College of Business Administration": "gov-CBA",
  "College of Education, Arts and Sciences": "gov-CEAS",
  "College of Criminology": "gov-CRIM",
  "College of Criminal Justice Education": "gov-CRIM",
  "College of Hospitality Management": "gov-CHM",
};

const ROLE_DEPARTMENT_MAP = {
  it_governor: "College of Information Technology",
  cba_governor: "College of Business Administration",
  ceas_governor: "College of Education, Arts and Sciences",
  coc_governor: "College of Criminal Justice Education",
  chm_governor: "College of Hospitality Management",
};

export default function CreateUserModal({ open, onClose }) {
  const { data: session } = useAuthSession();
  const [createUserError, setCreateUserError] = useState("");
  const [createdAccount, setCreatedAccount] = useState(null);

  const [createUserForm, setCreateUserForm] = useState({
    fullName: "",
    department: "",
    major: "",
    username: "",
    password: "",
    confirmPassword: "",
    accountType: "department",
  });

  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showCreateConfirmPassword, setShowCreateConfirmPassword] =
    useState(false);

  const selectedDepartment = useMemo(
    () =>
      DEPARTMENT_OPTIONS.find(
        (item) => item.value === createUserForm.department,
      ),
    [createUserForm.department],
  );

  const majorOptions = selectedDepartment?.majors || [];

  const currentRole = String(
    session?.role ??
      session?.user?.role ??
      session?.data?.role ??
      session?.profile?.role ??
      "",
  )
    .toLowerCase()
    .trim();
  const governorDepartmentFromRole = ROLE_DEPARTMENT_MAP[currentRole] ?? "";
  const isGovernorLoggedIn = !!governorDepartmentFromRole;

  const resetForOpen = () => {
    setCreateUserError("");
    setCreatedAccount(null);
    setShowCreatePassword(false);
    setShowCreateConfirmPassword(false);
    setCreateUserForm({
      fullName: "",
      department: "",
      major: "",
      username: "",
      password: "",
      confirmPassword: "",
      accountType: "department",
    });
  };

  useEffect(() => {
    if (!open) return;
    resetForOpen();
  }, [open]);

  useEffect(() => {
    if (!open || !isGovernorLoggedIn) return;
    setCreateUserForm((prev) => ({
      ...prev,
      accountType: "department",
      department: governorDepartmentFromRole,
      major: "",
      username: "",
    }));
  }, [open, isGovernorLoggedIn, governorDepartmentFromRole]);

  const isPasswordValid = !createUserForm.password
    ? false
    : createUserForm.password.length >= 6;
  const doPasswordsMatch =
    !createUserForm.password ||
    !createUserForm.confirmPassword ||
    createUserForm.password === createUserForm.confirmPassword;

  const normalizedDepartment = createUserForm.department
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const normalizedMajor = createUserForm.major
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const usernameValue = createUserForm.username.trim();

  const generatedPassword = useMemo(() => {
    // For consistency with your current backend signup flow, admin can set password manually.
    return "";
  }, []);

  const passwordValue = createUserForm.password || "";

  const requiresMajor = useMemo(() => {
    if (createUserForm.accountType === "csg_president") return false;
    if (!isGovernorLoggedIn) return false;
    return majorOptions.length > 0;
  }, [createUserForm.accountType, majorOptions.length, isGovernorLoggedIn]);

  const { mutate: createUser, isPending: isCreatingUser } =
    useCreateUserDebugMutation();

  const isCreateDisabled =
    isCreatingUser ||
    !createUserForm.fullName.trim() ||
    !createUserForm.username.trim() ||
    !passwordValue ||
    !doPasswordsMatch ||
    !isPasswordValid ||
    (requiresMajor && !createUserForm.major.trim());

  const DEPARTMENT_ROLE_MAP = {
    "College of Information Technology": "it_governor",
    "College of Business Administration": "cba_governor",
    "College of Education, Arts and Sciences": "ceas_governor",
    "College of Criminology": "coc_governor",
    "College of Criminal Justice Education": "coc_governor",
    "College of Hospitality Management": "chm_governor",
  };

  const roleToSend =
    createUserForm.accountType === "csg_president"
      ? "csg_president"
      : (selectedDepartment?.code &&
          DEPARTMENT_CODE_TO_GOVERNOR_ROLE[selectedDepartment.code]) ||
        DEPARTMENT_ROLE_MAP[createUserForm.department] ||
        "department";

  const resetForm = () => {
    setCreateUserError("");
    setCreatedAccount(null);
    setCreateUserForm({
      fullName: "",
      department: "",
      major: "",
      username: "",
      password: "",
      confirmPassword: "",
      accountType: "department",
    });
    setShowCreatePassword(false);
    setShowCreateConfirmPassword(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="border-b border-[#07713c]/30 bg-[#07713c]/10 px-5 py-3">
          <h3 className="font-semibold text-black">Create User</h3>
        </div>
        <form
          className={`${CREATE_USER_TEXT} p-5 space-y-4 text-sm`}
          onSubmit={(e) => {
            e.preventDefault();
            setCreateUserError("");
            setCreatedAccount(null);

            if (createUserForm.accountType !== "csg_president") {
              if (!createUserForm.department.trim()) {
                setCreateUserError("Department is required.");
                return;
              }
              if (requiresMajor && !createUserForm.major.trim()) {
                setCreateUserError(
                  "Major is required for the selected department.",
                );
                return;
              }
            }

            if (!createUserForm.fullName.trim()) {
              setCreateUserError("Full name is required.");
              return;
            }

            if (!usernameValue) {
              setCreateUserError("Username is required.");
              return;
            }

            if (
              !createUserForm.password ||
              createUserForm.password.length < 6
            ) {
              setCreateUserError("Password must be at least 6 characters.");
              return;
            }

            if (createUserForm.password !== createUserForm.confirmPassword) {
              setCreateUserError("Password and confirm password do not match.");
              return;
            }

            createUser(
              {
                username: usernameValue,
                fullName: createUserForm.fullName.trim(),
                password: createUserForm.password,
                department:
                  createUserForm.accountType === "csg_president"
                    ? ""
                    : createUserForm.department.trim(),
                major:
                  createUserForm.accountType === "csg_president"
                    ? ""
                    : isGovernorLoggedIn && requiresMajor
                      ? createUserForm.major.trim()
                      : "",
                role: roleToSend,
              },
              {
                onSuccess: () => {
                  setCreatedAccount({
                    username: usernameValue,
                    role: roleToSend,
                  });
                  setCreateUserForm((prev) => ({
                    ...prev,
                    password: "",
                    confirmPassword: "",
                  }));
                  setShowCreatePassword(false);
                  setShowCreateConfirmPassword(false);
                },
                onError: (err) => {
                  setCreateUserError(
                    err?.response?.data?.message || "Failed to create user.",
                  );
                },
              },
            );
          }}
        >
          {createUserError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-xs text-black">
              {createUserError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-black mb-1">
                Account Type
              </label>
              <select
                value={createUserForm.accountType}
                disabled={isGovernorLoggedIn}
                onChange={(e) => {
                  const nextType = e.target.value;
                  setCreateUserForm((prev) => ({
                    ...prev,
                    accountType: nextType,
                    ...(nextType === "csg_president"
                      ? { department: "", major: "" }
                      : null),
                  }));
                }}
                className="w-full rounded-lg border border-[#07713c]/40 bg-white px-3 py-2 text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c] disabled:bg-gray-100"
              >
                <option value="department">Department User</option>
                <option value="csg_president">CSG President</option>
              </select>
            </div>

            {createUserForm.accountType !== "csg_president" && (
              <>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Department
                  </label>
                  {isGovernorLoggedIn ? (
                    <div className="w-full rounded-lg border border-[#07713c]/30 bg-gray-100 px-3 py-2 text-sm text-black/70">
                      {governorDepartmentFromRole}
                    </div>
                  ) : (
                    <select
                      value={createUserForm.department}
                      onChange={(e) =>
                        setCreateUserForm((prev) => ({
                          ...prev,
                          department: e.target.value,
                          major: "",
                        }))
                      }
                      className="w-full rounded-lg border border-[#07713c]/40 bg-white px-3 py-2 text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]"
                    >
                      <option value="">Select Department</option>
                      {DEPARTMENT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.value}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {isGovernorLoggedIn && (
                  <div>
                    <label className="block text-xs font-medium text-black mb-1">
                      Major
                    </label>
                    <select
                      value={createUserForm.major}
                      onChange={(e) =>
                        setCreateUserForm((prev) => ({
                          ...prev,
                          major: e.target.value,
                        }))
                      }
                      disabled={
                        !createUserForm.department || majorOptions.length === 0
                      }
                      className="w-full rounded-lg border border-[#07713c]/40 bg-white px-3 py-2 text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c] disabled:bg-gray-100"
                    >
                      <option value="">
                        {createUserForm.department && majorOptions.length === 0
                          ? "No Major Required"
                          : createUserForm.department
                            ? "Select Major"
                            : "Select Department First"}
                      </option>
                      {majorOptions.map((major) => (
                        <option key={major} value={major}>
                          {major}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-black mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showCreatePassword ? "text" : "password"}
                  value={createUserForm.password}
                  onChange={(e) =>
                    setCreateUserForm((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
                  className={`w-full rounded-lg border px-3 py-2 pr-14 text-sm text-black placeholder:text-black/45 bg-white focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c] ${
                    !createUserForm.password
                      ? "border-[#07713c]/40"
                      : isPasswordValid
                        ? "border-[#07713c]/40"
                        : "border-red-400"
                  }`}
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePassword((prev) => !prev)}
                  className="absolute inset-y-0 right-3 text-[11px] text-black hover:text-black/70"
                >
                  {showCreatePassword ? "Hide" : "Show"}
                </button>
              </div>
              {createUserForm.password && !isPasswordValid && (
                <p className="text-[11px] text-black mt-1">
                  Password must be at least 6 characters.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-black mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showCreateConfirmPassword ? "text" : "password"}
                  value={createUserForm.confirmPassword}
                  onChange={(e) =>
                    setCreateUserForm((prev) => ({
                      ...prev,
                      confirmPassword: e.target.value,
                    }))
                  }
                  className={`w-full rounded-lg border px-3 py-2 pr-14 text-sm text-black placeholder:text-black/45 bg-white focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c] ${
                    !createUserForm.confirmPassword
                      ? "border-[#07713c]/40"
                      : doPasswordsMatch
                        ? "border-[#07713c]/40"
                        : "border-red-400"
                  }`}
                  placeholder="Confirm password"
                />
                <button
                  type="button"
                  onClick={() => setShowCreateConfirmPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-3 text-[11px] text-black hover:text-black/70"
                >
                  {showCreateConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
              {createUserForm.confirmPassword && !doPasswordsMatch && (
                <p className="text-[11px] text-black mt-1">
                  Passwords do not match.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
            <div>
              <label className="block text-xs font-medium text-black mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={createUserForm.fullName}
                onChange={(e) =>
                  setCreateUserForm((prev) => ({
                    ...prev,
                    fullName: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-[#07713c]/40 px-3 py-2 text-sm text-black placeholder:text-black/45 bg-white focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]"
                placeholder="Enter full name"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-black mb-1">
                Username
              </label>
              <input
                type="text"
                value={createUserForm.username}
                onChange={(e) =>
                  setCreateUserForm((prev) => ({
                    ...prev,
                    username: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-[#07713c]/40 px-3 py-2 text-sm text-black placeholder:text-black/45 bg-white focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]"
                placeholder="Enter username"
              />
            </div>
            {!createUserForm.username.trim() &&
            createUserError?.toLowerCase().includes("username") ? (
              <p className="text-[11px] text-black">Username is required.</p>
            ) : null}
          </div>

          {createdAccount && (
            <div className="rounded-lg border border-[#07713c]/30 bg-[#07713c]/10 p-3 space-y-1">
              <p className="text-xs font-semibold text-black">
                {createdAccount.role === "csg_president"
                  ? "CSG President created successfully."
                  : "User created successfully."}
              </p>
              <p className="text-xs text-black">
                Username: {createdAccount.username}
              </p>
            </div>
          )}

          <div className="px-1 pt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                resetForm();
                onClose?.();
              }}
              disabled={isCreatingUser}
              className="px-4 py-2 rounded-lg border border-gray-300 text-black"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreateDisabled}
              className="px-4 py-2 rounded-lg border border-[#07713c] bg-[#07713c]/10 font-medium text-black hover:bg-[#07713c]/15 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isCreatingUser ? "Creating..." : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
