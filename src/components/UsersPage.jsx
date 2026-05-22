import { useEffect, useMemo, useState } from "react";
import SidebarNavIcon from "./SidebarNavIcon";
import UserCircleIcon from "./UserCircleIcon";
import CreateUserModal from "./CreateUserModal";
import { getAppNavItems } from "../utils/appNav";
import { getDashboardRoleLabel } from "../utils/roles";
import { useGovernorScope } from "../hooks/useGovernorScope";
import { useDeleteUser, useUpdateUser, useUsersList } from "../hooks/useUsersManagement";

export default function UsersPage({ onNavigate, onLogout }) {
  const { role, isGovernor, governorScope } = useGovernorScope();
  const roleLabel = getDashboardRoleLabel(isGovernor, governorScope, role);
  const isAdmin = String(role || "").toLowerCase().trim() === "admin";
  const [showLogout, setShowLogout] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [editForm, setEditForm] = useState({ username: "", password: "" });
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const { data: users = [], isLoading, refetch } = useUsersList(isAdmin);
  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();

  const navItems = getAppNavItems({ isAdmin });

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => Number(a.id) - Number(b.id)),
    [users],
  );

  const roleLabelForUsersPage = (rawRole) => {
    const normalized = String(rawRole || "").trim().toLowerCase();
    if (normalized === "coc_governor") return "ccje_governor";
    return rawRole;
  };

  useEffect(() => {
    if (isAdmin) return;
    onNavigate?.("attendance");
  }, [isAdmin, onNavigate]);

  if (!isAdmin) {
    return null;
  }

  const startEdit = (user) => {
    setActionError("");
    setActionSuccess("");
    setEditingUserId(user.id);
    setEditForm({ username: user.username || "", password: "" });
  };

  const saveEdit = () => {
    setActionError("");
    setActionSuccess("");
    if (!editingUserId) return;
    const payload = {};
    if (editForm.username.trim()) payload.username = editForm.username.trim();
    if (editForm.password.trim()) payload.password = editForm.password.trim();
    if (!payload.username && !payload.password) {
      setActionError("Provide a username or password to update.");
      return;
    }
    updateUserMutation.mutate(
      { id: editingUserId, payload },
      {
        onSuccess: () => {
          setActionSuccess("User updated successfully.");
          setEditingUserId(null);
          setEditForm({ username: "", password: "" });
        },
        onError: (err) => {
          setActionError(err?.response?.data?.message || "Failed to update user.");
        },
      },
    );
  };

  const removeUser = (id) => {
    setActionError("");
    setActionSuccess("");
    if (!window.confirm("Remove this user? This cannot be undone.")) return;
    deleteUserMutation.mutate(id, {
      onSuccess: () => setActionSuccess("User removed successfully."),
      onError: (err) => setActionError(err?.response?.data?.message || "Failed to remove user."),
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
                item.id === "users" ? "bg-[#055a2e] text-white" : "text-green-100 hover:bg-white/15"
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
            User Management
          </h1>
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
        </header>

        <main className="flex-1 p-6 overflow-auto">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-[#36454F]">
                {isAdmin
                  ? "Manage registered users. Admin can update username/password and remove accounts."
                  : "You can view users, but only admin can edit."}
              </p>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="rounded-lg bg-[#07713c] px-4 py-2 text-xs font-semibold text-white hover:bg-[#055a2e]"
                  >
                    + Add User
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-[#36454F]/75">Role: {roleLabel}</p>
            {actionError && <p className="text-sm text-red-600">{actionError}</p>}
            {actionSuccess && <p className="text-sm text-green-700">{actionSuccess}</p>}

            <div className="overflow-x-auto rounded-lg border border-[#07713c]/20">
              <table className="w-full min-w-[760px] text-sm font-[Inter,sans-serif]">
                <thead className="border-b border-[#07713c]/30 bg-[#07713c] text-xs font-semibold uppercase tracking-wide text-white">
                  <tr>
                    <th className="px-3 py-2.5 text-left align-middle">ID</th>
                    <th className="px-3 py-2.5 text-left align-middle">Username</th>
                    <th className="px-3 py-2.5 text-left align-middle">Password</th>
                    <th className="px-3 py-2.5 text-left align-middle">Role</th>
                    <th className="px-3 py-2.5 text-left align-middle">Department</th>
                    <th className="px-3 py-2.5 text-left align-middle">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td className="px-3 py-3 text-sm text-gray-500" colSpan={6}>
                        Loading users...
                      </td>
                    </tr>
                  ) : sortedUsers.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 text-sm text-gray-500" colSpan={6}>
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    sortedUsers.map((user) => {
                      const isEditing = editingUserId === user.id;
                      return (
                        <tr key={user.id} className="border-t border-[#07713c]/20 hover:bg-gray-50">
                          <td className="px-3 py-1.5 text-left font-medium leading-snug text-[#07713c]">{user.id}</td>
                          <td className="px-3 py-1.5 text-left font-medium leading-snug text-[#07713c]">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editForm.username}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, username: e.target.value }))}
                                className="w-full rounded-lg border border-[#07713c]/40 bg-white px-2.5 py-1.5 text-sm text-[#07713c] focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                              />
                            ) : (
                              user.username
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-left leading-snug text-[#07713c]">
                            {isEditing && isAdmin ? (
                              <input
                                type="password"
                                value={editForm.password}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, password: e.target.value }))}
                                className="w-full min-w-44 rounded-lg border border-[#07713c]/40 bg-white px-2.5 py-1.5 text-sm text-[#07713c] focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                                placeholder="Enter new password"
                              />
                            ) : (
                              <span className="text-[#07713c]/65">••••••••</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-left leading-snug text-[#07713c]">{roleLabelForUsersPage(user.role)}</td>
                          <td className="px-3 py-1.5 text-left leading-snug text-[#07713c]">{user.department_name || "-"}</td>
                          <td className="px-3 py-1.5 text-left">
                            {!isAdmin ? (
                              <span className="text-xs text-[#36454F]/60">View only</span>
                            ) : isEditing ? (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={saveEdit}
                                  disabled={updateUserMutation.isPending}
                                  className="rounded-lg bg-[#07713C] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingUserId(null);
                                    setEditForm({ username: "", password: "" });
                                  }}
                                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-[#36454F]"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => startEdit(user)}
                                  className="rounded-lg border border-[#07713C]/40 px-3 py-1.5 text-xs font-medium text-[#07713C] hover:bg-[#07713C]/10"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeUser(user.id)}
                                  disabled={deleteUserMutation.isPending}
                                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                                >
                                  Remove
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      <CreateUserModal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          refetch();
        }}
      />
    </div>
  );
}
