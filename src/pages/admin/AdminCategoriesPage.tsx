import React, { useEffect, useState } from 'react';
import { Check, Edit3, FolderPlus, Layers, Trash2, X } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { AdminLayout } from './AdminLayout.tsx';
import { ConfirmDeleteDropdown } from '../../components/ConfirmDeleteDropdown.tsx';
import type { Category } from '../../types.ts';

export function AdminCategoriesPage() {
  const { apiFetch, refreshPublicBootstrap } = useApp();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newParentId, setNewParentId] = useState<string>('');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(
    null
  );

  useEffect(() => {
    setLoading(true);
    apiFetch<{ categories: Category[] }>('/api/admin/categories')
      .then((res) => setCategories(res.categories))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apiFetch]);

  const mainCategories = categories.filter((c) => c.parent_id === null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!newName.trim()) return;
    try {
      const res = await apiFetch<{ categories: Category[] }>('/api/admin/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: newName.trim(),
          description: newDesc.trim(),
          parent_id: newParentId ? Number(newParentId) : null,
        }),
      });
      setCategories(res.categories);
      setNewName('');
      setNewDesc('');
      setNewParentId('');
      await refreshPublicBootstrap();
      setFeedback({ type: 'success', text: 'تمت إضافة التصنيف بنجاح.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'تعذر إضافة التصنيف.',
      });
    }
  };

  const handleSaveEdit = async (id: number) => {
    setFeedback(null);
    if (!editName.trim()) return;
    try {
      const res = await apiFetch<{ categories: Category[] }>(`/api/admin/categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editName.trim(), description: editDesc.trim() }),
      });
      setCategories(res.categories);
      setEditingId(null);
      await refreshPublicBootstrap();
      setFeedback({ type: 'success', text: 'تم تحديث التصنيف.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'تعذر تعديل التصنيف.',
      });
    }
  };

  const handleDeleteCategory = async (id: number) => {
    setFeedback(null);
    setDeletingId(id);
    try {
      const res = await apiFetch<{ categories: Category[] }>(`/api/admin/categories/${id}`, {
        method: 'DELETE',
      });
      setCategories(res.categories);
      await refreshPublicBootstrap();
      setFeedback({ type: 'success', text: 'تم حذف التصنيف.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'تعذر حذف التصنيف.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AdminLayout title="إدارة التصنيفات">
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            إدارة التصنيفات الرئيسية والفرعية
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            نظّم مجالات إنتاجات التلاميذ بإضافة تصنيفات رئيسية أو تصنيفات فرعية متخصصة.
          </p>
        </div>

        {feedback && (
          <div
            className={`p-3.5 rounded-xl border text-sm ${
              feedback.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* Add Category Form */}
        <form
          onSubmit={handleAdd}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
            <FolderPlus className="w-4 h-4 text-[#1E40AF]" />
            <span>إضافة تصنيف جديد</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                اسم التصنيف *
              </label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="مثال: المسرح المدرسي"
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                يتبع لتصنيف رئيسي (للتصنيف الفرعي)
              </label>
              <select
                value={newParentId}
                onChange={(e) => setNewParentId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
              >
                <option value="">تصنيف رئيسي مستقل</option>
                {mainCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    فرعي تحت: {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                وصف مختصر (اختياري)
              </label>
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="وصف يظهر في واجهة المنصة..."
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1E40AF] text-white text-sm font-medium hover:bg-[#1E3A8A] cursor-pointer"
          >
            <FolderPlus className="w-4 h-4" />
            <span>حفظ التصنيف</span>
          </button>
        </form>

        {/* Categories Tree List */}
        {loading ? (
          <div className="h-48 bg-white border border-slate-200 rounded-xl animate-pulse" />
        ) : (
          <div className="space-y-4">
            {mainCategories.map((cat) => {
              const subs = categories.filter((s) => s.parent_id === cat.id);
              const isEditing = editingId === cat.id;

              return (
                <div
                  key={cat.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {isEditing ? (
                      <div className="flex-1 flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm flex-1"
                        />
                        <input
                          type="text"
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          placeholder="الوصف"
                          className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm flex-1"
                        />
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(cat.id)}
                            className="p-2 rounded-lg bg-emerald-600 text-white cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="p-2 rounded-lg border border-slate-200 text-slate-600 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2.5">
                            <Layers className="w-4 h-4 text-[#1E40AF]" />
                            <h3 className="font-semibold text-base text-slate-900">{cat.name}</h3>
                            <span className="text-xs font-mono tabular-nums text-slate-500">
                              ({cat.item_count || 0} إنتاج)
                            </span>
                          </div>
                          {cat.description && (
                            <p className="text-xs text-slate-500">{cat.description}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(cat.id);
                              setEditName(cat.name);
                              setEditDesc(cat.description);
                            }}
                            title="تعديل التصنيف"
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <ConfirmDeleteDropdown
                            message={`هل تريد حذف التصنيف «${cat.name}»؟`}
                            busy={deletingId === cat.id}
                            onConfirm={() => handleDeleteCategory(cat.id)}
                            renderTrigger={({ onClick }) => (
                              <button
                                type="button"
                                onClick={onClick}
                                title="حذف التصنيف"
                                className="p-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {subs.length > 0 && (
                    <div className="pr-6 border-t border-slate-100 pt-3 space-y-2">
                      {subs.map((sub) => (
                        <div
                          key={sub.id}
                          className="flex items-center justify-between gap-3 py-1.5 text-sm"
                        >
                          {editingId === sub.id ? (
                            <div className="flex-1 flex items-center gap-2">
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="px-2.5 py-1 rounded-lg border border-slate-300 text-sm flex-1"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(sub.id)}
                                className="p-1.5 rounded-lg bg-emerald-600 text-white cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 text-slate-700">
                                <span className="text-slate-400">↳</span>
                                <span>{sub.name}</span>
                                <span className="text-xs font-mono tabular-nums text-slate-400">
                                  ({sub.item_count || 0})
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingId(sub.id);
                                    setEditName(sub.name);
                                    setEditDesc(sub.description);
                                  }}
                                  title="تعديل التصنيف الفرعي"
                                  className="p-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <ConfirmDeleteDropdown
                                  message={`هل تريد حذف التصنيف الفرعي «${sub.name}»؟`}
                                  busy={deletingId === sub.id}
                                  onConfirm={() => handleDeleteCategory(sub.id)}
                                  renderTrigger={({ onClick }) => (
                                    <button
                                      type="button"
                                      onClick={onClick}
                                      title="حذف التصنيف الفرعي"
                                      className="p-1 rounded border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                />
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
