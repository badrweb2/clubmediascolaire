import React from 'react';
import { Info } from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { isSafeUrl, normalizeImageUrl } from '../lib/mediaUtils.ts';

export function VisitorFooter() {
  const { navigate, settings } = useApp();
  const accentColor = settings.primary_color || '#1E40AF';

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
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-xs sm:text-sm font-medium bg-white hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Info className="w-4 h-4" />
                <span>{settings.about_button_label || 'حول المنصة'}</span>
              </button>
            </div>
          </div>

          <div className="md:col-span-4 space-y-3">
            <h4 className="text-sm font-semibold text-slate-900">أقسام المعرض الرقمي</h4>
            <ul className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm text-slate-600">
              <li>
                <a
                  href="/works"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/works');
                  }}
                  className="hover:text-[#1E40AF] transition-colors"
                >
                  {settings.nav_works_label || 'إنتاجات'}
                </a>
              </li>
              <li>
                <a
                  href="/videos"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/videos');
                  }}
                  className="hover:text-[#1E40AF] transition-colors"
                >
                  {settings.nav_videos_label || 'الفيديوهات'}
                </a>
              </li>
              <li>
                <a
                  href="/audio"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/audio');
                  }}
                  className="hover:text-[#1E40AF] transition-colors"
                >
                  {settings.nav_audio_label || 'الإذاعة المدرسية'}
                </a>
              </li>
              <li>
                <a
                  href="/innovations"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/innovations');
                  }}
                  className="hover:text-[#1E40AF] transition-colors"
                >
                  {settings.nav_innovations_label || 'ابتكارات'}
                </a>
              </li>
              <li>
                <a
                  href="/projects"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/projects');
                  }}
                  className="hover:text-[#1E40AF] transition-colors"
                >
                  {settings.nav_projects_label || 'مشاريع'}
                </a>
              </li>
              <li>
                <a
                  href="/activities"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/activities');
                  }}
                  className="hover:text-[#1E40AF] transition-colors"
                >
                  {settings.nav_activities_label || 'أنشطة'}
                </a>
              </li>
              <li>
                <a
                  href="/gallery"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/gallery');
                  }}
                  className="hover:text-[#1E40AF] transition-colors"
                >
                  المعرض الفني
                </a>
              </li>
              <li>
                <a
                  href="/about"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/about');
                  }}
                  className="hover:text-[#1E40AF] transition-colors font-medium text-slate-800"
                >
                  {settings.about_button_label || 'حول المنصة'}
                </a>
              </li>
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
            <div className="flex items-center gap-4 pt-1">
              <a
                href="/about"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/about');
                }}
                className="text-xs font-medium text-[#1E40AF] hover:underline underline-offset-4 transition-colors"
              >
                {settings.about_button_label || 'حول المنصة'}
              </a>
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
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate('/about')}
              className="text-slate-700 hover:text-[#1E40AF] font-medium cursor-pointer"
            >
              {settings.about_button_label || 'حول المنصة'}
            </button>
            <span>{settings.school_name}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
