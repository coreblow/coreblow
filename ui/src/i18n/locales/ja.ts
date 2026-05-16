import type { TranslationMap } from "../lib/types.ts";

export const ja: TranslationMap = {
  common: { health: "ヘルス", ok: "OK", online: "オンライン", offline: "オフライン", connect: "接続", refresh: "更新", enabled: "有効", disabled: "無効", na: "該当なし", version: "バージョン", docs: "ドキュメント", theme: "テーマ", resources: "リソース", search: "検索", send: "送信", delete: "削除", status: "ステータス", none: "なし", actions: "アクション", models: "モデル", events: "イベント", general: "一般", url: "URL" },
  nav: { chat: "チャット", control: "コントロール", agent: "エージェント", settings: "設定", expand: "サイドバーを展開", collapse: "サイドバーを折りたたむ", navigate: "ナビゲーション" },
  tabs: { overview: "概要", channels: "チャンネル", sessions: "セッション", usage: "使用状況とメトリクス", cron: "スケジュールタスク", skills: "スキル", chat: "チャット", config: "設定", aiAgents: "AIエージェント", debug: "デバッグ", logs: "ログ", peers: "デバイス" },
  subtitles: { overview: "ステータス、エントリポイント、ヘルス。", channels: "チャンネルと設定。", sessions: "アクティブなセッションとデフォルト。", usage: "API使用量とコスト。", cron: "ウェイクアップと定期実行。", skills: "スキルとAPIキー。", chat: "クイック介入用ゲートウェイチャット。", config: "coreblow.jsonを編集。", aiAgents: "エージェント、モデル、スキル、ツール、メモリ、セッション。", debug: "スナップショット、イベント、RPC。", logs: "ライブゲートウェイログ。" },
  overview: { access: { title: "ゲートウェイアクセス", subtitle: "ダッシュボードの接続先と認証方法。", wsUrl: "WebSocket URL", token: "ゲートウェイトークン", password: "パスワード", language: "言語", connectHint: "接続をクリックして接続変更を適用します。" }, health: { title: "システムヘルス", checkHealth: "システムヘルスを確認", started: "システム開始", pollFailed: "ヘルスチェック失敗" }, status: { connected: "接続済み", connectedServer: "ゲートウェイサーバーに接続済み", disconnected: "切断済み", notConnected: "未接続", reconnect: "ゲートウェイに再接続", reconnectWs: "WebSocketに再接続", coreblowOnline: "CoreBlow オンライン" } },
  chat: { activeChat: "アクティブチャット", newSession: "新規チャットセッション", createSession: "新しいチャットセッションを作成", resetMessages: "メッセージをリセット", openInChat: "チャットで開く", selectModel: "チャットモデル", defaultModel: "デフォルトモデル", connectToChat: "接続するには以下にゲートウェイURLを設定してください", connectFailed: "接続失敗" },
  sessions: { title: "セッション", active: "アクティブセッション", list: "アクティブセッション一覧", maxConcurrent: "最大同時セッション数", fetchFailed: "セッションの取得に失敗" },
  agents: { title: "AIエージェント", defaultProvider: "デフォルトプロバイダー", defaultModel: "デフォルトモデル", contextWindow: "コンテキストウィンドウ", maxOutput: "最大出力トークン", maxTurns: "実行あたり最大ターン", sandboxDir: "サンドボックスディレクトリ", fetchFailed: "エージェントの取得に失敗", registeredTools: "登録済みツール" },
  skills: { title: "スキル", noMatch: "フィルターに一致するスキルがありません", noRegistered: "登録済みスキルがありません" },
  config: { title: "設定", fetchFailed: "設定の取得に失敗", invalidJson: "無効なJSONパラメーター" },
  debug: { title: "デバッグコンソール", rpc: "RPC呼び出し" },
  usage: { title: "使用状況とメトリクス", listModels: "利用可能なモデル一覧" },
  cron: { title: "スケジュールタスク", runNow: "今すぐ実行" },
  languages: { en: "English", ar: "العربية", de: "Deutsch", es: "Español", fr: "Français", id: "Bahasa Indonesia", ja: "日本語", ko: "한국어", pt: "Português", zh: "中文" },
  errors: { unknown: "不明なエラーが発生しました" },
};
