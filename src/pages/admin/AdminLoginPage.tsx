import React, { useEffect, useState } from 'react';
import { ArrowRight, KeyRound, Lock, ShieldCheck, User } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { isSafeUrl } from '../../lib/mediaUtils.ts';
import type { AdminPermission } from '../../types.ts';

export function AdminLoginPage() {
  const { auth, setSession, navigate, settings, refreshAuthStatus } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    refreshAuthStatus();
  }, [refreshAuthStatus]);

  useEffect(() => {
    if (auth.authenticated) {
      navigate('/admin');
    }
  }, [auth.authenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (auth.needsSetup) {
      if (username.trim().length < 3) {
        setError('يجب أن يتكون اسم المستخدم من 3 أحرف على الأقل.');
        return;
      }
      if (password.length < 6) {
        setError('يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.');
        return;
      }
      if (password !== confirmPassword) {
        setError('كلمتا المرور غير متطابقتين.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const endpoint = auth.needsSetup ? '/api/auth/setup' : '/api/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        token?: string;
        username?: string;
        displayName?: string;
        permissions?: AdminPermission[];
        isPrimary?: boolean;
        envManaged?: boolean;
        error?: string;
      };
      if (!res.ok || !data.token) {
        throw new Error(data.error || 'تعذر تسجيل الدخول. تحقق من البيانات المدخلة.');
      }
      setSession(data.token, data.username || username.trim(), Boolean(data.envManaged), {
        displayName: data.displayName,
        permissions: data.permissions,
        isPrimary: data.isPrimary,
      });
      navigate('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 px-4 sm:px-6">
      <div className="max-w-md w-full mx-auto space-y-6">
        <div className="text-center space-y-3">
          {isSafeUrl(settings.logo_url) && (
            <img
              src={settings.logo_url}
              alt={settings.school_name}
              referrerPolicy="no-referrer"
              className="h-16 w-auto mx-auto object-contain mix-blend-multiply"
            />
          )}
          <h1 className="font-display text-2xl font-bold text-slate-900">
            {auth.needsSetup ? 'تفعيل حساب مدير المنصة' : 'تسجيل دخول لوحة الإدارة'}
          </h1>
          <p className="text-sm text-slate-600">
            {auth.needsSetup
              ? 'قم بإنشاء اسم المستخدم وكلمة المرور الخاصة بصاحب المنصة لحماية لوحة التحكم.'
              : `بوابة خاصة بإدارة ${settings.platform_title}`}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
          {auth.needsSetup && (
            <div className="mb-5 p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-2.5 leading-relaxed">
              <ShieldCheck className="w-4 h-4 text-[#1E40AF] shrink-0 mt-0.5" />
              <span>
                الإعداد الأولي للمنصة: هذه الخطوة تُنفّذ مرة واحدة فقط لتعيين بيانات الدخول المشفرة
                للمدير وحفظها على الخادم.
              </span>
            </div>
          )}

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="admin-username" className="block text-sm font-medium text-slate-700 mb-1.5">
                اسم المستخدم
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="admin-username"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="أدخل اسم المستخدم"
                  className="w-full pr-10 pl-4 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="admin-password" className="block text-sm font-medium text-slate-700 mb-1.5">
                كلمة المرور
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="admin-password"
                  type="password"
                  required
                  autoComplete={auth.needsSetup ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pr-10 pl-4 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                />
              </div>
            </div>

            {auth.needsSetup && (
              <div>
                <label
                  htmlFor="admin-confirm-password"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  تأكيد كلمة المرور
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="admin-confirm-password"
                    type="password"
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="أعد كتابة كلمة المرور"
                    className="w-full pr-10 pl-4 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-lg bg-[#1E40AF] text-white text-sm font-medium hover:bg-[#1E3A8A] disabled:opacity-60 transition-colors cursor-pointer"
            >
              {submitting
                ? 'جاري التحقق...'
                : auth.needsSetup
                  ? 'حفظ بيانات المدير والدخول'
                  : 'تسجيل الدخول إلى لوحة التحكم'}
            </button>
          </form>
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-[#1E40AF] cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة إلى واجهة المنصة العامة</span>
          </button>
        </div>
      </div>
    </div>
  );
}
