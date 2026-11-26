import React, { useEffect, useState } from 'react';
import { CheckCircle2, KeyRound, Save, XCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { AdminLayout } from './AdminLayout.tsx';
import { isSafeUrl } from '../../lib/mediaUtils.ts';
import type { PlatformSettings } from '../../types.ts';

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

export function AdminSettingsPage() {
  const { apiFetch, refreshPublicBootstrap, auth, setSession, token } = useApp();
  const [form, setForm] = useState<PlatformSettings>({
    school_name: '',
    platform_title: '',
    platform_tagline: '',
    hero_cover_url: '',
    logo_url: '',
    academic_year: '',
    footer_note: '',
  });
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
      .then((res) => setForm(res.settings))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apiFetch]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSaving(true);
    try {
      const res = await apiFetch<{ settings: PlatformSettings }>('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      setForm(res.settings);
      await refreshPublicBootstrap();
      setFeedback({ type: 'success', text: 'تم حفظ إعدادات المنصة وتحديث الواجهة بنجاح.' });
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

  return (
    <AdminLayout title="إعدادات المنصة">
      <div className="space-y-8 max-w-4xl">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            إعدادات المنصة والهوية البصرية
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            تحديث اسم المؤسسة، العنوان الرئيسي، العبارة التعريفية، الشعار، وصورة الغلاف الرئيسية.
          </p>
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
        ) : (
          <form
            onSubmit={handleSaveSettings}
            className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
          >
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
                العبارة التعريفية بالمنصة
              </label>
              <textarea
                rows={3}
                value={form.platform_tagline}
                onChange={(e) => setForm((f) => ({ ...f, platform_tagline: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-100">
              <label className="block text-sm font-medium text-slate-700">
                رابط صورة الغلاف الرئيسية (قابلة للتغيير)
              </label>
              <input
                type="text"
                dir="ltr"
                value={form.hero_cover_url}
                onChange={(e) => setForm((f) => ({ ...f, hero_cover_url: e.target.value }))}
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
              {isSafeUrl(form.hero_cover_url) && (
                <div className="rounded-xl overflow-hidden border border-slate-200 h-48 bg-slate-100">
                  <img
                    src={form.hero_cover_url}
                    alt="معاينة الغلاف"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  رابط شعار المؤسسة
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={form.logo_url}
                  onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-left"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  نص التذييل (Footer)
                </label>
                <input
                  type="text"
                  value={form.footer_note}
                  onChange={(e) => setForm((f) => ({ ...f, footer_note: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1E40AF] text-white text-sm font-medium hover:bg-[#1E3A8A] disabled:opacity-60 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'جاري الحفظ...' : 'حفظ إعدادات المنصة'}</span>
            </button>
          </form>
        )}

        {/* Admin Credentials Update */}
        {!auth.envManaged && (
          <form
            onSubmit={handlePasswordChange}
            className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
          >
            <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#1E40AF]" />
              <span>تحديث بيانات دخول المدير</span>
            </h2>

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
              className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              تحديث بيانات الدخول
            </button>
          </form>
        )}
      </div>
    </AdminLayout>
  );
}
