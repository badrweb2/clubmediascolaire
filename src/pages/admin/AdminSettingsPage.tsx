import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  Image as ImageIcon,
  Info,
  KeyRound,
  LayoutTemplate,
  Link2,
  Megaphone,
  Palette,
  Plus,
  RotateCcw,
  Save,
  Shield,
  Sliders,
  Trash2,
  UserPlus,
  Users,
  Volume2,
  X,
  XCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { AdminLayout } from './AdminLayout.tsx';
import { ConfirmDeleteDropdown } from '../../components/ConfirmDeleteDropdown.tsx';
import { ConfirmActionDropdown } from '../../components/ConfirmActionDropdown.tsx';
import { SocialBrandIcon, getSocialBrandColor } from '../../components/SocialBrandIcon.tsx';
import { isSafeUrl, normalizeImageUrl } from '../../lib/mediaUtils.ts';
import {
  ADMIN_PERMISSION_LABELS,
  ALL_ADMIN_PERMISSIONS,
  BUILTIN_NAV_ITEMS,
  DEFAULT_PLATFORM_SETTINGS,
  DEFAULT_SOCIAL_LINKS,
  SOCIAL_ICON_OPTIONS,
  UI_SOUND_PRESET_OPTIONS,
  isSafeSocialUrl,
  isSettingEnabled,
  parseCustomNavItems,
  parseFaqJson,
  parseHeroExtraCoversJson,
  parseHiddenNavKeys,
  parseSocialLinksJson,
} from '../../lib/settingsDefaults.ts';
import {
  BACKGROUND_BANK,
  normalizeBackgroundValue,
  resolveBackgroundStyle,
  resolveFontFamilyStack,
  THEME_BANK,
  type SiteThemePreset,
} from '../../lib/themePresets.ts';
import {
  playSoundPreview,
  setUiSoundPreset,
  setUiSoundsEnabled,
} from '../../lib/uiSounds.ts';
import type {
  AdminPermission,
  AdminUserSummary,
  CustomNavItem,
  FaqItem,
  PlatformSettings,
  SocialIconKey,
  SocialLinkItem,
  UiSoundPreset,
} from '../../types.ts';

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

const INTERNAL_ROUTE_OPTIONS = [
  { value: '/', label: 'الصفحة الرئيسية' },
  { value: '/videos', label: 'قسم الفيديوهات' },
  { value: '/audio', label: 'قسم الإذاعة المدرسية' },
  { value: '/innovations', label: 'قسم الابتكارات' },
  { value: '/projects', label: 'قسم المشاريع' },
  { value: '/activities', label: 'قسم الأنشطة' },
  { value: '/creations', label: 'قسم إبداعات التلاميذ' },
  { value: '/presentations', label: 'قسم العروض والبحوث' },
  { value: '/competitions', label: 'قسم المسابقات' },
  { value: '/designs', label: 'قسم التصاميم والإبداعات' },
  { value: '/works', label: 'المعرض الكامل' },
  { value: '/about', label: 'حول المنصة' },
];

type BackgroundFieldKey = 'bg_site' | 'bg_home' | 'bg_pages' | 'bg_cards' | 'bg_work_detail';

const BACKGROUND_FIELDS: Array<{
  key: BackgroundFieldKey;
  label: string;
  shortLabel: string;
  hint: string;
}> = [
  {
    key: 'bg_site',
    label: 'الخلفية العامة للموقع',
    shortLabel: 'الموقع',
    hint: 'تُطبق كخلفية افتراضية لكافة واجهات المنصة.',
  },
  {
    key: 'bg_home',
    label: 'خلفية الصفحة الرئيسية',
    shortLabel: 'الرئيسية',
    hint: 'تُخصص للصفحة الرئيسية فوق الخلفية العامة.',
  },
  {
    key: 'bg_pages',
    label: 'خلفية الصفحات والأقسام',
    shortLabel: 'الصفحات',
    hint: 'تُطبق على صفحات الأقسام والفيديوهات والإذاعة وحول المنصة.',
  },
  {
    key: 'bg_cards',
    label: 'خلفية البطاقات',
    shortLabel: 'البطاقات',
    hint: 'خلفية بطاقات الإنتاجات والمشاريع في المعرض والرئيسية.',
  },
  {
    key: 'bg_work_detail',
    label: 'خلفية صفحة عرض الموضوع',
    shortLabel: 'المواضيع',
    hint: 'تُطبق على صفحة عرض المشغل وتفاصيل كل موضوع.',
  },
];

type SettingsTab = 'identity' | 'sections' | 'about' | 'security';

