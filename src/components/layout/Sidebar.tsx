'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useAppStore } from '@/lib/store';
import { useSettingsStore } from '@/store/settingsStore';
import { NAV_ITEMS, SECTION_LABELS } from '@/lib/constants';
import type { UserRole } from '@/lib/constants';

interface SidebarProps {
  userName: string;
  userRole: UserRole;
  userEmail: string;
}

export default function Sidebar({ userName, userRole, userEmail }: SidebarProps) {
  const pathname = usePathname();
  const { language, theme, sidebarCollapsed, toggleSidebar, toggleTheme, lowStockRefreshKey } = useAppStore();
  const { businessName } = useSettingsStore();
  const [lowStockCount, setLowStockCount] = useState(0);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    const fetchLowStock = async () => {
      try {
        const res = await fetch('/api/inventory/low-stock-count');
        if (res.ok) {
          const data = await res.json();
          setLowStockCount(data.count ?? 0);
        }
      } catch {
        // silently ignore if API not available yet
      }
    };
    fetchLowStock();
    const interval = setInterval(fetchLowStock, 60000);
    return () => clearInterval(interval);
  }, [lowStockRefreshKey]);

  const filteredItems = NAV_ITEMS.filter((item) =>
    item.roles.includes(userRole)
  );

  const sections = ['main', 'management', 'analytics'] as const;

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLogout = async () => {
    // Clear lastLoginAt so check-session won't show false "active session"
    try { await fetch('/api/auth/signout-cleanup', { method: 'POST' }); } catch { /* ignore */ }
    await signOut({ callbackUrl: '/login' });
  };

  return (
    <aside
      className={`sidebar${sidebarCollapsed ? ' collapsed' : ''}`}
      style={sidebarCollapsed ? { width: 'var(--sidebar-collapsed)' } : undefined}
    >
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">{businessName.charAt(0).toUpperCase()}</div>
        {!sidebarCollapsed && (
          <span className="sidebar-logo-text text-gradient">{businessName}</span>
        )}
        <button
          className="btn btn-ghost btn-icon"
          onClick={toggleSidebar}
          style={{ marginLeft: sidebarCollapsed ? 0 : 'auto' }}
          aria-label="Toggle sidebar"
        >
          {sidebarCollapsed ? '▶' : '◀'}
        </button>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {sections.map((section) => {
          const sectionItems = filteredItems.filter(
            (item) => item.section === section
          );
          if (sectionItems.length === 0) return null;

          return (
            <div key={section} className="sidebar-section">
              {!sidebarCollapsed && (
                <div className="sidebar-section-title">
                  {language === 'mm'
                    ? SECTION_LABELS[section].mm
                    : SECTION_LABELS[section].en}
                </div>
              )}
              {sectionItems.map((item) => {
                const isActive =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname === item.href ||
                      pathname.startsWith(item.href + '/');

                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`sidebar-link${isActive ? ' active' : ''}`}
                    title={sidebarCollapsed ? (language === 'mm' ? item.labelMm : item.label) : undefined}
                  >
                    <span className="sidebar-link-icon">{item.icon}</span>
                    {!sidebarCollapsed && (
                      <span>{language === 'mm' ? item.labelMm : item.label}</span>
                    )}
                    {!sidebarCollapsed &&
                      item.hasBadge &&
                      lowStockCount > 0 && (
                        <span className="sidebar-link-badge">
                          {lowStockCount}
                        </span>
                      )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Theme Toggle */}
      <div style={{ padding: '0 var(--space-md)', marginBottom: 'var(--space-sm)' }}>
        <button
          className="btn btn-ghost"
          onClick={toggleTheme}
          title={theme === 'dark' ? (language === 'mm' ? 'အလင်းမုဒ်သို့ပြောင်းရန်' : 'Switch to Light Mode') : (language === 'mm' ? 'အမှိုင်မုဒ်သို့ပြောင်းရန်' : 'Switch to Dark Mode')}
          style={{
            width: '100%',
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            padding: '10px var(--space-md)',
            borderRadius: 'var(--radius-md)',
            gap: 'var(--space-md)',
            fontSize: 'var(--text-sm)',
          }}
        >
          <span style={{ fontSize: '18px', width: 20, textAlign: 'center' }}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </span>
          {!sidebarCollapsed && (
            <span>{theme === 'dark' ? (language === 'mm' ? 'အလင်းမုဒ်' : 'Light Mode') : (language === 'mm' ? 'အမှိုင်မုဒ်' : 'Dark Mode')}</span>
          )}
        </button>
      </div>

      {/* Footer */}
      <div className="sidebar-footer" style={{ position: 'relative' }}>
        {/* User Menu Popover */}
        {showUserMenu && (
          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              left: sidebarCollapsed ? '50%' : 'var(--space-md)',
              right: sidebarCollapsed ? 'auto' : 'var(--space-md)',
              transform: sidebarCollapsed ? 'translateX(-50%)' : 'none',
              minWidth: sidebarCollapsed ? '200px' : 'auto',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)',
              padding: 'var(--space-md)',
              marginBottom: 'var(--space-sm)',
              zIndex: 'var(--z-dropdown)',
              animation: 'slideUp 0.15s ease',
            }}
          >
            {/* User Info */}
            <div style={{ marginBottom: 'var(--space-md)', paddingBottom: 'var(--space-md)', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>{userName}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>{userEmail}</div>
              <span className={`badge ${userRole === 'ADMIN' ? 'badge-primary' : userRole === 'MANAGER' ? 'badge-success' : 'badge-neutral'}`} style={{ marginTop: 'var(--space-xs)' }}>
                {userRole}
              </span>
            </div>
            {/* Sign Out Button */}
            <button
              className="btn btn-danger"
              onClick={handleLogout}
              style={{
                width: '100%',
                justifyContent: 'center',
                gap: 'var(--space-sm)',
              }}
            >
              <span>🚪</span>
              {language === 'mm' ? 'ထွက်မည်' : 'Sign Out'}
            </button>
          </div>
        )}

        {/* Clickable User Area */}
        <div
          className="sidebar-user"
          onClick={() => setShowUserMenu(!showUserMenu)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') setShowUserMenu(!showUserMenu); }}
          style={{ cursor: 'pointer' }}
        >
          <div className="sidebar-user-avatar">{getInitials(userName)}</div>
          {!sidebarCollapsed && (
            <div className="sidebar-user-info" style={{ flex: 1 }}>
              <div className="sidebar-user-name">{userName}</div>
              <div className="sidebar-user-role">{userRole}</div>
            </div>
          )}
          {!sidebarCollapsed && (
            <span
              style={{
                fontSize: '12px',
                color: 'var(--text-muted)',
                transition: 'transform 0.2s ease',
                transform: showUserMenu ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            >
              ▲
            </span>
          )}
        </div>
      </div>

      {/* Backdrop to close menu */}
      {showUserMenu && (
        <div
          onClick={() => setShowUserMenu(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 'calc(var(--z-dropdown) - 1)',
          }}
        />
      )}
    </aside>
  );
}
