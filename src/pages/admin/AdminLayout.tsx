import React, { useState } from 'react';
import {
  ExternalLink,
  FolderTree,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  PlusCircle,
  Settings,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { isSafeUrl, normalizeImageUrl } from '../../lib/mediaUtils.ts';

interface AdminLayoutProps {
  title: string;
  children: React.ReactNode;
}

export function AdminLayout({ title, children }: AdminLayoutProps) {
  const { pathname, navigate, settings, auth, clearSession, hasPermission } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const allMenuItems: Array<{
    label: string;
    path: string;
    icon: React.ComponentType<{ className?: string }>;
    visible: boolean;
  }> = [
    { label: 'لوحة التحكم والإحصائيات', path: '/admin', icon: LayoutDashboard, visible: true },
    {
      label: 'إضافة محتوى جديد',
      path: '/admin/add',
      icon: PlusCircle,
      visible: hasPermission('manage_works'),
    },
    {
      label: 'إدارة المحتويات',
      path: '/admin/works',
      icon: ListChecks,
      visible: hasPermission('manage_works'),
    },
    {
      label: 'إدارة التصنيفات',
      path: '/admin/categories',
      icon: FolderTree,
      visible: hasPermission('manage_categories'),
    },
    {
      label: 'إعدادات المنصة',
      path: '/admin/settings',
      icon: Settings,
      visible: hasPermission('manage_settings') || hasPermission('manage_users'),
    },
  ];
  const menuItems = allMenuItems.filter((m) => m.visible);

  const handleNav = (path: string) => {
    navigate(path);
    setSidebarOpen(false);
  };

  const handleLogout = async () => {
    await clearSession();
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Desktop Sidebar (256px) */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col bg-white border-l border-slate-200 shrink-0">
        <div className="h-16 px-5 border-b border-slate-200 flex items-center gap-3">
          {isSafeUrl(normalizeImageUrl(settings.logo_url)) && (
            <img
              src={normalizeImageUrl(settings.logo_url)}
              alt={settings.school_name}
              referrerPolicy="no-referrer"
              className="h-9 w-auto object-contain mix-blend-multiply shrink-0"
            />
          )}
          <div className="min-w-0">
            <div className="font-display text-sm font-bold text-slate-900 truncate">
              لوحة إدارة المنصة
            </div>
            <div className="text-xs text-slate-500 truncate">{settings.school_name}</div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.path === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.path);
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => handleNav(item.path)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[#1E40AF] text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-2">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>معاينة واجهة الزوار</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium text-rose-700 hover:bg-rose-50 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-64 bg-white h-full border-l border-slate-200 flex flex-col">
            <div className="h-16 px-4 border-b border-slate-200 flex items-center justify-between">
              <span className="font-display text-sm font-bold text-slate-900">القائمة الإدارية</span>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-4 space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const active =
                  item.path === '/admin'
                    ? pathname === '/admin'
                    : pathname.startsWith(item.path);
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => handleNav(item.path)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium cursor-pointer ${
                      active ? 'bg-[#1E40AF] text-white' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-200 space-y-2">
              <button
                type="button"
                onClick={() => handleNav('/')}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>واجهة الزوار</span>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-rose-700 hover:bg-rose-50"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </div>
          <div className="flex-1 bg-slate-950/40" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700 cursor-pointer"
              aria-label="فتح القائمة"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-sm text-slate-500 truncate">
              <span>الإدارة</span>
              <span className="mx-2">/</span>
              <span className="font-semibold text-slate-900">{title}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline text-xs text-slate-500">
              {auth.isPrimary ? 'المدير:' : 'المشرف:'}{' '}
              <strong className="text-slate-800">{auth.displayName || auth.username}</strong>
            </span>
            {hasPermission('manage_works') && (
              <button
                type="button"
                onClick={() => navigate('/admin/add')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1E40AF] text-white text-xs font-medium hover:bg-[#1E3A8A] cursor-pointer whitespace-nowrap shrink-0"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>إضافة إنتاج</span>
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1280px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
