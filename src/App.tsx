import React, { useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext.tsx';
import { VisitorHeader } from './components/VisitorHeader.tsx';
import { VisitorFooter } from './components/VisitorFooter.tsx';
import { HomePage } from './pages/public/HomePage.tsx';
import { CatalogPage } from './pages/public/CatalogPage.tsx';
import { WorkDetailPage } from './pages/public/WorkDetailPage.tsx';
import { AboutPage } from './pages/public/AboutPage.tsx';
import { AdminLoginPage } from './pages/admin/AdminLoginPage.tsx';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage.tsx';
import { AdminWorkEditorPage } from './pages/admin/AdminWorkEditorPage.tsx';
import { AdminWorksPage } from './pages/admin/AdminWorksPage.tsx';
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage.tsx';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage.tsx';

function ProtectedAdminGate({ children }: { children: React.ReactNode }) {
  const { auth, navigate } = useApp();

  useEffect(() => {
    if (!auth.authenticated) {
      navigate('/admin/login');
    }
  }, [auth.authenticated, navigate]);

  if (!auth.authenticated) {
    return <AdminLoginPage />;
  }

  return <>{children}</>;
}

function RouterView() {
  const { pathname } = useApp();

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
      <ProtectedAdminGate>
        <AdminWorkEditorPage />
      </ProtectedAdminGate>
    );
  }
  if (pathname.startsWith('/admin/edit/')) {
    const id = Number(pathname.replace('/admin/edit/', ''));
    return (
      <ProtectedAdminGate>
        <AdminWorkEditorPage editId={Number.isInteger(id) && id > 0 ? id : undefined} />
      </ProtectedAdminGate>
    );
  }
  if (pathname === '/admin/works') {
    return (
      <ProtectedAdminGate>
        <AdminWorksPage />
      </ProtectedAdminGate>
    );
  }
  if (pathname === '/admin/categories') {
    return (
      <ProtectedAdminGate>
        <AdminCategoriesPage />
      </ProtectedAdminGate>
    );
  }
  if (pathname === '/admin/settings') {
    return (
      <ProtectedAdminGate>
        <AdminSettingsPage />
      </ProtectedAdminGate>
    );
  }

  // Public Visitor Interface (zero admin affordances)
  let publicContent: React.ReactNode = <HomePage />;

  if (pathname === '/works') {
    publicContent = <CatalogPage mode="all" />;
  } else if (pathname === '/videos') {
    publicContent = <CatalogPage mode="videos" />;
  } else if (pathname === '/audio') {
    publicContent = <CatalogPage mode="audio" />;
  } else if (pathname === '/innovations') {
    publicContent = <CatalogPage mode="innovations" />;
  } else if (pathname === '/projects') {
    publicContent = <CatalogPage mode="projects" />;
  } else if (pathname === '/activities') {
    publicContent = <CatalogPage mode="activities" />;
  } else if (pathname === '/creations') {
    publicContent = <CatalogPage mode="creations" />;
  } else if (pathname === '/presentations') {
    publicContent = <CatalogPage mode="presentations" />;
  } else if (pathname === '/competitions') {
    publicContent = <CatalogPage mode="competitions" />;
  } else if (pathname === '/designs') {
    publicContent = <CatalogPage mode="designs" />;
  } else if (pathname === '/gallery') {
    publicContent = <CatalogPage mode="gallery" />;
  } else if (pathname === '/about') {
    publicContent = <AboutPage />;
  } else if (pathname.startsWith('/work/')) {
    const workId = Number(pathname.replace('/work/', ''));
    publicContent = <WorkDetailPage workId={Number.isInteger(workId) && workId > 0 ? workId : 0} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
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
