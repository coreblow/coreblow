import type { TranslationMap } from "../lib/types.ts";

export const ko: TranslationMap = {
  common: { health: "상태", ok: "확인", online: "온라인", offline: "오프라인", connect: "연결", refresh: "새로고침", enabled: "활성화됨", disabled: "비활성화됨", na: "해당없음", version: "버전", docs: "문서", theme: "테마", resources: "리소스", search: "검색", send: "전송", delete: "삭제", status: "상태", none: "없음", actions: "작업", models: "모델", events: "이벤트", general: "일반", url: "URL" },
  nav: { chat: "채팅", control: "제어", agent: "에이전트", settings: "설정", expand: "사이드바 확장", collapse: "사이드바 축소", navigate: "탐색" },
  tabs: { overview: "개요", channels: "채널", sessions: "세션", usage: "사용량 및 지표", cron: "예약 작업", skills: "스킬", chat: "채팅", config: "구성", aiAgents: "AI 에이전트", debug: "디버그", logs: "로그", peers: "장치" },
  subtitles: { overview: "상태, 진입점, 건강.", channels: "채널 및 설정.", sessions: "활성 세션 및 기본값.", usage: "API 사용량 및 비용.", cron: "웨이크업 및 반복 실행.", skills: "스킬 및 API 키.", chat: "빠른 개입을 위한 게이트웨이 채팅.", config: "coreblow.json 편집.", aiAgents: "에이전트, 모델, 스킬, 도구, 메모리, 세션.", debug: "스냅샷, 이벤트, RPC.", logs: "실시간 게이트웨이 로그." },
  overview: { access: { title: "게이트웨이 접근", subtitle: "대시보드 연결 위치 및 인증 방법.", wsUrl: "WebSocket URL", token: "게이트웨이 토큰", password: "비밀번호", language: "언어", connectHint: "연결을 클릭하여 연결 변경 사항을 적용하세요." }, health: { title: "시스템 상태", checkHealth: "시스템 상태 확인", started: "시스템 시작됨", pollFailed: "상태 확인 실패" }, status: { connected: "연결됨", connectedServer: "게이트웨이 서버에 연결됨", disconnected: "연결 해제됨", notConnected: "연결되지 않음", reconnect: "게이트웨이 재연결", reconnectWs: "WebSocket 재연결", coreblowOnline: "CoreBlow 온라인" } },
  chat: { activeChat: "활성 채팅", newSession: "새 채팅 세션", createSession: "새 채팅 세션 만들기", resetMessages: "메시지 초기화", openInChat: "채팅에서 열기", selectModel: "채팅 모델", defaultModel: "기본 모델", connectToChat: "연결하려면 아래에 게이트웨이 URL을 설정하세요", connectFailed: "연결 실패" },
  sessions: { title: "세션", active: "활성 세션", list: "활성 세션 목록", maxConcurrent: "최대 동시 세션", fetchFailed: "세션을 가져오지 못했습니다" },
  agents: { title: "AI 에이전트", defaultProvider: "기본 제공자", defaultModel: "기본 모델", contextWindow: "컨텍스트 윈도우", maxOutput: "최대 출력 토큰", maxTurns: "실행당 최대 턴", sandboxDir: "샌드박스 디렉토리", fetchFailed: "에이전트를 가져오지 못했습니다", registeredTools: "등록된 도구" },
  skills: { title: "스킬", noMatch: "필터와 일치하는 스킬이 없습니다", noRegistered: "등록된 스킬이 없습니다" },
  config: { title: "구성", fetchFailed: "구성을 가져오지 못했습니다", invalidJson: "잘못된 JSON 매개변수" },
  debug: { title: "디버그 콘솔", rpc: "RPC 호출" },
  usage: { title: "사용량 및 지표", listModels: "사용 가능한 모델 목록" },
  cron: { title: "예약 작업", runNow: "지금 실행" },
  languages: { en: "English", ar: "العربية", de: "Deutsch", es: "Español", fr: "Français", id: "Bahasa Indonesia", ja: "日本語", ko: "한국어", pt: "Português", zh: "中文" },
  errors: { unknown: "알 수 없는 오류가 발생했습니다" },
};
