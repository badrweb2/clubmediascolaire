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
    { label: settings.nav_works_label || 'إنتاجات', path: '/works' },
  ];

  const handleNav = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const accentColor = settings.primary_color || '#1E40AF';

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            handleNav('/');
          }}
          className="flex items-center gap-2.5 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E40AF] rounded-lg py-1"
        >
          {isSafeUrl(normalizeImageUrl(settings.logo_url)) && (
            <img
              src={normalizeImageUrl(settings.logo_url)}
              alt={settings.school_name}
              referrerPolicy="no-referrer"
              className="h-10 w-auto object-contain mix-blend-multiply shrink-0"
            />
          )}
          <span className="font-display text-sm sm:text-base font-bold text-slate-900 tracking-tight whitespace-nowrap shrink-0">
            {settings.school_name}
          </span>
        </a>

        {/* Main Navigation: 7 Requested Single-Line Links */}
        <nav
          aria-label="التنقل الرئيسي"
          className="hidden lg:flex items-center gap-4 xl:gap-6 text-sm font-medium text-slate-600"
        >
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
                style={active ? { color: accentColor } : undefined}
                className={`relative py-1 whitespace-nowrap shrink-0 transition-colors ${
                  active ? 'font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {link.label}
                {active && (
                  <span
                    style={{ backgroundColor: accentColor }}
                    className="absolute inset-x-0 -bottom-[21px] h-0.5"
                  />
                )}
              </a>
            );
          })}
        </nav>

        {/* Quick Search Trigger + Mobile Toggle */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => handleNav('/works')}
            style={{ backgroundColor: accentColor }}
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-white text-xs font-medium hover:opacity-95 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            <span>بحث</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
            className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="lg:hidden bg-white border-t border-slate-200 px-4 py-4 space-y-1.5">
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
                className={`block px-3 py-2.5 rounded-lg text-sm font-medium ${
                  active ? 'bg-[#1E40AF]/10 text-[#1E40AF]' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {link.label}
              </a>
            );
          })}
        </div>
      )}
    </header>
  );
}
