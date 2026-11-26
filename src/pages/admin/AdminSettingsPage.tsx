import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Info,
  KeyRound,
  LayoutTemplate,
  Palette,
  Plus,
  Save,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { AdminLayout } from './AdminLayout.tsx';
import { ConfirmDeleteDropdown } from '../../components/ConfirmDeleteDropdown.tsx';
import { isSafeUrl, normalizeImageUrl } from '../../lib/mediaUtils.ts';
import {
  DEFAULT_PLATFORM_SETTINGS,
  isSettingEnabled,
  parseFaqJson,
} from '../../lib/settingsDefaults.ts';
import type { FaqItem, PlatformSettings } from '../../types.ts';

const HERO_PRESETS = [
  {
    label: 'قاعة المكتبة والمعرض (الافتراضي)',
    url: '/src/assets/images/hero_school_cover_1795563098821.jpg',
  },
  {
    label: 'معرض الفنون التشكيلية',
    url: '/src/assets/images/thumb_art_calligraphy_1795563100612.jpg',
  },
  {
    label: 'مختبر الروبوتيك والعلوم',
    url: '/src/assets/images/thumb_robotics_club_1795563100911.jpg',
  },
];

const COLOR_PRESETS = [
  { label: 'الأزرق الأكاديمي (الافتراضي)', hex: '#1E40AF' },
  { label: 'الأخضر التربوي', hex: '#047857' },
  { label: 'الكحلي الكلاسيكي', hex: '#0F172A' },
  { label: 'العنابي الوقور', hex: '#9F1239' },
];

type SettingsTab = 'identity' | 'sections' | 'about' | 'security';

