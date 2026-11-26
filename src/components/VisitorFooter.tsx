import React from 'react';
import { Info } from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { isSafeUrl, normalizeImageUrl } from '../lib/mediaUtils.ts';

export function VisitorFooter() {
  const { navigate, settings } = useApp();
  const accentColor = settings.primary_color || '#1E40AF';

  const footerSections = [
    { label: settings.nav_videos_label || 'الفيديوهات', path: '/videos' },
    { label: settings.nav_audio_label || 'الإذاعة المدرسية', path: '/audio' },
    { label: settings.nav_innovations_label || 'ابتكارات', path: '/innovations' },
    { label: settings.nav_projects_label || 'مشاريع', path: '/projects' },
    { label: settings.nav_activities_label || 'أنشطة', path: '/activities' },
    { label: settings.nav_works_label || 'إنتاجات', path: '/creations' },
    { label: settings.nav_presentations_label || 'عروض', path: '/presentations' },
    { label: settings.nav_competitions_label || 'مسابقات', path: '/competitions' },
    { label: settings.nav_designs_label || 'إبداعات', path: '/designs' },
    { label: 'الأرشيف الشامل', path: '/works' },
  ];

  return (
    <footer className="bg-white border-t border-slate-200 mt-20">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-10 border-b border-slate-200">
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center gap-3">
              {isSafeUrl(normalizeImageUrl(settings.logo_url)) && (
                <img
                  src={normalizeImageUrl(settings.logo_url)}
                  alt={settings.school_name}
                  referrerPolicy="no-referrer"
                  className="h-11 w-auto object-contain mix-blend-multiply"
                />
              )}
              <div>
                <div className="font-display text-base font-bold text-slate-900">
                  {settings.platform_title}
                </div>
                <div className="text-xs text-slate-500">
                  الموسم الدراسي {settings.academic_year}
                </div>
              </div>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed max-w-md">
              {settings.platform_tagline}
            </p>
            <div className="pt-1">
              <button
                type="button"
                onClick={() => navigate('/about')}
                style={{ borderColor: accentColor, color: accentColor }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border text-sm font-semibold bg-white hover:bg-slate-50 hover:-translate-y-0.5 hover:shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                <Info className="w-4 h-4" />
                <span>{settings.about_button_label || 'حول المنصة'}</span>
              </button>
            </div>
          </div>

          <div className="md:col-span-4 space-y-3">
            <h4 className="text-sm font-semibold text-slate-900">أقسام المعرض الرقمي</h4>
            <ul className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm text-slate-600">
              {footerSections.map((sec) => (
                <li key={sec.path}>
                  <a
                    href={sec.path}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(sec.path);
                    }}
                    className="hover:text-[#1E40AF] transition-colors"
                  >
                    {sec.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-3 space-y-3">
            <h4 className="text-sm font-semibold text-slate-900">التوثيق والنشر</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              {settings.footer_publish_note}
            </p>
            {settings.supervisor_name && (
              <p className="text-xs text-slate-700 font-medium">
                إشراف: {settings.supervisor_name}
              </p>
            )}
            <div className="pt-1">
              <a
                href="/admin/login"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/admin/login');
                }}
                className="text-xs text-slate-500 hover:text-[#1E40AF] underline underline-offset-4 transition-colors"
              >
                بوابة الإدارة
              </a>
            </div>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span>{settings.footer_note}</span>
          <span>{settings.school_name}</span>
        </div>
      </div>
    </footer>
  );
}