export function AdminSettingsPage() {
  const {
    apiFetch,
    refreshPublicBootstrap,
    auth,
    setSession,
    token,
    categories,
    hasPermission,
  } = useApp();

  const canManageSettings = hasPermission('manage_settings');
  const canManageUsers = hasPermission('manage_users');

  const [activeTab, setActiveTab] = useState<SettingsTab>(() =>
    canManageSettings ? 'identity' : 'security'
  );
  const [form, setForm] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS);
  const [faqItems, setFaqItems] = useState<FaqItem[]>(() =>
    parseFaqJson(DEFAULT_PLATFORM_SETTINGS.about_faq_json)
  );
  const [customNavItems, setCustomNavItems] = useState<CustomNavItem[]>([]);
  const [hiddenNavKeys, setHiddenNavKeys] = useState<string[]>([]);
  const [heroExtraCovers, setHeroExtraCovers] = useState<string[]>([]);
  const [newHeroExtraUrl, setNewHeroExtraUrl] = useState('');
  const [socialLinks, setSocialLinks] = useState<SocialLinkItem[]>(DEFAULT_SOCIAL_LINKS);
  const [newSocialLabel, setNewSocialLabel] = useState('');
  const [newSocialUrl, setNewSocialUrl] = useState('');
  const [newSocialIcon, setNewSocialIcon] = useState<SocialIconKey>('website');
  const [loading, setLoading] = useState(canManageSettings);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(
    null
  );

  // Copy feedback for background bank & theme filter
  const [copiedBgId, setCopiedBgId] = useState<string | null>(null);
  const [themeCategoryFilter, setThemeCategoryFilter] = useState<'all' | 'kids' | 'educational' | 'classic'>('all');

  // New custom nav button builder
  const [newNavLabel, setNewNavLabel] = useState('');
  const [newNavType, setNewNavType] = useState<'category' | 'route' | 'url'>('category');
  const [newNavTarget, setNewNavTarget] = useState('');

  // Self password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passFeedback, setPassFeedback] = useState<{
    type: 'error' | 'success';
    text: string;
  } | null>(null);

  // Multi-user RBAC management state
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userFeedback, setUserFeedback] = useState<{
    type: 'error' | 'success';
    text: string;
  } | null>(null);

  const [createUserUsername, setCreateUserUsername] = useState('');
  const [createUserDisplay, setCreateUserDisplay] = useState('');
  const [createUserPassword, setCreateUserPassword] = useState('');
  const [createUserActive, setCreateUserActive] = useState(true);
  const [createUserPerms, setCreateUserPerms] = useState<AdminPermission[]>(['manage_works']);
  const [creatingUser, setCreatingUser] = useState(false);

  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editUserDisplay, setEditUserDisplay] = useState('');
  const [editUserPassword, setEditUserPassword] = useState('');
  const [editUserActive, setEditUserActive] = useState(true);
  const [editUserPerms, setEditUserPerms] = useState<AdminPermission[]>([]);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);

  const loadSettings = useCallback(() => {
    if (!canManageSettings) {
      setLoading(false);
      return;
    }
    setLoading(true);
    apiFetch<{ settings: PlatformSettings }>('/api/admin/settings')
      .then((res) => {
        setForm(res.settings);
        setFaqItems(parseFaqJson(res.settings.about_faq_json));
        setCustomNavItems(parseCustomNavItems(res.settings.custom_nav_items_json));
        setHiddenNavKeys(parseHiddenNavKeys(res.settings.hidden_nav_keys_json));
        setHeroExtraCovers(parseHeroExtraCoversJson(res.settings.hero_extra_covers_json));
        setSocialLinks(parseSocialLinksJson(res.settings.social_links_json));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apiFetch, canManageSettings]);

  const loadUsers = useCallback(() => {
    if (!canManageUsers || auth.envManaged) return;
    setUsersLoading(true);
    apiFetch<{ users: AdminUserSummary[] }>('/api/admin/users')
      .then((res) => setUsers(res.users))
      .catch(() => {})
      .finally(() => setUsersLoading(false));
  }, [apiFetch, canManageUsers, auth.envManaged]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (newNavType === 'category' && !newNavTarget && categories.length > 0) {
      setNewNavTarget(String(categories[0].id));
    } else if (newNavType === 'route' && !newNavTarget) {
      setNewNavTarget('/');
    }
  }, [newNavType, newNavTarget, categories]);

  const persistSettings = async (override?: Partial<PlatformSettings>, successMsg?: string) => {
    setFeedback(null);
    setSaving(true);
    try {
      const merged: PlatformSettings = { ...form, ...(override || {}) };
      const cleanedFaq = faqItems
        .map((item) => ({
          question: item.question.trim(),
          answer: item.answer.trim(),
        }))
        .filter((item) => item.question || item.answer);

      const cleanedHeroExtras = heroExtraCovers
        .map((u) => normalizeImageUrl(u))
        .filter((u, idx, arr) => Boolean(u) && isSafeUrl(u) && arr.indexOf(u) === idx);

      const cleanedSocialLinks = socialLinks
        .map((item, idx) => ({
          id: item.id || `social-${idx + 1}`,
          label: item.label.trim() || 'رابط خارجي',
          url: item.url.trim(),
          icon: item.icon || 'website',
          enabled: item.enabled !== false,
        }))
        .filter((item) => isSafeSocialUrl(item.url));

      if (cleanedSocialLinks.length !== socialLinks.length) {
        setFeedback({
          type: 'error',
          text: 'أحد روابط التواصل الاجتماعي غير صالح. يرجى التأكد من أن جميع الروابط تبدأ بـ https:// أو http://.',
        });
        setSaving(false);
        return;
      }

      const normalizedForm: PlatformSettings = {
        ...merged,
        hero_cover_url: normalizeImageUrl(merged.hero_cover_url),
        logo_url: normalizeImageUrl(merged.logo_url),
        bg_site: normalizeBackgroundValue(merged.bg_site),
        bg_home: normalizeBackgroundValue(merged.bg_home),
        bg_pages: normalizeBackgroundValue(merged.bg_pages),
        bg_cards: normalizeBackgroundValue(merged.bg_cards),
        bg_work_detail: normalizeBackgroundValue(merged.bg_work_detail),
        about_faq_json: JSON.stringify(cleanedFaq),
        hidden_nav_keys_json: JSON.stringify(hiddenNavKeys),
        custom_nav_items_json: JSON.stringify(customNavItems),
        hero_extra_covers_json: JSON.stringify(cleanedHeroExtras),
        ui_sound_preset: merged.ui_sound_preset || 'classic',
        social_links_json: JSON.stringify(cleanedSocialLinks),
      };

      const res = await apiFetch<{ settings: PlatformSettings }>('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(normalizedForm),
      });
      setForm(res.settings);
      setFaqItems(parseFaqJson(res.settings.about_faq_json));
      setCustomNavItems(parseCustomNavItems(res.settings.custom_nav_items_json));
      setHiddenNavKeys(parseHiddenNavKeys(res.settings.hidden_nav_keys_json));
      setHeroExtraCovers(parseHeroExtraCoversJson(res.settings.hero_extra_covers_json));
      setSocialLinks(parseSocialLinksJson(res.settings.social_links_json));
      setUiSoundPreset(res.settings.ui_sound_preset);
      await refreshPublicBootstrap();
      setFeedback({
        type: 'success',
        text: successMsg || 'تم حفظ جميع إعدادات المنصة وتحديث الواجهة بنجاح.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'تعذر حفظ الإعدادات.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleApplyThemePreset = async (preset: SiteThemePreset) => {
    setForm((prev) => ({ ...prev, ...preset.values }));
    await persistSettings(
      preset.values,
      `تم تطبيق ثيم «${preset.name}» وحفظه في واجهة المنصة بنجاح.`
    );
  };

  const handleCopyBgLink = async (id: string, value: string) => {
    try {
      const fullValue =
        value.startsWith('/') && typeof window !== 'undefined'
          ? `${window.location.origin}${value}`
          : value;
      await navigator.clipboard.writeText(fullValue);
      setCopiedBgId(id);
      setTimeout(() => setCopiedBgId((prev) => (prev === id ? null : prev)), 1800);
    } catch {
      setCopiedBgId(null);
    }
  };

  const handleApplyBackgroundTarget = (field: BackgroundFieldKey, value: string, label: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFeedback({
      type: 'success',
      text: `تم اختيار «${label}» في خانة الخلفية. اضغط «حفظ جميع الإعدادات» بالأسفل لتطبيقه نهائياً للزوار.`,
    });
  };

  const toggleBuiltinNavVisible = (key: string) => {
    setHiddenNavKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleAddCustomNavItem = () => {
    const label = newNavLabel.trim();
    const target = newNavTarget.trim();
    if (!label || !target) {
      setFeedback({ type: 'error', text: 'يرجى إدخال اسم الزر والوجهة قبل إضافته.' });
      return;
    }
    if (newNavType === 'url' && !isSafeUrl(target)) {
      setFeedback({ type: 'error', text: 'يرجى إدخال رابط يبدأ بـ https:// أو http://.' });
      return;
    }

    const nextItem: CustomNavItem = {
      id: `custom-${Date.now()}`,
      label,
      target_type: newNavType,
      target_value: target,
      enabled: true,
    };
    setCustomNavItems((prev) => [...prev, nextItem]);
    setNewNavLabel('');
    if (newNavType === 'url') setNewNavTarget('');
    setFeedback({
      type: 'success',
      text: `تمت إضافة الزر «${label}» إلى القائمة. اضغط «حفظ جميع الإعدادات» لاعتماده في المنصة.`,
    });
  };

  const moveCustomNavItem = (idx: number, delta: -1 | 1) => {
    const target = idx + delta;
    if (target < 0 || target >= customNavItems.length) return;
    setCustomNavItems((prev) => {
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[target];
      next[target] = temp;
      return next;
    });
  };

  const handleAddHeroExtraCover = (rawUrl?: string) => {
    const candidate = normalizeImageUrl((rawUrl ?? newHeroExtraUrl).trim());
    if (!candidate || !isSafeUrl(candidate)) {
      setFeedback({ type: 'error', text: 'يرجى إدخال رابط صورة صالح يبدأ بـ https:// أو http://.' });
      return;
    }
    if (candidate === normalizeImageUrl(form.hero_cover_url) || heroExtraCovers.includes(candidate)) {
      setFeedback({ type: 'error', text: 'هذه الصورة مضافة مسبقاً ضمن صور الواجهة الرئيسية.' });
      return;
    }
    setHeroExtraCovers((prev) => [...prev, candidate]);
    if (!rawUrl) setNewHeroExtraUrl('');
    setFeedback({
      type: 'success',
      text: 'تمت إضافة الصورة للعرض المتحرك في الرئيسية. اضغط «حفظ جميع الإعدادات» لتطبيق التغيير.',
    });
  };

  const moveHeroExtraCover = (idx: number, delta: -1 | 1) => {
    const target = idx + delta;
    if (target < 0 || target >= heroExtraCovers.length) return;
    setHeroExtraCovers((prev) => {
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[target];
      next[target] = temp;
      return next;
    });
  };

  const handleAddSocialLink = () => {
    const label = newSocialLabel.trim();
    const url = newSocialUrl.trim();
    if (!label) {
      setFeedback({ type: 'error', text: 'يرجى كتابة اسم القناة أو الموقع قبل الإضافة.' });
      return;
    }
    if (!isSafeSocialUrl(url)) {
      setFeedback({ type: 'error', text: 'يرجى إدخال رابط صالح يبدأ بـ https:// أو http://.' });
      return;
    }
    setSocialLinks((prev) => [
      ...prev,
      {
        id: `social-${Date.now()}`,
        label,
        url,
        icon: newSocialIcon,
        enabled: true,
      },
    ]);
    setNewSocialLabel('');
    setNewSocialUrl('');
    setFeedback({
      type: 'success',
      text: `تمت إضافة رابط «${label}» لأزرار التواصل الاجتماعي. اضغط «حفظ جميع الإعدادات» لتثبيته في التذييل.`,
    });
  };

  const moveSocialLink = (idx: number, delta: -1 | 1) => {
    const target = idx + delta;
    if (target < 0 || target >= socialLinks.length) return;
    setSocialLinks((prev) => {
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[target];
      next[target] = temp;
      return next;
    });
  };

  const handlePasswordChange = async () => {
    setPassFeedback(null);
    if (!currentPassword) {
      setPassFeedback({ type: 'error', text: 'يرجى إدخال كلمة المرور الحالية.' });
      return;
    }
    try {
      const res = await apiFetch<{
        ok: boolean;
        username: string;
        displayName?: string;
        permissions?: AdminPermission[];
        isPrimary?: boolean;
      }>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword,
          newUsername: newUsername.trim(),
          newPassword,
        }),
      });
      if (token && res.username) {
        setSession(token, res.username, auth.envManaged, {
          displayName: res.displayName ?? auth.displayName,
          permissions: res.permissions ?? auth.permissions,
          isPrimary: res.isPrimary ?? auth.isPrimary,
        });
      }
      setCurrentPassword('');
      setNewUsername('');
      setNewPassword('');
      setPassFeedback({ type: 'success', text: 'تم تحديث بيانات الدخول بنجاح.' });
      loadUsers();
    } catch (err) {
      setPassFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'تعذر تحديث كلمة المرور.',
      });
    }
  };

  const handleCreateUser = async () => {
    setUserFeedback(null);
    if (createUserUsername.trim().length < 3) {
      setUserFeedback({ type: 'error', text: 'اسم المستخدم يجب أن يتكون من 3 أحرف على الأقل.' });
      return;
    }
    if (createUserPassword.length < 6) {
      setUserFeedback({ type: 'error', text: 'كلمة المرور يجب أن تتكون من 6 أحرف على الأقل.' });
      return;
    }
    setCreatingUser(true);
    try {
      const res = await apiFetch<{ users: AdminUserSummary[] }>('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          username: createUserUsername.trim(),
          display_name: createUserDisplay.trim() || createUserUsername.trim(),
          password: createUserPassword,
          permissions: createUserPerms,
          is_active: createUserActive,
        }),
      });
      setUsers(res.users);
      setCreateUserUsername('');
      setCreateUserDisplay('');
      setCreateUserPassword('');
      setCreateUserPerms(['manage_works']);
      setCreateUserActive(true);
      setUserFeedback({ type: 'success', text: 'تمت إضافة حساب المستخدم وصلاحياته بنجاح.' });
    } catch (err) {
      setUserFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'تعذر إنشاء المستخدم.',
      });
    } finally {
      setCreatingUser(false);
    }
  };

  const handleUpdateUser = async (userId: number) => {
    setUserFeedback(null);
    setSavingUserId(userId);
    try {
      const res = await apiFetch<{ users: AdminUserSummary[] }>(`/api/admin/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({
          display_name: editUserDisplay.trim(),
          permissions: editUserPerms,
          is_active: editUserActive,
          password: editUserPassword || undefined,
        }),
      });
      setUsers(res.users);
      setEditingUserId(null);
      setEditUserPassword('');
      setUserFeedback({ type: 'success', text: 'تم تحديث بيانات وصلاحيات المستخدم بنجاح.' });
    } catch (err) {
      setUserFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'تعذر تعديل بيانات المستخدم.',
      });
    } finally {
      setSavingUserId(null);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    setUserFeedback(null);
    setSavingUserId(userId);
    try {
      const res = await apiFetch<{ users: AdminUserSummary[] }>(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });
      setUsers(res.users);
      setUserFeedback({ type: 'success', text: 'تم حذف حساب المستخدم.' });
    } catch (err) {
      setUserFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'تعذر حذف المستخدم.',
      });
    } finally {
      setSavingUserId(null);
    }
  };

  const toggleFlag = (key: keyof PlatformSettings) => {
    setForm((prev) => ({
      ...prev,
      [key]: isSettingEnabled(prev[key]) ? '0' : '1',
    }));
  };

  const togglePermissionInList = (
    list: AdminPermission[],
    setter: React.Dispatch<React.SetStateAction<AdminPermission[]>>,
    perm: AdminPermission
  ) => {
    setter(list.includes(perm) ? list.filter((p) => p !== perm) : [...list, perm]);
  };

  const allTabs: Array<{
    id: SettingsTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    visible: boolean;
  }> = [
    { id: 'identity', label: 'الهوية والخلفيات والثيمات', icon: Palette, visible: canManageSettings },
    { id: 'sections', label: 'القائمة والأقسام وإعدادات أخرى', icon: LayoutTemplate, visible: canManageSettings },
    { id: 'about', label: 'حول المنصة والإشراف والأسئلة', icon: Info, visible: canManageSettings },
    {
      id: 'security',
      label: canManageUsers ? 'بيانات الدخول والمستخدمين' : 'بيانات دخول الحساب',
      icon: KeyRound,
      visible: true,
    },
  ];
  const tabs = allTabs.filter((t) => t.visible);

  return (
    <AdminLayout title="إعدادات المنصة الكاملة">
      <div className="space-y-6 max-w-5xl">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            إعدادات المنصة والهوية البصرية الشاملة
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            تحكم متكامل في الثيمات، الخلفيات، القوائم والأزرار المخصصة، الأصوات التفاعلية، محتوى «حول المنصة»، وإدارة المستخدمين ومهامهم.
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
        ) : activeTab !== 'security' && canManageSettings ? (
          <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
            {/* TAB 1: Identity, Theme Bank, Background System & Bank, Colors, Footer */}
            {activeTab === 'identity' && (
              <div className="space-y-6">
                {/* Site Theme Bank */}
                <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Palette className="w-5 h-5 text-[#1E40AF]" />
                        <span>بنك الثيمات العام للموقع (Theme Bank)</span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-1">
                        اختر ثيماً متناسقاً (أكاديمي، تعليمي، أو طفولي مبهج) لتطبيق الألوان والخلفيات والخطوط وحواف البطاقات تلقائياً.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      {(
                        [
                          { id: 'all', label: `الكل (${THEME_BANK.length})` },
                          {
                            id: 'kids',
                            label: `طفولية مبهجة (${THEME_BANK.filter((t) => t.category === 'kids').length})`,
                          },
                          {
                            id: 'educational',
                            label: `تعليمية (${THEME_BANK.filter((t) => t.category === 'educational').length})`,
                          },
                          {
                            id: 'classic',
                            label: `كلاسيكية (${THEME_BANK.filter((t) => t.category === 'classic').length})`,
                          },
                        ] as const
                      ).map((tabItem) => (
                        <button
                          key={tabItem.id}
                          type="button"
                          onClick={() => setThemeCategoryFilter(tabItem.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                            themeCategoryFilter === tabItem.id
                              ? 'bg-[#1E40AF] text-white border-[#1E40AF]'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {tabItem.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {THEME_BANK.filter(
                      (preset) =>
                        themeCategoryFilter === 'all' || preset.category === themeCategoryFilter
                    ).map((preset) => {
                      const isActive = form.active_theme_id === preset.id;
                      const catLabel =
                        preset.category === 'kids'
                          ? 'ثيم طفولي مبهج'
                          : preset.category === 'educational'
                            ? 'ثيم تعليمي'
                            : 'ثيم كلاسيكي';
                      const catTone =
                        preset.category === 'kids'
                          ? 'bg-orange-50 text-orange-700 border-orange-200'
                          : preset.category === 'educational'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200';
                      return (
                        <div
                          key={preset.id}
                          className={`rounded-xl border p-4 flex flex-col justify-between gap-3 transition-colors ${
                            isActive
                              ? 'border-[#1E40AF] bg-blue-50/40 ring-1 ring-[#1E40AF]/20'
                              : 'border-slate-200 bg-white'
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1">
                                <span
                                  className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded border ${catTone}`}
                                >
                                  {catLabel}
                                </span>
                                <div className="font-display text-sm font-bold text-slate-900">
                                  {preset.name}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0 pt-0.5">
                                {preset.swatch.map((hex, i) => (
                                  <span
                                    key={i}
                                    className="w-4 h-4 rounded-full border border-slate-300"
                                    style={{ backgroundColor: hex }}
                                  />
                                ))}
                              </div>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              {preset.description}
                            </p>
                          </div>

                          <ConfirmActionDropdown
                            variant="primary"
                            title="تأكيد تطبيق الثيم"
                            message={`هل تريد تطبيق ثيم «${preset.name}» وحفظ ألوانه وخلفياته على المنصة فوراً؟`}
                            confirmLabel="نعم، تطبيق الثيم"
                            busy={saving}
                            onConfirm={() => handleApplyThemePreset(preset)}
                            renderTrigger={({ onClick }) => (
                              <button
                                type="button"
                                disabled={saving}
                                onClick={onClick}
                                className={`w-full py-2 px-3 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                                  isActive
                                    ? 'bg-[#1E40AF] text-white'
                                    : 'border border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100'
                                }`}
                              >
                                {isActive ? 'الثيم المفعّل حالياً' : 'تطبيق هذا الثيم'}
                              </button>
                            )}
                          />
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Granular Backgrounds Control */}
                <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
                      <ImageIcon className="w-5 h-5 text-[#1E40AF]" />
                      <span>أنظمة التحكم في الخلفيات</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      تعديل مستقل لخلفية الموقع العام، الصفحة الرئيسية، الصفحات، البطاقات، وصفحة عرض الموضوع (يدعم لون Hex مثل #F8FAFC، تدرج CSS، أو رابط صورة / Google Drive).
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {BACKGROUND_FIELDS.map((field) => {
                      const currentVal = form[field.key];
                      const previewCss = resolveBackgroundStyle(currentVal, {
                        isCard: field.key === 'bg_cards',
                      });
                      return (
                        <div
                          key={field.key}
                          className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <label className="text-xs font-bold text-slate-800">{field.label}</label>
                            {currentVal && (
                              <button
                                type="button"
                                onClick={() => setForm((f) => ({ ...f, [field.key]: '' }))}
                                className="text-[11px] text-rose-700 hover:underline cursor-pointer"
                              >
                                إعادة للافتراضي
                              </button>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500">{field.hint}</p>
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-11 h-10 rounded-lg border border-slate-300 bg-white shrink-0"
                              style={previewCss}
                            />
                            <input
                              type="text"
                              dir="ltr"
                              value={currentVal}
                              onChange={(e) =>
                                setForm((f) => ({ ...f, [field.key]: e.target.value }))
                              }
                              placeholder="#F8FAFC أو linear-gradient(...) أو رابط صورة..."
                              className="flex-1 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-left"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Background Bank with Copy Link */}
                <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      بنك الخلفيات (صور تربوية وتدرجات جاهزة مع نسخ الرابط)
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      انسخ رابط أي خلفية لاستخدامها في أي مكان أو طبقها مباشرة على الموقع أو البطاقات أو الصفحات.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {BACKGROUND_BANK.map((bg) => {
                      const previewCss = resolveBackgroundStyle(bg.value);
                      const isCopied = copiedBgId === bg.id;
                      return (
                        <div
                          key={bg.id}
                          className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col"
                        >
                          <div
                            className="h-24 w-full border-b border-slate-200 bg-slate-100 relative"
                            style={!bg.previewImage ? previewCss : undefined}
                          >
                            {bg.previewImage && (
                              <img
                                src={bg.previewImage}
                                alt={bg.label}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                          <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
                            <div>
                              <div className="text-xs font-bold text-slate-800">{bg.label}</div>
                              <div className="mt-1.5 flex items-center gap-1.5">
                                <input
                                  type="text"
                                  readOnly
                                  dir="ltr"
                                  value={bg.value}
                                  className="flex-1 px-2 py-1 rounded border border-slate-200 bg-slate-50 text-[11px] text-slate-600 text-left"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleCopyBgLink(bg.id, bg.value)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 bg-white text-[11px] font-medium text-slate-700 hover:bg-slate-50 cursor-pointer shrink-0"
                                >
                                  {isCopied ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-600" />
                                      <span className="text-emerald-700">تم النسخ</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span>نسخ الرابط</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-100">
                              {BACKGROUND_FIELDS.map((target) => (
                                <button
                                  key={target.key}
                                  type="button"
                                  onClick={() =>
                                    handleApplyBackgroundTarget(target.key, bg.value, bg.label)
                                  }
                                  className="px-2 py-1 rounded bg-slate-100 hover:bg-[#1E40AF] hover:text-white text-[11px] text-slate-700 transition-colors cursor-pointer"
                                >
                                  {target.shortLabel}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Text & Visual Identity */}
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
                        onChange={(e) =>
                          setForm((f) => ({ ...f, platform_title: e.target.value }))
                        }
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
                        onChange={(e) =>
                          setForm((f) => ({ ...f, hero_badge_text: e.target.value }))
                        }
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
                      onChange={(e) =>
                        setForm((f) => ({ ...f, platform_tagline: e.target.value }))
                      }
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
                        value={
                          /^#[0-9a-fA-F]{6}$/.test(form.primary_color)
                            ? form.primary_color
                            : '#1E40AF'
                        }
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
                        setForm((f) => ({
                          ...f,
                          hero_cover_url: normalizeImageUrl(e.target.value),
                        }))
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

                    {/* Multi-Image Hero Slideshow Manager */}
                    <div className="mt-4 p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="text-xs sm:text-sm font-bold text-slate-900">
                            صور إضافية لواجهة العرض المتحرك في الصفحة الرئيسية ({heroExtraCovers.length})
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            أضف أكثر من صورة لتشتغل تلقائياً كعرض شرائح أنيق في الصورة الرئيسية للمنصة (مع أزرار تنقل ونقاط عرض).
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          dir="ltr"
                          value={newHeroExtraUrl}
                          onChange={(e) => setNewHeroExtraUrl(e.target.value)}
                          placeholder="https://... أو رابط صورة Google Drive"
                          className="flex-1 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm text-left"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddHeroExtraCover()}
                          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#1E40AF] text-white text-xs font-medium hover:bg-[#1E3A8A] cursor-pointer shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>إضافة صورة للعرض</span>
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] text-slate-500 ml-1">إضافة سريعة من الجاهزة:</span>
                        {HERO_PRESETS.map((preset) => (
                          <button
                            key={`extra-${preset.url}`}
                            type="button"
                            onClick={() => handleAddHeroExtraCover(preset.url)}
                            className="px-2.5 py-1 rounded-md border border-slate-200 bg-white text-[11px] text-slate-700 hover:bg-slate-100 cursor-pointer"
                          >
                            + {preset.label}
                          </button>
                        ))}
                      </div>

                      {heroExtraCovers.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                          {heroExtraCovers.map((imgUrl, idx) => (
                            <div
                              key={`${imgUrl}-${idx}`}
                              className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center gap-3"
                            >
                              <img
                                src={imgUrl}
                                alt={`صورة رئيسية ${idx + 2}`}
                                referrerPolicy="no-referrer"
                                className="w-20 h-14 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-100"
                              />
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="text-[11px] font-semibold text-slate-800">
                                  الصورة الإضافية #{idx + 1}
                                </div>
                                <div
                                  dir="ltr"
                                  className="text-[10px] text-slate-500 truncate text-left"
                                  title={imgUrl}
                                >
                                  {imgUrl}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => moveHeroExtraCover(idx, -1)}
                                  className="p-1.5 rounded border border-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer"
                                  title="تقديم"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === heroExtraCovers.length - 1}
                                  onClick={() => moveHeroExtraCover(idx, 1)}
                                  className="p-1.5 rounded border border-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer"
                                  title="تأخير"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                                <ConfirmDeleteDropdown
                                  message="هل تريد إزالة هذه الصورة من العرض المتحرك بالرئيسية؟"
                                  onConfirm={() =>
                                    setHeroExtraCovers((prev) => prev.filter((_, i) => i !== idx))
                                  }
                                  renderTrigger={({ onClick }) => (
                                    <button
                                      type="button"
                                      onClick={onClick}
                                      className="p-1.5 rounded border border-rose-200 text-rose-700 hover:bg-rose-50 cursor-pointer"
                                      title="حذف الصورة"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
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

                {/* Footer Social Media Links Manager */}
                <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Link2 className="w-5 h-5 text-[#1E40AF]" />
                        <span>أزرار التواصل الاجتماعي والروابط في أسفل المنصة</span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-1">
                        تحكم كامل في الأيقونات، الأسماء، الروابط، الترتيب، أو إضافة وإلغاء أي زر في تذييل المنصة.
                      </p>
                    </div>

                    <ConfirmActionDropdown
                      variant="primary"
                      title="استعادة الروابط الافتراضية"
                      message="هل تريد استعادة قائمة روابط المدرسة والقنوات الافتراضية الأربع؟"
                      confirmLabel="نعم، استعادة الروابط"
                      onConfirm={() => {
                        setSocialLinks(DEFAULT_SOCIAL_LINKS);
                        setFeedback({
                          type: 'success',
                          text: 'تمت استعادة روابط التواصل الافتراضية. اضغط «حفظ جميع الإعدادات» للاعتماد.',
                        });
                      }}
                      renderTrigger={({ onClick }) => (
                        <button
                          type="button"
                          onClick={onClick}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>استعادة الروابط الافتراضية</span>
                        </button>
                      )}
                    />
                  </div>

                  {/* Existing Social Links */}
                  <div className="space-y-3">
                    {socialLinks.map((item, idx) => {
                      const brandColor = getSocialBrandColor(item.icon);
                      return (
                        <div
                          key={item.id}
                          className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center"
                        >
                          <div className="lg:col-span-3 flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={item.enabled}
                              onChange={() =>
                                setSocialLinks((prev) =>
                                  prev.map((s, i) =>
                                    i === idx ? { ...s, enabled: !s.enabled } : s
                                  )
                                )
                              }
                              title="إظهار أو إخفاء الزر"
                              className="w-4 h-4 accent-[#1E40AF] shrink-0"
                            />
                            <span
                              style={{ backgroundColor: `${brandColor}16`, color: brandColor }}
                              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border border-slate-200/70"
                            >
                              <SocialBrandIcon icon={item.icon} className="w-4 h-4" />
                            </span>
                            <input
                              type="text"
                              value={item.label}
                              onChange={(e) =>
                                setSocialLinks((prev) =>
                                  prev.map((s, i) =>
                                    i === idx ? { ...s, label: e.target.value } : s
                                  )
                                )
                              }
                              placeholder="تسمية الزر"
                              className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm"
                            />
                          </div>

                          <div className="lg:col-span-3">
                            <select
                              value={item.icon}
                              onChange={(e) =>
                                setSocialLinks((prev) =>
                                  prev.map((s, i) =>
                                    i === idx
                                      ? { ...s, icon: e.target.value as SocialIconKey }
                                      : s
                                  )
                                )
                              }
                              className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm"
                            >
                              {SOCIAL_ICON_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="lg:col-span-4">
                            <input
                              type="text"
                              dir="ltr"
                              value={item.url}
                              onChange={(e) =>
                                setSocialLinks((prev) =>
                                  prev.map((s, i) =>
                                    i === idx ? { ...s, url: e.target.value } : s
                                  )
                                )
                              }
                              placeholder="https://..."
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-left"
                            />
                          </div>

                          <div className="lg:col-span-2 flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveSocialLink(idx, -1)}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-30 cursor-pointer"
                              title="تحريك للأعلى"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === socialLinks.length - 1}
                              onClick={() => moveSocialLink(idx, 1)}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-30 cursor-pointer"
                              title="تحريك للأسفل"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <ConfirmDeleteDropdown
                              message={`هل تريد حذف رابط «${item.label}» من التذييل؟`}
                              onConfirm={() =>
                                setSocialLinks((prev) => prev.filter((_, i) => i !== idx))
                              }
                              renderTrigger={({ onClick }) => (
                                <button
                                  type="button"
                                  onClick={onClick}
                                  className="p-1.5 rounded-lg border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 cursor-pointer"
                                  title="حذف الرابط"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add New Social Link */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                    <div className="text-xs font-bold text-slate-800">إضافة رابط وأيقونة جديدة:</div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input
                        type="text"
                        value={newSocialLabel}
                        onChange={(e) => setNewSocialLabel(e.target.value)}
                        placeholder="الاسم (مثال: قناة المؤسسة)"
                        className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                      />
                      <select
                        value={newSocialIcon}
                        onChange={(e) => setNewSocialIcon(e.target.value as SocialIconKey)}
                        className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                      >
                        {SOCIAL_ICON_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        dir="ltr"
                        value={newSocialUrl}
                        onChange={(e) => setNewSocialUrl(e.target.value)}
                        placeholder="https://..."
                        className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-left"
                      />
                    </div>
                    <ConfirmActionDropdown
                      variant="primary"
                      title="تأكيد إضافة رابط تواصل"
                      message={
                        newSocialLabel.trim()
                          ? `هل تريد إضافة «${newSocialLabel.trim()}» إلى أزرار التواصل الاجتماعي؟`
                          : 'سيتم التحقق من الرابط وإضافته.'
                      }
                      confirmLabel="إضافة الرابط"
                      onConfirm={handleAddSocialLink}
                      renderTrigger={({ onClick }) => (
                        <button
                          type="button"
                          onClick={onClick}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1E40AF] text-white text-xs font-medium hover:bg-[#1E3A8A] cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>إضافة زر تواصل اجتماعي</span>
                        </button>
                      )}
                    />
                  </div>
                </section>
              </div>
            )}

            {/* TAB 2: Navigation Labels, Custom Nav Buttons, Homepage Sections, Extra Settings */}
            {activeTab === 'sections' && (
              <div className="space-y-6">
                {/* Built-in Nav Labels + Visibility */}
                <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      أزرار القائمة الرئيسية (تخصيص الأسماء والإظهار)
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      عدّل تسميات الأزرار الرئيسية وتحكم في إظهار أو إخفاء أي زر في الشريط العلوي.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {BUILTIN_NAV_ITEMS.map((item) => {
                      const isHidden = hiddenNavKeys.includes(item.key);
                      return (
                        <div
                          key={item.key}
                          className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-slate-600">
                              {item.defaultLabel}
                            </span>
                            <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!isHidden}
                                onChange={() => toggleBuiltinNavVisible(item.key)}
                                className="w-3.5 h-3.5 accent-[#1E40AF]"
                              />
                              <span>إظهار</span>
                            </label>
                          </div>
                          <input
                            type="text"
                            value={form[item.key]}
                            onChange={(e) => setForm((f) => ({ ...f, [item.key]: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                          />
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Custom Main Menu Buttons Builder */}
                <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Plus className="w-5 h-5 text-[#1E40AF]" />
                      <span>إضافة خانات وأزرار جديدة في القائمة الرئيسية</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      أضف أزراراً إضافية في شريط التصفح العلوي توجه الزائر إلى تصنيف محدد أو صفحة داخلية أو رابط خارجي.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          اسم الزر في القائمة *
                        </label>
                        <input
                          type="text"
                          value={newNavLabel}
                          onChange={(e) => setNewNavLabel(e.target.value)}
                          placeholder="مثال: النادي البيئي / المجلة"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          نوع الوجهة
                        </label>
                        <select
                          value={newNavType}
                          onChange={(e) => {
                            const nextType = e.target.value as 'category' | 'route' | 'url';
                            setNewNavType(nextType);
                            if (nextType === 'category') {
                              setNewNavTarget(categories[0] ? String(categories[0].id) : '');
                            } else if (nextType === 'route') {
                              setNewNavTarget('/');
                            } else {
                              setNewNavTarget('');
                            }
                          }}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                        >
                          <option value="category">تصنيف رئيسي أو فرعي</option>
                          <option value="route">صفحة داخلية بالمنصة</option>
                          <option value="url">رابط خارجي</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          الوجهة المختارة *
                        </label>
                        {newNavType === 'category' ? (
                          <select
                            value={newNavTarget}
                            onChange={(e) => setNewNavTarget(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                          >
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.parent_id ? `↳ ${c.name}` : c.name}
                              </option>
                            ))}
                          </select>
                        ) : newNavType === 'route' ? (
                          <select
                            value={newNavTarget}
                            onChange={(e) => setNewNavTarget(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                          >
                            {INTERNAL_ROUTE_OPTIONS.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            dir="ltr"
                            value={newNavTarget}
                            onChange={(e) => setNewNavTarget(e.target.value)}
                            placeholder="https://..."
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-left"
                          />
                        )}
                      </div>
                    </div>

                    <ConfirmActionDropdown
                      variant="primary"
                      title="تأكيد إضافة زر للقائمة"
                      message={
                        newNavLabel.trim()
                          ? `هل تريد إضافة الزر «${newNavLabel.trim()}» إلى أزرار القائمة الرئيسية؟`
                          : 'سيتم التحقق من بيانات الزر وإضافته.'
                      }
                      confirmLabel="إضافة الزر"
                      onConfirm={handleAddCustomNavItem}
                      renderTrigger={({ onClick }) => (
                        <button
                          type="button"
                          onClick={onClick}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1E40AF] text-white text-xs font-medium hover:bg-[#1E3A8A] cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>إضافة زر للقائمة</span>
                        </button>
                      )}
                    />
                  </div>

                  {customNavItems.length > 0 && (
                    <div className="space-y-2">
                      {customNavItems.map((btn, idx) => (
                        <div
                          key={btn.id}
                          className="p-3 rounded-xl border border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <label className="inline-flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={btn.enabled}
                                onChange={() =>
                                  setCustomNavItems((prev) =>
                                    prev.map((item, i) =>
                                      i === idx ? { ...item, enabled: !item.enabled } : item
                                    )
                                  )
                                }
                                className="w-4 h-4 accent-[#1E40AF]"
                              />
                              <span className="text-sm font-semibold text-slate-900">
                                {btn.label}
                              </span>
                            </label>
                            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                              {btn.target_type === 'category'
                                ? `تصنيف (${
                                    categories.find((c) => String(c.id) === btn.target_value)
                                      ?.name || btn.target_value
                                  })`
                                : btn.target_type === 'url'
                                  ? btn.target_value
                                  : INTERNAL_ROUTE_OPTIONS.find((r) => r.value === btn.target_value)
                                      ?.label || btn.target_value}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveCustomNavItem(idx, -1)}
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === customNavItems.length - 1}
                              onClick={() => moveCustomNavItem(idx, 1)}
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <ConfirmDeleteDropdown
                              message={`هل تريد حذف زر «${btn.label}» من القائمة؟`}
                              onConfirm={() =>
                                setCustomNavItems((prev) => prev.filter((_, i) => i !== idx))
                              }
                              renderTrigger={({ onClick }) => (
                                <button
                                  type="button"
                                  onClick={onClick}
                                  className="p-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Homepage Sections */}
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

                {/* Extra Platform Settings (Sounds, Fonts, Radius, Zoom, Sorting, Announcement) */}
                <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Sliders className="w-5 h-5 text-[#1E40AF]" />
                      <span>إعدادات أخرى متقدمة (الأصوات، الخطوط، الترتيب، التنبيهات)</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      خيارات إضافية للتحكم في تجربة التصفح التفاعلية، الخط العربي، حجم العرض، عدد البطاقات، والشريط الإعلاني.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Interactive Click & Navigation Sounds + Presets */}
                    <div className="md:col-span-2 p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium text-slate-800">
                          <input
                            type="checkbox"
                            checked={isSettingEnabled(form.enable_ui_sounds)}
                            onChange={() => {
                              const nextEnabled = !isSettingEnabled(form.enable_ui_sounds);
                              setUiSoundsEnabled(nextEnabled);
                              setForm((f) => ({ ...f, enable_ui_sounds: nextEnabled ? '1' : '0' }));
                              if (nextEnabled) {
                                playSoundPreview((form.ui_sound_preset || 'classic') as UiSoundPreset);
                              }
                            }}
                            className="w-4 h-4 accent-[#1E40AF] rounded"
                          />
                          <span>أصوات التفاعل عند النقر على الأزرار والتصفح</span>
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            playSoundPreview((form.ui_sound_preset || 'classic') as UiSoundPreset)
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0"
                        >
                          <Volume2 className="w-3.5 h-3.5 text-[#1E40AF]" />
                          <span>تجربة النغمة المختارة</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                        {UI_SOUND_PRESET_OPTIONS.map((preset) => {
                          const selected = (form.ui_sound_preset || 'classic') === preset.id;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => {
                                setForm((f) => ({ ...f, ui_sound_preset: preset.id }));
                                setUiSoundPreset(preset.id);
                                playSoundPreview(preset.id);
                              }}
                              className={`text-right p-2.5 rounded-lg border transition-colors cursor-pointer ${
                                selected
                                  ? 'border-[#1E40AF] bg-blue-50/70 text-[#1E40AF]'
                                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <div className="text-xs font-bold">{preset.label}</div>
                              <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                                {preset.description}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Hero Auto Zoom Toggle */}
                    <label className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center gap-2.5 cursor-pointer text-sm font-medium text-slate-800">
                      <input
                        type="checkbox"
                        checked={isSettingEnabled(form.hero_zoom_enabled)}
                        onChange={() => toggleFlag('hero_zoom_enabled')}
                        className="w-4 h-4 accent-[#1E40AF] rounded"
                      />
                      <span>تفعيل حركة الزوم التلقائي في صورة الواجهة الرئيسية</span>
                    </label>

                    {/* Animations Toggle */}
                    <label className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center gap-2.5 cursor-pointer text-sm font-medium text-slate-800">
                      <input
                        type="checkbox"
                        checked={isSettingEnabled(form.enable_animations)}
                        onChange={() => toggleFlag('enable_animations')}
                        className="w-4 h-4 accent-[#1E40AF] rounded"
                      />
                      <span>تفعيل التأثيرات والحركات التفاعلية على الأزرار والبطاقات</span>
                    </label>

                    {/* Back to Top Toggle */}
                    <label className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center gap-2.5 cursor-pointer text-sm font-medium text-slate-800">
                      <input
                        type="checkbox"
                        checked={isSettingEnabled(form.show_back_to_top)}
                        onChange={() => toggleFlag('show_back_to_top')}
                        className="w-4 h-4 accent-[#1E40AF] rounded"
                      />
                      <span>إظهار زر «العودة للأعلى» العائم للزوار</span>
                    </label>
                  </div>

                  {/* Fonts, Radius, Sort, Font Size, Cards per row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">
                        الخط العربي المعتمد بالمنصة
                      </label>
                      <select
                        value={form.font_family}
                        onChange={(e) => setForm((f) => ({ ...f, font_family: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                      >
                        <option value="ibm">IBM Plex Sans Arabic (الافتراضي)</option>
                        <option value="cairo">Cairo — خط القاهرة العصري</option>
                        <option value="tajawal">Tajawal — خط تجوّل الواضح</option>
                        <option value="almarai">Almarai — خط المراعي المدرسي</option>
                        <option value="kufi">Noto Kufi Arabic — خط كوفي أنيق</option>
                        <option value="changa">Changa — خط طفولي وحيوي</option>
                        <option value="amiri">Amiri — خط أميري الأدبي التراثي</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">
                        حجم الخط العام للقراءة
                      </label>
                      <select
                        value={form.font_size_scale}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, font_size_scale: e.target.value }))
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                      >
                        <option value="compact">مدمج ومريح (15px)</option>
                        <option value="normal">عادي متوازن (الافتراضي 16px)</option>
                        <option value="large">كبير وواضح للتلاميذ (17.5px)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">
                        عدد البطاقات في الصف الواحد
                      </label>
                      <select
                        value={form.cards_per_row}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, cards_per_row: e.target.value }))
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                      >
                        <option value="3">3 بطاقات في الصف (الافتراضي)</option>
                        <option value="4">4 بطاقات في الصف (عرض مكثف)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">
                        نمط زوايا البطاقات
                      </label>
                      <select
                        value={form.card_radius}
                        onChange={(e) => setForm((f) => ({ ...f, card_radius: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                      >
                        <option value="rounded">متوسطة الانحناء (الافتراضي)</option>
                        <option value="soft">ناعمة ومستديرة (مناسب للطفولة)</option>
                        <option value="sharp">رسمية بحواف حادة</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2 lg:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">
                        الترتيب الافتراضي في صفحات المعرض والأقسام
                      </label>
                      <select
                        value={form.default_catalog_sort}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, default_catalog_sort: e.target.value }))
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                      >
                        <option value="custom">الترتيب المخصص من الإدارة (الأرقام الترتيبية)</option>
                        <option value="newest">الأحدث نشراً أولاً</option>
                        <option value="views">الأكثر مشاهدة</option>
                        <option value="oldest">الأقدم أولاً</option>
                      </select>
                    </div>
                  </div>

                  {/* Live Font Preview Box */}
                  <div
                    style={{ fontFamily: resolveFontFamilyStack(form.font_family).sans }}
                    className="p-4 rounded-xl border border-blue-100 bg-blue-50/40 space-y-1"
                  >
                    <div className="text-[11px] font-medium text-[#1E40AF]">
                      معاينة فورية للخط المختار قبل الحفظ:
                    </div>
                    <div className="text-base font-bold text-slate-900">
                      المنصة التعليمية لمدرسة الحسن الداخل — معرض الإبداع الطلابي
                    </div>
                    <p className="text-xs text-slate-600">
                      نموذج لعرض العناوين والفقرات التربوية بالخط العربي المختار عند حفظ الإعدادات.
                    </p>
                  </div>

                  {/* Announcement Banner */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium text-slate-800">
                        <input
                          type="checkbox"
                          checked={isSettingEnabled(form.announcement_enabled)}
                          onChange={() => toggleFlag('announcement_enabled')}
                          className="w-4 h-4 accent-[#1E40AF] rounded"
                        />
                        <span>
                          إظهار الشريط الإخباري المتحرك (فقط بالصفحة الرئيسية أسفل الصورة الرئيسية)
                        </span>
                      </label>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600">لون الشريط:</span>
                        <input
                          type="color"
                          value={
                            /^#[0-9a-fA-F]{6}$/.test(form.announcement_bg_color)
                              ? form.announcement_bg_color
                              : /^#[0-9a-fA-F]{6}$/.test(form.primary_color)
                                ? form.primary_color
                                : '#1E40AF'
                          }
                          onChange={(e) =>
                            setForm((f) => ({ ...f, announcement_bg_color: e.target.value }))
                          }
                          className="w-8 h-8 rounded border border-slate-300 bg-white cursor-pointer p-0.5"
                        />
                        {form.announcement_bg_color && (
                          <button
                            type="button"
                            onClick={() =>
                              setForm((f) => ({ ...f, announcement_bg_color: '' }))
                            }
                            className="text-[11px] text-slate-600 hover:underline cursor-pointer"
                          >
                            لون الثيم
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500">
                      يتحرك الشريط تلقائياً من اليسار إلى اليمين عند الكتابة بالعربية، ومن اليمين إلى اليسار عند الكتابة بالفرنسية، ويظهر فقط في الصفحة الرئيسية أسفل الصورة الرئيسية.
                    </p>

                    <input
                      type="text"
                      value={form.announcement_text}
                      onChange={(e) => {
                        const nextText = e.target.value;
                        setForm((f) => ({
                          ...f,
                          announcement_text: nextText,
                          announcement_enabled:
                            !f.announcement_text.trim() && nextText.trim()
                              ? '1'
                              : f.announcement_enabled,
                        }));
                      }}
                      placeholder="مثال: باب المشاركة في المسابقة الثقافية مفتوح إلى غاية نهاية الشهر..."
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-sm"
                    />

                    {form.announcement_text.trim() && (
                      <div className="space-y-1">
                        <div className="text-[11px] text-slate-500">
                          معاينة حية للشريط الإخباري ({isSettingEnabled(form.announcement_enabled) ? 'مفعّل للظهور أسفل الصورة الرئيسية' : 'مخفي حالياً — فعّل الخيار أعلاه لإظهاره'}):
                        </div>
                        <div
                          style={{
                            backgroundColor:
                              form.announcement_bg_color || form.primary_color || '#1E40AF',
                          }}
                          className="rounded-xl text-white text-xs sm:text-sm font-medium overflow-hidden flex items-stretch"
                        >
                          <div className="bg-black/20 px-3 py-2 flex items-center gap-1.5 shrink-0 border-l border-white/15">
                            <Megaphone className="w-4 h-4 shrink-0" />
                            <span className="text-xs font-bold whitespace-nowrap">
                              {/[\u0600-\u06FF]/.test(form.announcement_text)
                                ? 'إعلان هام'
                                : 'Annonce'}
                            </span>
                          </div>
                          <div className="ticker-viewport flex-1 py-2 flex items-center min-w-0">
                            <div
                              dir={/[\u0600-\u06FF]/.test(form.announcement_text) ? 'rtl' : 'ltr'}
                              className={`ticker-track px-3 ${
                                /[\u0600-\u06FF]/.test(form.announcement_text)
                                  ? 'animate-ticker-ltr'
                                  : 'animate-ticker-rtl'
                              }`}
                            >
                              {form.announcement_text}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
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

            {/* Sticky Save Bar with Confirmation Dropdown */}
            <div className="sticky bottom-4 z-20 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4 shadow-sm">
              <span className="text-xs text-slate-500">
                تُطبق التغييرات فوراً على واجهة الزوار فور تأكيد الحفظ.
              </span>
              <ConfirmActionDropdown
                variant="primary"
                title="تأكيد حفظ الإعدادات"
                message="هل تريد اعتماد التعديلات وحفظ جميع إعدادات المنصة وتحديثها للزوار الآن؟"
                confirmLabel="نعم، حفظ الإعدادات"
                busy={saving}
                busyLabel="جاري الحفظ..."
                onConfirm={() => persistSettings()}
                renderTrigger={({ onClick }) => (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={onClick}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1E40AF] text-white text-sm font-medium hover:bg-[#1E3A8A] disabled:opacity-60 cursor-pointer shrink-0"
                  >
                    <Save className="w-4 h-4" />
                    <span>{saving ? 'جاري الحفظ...' : 'حفظ جميع الإعدادات'}</span>
                  </button>
                )}
              />
            </div>
          </form>
        ) : (
          /* TAB 4: Admin Credentials & Multi-User RBAC Management */
          <div className="space-y-6">
            {/* Self Credentials Update */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#1E40AF]" />
                <span>تحديث بيانات دخول حسابك الشخصي ({auth.displayName || auth.username})</span>
              </h2>

              {auth.envManaged ? (
                <p className="text-sm text-slate-600 leading-relaxed">
                  بيانات دخول المدير مضبوطة حالياً عبر متغيرات البيئة (Environment Variables) في إعدادات الخادم، ولا يمكن تعديلها من هنا. لتغييرها، عدّل القيم في لوحة Cloudflare Pages ثم أعد النشر.
                </p>
              ) : (
                <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
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

                  <ConfirmActionDropdown
                    variant="primary"
                    title="تأكيد تحديث بيانات الدخول"
                    message="هل تريد اعتماد بيانات الدخول الجديدة لحسابك الآن؟"
                    confirmLabel="تحديث البيانات"
                    onConfirm={handlePasswordChange}
                    renderTrigger={({ onClick }) => (
                      <button
                        type="button"
                        onClick={onClick}
                        className="px-4 py-2 rounded-lg bg-[#1E40AF] text-white text-sm font-medium hover:bg-[#1E3A8A] cursor-pointer"
                      >
                        تحديث بيانات الدخول
                      </button>
                    )}
                  />
                </form>
              )}
            </div>

            {/* Multi-User Management & Task Permissions */}
            {canManageUsers && !auth.envManaged && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#1E40AF]" />
                    <span>إدارة المستخدمين وتحديد مهامهم (الصلاحيات)</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    أضف مشرفين أو أساتذة بحسابات مستقلة وحدد لكل مستخدم المهام المسموح له بتنفيذها داخل لوحة الإدارة.
                  </p>
                </div>

                {userFeedback && (
                  <div
                    className={`p-3 rounded-lg border text-sm ${
                      userFeedback.type === 'error'
                        ? 'bg-rose-50 border-rose-200 text-rose-800'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    }`}
                  >
                    {userFeedback.text}
                  </div>
                )}

                {/* Create New User Form */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <UserPlus className="w-4 h-4 text-[#1E40AF]" />
                    <span>إضافة مستخدم جديد</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        اسم المستخدم للدخول *
                      </label>
                      <input
                        type="text"
                        value={createUserUsername}
                        onChange={(e) => setCreateUserUsername(e.target.value)}
                        placeholder="مثال: ahmed.prof"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        الاسم الكامل / الصفة
                      </label>
                      <input
                        type="text"
                        value={createUserDisplay}
                        onChange={(e) => setCreateUserDisplay(e.target.value)}
                        placeholder="مثال: الأستاذ أحمد - منسق النادي"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        كلمة المرور (6 أحرف+) *
                      </label>
                      <input
                        type="password"
                        value={createUserPassword}
                        onChange={(e) => setCreateUserPassword(e.target.value)}
                        placeholder="••••••"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-700">تحديد المهام والصلاحيات:</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {ALL_ADMIN_PERMISSIONS.map((perm) => (
                        <label
                          key={perm}
                          className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={createUserPerms.includes(perm)}
                            onChange={() =>
                              togglePermissionInList(createUserPerms, setCreateUserPerms, perm)
                            }
                            className="w-4 h-4 accent-[#1E40AF]"
                          />
                          <span>{ADMIN_PERMISSION_LABELS[perm]}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createUserActive}
                        onChange={(e) => setCreateUserActive(e.target.checked)}
                        className="w-4 h-4 accent-[#1E40AF]"
                      />
                      <span>تفعيل الحساب مباشرة</span>
                    </label>

                    <ConfirmActionDropdown
                      variant="primary"
                      title="تأكيد إضافة مستخدم"
                      message={
                        createUserUsername.trim()
                          ? `هل تريد إنشاء حساب المستخدم «${createUserUsername.trim()}» بالصلاحيات المحددة؟`
                          : 'سيتم التحقق من البيانات وإنشاء الحساب.'
                      }
                      confirmLabel="إنشاء المستخدم"
                      busy={creatingUser}
                      onConfirm={handleCreateUser}
                      renderTrigger={({ onClick }) => (
                        <button
                          type="button"
                          disabled={creatingUser}
                          onClick={onClick}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1E40AF] text-white text-xs sm:text-sm font-medium hover:bg-[#1E3A8A] disabled:opacity-60 cursor-pointer"
                        >
                          <UserPlus className="w-4 h-4" />
                          <span>{creatingUser ? 'جاري الإنشاء...' : 'إضافة المستخدم وحفظ مهامه'}</span>
                        </button>
                      )}
                    />
                  </div>
                </div>

                {/* Existing Users List */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-800">
                    قائمة المستخدمين والمسؤولين ({users.length})
                  </h3>

                  {usersLoading ? (
                    <div className="h-24 rounded-xl bg-slate-100 animate-pulse" />
                  ) : (
                    <div className="space-y-3">
                      {users.map((u) => {
                        const isEditing = editingUserId === u.id;
                        const isSelf = u.username === auth.username;
                        return (
                          <div
                            key={u.id}
                            className="p-4 rounded-xl border border-slate-200 bg-white space-y-3"
                          >
                            {isEditing ? (
                              <div className="space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                      الاسم المعروض
                                    </label>
                                    <input
                                      type="text"
                                      value={editUserDisplay}
                                      onChange={(e) => setEditUserDisplay(e.target.value)}
                                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                      كلمة مرور جديدة (اتركها فارغة للإبقاء على الحالية)
                                    </label>
                                    <input
                                      type="password"
                                      value={editUserPassword}
                                      onChange={(e) => setEditUserPassword(e.target.value)}
                                      placeholder="••••••"
                                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                                    />
                                  </div>
                                </div>

                                {!u.is_primary && (
                                  <>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {ALL_ADMIN_PERMISSIONS.map((perm) => (
                                        <label
                                          key={perm}
                                          className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-800 cursor-pointer"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={editUserPerms.includes(perm)}
                                            onChange={() =>
                                              togglePermissionInList(
                                                editUserPerms,
                                                setEditUserPerms,
                                                perm
                                              )
                                            }
                                            className="w-3.5 h-3.5 accent-[#1E40AF]"
                                          />
                                          <span>{ADMIN_PERMISSION_LABELS[perm]}</span>
                                        </label>
                                      ))}
                                    </div>

                                    <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={editUserActive}
                                        onChange={(e) => setEditUserActive(e.target.checked)}
                                        className="w-4 h-4 accent-[#1E40AF]"
                                      />
                                      <span>حساب مفعّل ويمكنه تسجيل الدخول</span>
                                    </label>
                                  </>
                                )}

                                <div className="flex items-center gap-2">
                                  <ConfirmActionDropdown
                                    variant="primary"
                                    title="تأكيد تعديل المستخدم"
                                    message={`هل تريد حفظ التعديلات على صلاحيات وبيانات «${u.username}»؟`}
                                    confirmLabel="حفظ التعديلات"
                                    busy={savingUserId === u.id}
                                    onConfirm={() => handleUpdateUser(u.id)}
                                    renderTrigger={({ onClick }) => (
                                      <button
                                        type="button"
                                        disabled={savingUserId === u.id}
                                        onClick={onClick}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 cursor-pointer"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                        <span>حفظ التعديلات</span>
                                      </button>
                                    )}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setEditingUserId(null)}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-700 cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    <span>إلغاء</span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="space-y-1.5">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Shield
                                      className={`w-4 h-4 ${
                                        u.is_primary ? 'text-[#1E40AF]' : 'text-slate-500'
                                      }`}
                                    />
                                    <span className="font-bold text-sm text-slate-900">
                                      {u.display_name || u.username}
                                    </span>
                                    <span dir="ltr" className="text-xs font-mono text-slate-500">
                                      @{u.username}
                                    </span>
                                    {u.is_primary && (
                                      <span className="px-2 py-0.5 rounded bg-blue-50 text-[#1E40AF] text-[11px] font-semibold">
                                        المدير الرئيسي
                                      </span>
                                    )}
                                    <span
                                      className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                                        u.is_active
                                          ? 'bg-emerald-50 text-emerald-700'
                                          : 'bg-rose-50 text-rose-700'
                                      }`}
                                    >
                                      {u.is_active ? 'مفعّل' : 'معطّل'}
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap gap-1.5">
                                    {u.permissions.map((p) => (
                                      <span
                                        key={p}
                                        className="text-[11px] px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-700"
                                      >
                                        {ADMIN_PERMISSION_LABELS[p] || p}
                                      </span>
                                    ))}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingUserId(u.id);
                                      setEditUserDisplay(u.display_name || u.username);
                                      setEditUserActive(u.is_active);
                                      setEditUserPerms(u.permissions);
                                      setEditUserPassword('');
                                    }}
                                    title="تعديل بيانات ومهام المستخدم"
                                    className="p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>

                                  {!u.is_primary && !isSelf && (
                                    <ConfirmDeleteDropdown
                                      title="تأكيد حذف المستخدم"
                                      message={`هل تريد حذف حساب المستخدم «${u.display_name || u.username}» نهائياً؟`}
                                      confirmLabel="حذف الحساب"
                                      busy={savingUserId === u.id}
                                      onConfirm={() => handleDeleteUser(u.id)}
                                      renderTrigger={({ onClick }) => (
                                        <button
                                          type="button"
                                          onClick={onClick}
                                          title="حذف المستخدم"
                                          className="p-2 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 cursor-pointer"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      )}
                                    />
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
