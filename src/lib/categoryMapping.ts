import type { Category } from '../types.ts';

export type CatalogMode =
  | 'all'
  | 'videos'
  | 'audio'
  | 'innovations'
  | 'projects'
  | 'activities'
  | 'creations'
  | 'presentations'
  | 'competitions'
  | 'designs'
  | 'gallery';

export function resolveMainCategoryForMode(
  mode: CatalogMode,
  categories: Category[]
): Category | null {
  if (mode === 'all') return null;
  const mainCats = categories.filter((c) => c.parent_id === null);
  if (mainCats.length === 0) return null;

  switch (mode) {
    case 'videos':
      return (
        mainCats.find((c) => c.slug === 'videos') ||
        mainCats.find((c) => c.name.trim() === 'الفيديوهات') ||
        mainCats.find((c) => /فيديو/.test(c.name)) ||
        null
      );
    case 'audio':
      return (
        mainCats.find((c) => c.slug === 'audio-radio') ||
        mainCats.find((c) => /إذاعة|صوت/.test(c.name)) ||
        null
      );
    case 'gallery':
      return (
        mainCats.find((c) => c.slug === 'arts-photos') ||
        mainCats.find((c) => /فنون|تشكيلية|صور/.test(c.name)) ||
        null
      );
    case 'innovations':
      return (
        mainCats.find((c) => c.name.trim() === 'ابتكارات') ||
        mainCats.find((c) => c.name.includes('ابتكار') && c.slug !== 'projects') ||
        mainCats.find((c) => c.slug === 'projects') ||
        mainCats.find((c) => /ابتكار|تكنولوج/.test(c.name)) ||
        null
      );
    case 'projects':
      return (
        mainCats.find((c) => c.name.trim() === 'مشاريع') ||
        mainCats.find((c) => c.name.includes('مشاريع') && !c.name.includes('ابتكار')) ||
        mainCats.find((c) => c.slug === 'projects') ||
        mainCats.find((c) => /مشاريع|مشروع/.test(c.name)) ||
        null
      );
    case 'activities':
      return (
        mainCats.find((c) => c.slug === 'cultural-activities') ||
        mainCats.find((c) => c.name.trim() === 'أنشطة') ||
        mainCats.find((c) => /الأنشطة|أنشطة/.test(c.name)) ||
        null
      );
    case 'creations':
      return (
        mainCats.find((c) => c.slug === 'student-creations') ||
        mainCats.find((c) => c.name.trim() === 'إنتاجات') ||
        mainCats.find((c) => c.name.includes('إبداعات التلاميذ')) ||
        null
      );
    case 'presentations':
      return (
        mainCats.find((c) => c.slug === 'research-presentations') ||
        mainCats.find((c) => c.name.trim() === 'عروض') ||
        mainCats.find((c) => /العروض|البحوث|عروض/.test(c.name)) ||
        null
      );
    case 'competitions':
      return (
        mainCats.find((c) => c.slug === 'competitions') ||
        mainCats.find((c) => /مسابق|تحديات/.test(c.name)) ||
        null
      );
    case 'designs':
      return (
        mainCats.find((c) => c.slug === 'designs-creations') ||
        mainCats.find((c) => /تصاميم/.test(c.name)) ||
        mainCats.find((c) => c.name.trim() === 'إبداعات') ||
        null
      );
    default:
      return null;
  }
}

export function getCornerTargetForCategory(
  categoryId: number,
  categories: Category[],
  fallbackName?: string
): { path: string; label: string } {
  const cat = categories.find((c) => c.id === categoryId);
  const mainCat =
    cat && cat.parent_id !== null
      ? categories.find((c) => c.id === cat.parent_id) || cat
      : cat;

  if (!mainCat) {
    return {
      path: categoryId ? `/works?categoryId=${categoryId}` : '/works',
      label: fallbackName ? `العودة إلى ${fallbackName}` : 'العودة إلى الإنتاجات',
    };
  }

  const slug = mainCat.slug;
  const name = mainCat.name;

  if (slug === 'videos' || /فيديو/.test(name)) {
    return { path: '/videos', label: `العودة إلى ${name}` };
  }
  if (slug === 'audio-radio' || /إذاعة|صوت/.test(name)) {
    return { path: '/audio', label: `العودة إلى ${name}` };
  }
  if (slug === 'arts-photos' || /فنون|تشكيلية|صور/.test(name)) {
    return { path: '/gallery', label: `العودة إلى ${name}` };
  }
  if (name.trim() === 'ابتكارات' || (name.includes('ابتكار') && slug !== 'projects')) {
    return { path: '/innovations', label: `العودة إلى ${name}` };
  }
  if (slug === 'projects' || /مشاريع|ابتكار/.test(name)) {
    return { path: '/projects', label: `العودة إلى ${name}` };
  }
  if (slug === 'cultural-activities' || /أنشطة/.test(name)) {
    return { path: '/activities', label: `العودة إلى ${name}` };
  }
  if (slug === 'student-creations' || name.includes('إبداعات التلاميذ')) {
    return { path: '/creations', label: `العودة إلى ${name}` };
  }
  if (slug === 'research-presentations' || /عروض|بحوث/.test(name)) {
    return { path: '/presentations', label: `العودة إلى ${name}` };
  }
  if (slug === 'competitions' || /مسابق|تحديات/.test(name)) {
    return { path: '/competitions', label: `العودة إلى ${name}` };
  }
  if (slug === 'designs-creations' || /تصاميم/.test(name)) {
    return { path: '/designs', label: `العودة إلى ${name}` };
  }

  return {
    path: `/works?categoryId=${mainCat.id}`,
    label: `العودة إلى ${name}`,
  };
}
