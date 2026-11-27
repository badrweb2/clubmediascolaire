import React, { useMemo, useState } from 'react';
import { Menu, Search, X } from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { isSafeUrl, normalizeImageUrl } from '../lib/mediaUtils.ts';
import {
  BUILTIN_NAV_ITEMS,
  parseCustomNavItems,
  parseHiddenNavKeys,
} from '../lib/settingsDefaults.ts';

interface ResolvedNavLink {
  key: string;
  label: string;
  path: string;
  external: boolean;
}

export function VisitorHeader() {
  const { pathname, searchParams, navigate, settings } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = useMemo<ResolvedNavLink[]>(() => {
    const hiddenSet = new Set(parseHiddenNavKeys(settings.hidden_nav_keys_json));
    const builtIn: ResolvedNavLink[] = BUILTIN_NAV_ITEMS.filter(
      (item) => !hiddenSet.has(item.key)
    ).map((item) => ({
      key: item.key,
      label: (settings[item.key] || '').trim() || item.defaultLabel,
      path: item.path,
      external: false,
    }));

    const customRaw = parseCustomNavItems(settings.custom_nav_items_json);
    const customResolved: ResolvedNavLink[] = [];
    for (const item of customRaw) {
      if (!item.enabled) continue;
      if (item.target_type === 'category') {
        const catId = Number(item.target_value);
        if (Number.isInteger(catId) && catId > 0) {
          customResolved.push({
            key: item.id,
            label: item.label,
            path: `/works?categoryId=${catId}`,
            external: false,
          });
        }
      } else if (item.target_type === 'url') {
        if (isSafeUrl(item.target_value)) {
          const isInternal = item.target_value.startsWith('/');
          customResolved.push({
            key: item.id,
            label: item.label,
            path: item.target_value,
            external: !isInternal,
          });
        }
      } else {
        const routePath = item.target_value.startsWith('/')
          ? item.target_value
          : `/${item.target_value}`;
        customResolved.push({
          key: item.id,
          label: item.label,
          path: routePath,
          external: false,
        });
      }
    }

    return [...builtIn, ...customResolved];
  }, [settings]);

  const handleNav = (path: string, external = false) => {
    setMobileOpen(false);
    if (external) {
      window.open(path, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(path);
  };

  const currentFull = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;
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
            const active = !link.external && (link.path.includes('?') ? currentFull === link.path : pathname === link.path);
            return (
              <a
                key={link.key}
                href={link.path}
                target={link.external ? '_blank' : undefined}
                rel={link.external ? 'noopener noreferrer' : undefined}
                onClick={(e) => {
                  if (!link.external) {
                    e.preventDefault();
                    handleNav(link.path, false);
                  }
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
            const active = !link.external && (link.path.includes('?') ? currentFull === link.path : pathname === link.path);
            return (
              <a
                key={link.key}
                href={link.path}
                target={link.external ? '_blank' : undefined}
                rel={link.external ? 'noopener noreferrer' : undefined}
                onClick={(e) => {
                  if (!link.external) {
                    e.preventDefault();
                    handleNav(link.path, false);
                  } else {
                    setMobileOpen(false);
                  }
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
