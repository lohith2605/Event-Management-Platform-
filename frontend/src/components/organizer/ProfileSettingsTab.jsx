import { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Lock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Save,
  KeyRound,
} from 'lucide-react';
import {
  fetchOrganizerProfileApi,
  updateOrganizerProfileApi,
  updateOrganizerPasswordApi,
} from '../../api/organizer';

export default function ProfileSettingsTab({ user, onProfileUpdated }) {
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    city: user?.city || '',
    bio: user?.bio || '',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [passwordSuccess, setPasswordSuccess] = useState(null);
  const [passwordError, setPasswordError] = useState(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetchOrganizerProfileApi();
        if (res && res.user) {
          setProfileData({
            name: res.user.name || '',
            email: res.user.email || '',
            phone: res.user.phone || '',
            city: res.user.city || '',
            bio: res.user.bio || '',
          });
        }
      } catch (e) {
        // use session defaults
      }
    }
    loadProfile();
  }, []);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSuccess(null);
    setProfileError(null);

    try {
      const res = await updateOrganizerProfileApi({
        name: profileData.name,
        phone: profileData.phone,
        city: profileData.city,
        bio: profileData.bio,
      });

      setProfileSuccess('Organizer profile updated successfully.');
      if (onProfileUpdated && res.user) {
        onProfileUpdated(res.user);
      }
    } catch (err) {
      setProfileError(err.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setSavingPassword(true);
    setPasswordSuccess(null);
    setPasswordError(null);

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New passwords do not match.');
      setSavingPassword(false);
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      setSavingPassword(false);
      return;
    }

    try {
      await updateOrganizerPasswordApi({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });

      setPasswordSuccess('Password changed successfully.');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPasswordError(err.message || 'Failed to update password. Verify current password.');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Account Role Badge Header */}
      <div className="p-5 rounded-2xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[var(--color-golden-accent)]/15 border border-[var(--color-golden-accent)]/30 text-[var(--color-golden-accent)] flex items-center justify-center font-bold text-lg shrink-0">
            {profileData.name ? profileData.name[0].toUpperCase() : 'O'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-[var(--color-main-text)]">
                {profileData.name || 'Organizer Profile'}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[var(--color-golden-accent)]/15 text-[var(--color-golden-accent)] border border-[var(--color-golden-accent)]/30">
                Verified Organizer
              </span>
            </div>
            <p className="text-xs text-[var(--color-secondary-text)] mt-0.5">
              {profileData.email} • Platform Role: <strong className="uppercase">{user?.role}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-[var(--color-secondary-text)]">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Role verified by UTSAV Security</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Info Form */}
        <div className="rounded-2xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] p-6 space-y-4 shadow-xs">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-[var(--color-secondary-text)] flex items-center gap-2">
            <User className="w-4 h-4 text-[var(--color-primary-action)]" />
            <span>Profile Details</span>
          </h3>

          {profileSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{profileSuccess}</span>
            </div>
          )}

          {profileError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{profileError}</span>
            </div>
          )}

          <form onSubmit={handleProfileSubmit} className="space-y-3.5 text-xs">
            <div>
              <label className="block font-bold text-[var(--color-main-text)] mb-1">
                Full Name / Organization Name
              </label>
              <input
                type="text"
                value={profileData.name}
                onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--color-input-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)] focus:outline-none focus:border-[var(--color-primary-action)] transition-colors"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-[var(--color-main-text)] mb-1">
                Registered Email (Immutable)
              </label>
              <input
                type="email"
                value={profileData.email}
                disabled
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--color-secondary-bg)]/50 text-[var(--color-secondary-text)] border border-[var(--color-borders)] opacity-70 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block font-bold text-[var(--color-main-text)] mb-1">
                Contact Phone
              </label>
              <input
                type="text"
                value={profileData.phone}
                onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                placeholder="+91 98765 43210"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--color-input-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)] focus:outline-none focus:border-[var(--color-primary-action)] transition-colors"
              />
            </div>

            <div>
              <label className="block font-bold text-[var(--color-main-text)] mb-1">
                Headquarters City
              </label>
              <input
                type="text"
                value={profileData.city}
                onChange={(e) => setProfileData({ ...profileData, city: e.target.value })}
                placeholder="e.g. New Delhi, Bengaluru"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--color-input-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)] focus:outline-none focus:border-[var(--color-primary-action)] transition-colors"
              />
            </div>

            <div>
              <label className="block font-bold text-[var(--color-main-text)] mb-1">
                About / Bio
              </label>
              <textarea
                rows={3}
                value={profileData.bio}
                onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                placeholder="Brief summary of your events and council..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--color-input-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)] focus:outline-none focus:border-[var(--color-primary-action)] transition-colors resize-y"
              />
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-primary-action)] text-[var(--color-primary-text)] font-bold text-xs hover:bg-[var(--color-primary-action-hover)] transition-colors cursor-pointer disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              <span>{savingProfile ? 'Saving...' : 'Save Profile Changes'}</span>
            </button>
          </form>
        </div>

        {/* Change Password Form */}
        <div className="rounded-2xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] p-6 space-y-4 shadow-xs">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-[var(--color-secondary-text)] flex items-center gap-2">
            <Lock className="w-4 h-4 text-[var(--color-golden-accent)]" />
            <span>Security & Password</span>
          </h3>

          {passwordSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{passwordSuccess}</span>
            </div>
          )}

          {passwordError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-3.5 text-xs">
            <div>
              <label className="block font-bold text-[var(--color-main-text)] mb-1">
                Current Password
              </label>
              <input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--color-input-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)] focus:outline-none focus:border-[var(--color-primary-action)] transition-colors"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-[var(--color-main-text)] mb-1">
                New Password (minimum 6 characters)
              </label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--color-input-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)] focus:outline-none focus:border-[var(--color-primary-action)] transition-colors"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-[var(--color-main-text)] mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--color-input-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)] focus:outline-none focus:border-[var(--color-primary-action)] transition-colors"
                required
              />
            </div>

            <button
              type="submit"
              disabled={savingPassword}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-card-bg)] text-[var(--color-main-text)] font-bold text-xs hover:bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] transition-colors cursor-pointer disabled:opacity-60"
            >
              <KeyRound className="w-4 h-4 text-[var(--color-golden-accent)]" />
              <span>{savingPassword ? 'Updating...' : 'Update Password'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
