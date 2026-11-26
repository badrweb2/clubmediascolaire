import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Edit3,
  Eye,
  FileText,
  FolderKanban,
  Headphones,
  Image as ImageIcon,
  Layers,
  Play,
  PlusCircle,
  RotateCcw,
  Users,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { AdminLayout } from './AdminLayout.tsx';
import { CONTENT_TYPE_LABELS, formatArabicDate } from '../../lib/mediaUtils.ts';
import type { AdminStats } from '../../types.ts';

export function AdminDashboardPage() {
  const { apiFetch, navigate } = useApp();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<AdminStats>('/api/admin/stats');
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل الإحصائيات.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleResetStats = async () => {
    setResetting(true);
    try {
      await apiFetch('/api/admin/stats/reset', { method: 'POST' });
      setConfirmReset(false);
      await loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تصفير العدادات.');
    } finally {
      setResetting(false);
    }
  };

  const statCards = stats
    ? [
        { label: 'إجمالي زيارات المنصة (حقيقي)', value: stats.total_site_visits, icon: Activity },
        { label: 'زيارات اليوم', value: stats.today_site_visits, icon: Activity },
        { label: 'الزوار الفريدون', value: stats.unique_visitors, icon: Users },
        { label: 'مشاهدات الإنتاجات الفعلية', value: stats.total_views, icon: Eye },
        { label: 'إجمالي الإنتاجات', value: stats.total_items, icon: Layers },
        { label: 'المحتويات المنشورة', value: stats.published_count, icon: CheckCircle2 },
        { label: 'المسودات', value: stats.draft_count, icon: Edit3 },
        { label: 'الفيديوهات', value: stats.total_videos, icon: Play },
        { label: 'التسجيلات الصوتية والإذاعة', value: stats.total_audio, icon: Headphones },
        { label: 'الصور والفنون', value: stats.total_images, icon: ImageIcon },
        { label: 'المشاريع المدرسية', value: stats.total_projects, icon: FolderKanban },
        {
          label: 'العروض وملفات PDF',
          value: stats.total_pdfs + stats.total_presentations,
          icon: FileText,
        },
      ]
    : [];

  return (
    <AdminLayout title="لوحة التحكم والإحصائيات">
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">
              ملخص المنصة والإحصائيات الحقيقية
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              متابعة فورية ودقيقة لعدد الزيارات الفعلية للمنصة، مشاهدات الإنتاجات، وحالة النشر.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs sm:text-sm font-medium hover:bg-slate-50 cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" />
              <span>تصفير عدادات الزيارات</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/add')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1E40AF] text-white text-sm font-medium hover:bg-[#1E3A8A] cursor-pointer whitespace-nowrap"
            >
              <PlusCircle className="w-4 h-4" />
              <span>إضافة محتوى جديد</span>
            </button>
          </div>
        </div>

        {confirmReset && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs sm:text-sm text-amber-900">
              هل تريد تصفير جميع عدادات الزيارات والمشاهدات والبدء من الصفر؟
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-xs text-slate-700 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={resetting}
                onClick={handleResetStats}
                className="px-3 py-1.5 rounded-lg bg-amber-700 text-white text-xs font-medium hover:bg-amber-800 disabled:opacity-60 cursor-pointer"
              >
                {resetting ? 'جاري التصفير...' : 'تأكيد التصفير'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="text-xs font-medium text-slate-500">{card.label}</div>
                    <div className="font-display text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                      {card.value}
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-slate-100 text-[#1E40AF] flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Latest Added Works Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <h2 className="font-display text-base font-bold text-slate-900">
              أحدث الإنتاجات المضافة
            </h2>
            <button
              type="button"
              onClick={() => navigate('/admin/works')}
              className="text-xs font-medium text-[#1E40AF] hover:underline cursor-pointer"
            >
              إدارة جميع المحتويات
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-xs text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-medium">العنوان</th>
                  <th className="py-3 px-4 font-medium">النوع</th>
                  <th className="py-3 px-4 font-medium">التصنيف</th>
                  <th className="py-3 px-4 font-medium">تاريخ النشر</th>
                  <th className="py-3 px-4 font-medium">الحالة</th>
                  <th className="py-3 px-4 font-medium">المشاهدات</th>
                  <th className="py-3 px-4 font-medium">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(stats?.latest_items || []).map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-medium text-slate-900 max-w-[260px] truncate">
                      {item.title}
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {CONTENT_TYPE_LABELS[item.content_type]}
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {item.category_name}
                    </td>
                    <td className="py-3 px-4 text-slate-500 tabular-nums whitespace-nowrap">
                      {formatArabicDate(item.publish_date)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`text-xs font-medium ${
                          item.status === 'published' ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {item.status === 'published' ? 'منشور' : 'مسودة'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-600">
                      {item.views_count}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/edit/${item.id}`)}
                        className="text-xs font-medium text-[#1E40AF] hover:underline cursor-pointer"
                      >
                        تعديل ومعاينة
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && (!stats?.latest_items || stats.latest_items.length === 0) && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      لا توجد محتويات مضافة بعد.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
