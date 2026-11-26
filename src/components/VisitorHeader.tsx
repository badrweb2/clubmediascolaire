import React, { useState } from 'react';
import { Menu, Search, X } from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { isSafeUrl, normalizeImageUrl } from '../lib/mediaUtils.ts';

export function VisitorHeader() {
  const { pathname, navigate, settings } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { label: settings.nav_home_label || 'الرئيسية', path: '/' },
    { label: settings.nav_videos_label || 'الفيديوهات', path: '/videos' },
    { label: settings.nav_audio_label || 'الإذاعة المدرسية', path: '/audio' },
    { label: settings.nav_innovations_label || 'ابتكارات', path: '/innovations' },
    { label: settings.nav_projects_label || 'مشاريع', path: '/projects' },
    { label: settings.nav_activities_label || 'أنشطة', path: '/activities' },
    { label: settings.nav_works_label || 'إنتاجات', path: '/creations' },
    { label: settings.nav_presentations_label || 'عروض', path: '/presentations' },
    { label: settings.nav_competitions_label || 'مسابقات', path: '/competitions' },
    { label: settings.nav_designs_label || 'إبداعات', path: '/designs' },
  ];

  const handleNav = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const accentColor = settings.primary_color || '#1E40AF';

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      {/* Top Identity & Search Bar */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            handleNav('/');
          }}
          className="flex items-center gap-3 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E40AF] rounded-lg py-1 transition-transform duration-200 hover:scale-[1.02] active:scale-95"
        >
          {isSafeUrl(normalizeImageUrl(settings.logo_url)) && (
            <img
              src={normalizeImageUrl(settings.logo_url)}
              alt={settings.school_name}
              referrerPolicy="no-referrer"
              className="h-10 w-auto object-contain mix-blend-multiply shrink-0"
            />
          )}
          <div className="flex flex-col">
            <span className="font-display text-base sm:text-lg font-bold text-slate-900 tracking-tight whitespace-nowrap shrink-0">
              {settings.school_name}
            </span>
          </div>
        </a>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => handleNav('/works')}
            style={{ backgroundColor: accentColor }}
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:scale-105 hover:shadow-md active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Search className="w-4 h-4" />
            <span>بحث في الأرشيف</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
            className="lg:hidden p-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Main Navigation Bar: Enlarged Interactive Buttons */}
      <nav
        aria-label="التنقل الرئيسي"
        className="hidden lg:block border-t border-slate-100 bg-slate-50/75"
      >
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-center gap-2 xl:gap-2.5">
          {navLinks.map((link) => {
            const active = pathname === link.path;
            return (
              <a
                key={link.path}
                href={link.path}
                onClick={(e) => {
                  e.preventDefault();
                  handleNav(link.path);
                }}
                style={active ? { backgroundColor: accentColor, borderColor: accentColor } : undefined}
                className={`group relative px-4 py-2.5 rounded-xl text-[15px] font-semibold border whitespace-nowrap shrink-0 transition-all duration-200 ease-out transform select-none ${
                  active
                    ? 'text-white shadow-md scale-[1.03]'
                    : 'bg-white text-slate-700 border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:bg-white hover:text-[#1E40AF] hover:border-blue-200 hover:-translate-y-0.5 hover:scale-105 hover:shadow-md'
                } active:scale-95 active:translate-y-0`}
              >
                <span>{link.label}</span>
              </a>
            );
          })}
        </div>
      </nav>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="lg:hidden bg-white border-t border-slate-200 px-4 py-4 grid grid-cols-2 gap-2">
          {navLinks.map((link) => {
            const active = pathname === link.path;
            return (
              <a
                key={link.path}
                href={link.path}
                onClick={(e) => {
                  e.preventDefault();
                  handleNav(link.path);
                }}
                style={active ? { backgroundColor: accentColor } : undefined}
                className={`block px-4 py-3 rounded-xl text-sm font-semibold text-center border transition-all duration-150 active:scale-95 ${
                  active
                    ? 'text-white border-transparent shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-white hover:text-[#1E40AF]'
                }`}
              >
                {link.label}
              </a>
            );
          })}
          <button
            type="button"
            onClick={() => handleNav('/works')}
            className="col-span-2 mt-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold active:scale-95 transition-transform cursor-pointer"
          >
            <Search className="w-4 h-4" />
            <span>بحث في جميع الإنتاجات</span>
          </button>
        </div>
      )}
    </header>
  );
}
