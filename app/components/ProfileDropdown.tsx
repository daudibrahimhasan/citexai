import { signOut } from 'next-auth/react';
import type { Session } from 'next-auth';
import { LogOut, User, Crown } from 'lucide-react';

interface ProfileDropdownProps {
  session: Session | null;
  userUsage: {
    usage_count: number;
    limit: number;
  } | null;
  showProfileMenu: boolean;
  setShowProfileMenu: (value: boolean | ((prev: boolean) => boolean)) => void;
}

export default function ProfileDropdown({
  session,
  userUsage,
  showProfileMenu,
  setShowProfileMenu
}: ProfileDropdownProps) {
  const usageCount = userUsage?.usage_count ?? 0;
  const usageLimit = userUsage?.limit ?? 25;
  const usagePercentage = Math.min((usageCount / usageLimit) * 100, 100);
  const remainingRequests = usageLimit - usageCount;
  const isPremium = usageLimit > 25;

  const userInitial = session?.user?.name?.[0]?.toUpperCase() ||
    session?.user?.email?.[0]?.toUpperCase() ||
    'U';

  return (
    <div className="profile-dropdown-container">
      <button
        onClick={() => setShowProfileMenu((v) => !v)}
        className="profile-button"
        aria-label="Profile"
        type="button"
      >
        <span className="profile-avatar">
          {userInitial}
        </span>
        <svg
          className={`profile-chevron ${showProfileMenu ? 'profile-chevron-open' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showProfileMenu && (
        <>
          {/* Backdrop */}
          <div
            className="profile-backdrop"
            onClick={() => setShowProfileMenu(false)}
            aria-hidden="true"
          />

          {/* Dropdown Menu */}
          <div className="profile-dropdown-menu">
            {/* Header Section */}
            <div className="profile-header">
              <div className="profile-header-content">
                <div className="profile-header-avatar">
                  {userInitial}
                </div>
                <div className="profile-header-info">
                  <div className="profile-header-name">
                    {session?.user?.name || 'User'}
                  </div>
                  <div className="profile-header-email">
                    {session?.user?.email}
                  </div>
                </div>
              </div>
            </div>

            {/* Account Type Badge */}
            <div className="profile-badge-section">
              {isPremium ? (
                <div className="profile-badge profile-badge-premium">
                  <Crown className="profile-badge-icon" />
                  <span>Premium Account</span>
                </div>
              ) : (
                <div className="profile-badge profile-badge-free">
                  <User className="profile-badge-icon" />
                  <span>Free Account</span>
                </div>
              )}
            </div>

            {/* Usage Stats Section */}
            <div className="profile-usage-section">
              <div className="profile-usage-header">
                <span className="profile-usage-label">API Usage</span>
                <span className="profile-usage-numbers">
                  {usageCount} / {usageLimit}
                </span>
              </div>
              <div className="profile-usage-bar-container">
                <div
                  className="profile-usage-bar-fill"
                  style={{ width: `${usagePercentage}%` }}
                />
              </div>
              <div className="profile-usage-remaining">
                {remainingRequests} requests remaining
              </div>
            </div>

            {!isPremium && (
              <div className="px-4 pb-2">
                <button
                  onClick={async () => {
                    if (confirm('Upgrade to Premium for $4.99? (Mock Payment)')) {
                      try {
                        const res = await fetch('/api/user/upgrade', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ email: session?.user?.email, plan: 'pro' })
                        });
                        if (res.ok) {
                          alert('Upgraded! Refreshing...');
                          window.location.reload();
                        }
                      } catch {
                        alert('Error upgrading');
                      }
                    }
                  }}
                  className="w-full bg-gradient-to-r from-yellow-400 to-yellow-600 text-white text-xs font-bold py-2 rounded-md shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Crown size={14} />
                  Upgrade to Premium
                </button>
              </div>
            )}

            {/* Sign Out Button */}
            <div className="profile-actions">
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  signOut();
                }}
                className="profile-signout-button"
              >
                <LogOut className="profile-signout-icon" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
