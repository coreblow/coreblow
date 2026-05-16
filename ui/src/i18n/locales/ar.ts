import type { TranslationMap } from "../lib/types.ts";

export const ar: TranslationMap = {
  common: { health: "الصحة", ok: "موافق", online: "متصل", offline: "غير متصل", connect: "اتصال", refresh: "تحديث", enabled: "مفعل", disabled: "معطل", na: "غ/م", version: "الإصدار", docs: "المستندات", theme: "السمة", resources: "الموارد", search: "بحث", send: "إرسال", delete: "حذف", status: "الحالة", none: "لا شيء", actions: "الإجراءات", models: "النماذج", events: "الأحداث", general: "عام", url: "الرابط" },
  nav: { chat: "محادثة", control: "التحكم", agent: "الوكيل", settings: "الإعدادات", expand: "توسيع الشريط الجانبي", collapse: "طي الشريط الجانبي", navigate: "تنقل" },
  tabs: { overview: "نظرة عامة", channels: "القنوات", sessions: "الجلسات", usage: "الاستخدام والمقاييس", cron: "المهام المجدولة", skills: "المهارات", chat: "محادثة", config: "الإعدادات", aiAgents: "وكلاء الذكاء الاصطناعي", debug: "تصحيح", logs: "السجلات", peers: "الأجهزة" },
  subtitles: { overview: "الحالة ونقاط الدخول والصحة.", channels: "القنوات والإعدادات.", sessions: "الجلسات النشطة والافتراضية.", usage: "استخدام API والتكاليف.", cron: "الإيقاظات والتشغيل المتكرر.", skills: "المهارات ومفاتيح API.", chat: "محادثة البوابة للتدخل السريع.", config: "تحرير coreblow.json.", aiAgents: "الوكلاء والنماذج والمهارات والأدوات والذاكرة والجلسة.", debug: "اللقطات والأحداث وRPC.", logs: "سجلات البوابة المباشرة." },
  overview: { access: { title: "الوصول إلى البوابة", subtitle: "أين تتصل لوحة التحكم وكيف تتم المصادقة.", wsUrl: "رابط WebSocket", token: "رمز البوابة", password: "كلمة المرور", connectHint: "انقر اتصال لتطبيق تغييرات الاتصال." }, health: { title: "صحة النظام", checkHealth: "فحص صحة النظام", started: "تم بدء النظام", pollFailed: "فشل فحص الصحة" }, status: { connected: "متصل", connectedServer: "متصل بخادم البوابة", disconnected: "غير متصل", notConnected: "غير متصل", reconnect: "إعادة اتصال البوابة", reconnectWs: "إعادة الاتصال بـ WebSocket", coreblowOnline: "CoreBlow متصل" } },
  chat: { activeChat: "محادثة نشطة", newSession: "جلسة محادثة جديدة", createSession: "إنشاء جلسة محادثة جديدة", resetMessages: "إعادة تعيين الرسائل", openInChat: "فتح في المحادثة", selectModel: "نموذج المحادثة", defaultModel: "النموذج الافتراضي", connectToChat: "قم بتكوين رابط البوابة أدناه للاتصال", connectFailed: "فشل الاتصال" },
  sessions: { title: "الجلسات", active: "الجلسات النشطة", list: "قائمة الجلسات النشطة", maxConcurrent: "الحد الأقصى للجلسات المتزامنة", fetchFailed: "فشل جلب الجلسات" },
  agents: { title: "وكلاء الذكاء الاصطناعي", defaultProvider: "المزود الافتراضي", defaultModel: "النموذج الافتراضي", contextWindow: "نافذة السياق", maxOutput: "الحد الأقصى لرموز الإخراج", maxTurns: "الحد الأقصى للأدوار لكل تشغيل", sandboxDir: "مجلد Sandbox", fetchFailed: "فشل جلب الوكلاء", registeredTools: "الأدوات المسجلة" },
  skills: { title: "المهارات", noMatch: "لا توجد مهارات تطابق الفلتر", noRegistered: "لا توجد مهارات مسجلة" },
  config: { title: "الإعدادات", fetchFailed: "فشل جلب الإعدادات", invalidJson: "معلمات JSON غير صالحة" },
  debug: { title: "وحدة التصحيح", rpc: "استدعاءات RPC" },
  usage: { title: "الاستخدام والمقاييس", listModels: "قائمة النماذج المتاحة" },
  cron: { title: "المهام المجدولة", runNow: "تشغيل الآن" },
  languages: { en: "English", ar: "العربية", de: "Deutsch", es: "Español", fr: "Français", id: "Bahasa Indonesia", ja: "日本語", ko: "한국어", pt: "Português", zh: "中文" },
  errors: { unknown: "حدث خطأ غير معروف" },
};
