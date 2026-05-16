import type { TranslationMap } from "../lib/types.ts";

export const zh: TranslationMap = {
  common: { health: "健康", ok: "确定", online: "在线", offline: "离线", connect: "连接", refresh: "刷新", enabled: "已启用", disabled: "已禁用", na: "不适用", version: "版本", docs: "文档", theme: "主题", resources: "资源", search: "搜索", send: "发送", delete: "删除", status: "状态", none: "无", actions: "操作", models: "模型", events: "事件", general: "常规", url: "URL" },
  nav: { chat: "聊天", control: "控制", agent: "代理", settings: "设置", expand: "展开侧边栏", collapse: "折叠侧边栏", navigate: "导航" },
  tabs: { overview: "概览", channels: "频道", sessions: "会话", usage: "使用量与指标", cron: "定时任务", skills: "技能", chat: "聊天", config: "配置", aiAgents: "AI代理", debug: "调试", logs: "日志", peers: "设备" },
  subtitles: { overview: "状态、入口点、健康。", channels: "频道和设置。", sessions: "活跃会话和默认值。", usage: "API使用量和费用。", cron: "唤醒和定期运行。", skills: "技能和API密钥。", chat: "用于快速干预的网关聊天。", config: "编辑 coreblow.json。", aiAgents: "代理、模型、技能、工具、记忆、会话。", debug: "快照、事件、RPC。", logs: "实时网关日志。" },
  overview: { access: { title: "网关访问", subtitle: "仪表板的连接位置和认证方式。", wsUrl: "WebSocket URL", token: "网关令牌", password: "密码", connectHint: "点击连接以应用连接更改。" }, health: { title: "系统健康", checkHealth: "检查系统健康", started: "系统已启动", pollFailed: "健康检查失败" }, status: { connected: "已连接", connectedServer: "已连接到网关服务器", disconnected: "已断开", notConnected: "未连接", reconnect: "重新连接网关", reconnectWs: "重新连接WebSocket", coreblowOnline: "CoreBlow 在线" } },
  chat: { activeChat: "活跃聊天", newSession: "新建聊天会话", createSession: "创建新的聊天会话", resetMessages: "重置消息", openInChat: "在聊天中打开", selectModel: "聊天模型", defaultModel: "默认模型", connectToChat: "在下方配置网关URL以进行连接", connectFailed: "连接失败" },
  sessions: { title: "会话", active: "活跃会话", list: "列出活跃会话", maxConcurrent: "最大并发会话数", fetchFailed: "获取会话失败" },
  agents: { title: "AI代理", defaultProvider: "默认提供商", defaultModel: "默认模型", contextWindow: "上下文窗口", maxOutput: "最大输出令牌", maxTurns: "每次运行最大轮次", sandboxDir: "沙盒目录", fetchFailed: "获取代理失败", registeredTools: "已注册工具" },
  skills: { title: "技能", noMatch: "没有匹配筛选条件的技能", noRegistered: "没有已注册的技能" },
  config: { title: "配置", fetchFailed: "获取配置失败", invalidJson: "无效的JSON参数" },
  debug: { title: "调试控制台", rpc: "RPC调用" },
  usage: { title: "使用量与指标", listModels: "列出可用模型" },
  cron: { title: "定时任务", runNow: "立即运行" },
  languages: { en: "English", ar: "العربية", de: "Deutsch", es: "Español", fr: "Français", id: "Bahasa Indonesia", ja: "日本語", ko: "한국어", pt: "Português", zh: "中文" },
  errors: { unknown: "发生未知错误" },
};