export function AdminSettingsPage() {
  const { apiFetch, refreshPublicBootstrap, auth, setSession, token } = useApp();
  const [activeTab, setActiveTab] = useState<SettingsTab>('identity');
  const [form, setForm] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS);
  const [faqItems, setFaqItems] = useState<FaqItem[]>(() =>
    parseFaqJson(DEFAULT_PLATFORM_SETTINGS.about_faq_json)
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(
    null
  );

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passFeedback, setPassFeedback] = useState<{
    type: 'error' | 'success';
    text: string;
  } | null>(null);

  useEffect(() => {
    setLoading(true);
    apiFetch<{ settings: PlatformSettings }>('/api/admin/settings')
      .then((res) => {
        setForm(res.settings);
        setFaqItems(parseFaqJson(res.settings.about_faq_json));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apiFetch]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSaving(true);
    try {
      const cleanedFaq = faqItems
        .map((item) => ({
          question: item.question.trim(),
          answer: item.answer.trim(),
        }))
        .filter((item) => item.question || item.answer);

      const normalizedForm: PlatformSettings = {
        ...form,
        hero_cover_url: normalizeImageUrl(form.hero_cover_url),
        logo_url: normalizeImageUrl(form.logo_url),
        about_faq_json: JSON.stringify(cleanedFaq),
      };
      const res = await apiFetch<{ settings: PlatformSettings }>('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(normalizedForm),
      });
      setForm(res.settings);
      setFaqItems(parseFaqJson(res.settings.about_faq_json));
      await refreshPublicBootstrap();
      setFeedback({ type: 'success', text: 'تم حفظ جميع إعدادات المنصة وتحديث الواجهة بنجاح.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'تعذر حفظ الإعدادات.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassFeedback(null);
    try {
      const res = await apiFetch<{ ok: boolean; username: string }>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword,
          newUsername: newUsername.trim(),
          newPassword,
        }),
      });
      if (token && res.username) {
        setSession(token, res.username, auth.envManaged);
      }
      setCurrentPassword('');
      setNewUsername('');
      setNewPassword('');
      setPassFeedback({ type: 'success', text: 'تم تحديث بيانات الدخول بنجاح.' });
    } catch (err) {
      setPassFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'تعذر تحديث كلمة المرور.',
      });
    }
  };

  const toggleFlag = (key: keyof PlatformSettings) => {
    setForm((prev) => ({
      ...prev,
      [key]: isSettingEnabled(prev[key]) ? '0' : '1',
    }));
  };

  const tabs: Array<{ id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'identity', label: 'الهوية البصرية والنصوص', icon: Palette },
    { id: 'sections', label: 'القائمة الرئيسية والأقسام', icon: LayoutTemplate },
    { id: 'about', label: 'حول المنصة والإشراف والأسئلة', icon: Info },
    { id: 'security', label: 'بيانات دخول المدير', icon: KeyRound },
  ];

  return (
    <AdminLayout title="إعدادات المنصة الكاملة">
      <div className="space-y-6 max-w-5xl">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            إعدادات المنصة والهوية البصرية الشاملة
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            تحكم كامل في الهوية البصرية، تسميات الأزرار، أقسام الصفحة الرئيسية، محتوى صفحة «حول المنصة» والأسئلة الشائعة، وإعدادات العرض.
          </p>
        </div>

        {/* Settings Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#1E40AF] text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {feedback && (
          <div
            className={`p-4 rounded-xl border text-sm flex items-center gap-2.5 ${
              feedback.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            {feedback.type === 'error' ? (
              <XCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {loading ? (
          <div className="h-72 bg-white border border-slate-200 rounded-xl animate-pulse" />
        ) : activeTab !== 'security' ? (
          <form onSubmit={handleSaveSettings} className="space-y-6">
            {/* TAB 1: Identity, Hero, Colors, Footer */}
            {activeTab === 'identity' && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                <h2 className="font-display text-lg font-bold text-slate-900">
                  الهوية البصرية ونصوص الواجهة والتذييل
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      اسم المؤسسة التعليمية
                    </label>
                    <input
                      type="text"
                      value={form.school_name}
                      onChange={(e) => setForm((f) => ({ ...f, school_name: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      الموسم الدراسي
                    </label>
                    <input
                      type="text"
                      value={form.academic_year}
                      onChange={(e) => setForm((f) => ({ ...f, academic_year: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      العنوان الرئيسي في الواجهة
                    </label>
                    <input
                      type="text"
                      value={form.platform_title}
                      onChange={(e) => setForm((f) => ({ ...f, platform_title: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      النص التعريفي الصغير أعلى العنوان
                    </label>
                    <input
                      type="text"
                      value={form.hero_badge_text}
                      onChange={(e) => setForm((f) => ({ ...f, hero_badge_text: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    العبارة التعريفية بالمنصة
                  </label>
                  <textarea
                    rows={3}
                    value={form.platform_tagline}
                    onChange={(e) => setForm((f) => ({ ...f, platform_tagline: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      نص زر الدعوة الأول بالواجهة
                    </label>
                    <input
                      type="text"
                      value={form.hero_primary_btn_text}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, hero_primary_btn_text: e.target.value }))
                      }
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      نص زر الدعوة الثاني بالواجهة
                    </label>
                    <input
                      type="text"
                      value={form.hero_secondary_btn_text}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, hero_secondary_btn_text: e.target.value }))
                      }
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                </div>

                {/* Primary Theme Color */}
                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                  <label className="block text-sm font-medium text-slate-700">
                    اللون الأساسي لهوية المنصة
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      type="color"
                      value={/^#[0-9a-fA-F]{6}$/.test(form.primary_color) ? form.primary_color : '#1E40AF'}
                      onChange={(e) => setForm((f) => ({ ...f, primary_color: e.target.value }))}
                      className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer p-0.5 bg-white"
                    />
                    {COLOR_PRESETS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, primary_color: c.hex }))}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs cursor-pointer ${
                          form.primary_color.toUpperCase() === c.hex
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full border border-white/50"
                          style={{ backgroundColor: c.hex }}
                        />
                        <span>{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Hero Cover Image */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <label className="block text-sm font-medium text-slate-700">
                    رابط صورة الغلاف الرئيسية (يدعم روابط الصور المباشرة أو Google Drive)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={form.hero_cover_url}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, hero_cover_url: normalizeImageUrl(e.target.value) }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-left"
                  />
                  <div className="flex flex-wrap gap-2">
                    {HERO_PRESETS.map((preset) => (
                      <button
                        key={preset.url}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, hero_cover_url: preset.url }))}
                        className={`px-3 py-1.5 rounded-lg border text-xs cursor-pointer ${
                          form.hero_cover_url === preset.url
                            ? 'bg-[#1E40AF] text-white border-[#1E40AF]'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  {isSafeUrl(normalizeImageUrl(form.hero_cover_url)) && (
                    <div className="rounded-xl overflow-hidden border border-slate-200 h-48 bg-slate-100">
                      <img
                        src={normalizeImageUrl(form.hero_cover_url)}
                        alt="معاينة الغلاف"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>

                {/* Logo & Footer Texts */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      رابط شعار المؤسسة
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={form.logo_url}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, logo_url: normalizeImageUrl(e.target.value) }))
                      }
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-left"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      نص حقوق التذييل (Footer)
                    </label>
                    <input
                      type="text"
                      value={form.footer_note}
                      onChange={(e) => setForm((f) => ({ ...f, footer_note: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    نص فقرة التوثيق والنشر في التذييل
                  </label>
                  <textarea
                    rows={2}
                    value={form.footer_publish_note}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, footer_publish_note: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
              </div>
            )}

            {/* TAB 2: Navigation Labels & Homepage Sections */}
            {activeTab === 'sections' && (
              <div className="space-y-6">
                <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      تسميات أزرار القائمة الرئيسية
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      تخصيص أسماء الأزرار العشرة الظاهرة في الشريط العلوي للمنصة.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {(
                      [
                        ['nav_home_label', 'الزر الأول (الرئيسية)'],
                        ['nav_videos_label', 'الزر الثاني (الفيديوهات)'],
                        ['nav_audio_label', 'الزر الثالث (الإذاعة)'],
                        ['nav_innovations_label', 'الزر الرابع (ابتكارات)'],
                        ['nav_projects_label', 'الزر الخامس (مشاريع)'],
                        ['nav_activities_label', 'الزر السادس (أنشطة)'],
                        ['nav_works_label', 'الزر السابع (إنتاجات)'],
                        ['nav_presentations_label', 'الزر الثامن (عروض)'],
                        ['nav_competitions_label', 'الزر التاسع (مسابقات)'],
                        ['nav_designs_label', 'الزر العاشر (إبداعات)'],
                      ] as Array<[keyof PlatformSettings, string]>
                    ).map(([key, label]) => (
                      <div key={key}>
                        <label className="block text-xs font-medium text-slate-600 mb-1.5">
                          {label}
                        </label>
                        <input
                          type="text"
                          value={form[key]}
                          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </section>

                <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      التحكم في أقسام الصفحة الرئيسية وخيارات العرض
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      إظهار أو إخفاء أي قسم في الواجهة الرئيسية وتعديل عنوانه.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {(
                      [
                        ['show_categories_section', 'categories_section_title', 'قسم استكشاف التصنيفات'],
                        ['show_latest_section', 'latest_section_title', 'قسم أحدث الإنتاجات المنشورة'],
                        ['show_featured_section', 'featured_section_title', 'قسم المشاريع المتميزة'],
                        ['show_most_viewed_section', 'most_viewed_section_title', 'قسم الأكثر مشاهدة'],
                        ['show_radio_corner', 'radio_corner_title', 'ركن الإذاعة المدرسية والبودكاست'],
                        ['show_art_corner', 'art_corner_title', 'ركن معرض الصور والفنون'],
                        ['show_video_corner', 'video_corner_title', 'ركن الفيديوهات التعليمية'],
                        ['show_project_corner', 'project_corner_title', 'ركن المشاريع والبحوث والمجلة'],
                      ] as Array<[keyof PlatformSettings, keyof PlatformSettings, string]>
                    ).map(([toggleKey, titleKey, label]) => (
                      <div
                        key={toggleKey}
                        className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 grid grid-cols-1 md:grid-cols-12 gap-3 items-center"
                      >
                        <label className="md:col-span-5 flex items-center gap-2.5 cursor-pointer text-sm font-medium text-slate-800">
                          <input
                            type="checkbox"
                            checked={isSettingEnabled(form[toggleKey])}
                            onChange={() => toggleFlag(toggleKey)}
                            className="w-4 h-4 accent-[#1E40AF] rounded"
                          />
                          <span>{label}</span>
                        </label>
                        <div className="md:col-span-7">
                          <input
                            type="text"
                            value={form[titleKey]}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, [titleKey]: e.target.value }))
                            }
                            placeholder="عنوان القسم في الرئيسية"
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
                    <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 cursor-pointer text-sm text-slate-800">
                      <input
                        type="checkbox"
                        checked={isSettingEnabled(form.show_stats_bar)}
                        onChange={() => toggleFlag('show_stats_bar')}
                        className="w-4 h-4 accent-[#1E40AF] rounded"
                      />
                      <span>إظهار شريط الإحصائيات بالرئيسية</span>
                    </label>
                    <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 cursor-pointer text-sm text-slate-800">
                      <input
                        type="checkbox"
                        checked={isSettingEnabled(form.show_view_counts)}
                        onChange={() => toggleFlag('show_view_counts')}
                        className="w-4 h-4 accent-[#1E40AF] rounded"
                      />
                      <span>إظهار عداد المشاهدات للزوار</span>
                    </label>
                    <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 cursor-pointer text-sm text-slate-800">
                      <input
                        type="checkbox"
                        checked={isSettingEnabled(form.show_share_button)}
                        onChange={() => toggleFlag('show_share_button')}
                        className="w-4 h-4 accent-[#1E40AF] rounded"
                      />
                      <span>إظهار زر مشاركة رابط الإنتاج</span>
                    </label>
                  </div>
                </section>
              </div>
            )}

            {/* TAB 3: About Platform, Supervisor & FAQ */}
            {activeTab === 'about' && (
              <div className="space-y-6">
                <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                  <h2 className="font-display text-lg font-bold text-slate-900">
                    محتوى صفحة «حول المنصة» والتعريف والأهداف
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        تسمية زر «حول المنصة» في الأسفل
                      </label>
                      <input
                        type="text"
                        value={form.about_button_label}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, about_button_label: e.target.value }))
                        }
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        عنوان صفحة حول المنصة
                      </label>
                      <input
                        type="text"
                        value={form.about_title}
                        onChange={(e) => setForm((f) => ({ ...f, about_title: e.target.value }))}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      تعريف المنصة
                    </label>
                    <textarea
                      rows={4}
                      value={form.about_definition}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, about_definition: e.target.value }))
                      }
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm leading-relaxed"
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        محتويات المنصة (عنصر واحد في كل سطر)
                      </label>
                      <textarea
                        rows={6}
                        value={form.about_contents}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, about_contents: e.target.value }))
                        }
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm leading-relaxed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        أهداف المنصة التربوية (هدف واحد في كل سطر)
                      </label>
                      <textarea
                        rows={6}
                        value={form.about_objectives}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, about_objectives: e.target.value }))
                        }
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm leading-relaxed"
                      />
                    </div>
                  </div>
                </section>

                {/* Supervisor Section */}
                <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <h2 className="font-display text-lg font-bold text-slate-900">
                    المشرف على المنصة
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        اسم المشرف على المنصة
                      </label>
                      <input
                        type="text"
                        value={form.supervisor_name}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, supervisor_name: e.target.value }))
                        }
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        الصفة / المهمة التربوية
                      </label>
                      <input
                        type="text"
                        value={form.supervisor_title}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, supervisor_title: e.target.value }))
                        }
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      نبذة عن مهام الإشراف
                    </label>
                    <textarea
                      rows={2}
                      value={form.supervisor_bio}
                      onChange={(e) => setForm((f) => ({ ...f, supervisor_bio: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                </section>

                {/* Dynamic FAQ Editor */}
                <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="font-display text-lg font-bold text-slate-900">
                        الأسئلة والأجوبة الشائعة (FAQ)
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        يمكنك تعديل الأسئلة الحالية أو إضافة أسئلة جديدة لصفحة «حول المنصة».
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setFaqItems((prev) => [...prev, { question: '', answer: '' }])
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-800 hover:bg-slate-50 cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة سؤال جديد</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {faqItems.map((faq, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-600">
                            السؤال {idx + 1}
                          </span>
                          <ConfirmDeleteDropdown
                            message={`هل تريد مسح السؤال رقم ${idx + 1}؟`}
                            onConfirm={() =>
                              setFaqItems((prev) => prev.filter((_, i) => i !== idx))
                            }
                            renderTrigger={({ onClick }) => (
                              <button
                                type="button"
                                onClick={onClick}
                                className="inline-flex items-center gap-1 text-xs text-rose-700 hover:underline cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>حذف</span>
                              </button>
                            )}
                          />
                        </div>
                        <input
                          type="text"
                          value={faq.question}
                          onChange={(e) =>
                            setFaqItems((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, question: e.target.value } : item
                              )
                            )
                          }
                          placeholder="اكتب نص السؤال..."
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                        />
                        <textarea
                          rows={2}
                          value={faq.answer}
                          onChange={(e) =>
                            setFaqItems((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, answer: e.target.value } : item
                              )
                            )
                          }
                          placeholder="اكتب الإجابة التوضيحية..."
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            <div className="sticky bottom-4 z-20 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4 shadow-sm">
              <span className="text-xs text-slate-500">
                تُطبق التغييرات فوراً على واجهة الزوار فور الضغط على حفظ.
              </span>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1E40AF] text-white text-sm font-medium hover:bg-[#1E3A8A] disabled:opacity-60 cursor-pointer shrink-0"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'جاري الحفظ...' : 'حفظ جميع الإعدادات'}</span>
              </button>
            </div>
          </form>
        ) : (
          /* TAB 4: Admin Credentials Update */
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#1E40AF]" />
              <span>تحديث بيانات دخول المدير</span>
            </h2>

            {auth.envManaged ? (
              <p className="text-sm text-slate-600 leading-relaxed">
                بيانات دخول المدير مضبوطة حالياً عبر متغيرات البيئة (Environment Variables) في إعدادات الخادم، ولا يمكن تعديلها من هنا. لتغييرها، عدّل القيم في لوحة Cloudflare Pages ثم أعد النشر.
              </p>
            ) : (
              <form onSubmit={handlePasswordChange} className="space-y-4">
                {passFeedback && (
                  <div
                    className={`p-3 rounded-lg border text-sm ${
                      passFeedback.type === 'error'
                        ? 'bg-rose-50 border-rose-200 text-rose-800'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    }`}
                  >
                    {passFeedback.text}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      كلمة المرور الحالية *
                    </label>
                    <input
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      اسم مستخدم جديد (اختياري)
                    </label>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder={auth.username || ''}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      كلمة مرور جديدة (6 أحرف+)
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#1E40AF] text-white text-sm font-medium hover:bg-[#1E3A8A] cursor-pointer"
                >
                  تحديث بيانات الدخول
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
