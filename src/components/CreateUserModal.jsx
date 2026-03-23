import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import api from "../api/axiosInstance";

function useCreateUserDebugMutation() {
  return useMutation({
    mutationFn: async ({
      username,
      password,
      email,
      department,
      major,
      role = "department",
    }) => {
      const requestBody = {
        username,
        password,
        email,
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
    value: "College of Education and Arts and Science",
    code: "CEAS",
    majors: ["English", "Filipino", "Mathematics", "BEED"],
  },
  {
    value: "College of Criminology",
    code: "COC",
    majors: [],
  },
  {
    value: "College of Hospitality Management",
    code: "CHM",
    majors: [],
  },
];

const DEPARTMENT_USERNAME_BASE = {
  "College of Information Technology": "gov-IT",
  "College of Business Administration": "gov-CBA",
  "College of Education and Arts and Science": "gov-CEAS",
  "College of Criminology": "gov-CRIM",
  "College of Hospitality Management": "gov-CHM",
};

function isValidAllowedEmail(value) {
  const email = value.trim().toLowerCase();
  return /^[a-z0-9._-]+@(normi\.edu\.ph|gmail\.com)$/.test(email);
}

export default function CreateUserModal({ open, onClose }) {
  const [createUserError, setCreateUserError] = useState("");
  const [createdAccount, setCreatedAccount] = useState(null);

  const [createUserForm, setCreateUserForm] = useState({
    department: "",
    major: "",
    email: "",
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

  const resetForOpen = () => {
    setCreateUserError("");
    setCreatedAccount(null);
    setShowCreatePassword(false);
    setShowCreateConfirmPassword(false);
    setCreateUserForm({
      department: "",
      major: "",
      email: "",
      password: "",
      confirmPassword: "",
      accountType: "department",
    });
  };

  useEffect(() => {
    if (!open) return;
    resetForOpen();
  }, [open]);

  const isEmailValid = !createUserForm.email.trim()
    ? true
    : isValidAllowedEmail(createUserForm.email);

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

  const generatedUsername = useMemo(() => {
    if (createUserForm.accountType === "csg_president") {
      return "csg-president".slice(0, 28);
    }

    const selectedDepartment = DEPARTMENT_OPTIONS.find(
      (item) => item.value === createUserForm.department,
    );
    const requiresMajor = (selectedDepartment?.majors?.length || 0) > 0;

    const departmentBase =
      DEPARTMENT_USERNAME_BASE[createUserForm.department] ||
      (normalizedDepartment ? `gov-${normalizedDepartment}` : "");

    if (!departmentBase) return "";
    if (!requiresMajor) return departmentBase.slice(0, 28);
    if (!normalizedMajor) return "";

    return `${departmentBase}-${normalizedMajor}`.slice(0, 28);
  }, [
    createUserForm.accountType,
    createUserForm.department,
    createUserForm.major,
    normalizedDepartment,
    normalizedMajor,
  ]);

  const generatedPassword = useMemo(() => {
    // For consistency with your current backend signup flow, admin can set password manually.
    return "";
  }, []);

  const passwordValue = createUserForm.password || "";

  const requiresMajor = useMemo(() => {
    if (createUserForm.accountType === "csg_president") return false;
    return majorOptions.length > 0;
  }, [createUserForm.accountType, majorOptions.length]);

  const { mutate: createUser, isPending: isCreatingUser } =
    useCreateUserDebugMutation();

  const isCreateDisabled =
    isCreatingUser ||
    !createUserForm.email.trim() ||
    !isEmailValid ||
    !passwordValue ||
    !doPasswordsMatch ||
    !isPasswordValid ||
    (requiresMajor && !createUserForm.major.trim());

  const DEPARTMENT_ROLE_MAP = {
    "College of Information Technology": "it_governor",
    "College of Business Administration": "cba_governor",
    "College of Education and Arts and Science": "ceas_governor",
    "College of Criminology": "coc_governor",
    "College of Hospitality Management": "chm_governor",
  };

  const roleToSend =
    createUserForm.accountType === "csg_president"
      ? "csg_president"
      : (DEPARTMENT_ROLE_MAP[createUserForm.department] ?? "it_governor");

  const resetForm = () => {
    setCreateUserError("");
    setCreatedAccount(null);
    setCreateUserForm({
      department: "",
      major: "",
      email: "",
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
        <div className="bg-[#008000] px-5 py-3">
          <h3 className="text-white font-semibold">Create User</h3>
        </div>
        <form
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

            if (!generatedUsername) {
              setCreateUserError(
                "Unable to generate username. Check your inputs.",
              );
              return;
            }

            if (!createUserForm.email.trim()) {
              setCreateUserError("Email is required.");
              return;
            }

            if (!isValidAllowedEmail(createUserForm.email)) {
              setCreateUserError(
                "Email must end with @normi.edu.ph or @gmail.com.",
              );
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
                username: generatedUsername,
                password: createUserForm.password,
                email: createUserForm.email.trim(),
                department:
                  createUserForm.accountType === "csg_president"
                    ? ""
                    : createUserForm.department.trim(),
                major:
                  createUserForm.accountType === "csg_president"
                    ? ""
                    : requiresMajor
                      ? createUserForm.major.trim()
                      : "",
                role: roleToSend,
              },
              {
                onSuccess: () => {
                  setCreatedAccount({
                    username: generatedUsername,
                    email: createUserForm.email.trim(),
                    password: createUserForm.password,
                    role: roleToSend,
                  });
                },
                onError: (err) => {
                  setCreateUserError(
                    err?.response?.data?.message || "Failed to create user.",
                  );
                },
              },
            );
          }}
          className="p-5 space-y-4 text-sm"
        >
          {createUserError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-xs text-red-700">
              {createUserError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Account Type
              </label>
              <select
                value={createUserForm.accountType}
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
              >
                <option value="department">Department User</option>
                <option value="csg_president">CSG President</option>
              </select>
            </div>

            {createUserForm.accountType !== "csg_president" && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Department
                  </label>
                  <select
                    value={createUserForm.department}
                    onChange={(e) =>
                      setCreateUserForm((prev) => ({
                        ...prev,
                        department: e.target.value,
                        major: "",
                      }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
                  >
                    <option value="">Select Department</option>
                    {DEPARTMENT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.value}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
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
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white disabled:bg-gray-100"
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
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Email
              </label>
              <input
                type="email"
                value={createUserForm.email}
                onChange={(e) =>
                  setCreateUserForm((prev) => ({
                    ...prev,
                    email: e.target.value,
                  }))
                }
                className={`w-full border rounded-lg px-3 py-2 bg-white ${
                  isEmailValid ? "border-gray-300" : "border-red-400"
                }`}
                placeholder="Enter email (e.g. gov-it@normi.edu.ph)"
                inputMode="email"
              />
              {!isEmailValid && (
                <p className="text-[11px] text-red-600 mt-1">
                  Invalid email. Use @normi.edu.ph or @gmail.com only.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
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
                  className={`w-full border rounded-lg px-3 py-2 pr-14 bg-white ${
                    isPasswordValid ? "border-gray-300" : "border-red-400"
                  }`}
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePassword((prev) => !prev)}
                  className="absolute inset-y-0 right-3 text-[11px] text-green-700 hover:text-green-800"
                >
                  {showCreatePassword ? "Hide" : "Show"}
                </button>
              </div>
              {!isPasswordValid && (
                <p className="text-[11px] text-red-600 mt-1">
                  Password must be at least 6 characters.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
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
                  className={`w-full border rounded-lg px-3 py-2 pr-14 bg-white ${
                    doPasswordsMatch ? "border-gray-300" : "border-red-400"
                  }`}
                  placeholder="Confirm password"
                />
                <button
                  type="button"
                  onClick={() => setShowCreateConfirmPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-3 text-[11px] text-green-700 hover:text-green-800"
                >
                  {showCreateConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
              {!doPasswordsMatch && (
                <p className="text-[11px] text-red-600 mt-1">
                  Passwords do not match.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1">
            <p className="text-xs text-gray-600">
              Generated username:{" "}
              <span className="font-semibold text-gray-800">
                {generatedUsername || "—"}
              </span>
            </p>
          </div>

          {createdAccount && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 space-y-1">
              <p className="text-xs font-semibold text-green-700">
                {createdAccount.role === "csg_president"
                  ? "CSG President created successfully."
                  : "User created successfully."}
              </p>
              <p className="text-xs text-green-700">
                Email: {createdAccount.email}
              </p>
              <p className="text-xs text-green-700">
                Username: {createdAccount.username}
              </p>
              <p className="text-xs text-green-700">
                Password: {createdAccount.password}
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
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreateDisabled}
              className="px-4 py-2 rounded-lg bg-[#008000] text-white disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isCreatingUser ? "Creating..." : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
