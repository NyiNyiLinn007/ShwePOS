'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useAppStore } from '@/lib/store';
import { useI18n } from '@/lib/i18n';
import { useSettingsStore } from '@/store/settingsStore';
import { NAV_ITEMS } from '@/lib/constants';
import type { UserRole } from '@/lib/constants';
import {
  NavIcon,
  Menu,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  LogOut,
} from '@/components/ui/Icons';

interface SidebarProps {
  userName: string;
  userRole: UserRole;
  userEmail: string;
}

export default function Sidebar({ userName, userRole, userEmail }: SidebarProps) {
  const pathname = usePathname();
  const {
    theme,
    language,
    sidebarCollapsed,
    toggleSidebar,
    toggleTheme,
    toggleLanguage,
    lowStockRefreshKey,
  } = useAppStore();
  const { t } = useI18n();
  const { businessName } = useSettingsStore();
  const [lowStockCount, setLowStockCount] = useState(0);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

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
    try { await fetch('/api/auth/signout-cleanup', { method: 'POST' }); } catch { /* ignore */ }
    await signOut({ callbackUrl: '/login' });
  };

  const openMobileNav = () => {
    if (sidebarCollapsed) toggleSidebar();
    setMobileOpen(true);
  };

  return (
    <>
      <button
        className="mobile-nav-trigger"
        type="button"
        onClick={openMobileNav}
        aria-label={t('openNavigation')}
        aria-expanded={mobileOpen}
      >
        <Menu size={20} strokeWidth={1.75} />
      </button>
      {mobileOpen && (
        <button
          className="mobile-nav-backdrop"
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label={t('closeNavigation')}
        />
      )}
      <aside
        className={`sidebar${sidebarCollapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}
        style={sidebarCollapsed ? { width: 'var(--sidebar-collapsed)' } : undefined}
      >
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">{businessName.charAt(0).toUpperCase()}</div>
          {!sidebarCollapsed && (
            <span className="sidebar-logo-text">{businessName}</span>
          )}
          <button
            className="btn btn-ghost btn-icon"
            onClick={toggleSidebar}
            style={{ marginLeft: sidebarCollapsed ? 0 : 'auto' }}
            aria-label={t('toggleSidebar')}
          >
            {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
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
                    {t(section)}
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
                      title={sidebarCollapsed ? t(item.key) : undefined}
                      onClick={() => setMobileOpen(false)}
                    >
                      <span className="sidebar-link-icon">
                        <NavIcon navKey={item.key} size={17} />
                      </span>
                      {!sidebarCollapsed && (
                        <span>{t(item.key)}</span>
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

        {/* Theme & Language Bar */}
        <div
          style={{
            padding: '0 10px',
            marginBottom: 'var(--space-sm)',
            display: 'flex',
            flexDirection: sidebarCollapsed ? 'column' : 'row',
            gap: 4,
          }}
        >
          <button
            className="btn btn-ghost btn-sm"
            onClick={toggleTheme}
            title={theme === 'dark' ? t('switchToLight') : t('switchToDark')}
            style={{
              flex: 1,
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              padding: '7px 10px',
              borderRadius: 'var(--radius-md)',
              gap: 8,
            }}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            {!sidebarCollapsed && (
              <span>{theme === 'dark' ? t('lightMode') : t('darkMode')}</span>
            )}
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={toggleLanguage}
            title={language === 'en' ? t('switchToMyanmar') : t('switchToEnglish')}
            style={{
              padding: '6px 10px',
              fontWeight: 600,
              fontFamily: 'var(--font-mono)',
            }}
          >
            {language === 'en' ? 'MM' : 'EN'}
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
                left: sidebarCollapsed ? '50%' : '10px',
                right: sidebarCollapsed ? 'auto' : '10px',
                transform: sidebarCollapsed ? 'translateX(-50%)' : 'none',
                minWidth: sidebarCollapsed ? '200px' : 'auto',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-lg)',
                padding: 'var(--space-md)',
                marginBottom: 'var(--space-sm)',
                zIndex: 'var(--z-dropdown)',
              }}
            >
              {/* User Info */}
              <div style={{ marginBottom: 'var(--space-md)', paddingBottom: 'var(--space-sm)', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{userName}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>{userEmail}</div>
                <span className={`badge ${userRole === 'ADMIN' ? 'badge-primary' : userRole === 'MANAGER' ? 'badge-success' : 'badge-neutral'}`} style={{ marginTop: 6 }}>
                  {t(userRole.toLowerCase())}
                </span>
              </div>
              {/* Sign Out Button */}
              <button
                className="btn btn-danger btn-sm"
                onClick={handleLogout}
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <LogOut size={14} />
                {t('signOut')}
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
                <div className="sidebar-user-role">{t(userRole.toLowerCase())}</div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
