import React from 'react';
import { useApp } from '../context/AppContext.tsx';
import { isSafeUrl } from '../lib/mediaUtils.ts';

export function VisitorFooter() {
  const { navigate, settings } = useApp();

  return (
    <footer className="bg-white border-t border-slate-200 mt-20">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-10 border-b border-slate-200">
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center gap-3">
              {isSafeUrl(settings.logo_url) && (
                <img
                  src={settings.logo_url}
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
                  جميع الإنتاجات
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
                  ركن الفيديوهات
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
                  الإذاعة المدرسية
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
                  href="/projects"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/projects');
                  }}
                  className="hover:text-[#1E40AF] transition-colors"
                >
                  المشاريع والبحوث
                </a>
              </li>
            </ul>
          </div>

          <div className="md:col-span-3 space-y-3">
            <h4 className="text-sm font-semibold text-slate-900">التوثيق والنشر</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              تُراجع جميع الإنتاجات الطلابية وتُنشر بإشراف إدارة المؤسسة لضمان جودة المحتوى التربوي.
            </p>
            <div>
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
