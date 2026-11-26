import React, { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  HelpCircle,
  Layers,
  Target,
  UserCheck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { parseFaqJson, parseMultilineList } from '../../lib/settingsDefaults.ts';

export function AboutPage() {
  const { navigate, settings } = useApp();
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  const contentsList = parseMultilineList(settings.about_contents);
  const objectivesList = parseMultilineList(settings.about_objectives);
  const faqItems = parseFaqJson(settings.about_faq_json);

  return (
    <div className="max-w-[1080px] mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-10">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة إلى الرئيسية</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('/works')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1E40AF] text-white text-sm font-medium hover:bg-[#1E3A8A] transition-colors cursor-pointer"
        >
          <span>استكشاف الإنتاجات</span>
        </button>
      </div>

      {/* Hero Definition Card */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 space-y-5">
        <div className="inline-flex items-center gap-2 text-xs font-medium text-[#1E40AF]">
          <BookOpen className="w-4 h-4" />
          <span>{settings.school_name} · {settings.academic_year}</span>
        </div>

        <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 leading-tight">
          {settings.about_title || `حول ${settings.platform_title}`}
        </h1>

        <p className="text-base sm:text-lg text-slate-700 leading-loose whitespace-pre-line">
          {settings.about_definition}
        </p>
      </section>

      {/* Contents & Objectives Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#1E40AF]/10 text-[#1E40AF] flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <h2 className="font-display text-xl font-bold text-slate-900">محتويات المنصة وأركانها</h2>
          </div>

          <ul className="space-y-3">
            {contentsList.map((item, idx) => (
              <li key={idx} className="flex items-start gap-3 text-sm sm:text-base text-slate-700 leading-relaxed">
                <CheckCircle2 className="w-4 h-4 text-[#1E40AF] shrink-0 mt-1" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0">
              <Target className="w-5 h-5" />
            </div>
            <h2 className="font-display text-xl font-bold text-slate-900">أهداف المنصة التربوية</h2>
          </div>

          <ol className="space-y-3">
            {objectivesList.map((goal, idx) => (
              <li key={idx} className="flex items-start gap-3 text-sm sm:text-base text-slate-700 leading-relaxed">
                <span className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                  {idx + 1}
                </span>
                <span>{goal}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* Platform Supervisor Card */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="w-14 h-14 rounded-xl bg-[#1E40AF] text-white flex items-center justify-center shrink-0">
            <UserCheck className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-[#1E40AF]">الإشراف التربوي والإداري على المنصة</div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900">
              {settings.supervisor_name || 'الأستاذ بدر الريمش'}
            </h2>
            {settings.supervisor_title && (
              <div className="text-sm font-medium text-slate-600">{settings.supervisor_title}</div>
            )}
            {settings.supervisor_bio && (
              <p className="text-sm text-slate-600 leading-relaxed pt-1 max-w-3xl">
                {settings.supervisor_bio}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Interactive FAQ Section */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-[#1E40AF]/10 text-[#1E40AF] flex items-center justify-center shrink-0">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">أسئلة وأجوبة شائعة</h2>
            <p className="text-xs text-slate-500 mt-0.5">إجابات توضيحية للتلاميذ والأطر التربوية والزوار</p>
          </div>
        </div>

        <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
          {faqItems.map((faq, idx) => {
            const isOpen = openFaqIdx === idx;
            return (
              <div key={idx} className="bg-white">
                <button
                  type="button"
                  onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                  aria-expanded={isOpen}
                  className="w-full px-5 py-4 flex items-center justify-between gap-4 text-right hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <span className="font-semibold text-sm sm:text-base text-slate-900">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-500 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-[#1E40AF]' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3 bg-slate-50/50">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
