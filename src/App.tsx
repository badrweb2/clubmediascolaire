import React, { useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext.tsx';
import { VisitorHeader } from './components/VisitorHeader.tsx';
import { VisitorFooter } from './components/VisitorFooter.tsx';
import { HomePage } from './pages/public/HomePage.tsx';
import { CatalogPage } from './pages/public/CatalogPage.tsx';
import { WorkDetailPage } from './pages/public/WorkDetailPage.tsx';
import { AboutPage } from './pages/public/AboutPage.tsx';
import { AdminLoginPage } from './pages/admin/AdminLoginPage.tsx';
import { AdminLayout } from './pages/admin/AdminLayout.tsx';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage.tsx';
import { AdminWorkEditorPage } from './pages/admin/AdminWorkEditorPage.tsx';
import { AdminWorksPage } from './pages/admin/AdminWorksPage.tsx';
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage.tsx';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage.tsx';
import { isSettingEnabled } from './lib/settingsDefaults.ts';
import { resolveBackgroundStyle } from './lib/themePresets.ts';
import type { AdminPermission } from './types.ts';

function ProtectedAdminGate({
  children,
  requiredPermission,
}: {
  children: React.ReactNode;
  requiredPermission?: AdminPermission | AdminPermission[];
}) {
  const { auth, navigate, hasPermission } = useApp();

  useEffect(() => {
    if (!auth.authenticated) {
      navigate('/admin/login');
    }
  }, [auth.authenticated, navigate]);

  if (!auth.authenticated) {
    return <AdminLoginPage />;
  }

  if (requiredPermission) {
    const perms = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
    const allowed = perms.some((p) => hasPermission(p));
    if (!allowed) {
      return (
        <AdminLayout title="صلاحية محدودة">
          <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-lg mx-auto text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h1 className="font-display text-lg font-bold text-slate-900">
              ليس لديك صلاحية للوصول إلى هذا القسم
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              حسابك مفعّل لمهام محددة فقط. يمكنك العودة إلى لوحة الإحصائيات أو التواصل مع المدير
              العام لمنحك هذه الصلاحية.
            </p>
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="px-4 py-2 rounded-lg bg-[#1E40AF] text-white text-sm font-medium hover:bg-[#1E3A8A] cursor-pointer"
            >
              العودة إلى لوحة التحكم
            </button>
          </div>
        </AdminLayout>
      );
    }
  }

  return <>{children}</>;
}

function RouterView() {
  const { pathname, settings } = useApp();

  // Admin routes (strictly separated from visitor UI)
  if (pathname === '/admin/login') {
    return <AdminLoginPage />;
  }
  if (pathname === '/admin') {
    return (
      <ProtectedAdminGate>
        <AdminDashboardPage />
      </ProtectedAdminGate>
    );
  }
  if (pathname === '/admin/add') {
    return (
      <ProtectedAdminGate requiredPermission="manage_works">
        <AdminWorkEditorPage />
      </ProtectedAdminGate>
    );
  }
  if (pathname.startsWith('/admin/edit/')) {
    const id = Number(pathname.replace('/admin/edit/', ''));
    return (
      <ProtectedAdminGate requiredPermission="manage_works">
        <AdminWorkEditorPage editId={Number.isInteger(id) && id > 0 ? id : undefined} />
      </ProtectedAdminGate>
    );
  }
  if (pathname === '/admin/works') {
    return (
      <ProtectedAdminGate requiredPermission="manage_works">
        <AdminWorksPage />
      </ProtectedAdminGate>
    );
  }
  if (pathname === '/admin/categories') {
    return (
      <ProtectedAdminGate requiredPermission="manage_categories">
        <AdminCategoriesPage />
      </ProtectedAdminGate>
    );
  }
  if (pathname === '/admin/settings') {
    return (
      <ProtectedAdminGate requiredPermission={['manage_settings', 'manage_users']}>
        <AdminSettingsPage />
      </ProtectedAdminGate>
    );
  }

  // Public Visitor Interface (zero admin affordances)
  let publicContent: React.ReactNode = <HomePage />;
  let routeBgRaw = settings.bg_home || settings.bg_site;

  if (pathname === '/works') {
    publicContent = <CatalogPage mode="all" />;
    routeBgRaw = settings.bg_pages || settings.bg_site;
  } else if (pathname === '/videos') {
    publicContent = <CatalogPage mode="videos" />;
    routeBgRaw = settings.bg_pages || settings.bg_site;
  } else if (pathname === '/audio') {
    publicContent = <CatalogPage mode="audio" />;
    routeBgRaw = settings.bg_pages || settings.bg_site;
  } else if (pathname === '/innovations') {
    publicContent = <CatalogPage mode="innovations" />;
    routeBgRaw = settings.bg_pages || settings.bg_site;
  } else if (pathname === '/projects') {
    publicContent = <CatalogPage mode="projects" />;
    routeBgRaw = settings.bg_pages || settings.bg_site;
  } else if (pathname === '/activities') {
    publicContent = <CatalogPage mode="activities" />;
    routeBgRaw = settings.bg_pages || settings.bg_site;
  } else if (pathname === '/creations') {
    publicContent = <CatalogPage mode="creations" />;
    routeBgRaw = settings.bg_pages || settings.bg_site;
  } else if (pathname === '/presentations') {
    publicContent = <CatalogPage mode="presentations" />;
    routeBgRaw = settings.bg_pages || settings.bg_site;
  } else if (pathname === '/competitions') {
    publicContent = <CatalogPage mode="competitions" />;
    routeBgRaw = settings.bg_pages || settings.bg_site;
  } else if (pathname === '/designs') {
    publicContent = <CatalogPage mode="designs" />;
    routeBgRaw = settings.bg_pages || settings.bg_site;
  } else if (pathname === '/gallery') {
    publicContent = <CatalogPage mode="gallery" />;
    routeBgRaw = settings.bg_pages || settings.bg_site;
  } else if (pathname === '/about') {
    publicContent = <AboutPage />;
    routeBgRaw = settings.bg_pages || settings.bg_site;
  } else if (pathname.startsWith('/work/')) {
    const workId = Number(pathname.replace('/work/', ''));
    publicContent = <WorkDetailPage workId={Number.isInteger(workId) && workId > 0 ? workId : 0} />;
    routeBgRaw = settings.bg_work_detail || settings.bg_pages || settings.bg_site;
  }

  const pageBackgroundStyle = resolveBackgroundStyle(routeBgRaw);
  const showAnnouncement =
    isSettingEnabled(settings.announcement_enabled) && settings.announcement_text.trim().length > 0;

  return (
    <div
      style={pageBackgroundStyle}
      className="min-h-screen flex flex-col bg-[#F8FAFC] transition-colors duration-300"
    >
      {showAnnouncement && (
        <div
          style={{ backgroundColor: settings.primary_color || '#1E40AF' }}
          className="text-white text-xs sm:text-sm font-medium text-center px-4 py-2"
        >
          {settings.announcement_text}
        </div>
      )}
      <VisitorHeader />
      <main className="flex-1">{publicContent}</main>
      <VisitorFooter />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <RouterView />
    </AppProvider>
  );
}
