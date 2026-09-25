import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProfile } from "../../contexts/ProfileContext.jsx";
import { deleteUserAccount, removeUserAvatar, updateUserProfile, uploadUserAvatar } from "./settingsService.js";
import { updatePassword, logout } from "../auth/auth.js";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingState,
  PageHeader,
} from "../../components/ui.jsx";
import EditProfileModal from "./components/EditProfileModal.jsx";
import DeleteAccountModal from "./components/DeleteAccountModal.jsx";
import ResetPasswordModal from "./components/ResetPasswordModal.jsx";
import { useNotifications } from "../../contexts/NotificationsContext.jsx";
import { getUserErrorMessage } from "../../utils/errorMessage.js";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { profile, isLoading, error: profileError, refreshProfile } = useProfile();
  const { notifyError, notifySuccess } = useNotifications();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (error) {
      notifyError("Error", error);
    }
  }, [error, notifyError]);

  useEffect(() => {
    if (profileError) {
      notifyError("Error", profileError);
    }
  }, [notifyError, profileError]);

  useEffect(() => {
    if (success) {
      notifySuccess("Saved", success);
    }
  }, [notifySuccess, success]);

  async function handleProfileUpdate(updates) {
    try {
      setIsSavingProfile(true);
      setError("");
      setSuccess("");
      await updateUserProfile(updates);
      await refreshProfile();
      setIsEditOpen(false);
      setSuccess("Profile updated.");
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleAvatarUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingAvatar(true);
      setError("");
      setSuccess("");
      await uploadUserAvatar(file);
      await refreshProfile();
      setSuccess("Profile photo updated.");
    } catch (uploadError) {
      setError(getUserErrorMessage(uploadError, "We couldn't upload your photo. Please try again."));
    } finally {
      setIsUploadingAvatar(false);
      event.target.value = "";
    }
  }

  async function handleAvatarRemove() {
    try {
      setIsUploadingAvatar(true);
      setError("");
      setSuccess("");
      await removeUserAvatar();
      await refreshProfile();
      setSuccess("Profile photo removed.");
    } catch (removeError) {
      setError(getUserErrorMessage(removeError, "We couldn't remove your photo. Please try again."));
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function handlePasswordUpdate(passwordForm) {
    if (passwordForm.password !== passwordForm.confirmPassword) {
      throw new Error("Passwords do not match.");
    }

    try {
      setIsUpdatingPassword(true);
      setError("");
      setSuccess("");
      await updatePassword(passwordForm.password);
      setIsResetPasswordOpen(false);
      setSuccess("Password updated.");
    } catch (passwordError) {
      setError(getUserErrorMessage(passwordError, "We couldn't update your password. Please try again."));
      throw passwordError;
    } finally {
      setIsUpdatingPassword(false);
    }
  }

  async function handleDeleteAccount() {
    try {
      setIsDeletingAccount(true);
      setError("");
      await deleteUserAccount();
      await logout();
      navigate("/", { replace: true });
    } catch (deleteError) {
      setError(getUserErrorMessage(deleteError, "We couldn't delete your account. Please try again."));
    } finally {
      setIsDeletingAccount(false);
      setIsDeleteOpen(false);
    }
  }

  async function handleLogout() {
    try {
      setIsLoggingOut(true);
      await logout();
      navigate("/login", { replace: true });
    } catch (logoutError) {
      setError(getUserErrorMessage(logoutError, "We couldn't sign you out. Please try again."));
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="motion-fade-up space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Manage your profile, security, and account access."
      />

      {isLoading ? (
        <LoadingState title="Loading profile" description="Pulling in your account information." />
      ) : !profile && profileError ? (
        <EmptyState
          title="Couldn't load profile"
          description={profileError}
          action={<Button onClick={refreshProfile}>Try again</Button>}
        />
      ) : (
        <div className="mx-auto max-w-4xl space-y-6">
          <Card className="motion-fade-up motion-delay-1 space-y-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
              <Avatar src={profile?.avatar_url} name={profile?.name} size="xl" className="!rounded-full" />
              <div className="space-y-3">
                <div>
                  <div className="text-2xl font-semibold tracking-tight text-slate-900">{profile?.name}</div>
                  <div className="text-sm text-slate-500">{profile?.email}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center rounded-2xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200">
                    {isUploadingAvatar ? "Working..." : profile?.avatar_url ? "Change photo" : "Upload photo"}
                    <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" disabled={isUploadingAvatar} />
                  </label>
                  {profile?.avatar_url ? (
                    <Button variant="ghost" size="sm" onClick={handleAvatarRemove} disabled={isUploadingAvatar}>
                      Remove photo
                    </Button>
                  ) : null}
                </div>
              </div>
              </div>
              <Button variant="secondary" onClick={() => setIsEditOpen(true)} className="shrink-0">
                Edit profile
              </Button>
            </div>

            <div className="border-t border-[var(--color-border)] pt-6">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Bio</div>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {profile?.bio || "Add a short bio so classmates know what you're studying or what you're interested in."}
              </p>
            </div>
          </Card>

          <Card className="motion-fade-up motion-delay-2">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Security</div>
                <div className="mt-3 text-lg font-semibold text-slate-900">Password</div>
                <div className="mt-1 text-sm text-slate-500">Update your password to keep your account secure.</div>
              </div>
              <Button variant="secondary" onClick={() => setIsResetPasswordOpen(true)} className="shrink-0">
                Change password
              </Button>
            </div>
          </Card>

          <Card className="motion-fade-up motion-delay-3 space-y-6">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Account actions</div>
            <div className="flex flex-col gap-4 border-b border-[var(--color-border)] pb-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-base font-semibold text-slate-900">Sign out</div>
                <div className="mt-1 text-sm text-slate-500">Sign out of ClassMatch on this device.</div>
              </div>
              <Button variant="secondary" onClick={handleLogout} disabled={isLoggingOut} className="shrink-0">
                {isLoggingOut ? "Signing out..." : "Sign out"}
              </Button>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-base font-semibold text-rose-700">Delete account</div>
                <div className="mt-1 text-sm text-slate-500">
                  This permanently removes your schedules, memberships, and account record.
                </div>
              </div>
              <Button variant="danger" onClick={() => setIsDeleteOpen(true)} className="shrink-0">
                Delete account
              </Button>
            </div>
          </Card>
        </div>
      )}

      <EditProfileModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        profile={profile}
        onSubmit={handleProfileUpdate}
        isSubmitting={isSavingProfile}
      />

      <DeleteAccountModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteAccount}
        isDeleting={isDeletingAccount}
      />
      <ResetPasswordModal
        isOpen={isResetPasswordOpen}
        onClose={() => setIsResetPasswordOpen(false)}
        onSubmit={handlePasswordUpdate}
        isSubmitting={isUpdatingPassword}
      />
    </div>
  );
}
