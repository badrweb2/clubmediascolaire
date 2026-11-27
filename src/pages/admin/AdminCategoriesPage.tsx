import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Edit3,
  FolderPlus,
  GripVertical,
  Layers,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { AdminLayout } from './AdminLayout.tsx';
import { ConfirmDeleteDropdown } from '../../components/ConfirmDeleteDropdown.tsx';
import { ConfirmActionDropdown } from '../../components/ConfirmActionDropdown.tsx';
import type { Category } from '../../types.ts';

export function AdminCategoriesPage() {
  const { apiFetch, refreshPublicBootstrap } = useApp();
  const [categories, setCategories] = useState<Category[]>([]);
  const [baselineOrders, setBaselineOrders] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newParentId, setNewParentId] = useState<string>('');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [dragSub, setDragSub] = useState<{ parentId: number; draggedId: number } | null>(null);
  const [dragOverSubId, setDragOverSubId] = useState<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(
    null
  );

  const syncFromServer = (list: Category[]) => {
    setCategories(list);
    const map: Record<number, number> = {};
    for (const c of list) {
      map[c.id] = c.sort_order;
    }
    setBaselineOrders(map);
  };

  useEffect(() => {
    setLoading(true);
    apiFetch<{ categories: Category[] }>('/api/admin/categories')
      .then((res) => syncFromServer(res.categories))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apiFetch]);

  const mainCategories = useMemo(
    () => categories.filter((c) => c.parent_id === null),
    [categories]
  );

  const hasSubOrderChanges = useMemo(
    () =>
      categories.some(
        (c) => c.parent_id !== null && baselineOrders[c.id] !== undefined && baselineOrders[c.id] !== c.sort_order
      ),
    [categories, baselineOrders]
  );

  const getSortedSubs = (parentId: number) =>
    categories
      .filter((s) => s.parent_id === parentId)
      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);

  const applySubListOrder = (parentId: number, orderedSubs: Category[]) => {
    const orderById = new Map<number, number>();
    orderedSubs.forEach((s, idx) => orderById.set(s.id, idx + 1));

    setCategories((prev) =>
      prev.map((c) => {
        if (c.parent_id === parentId && orderById.has(c.id)) {
          return { ...c, sort_order: orderById.get(c.id)! };
        }
        return c;
      })
    );
  };

  const handleDropSubcategory = (parentId: number, targetSubId: number) => {
    if (!dragSub || dragSub.parentId !== parentId || dragSub.draggedId === targetSubId) {
      setDragSub(null);
      setDragOverSubId(null);
      return;
    }
    const subs = getSortedSubs(parentId);
    const fromIdx = subs.findIndex((s) => s.id === dragSub.draggedId);
    const toIdx = subs.findIndex((s) => s.id === targetSubId);
    if (fromIdx === -1 || toIdx === -1) {
      setDragSub(null);
      setDragOverSubId(null);
      return;
    }
    const next = [...subs];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    applySubListOrder(parentId, next);
    setDragSub(null);
    setDragOverSubId(null);
  };

  const handleMoveSubcategory = (parentId: number, subId: number, delta: -1 | 1) => {
    const subs = getSortedSubs(parentId);
    const idx = subs.findIndex((s) => s.id === subId);
    const target = idx + delta;
    if (idx === -1 || target < 0 || target >= subs.length) return;
    const next = [...subs];
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    applySubListOrder(parentId, next);
  };

  const handleResetSubOrder = () => {
    setCategories((prev) =>
      prev.map((c) =>
        baselineOrders[c.id] !== undefined ? { ...c, sort_order: baselineOrders[c.id] } : c
      )
    );
  };

  const handleSaveSubOrder = async () => {
    setFeedback(null);
    setSavingOrder(true);
    try {
      const orders = categories
        .filter((c) => c.parent_id !== null)
        .map((c) => ({ id: c.id, sort_order: c.sort_order }));
      if (orders.length === 0) return;

      const res = await apiFetch<{ categories: Category[] }>('/api/admin/categories/reorder', {
        method: 'PUT',
        body: JSON.stringify({ orders }),
      });
      syncFromServer(res.categories);
      await refreshPublicBootstrap();
      setFeedback({
        type: 'success',
        text: 'تم حفظ الترتيب الجديد للتصنيفات الفرعية وتحديثه في المنصة بنجاح.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'تعذر حفظ ترتيب التصنيفات الفرعية.',
      });
    } finally {
      setSavingOrder(false);
    }
  };

  const handleAdd = async () => {
    setFeedback(null);
    if (!newName.trim()) {
      setFeedback({ type: 'error', text: 'يرجى كتابة اسم التصنيف قبل الحفظ.' });
      return;
    }
    try {
      const res = await apiFetch<{ categories: Category[] }>('/api/admin/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: newName.trim(),
          description: newDesc.trim(),
          parent_id: newParentId ? Number(newParentId) : null,
        }),
      });
      syncFromServer(res.categories);
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
      syncFromServer(res.categories);
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
      syncFromServer(res.categories);
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
            نظّم مجالات إنتاجات التلاميذ، واسحب التصنيفات الفرعية لترتيب ظهورها في القوائم والمنصة.
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

        {hasSubOrderChanges && (
          <div className="sticky top-4 z-20 p-4 rounded-xl border border-blue-200 bg-blue-50/95 backdrop-blur-sm shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-sm text-slate-800 font-medium">
              تم تعديل ترتيب التصنيفات الفرعية. اضغط «حفظ الترتيب الجديد» لاعتماده في المنصة.
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={savingOrder}
                onClick={handleResetSubOrder}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                تراجع
              </button>
              <ConfirmActionDropdown
                variant="primary"
                title="تأكيد حفظ ترتيب التصنيفات"
                message="هل تريد حفظ الترتيب الجديد للتصنيفات الفرعية وتحديثه في واجهة الزوار؟"
                confirmLabel="نعم، حفظ الترتيب"
                busy={savingOrder}
                onConfirm={handleSaveSubOrder}
                renderTrigger={({ onClick }) => (
                  <button
                    type="button"
                    disabled={savingOrder}
                    onClick={onClick}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#1E40AF] text-white text-xs font-medium hover:bg-[#1E3A8A] disabled:opacity-60 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{savingOrder ? 'جاري الحفظ...' : 'حفظ الترتيب الجديد'}</span>
                  </button>
                )}
              />
            </div>
          </div>
        )}

        {/* Add Category Form */}
        <form
          onSubmit={(e) => e.preventDefault()}
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

          <ConfirmActionDropdown
            variant="primary"
            title="تأكيد إضافة التصنيف"
            message={
              newName.trim()
                ? `هل تريد حفظ التصنيف الجديد «${newName.trim()}» وإضافته للمنصة؟`
                : 'سيتم التحقق من الاسم وحفظ التصنيف الجديد.'
            }
            confirmLabel="تأكيد الإضافة"
            onConfirm={handleAdd}
            renderTrigger={({ onClick }) => (
              <button
                type="button"
                onClick={onClick}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1E40AF] text-white text-sm font-medium hover:bg-[#1E3A8A] cursor-pointer"
              >
                <FolderPlus className="w-4 h-4" />
                <span>حفظ التصنيف</span>
              </button>
            )}
          />
        </form>

        {/* Categories Tree List */}
        {loading ? (
          <div className="h-48 bg-white border border-slate-200 rounded-xl animate-pulse" />
        ) : (
          <div className="space-y-4">
            {mainCategories.map((cat) => {
              const subs = getSortedSubs(cat.id);
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
                          <ConfirmActionDropdown
                            variant="primary"
                            title="تأكيد تعديل التصنيف"
                            message={`هل تريد حفظ التعديل على التصنيف «${editName.trim() || cat.name}»؟`}
                            confirmLabel="حفظ التعديل"
                            onConfirm={() => handleSaveEdit(cat.id)}
                            renderTrigger={({ onClick }) => (
                              <button
                                type="button"
                                onClick={onClick}
                                title="حفظ التعديل"
                                className="p-2 rounded-lg bg-emerald-600 text-white cursor-pointer"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                          />
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
                    <div className="pr-4 border-t border-slate-100 pt-3 space-y-2">
                      {subs.length > 1 && (
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mb-1">
                          <GripVertical className="w-3.5 h-3.5" />
                          <span>اسحب التصنيفات الفرعية أو استخدم الأسهم لإعادة ترتيب ظهورها</span>
                        </div>
                      )}
                      {subs.map((sub, subIdx) => {
                        const isDragging = dragSub?.draggedId === sub.id;
                        const isDropTarget = dragOverSubId === sub.id && dragSub?.draggedId !== sub.id;
                        return (
                          <div
                            key={sub.id}
                            draggable={editingId !== sub.id && subs.length > 1}
                            onDragStart={(e) => {
                              setDragSub({ parentId: cat.id, draggedId: sub.id });
                              e.dataTransfer.effectAllowed = 'move';
                              e.dataTransfer.setData('text/plain', String(sub.id));
                            }}
                            onDragOver={(e) => {
                              if (!dragSub || dragSub.parentId !== cat.id) return;
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                              if (dragOverSubId !== sub.id) setDragOverSubId(sub.id);
                            }}
                            onDragLeave={() => {
                              if (dragOverSubId === sub.id) setDragOverSubId(null);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              handleDropSubcategory(cat.id, sub.id);
                            }}
                            onDragEnd={() => {
                              setDragSub(null);
                              setDragOverSubId(null);
                            }}
                            className={`flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                              isDragging
                                ? 'opacity-50 bg-blue-50 border border-dashed border-[#1E40AF]'
                                : isDropTarget
                                  ? 'bg-blue-50/70 border border-[#1E40AF]'
                                  : 'hover:bg-slate-50 border border-transparent'
                            }`}
                          >
                            {editingId === sub.id ? (
                              <div className="flex-1 flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="px-2.5 py-1 rounded-lg border border-slate-300 text-sm flex-1"
                                />
                                <ConfirmActionDropdown
                                  variant="primary"
                                  title="تأكيد تعديل التصنيف الفرعي"
                                  message={`هل تريد حفظ التعديل على التصنيف الفرعي «${editName.trim() || sub.name}»؟`}
                                  confirmLabel="حفظ التعديل"
                                  onConfirm={() => handleSaveEdit(sub.id)}
                                  renderTrigger={({ onClick }) => (
                                    <button
                                      type="button"
                                      onClick={onClick}
                                      title="حفظ التعديل"
                                      className="p-1.5 rounded-lg bg-emerald-600 text-white cursor-pointer"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                />
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
                                <div className="flex items-center gap-2 text-slate-700 min-w-0">
                                  {subs.length > 1 && (
                                    <span
                                      title="اسحب لإعادة الترتيب"
                                      className="text-slate-400 hover:text-[#1E40AF] cursor-grab active:cursor-grabbing shrink-0"
                                    >
                                      <GripVertical className="w-4 h-4" />
                                    </span>
                                  )}
                                  <span className="text-xs font-mono tabular-nums text-slate-400 w-5 text-center shrink-0">
                                    {subIdx + 1}
                                  </span>
                                  <span className="truncate">{sub.name}</span>
                                  <span className="text-xs font-mono tabular-nums text-slate-400 shrink-0">
                                    ({sub.item_count || 0})
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {subs.length > 1 && (
                                    <>
                                      <button
                                        type="button"
                                        disabled={subIdx === 0}
                                        onClick={() => handleMoveSubcategory(cat.id, sub.id, -1)}
                                        title="تحريك للأعلى"
                                        className="p-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer disabled:cursor-default"
                                      >
                                        <ArrowUp className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={subIdx === subs.length - 1}
                                        onClick={() => handleMoveSubcategory(cat.id, sub.id, 1)}
                                        title="تحريك للأسفل"
                                        className="p-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer disabled:cursor-default"
                                      >
                                        <ArrowDown className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
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
                        );
                      })}
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
