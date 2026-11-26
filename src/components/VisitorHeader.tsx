import React, { useState } from 'react';
import { Menu, Search, X } from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { isSafeUrl } from '../lib/mediaUtils.ts';

export function VisitorHeader() {
  const { pathname, navigate, settings } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { label: 'الرئيسية', path: '/' },
    { label: 'الفيديوهات', path: '/videos' },
    { label: 'الإذاعة', path: '/audio' },
    { label: 'المعرض الفني', path: '/gallery' },
    { label: 'المشاريع', path: '/projects' },
  ];

  const handleNav = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand (Logo transparent without white bg + single-line school title) */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            handleNav('/');
          }}
          className="flex items-center gap-3 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E40AF] rounded-lg py-1"
        >
          {isSafeUrl(settings.logo_url) && (
            <img
              src={settings.logo_url}
              alt={settings.school_name}
              referrerPolicy="no-referrer"
              className="h-10 w-auto object-contain mix-blend-multiply shrink-0"
            />
          )}
          <span className="font-display text-base sm:text-lg font-bold text-slate-900 tracking-tight whitespace-nowrap shrink-0">
            {settings.school_name}
          </span>
        </a>

        {/* Zone 2: 5 concise single-line navigation links */}
        <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-slate-600">
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
                className={`relative py-1 whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'text-[#1E40AF] font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {link.label}
                {active && (
                  <span className="absolute inset-x-0 -bottom-[21px] h-0.5 bg-[#1E40AF]" />
                )}
              </a>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary Action + mobile toggle */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => handleNav('/works')}
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1E40AF] text-white text-xs sm:text-sm font-medium hover:bg-[#1E3A8A] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Search className="w-4 h-4" />
            <span>جميع الإنتاجات</span>
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
        <div className="lg:hidden bg-white border-t border-slate-200 px-4 py-4 space-y-2">
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
                  active
                    ? 'bg-[#1E40AF]/10 text-[#1E40AF]'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {link.label}
              </a>
            );
          })}
          <button
            type="button"
            onClick={() => handleNav('/works')}
            className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#1E40AF] text-white text-sm font-medium cursor-pointer"
          >
            <Search className="w-4 h-4" />
            <span>جميع الإنتاجات والبحث</span>
          </button>
        </div>
      )}
    </header>
  );
}
