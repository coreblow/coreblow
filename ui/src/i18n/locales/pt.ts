import type { TranslationMap } from "../lib/types.ts";

export const pt: TranslationMap = {
  common: { health: "Saúde", ok: "OK", online: "Online", offline: "Offline", connect: "Conectar", refresh: "Atualizar", enabled: "Ativado", disabled: "Desativado", na: "n/d", version: "Versão", docs: "Documentação", theme: "Tema", resources: "Recursos", search: "Pesquisar", send: "Enviar", delete: "Excluir", status: "Status", none: "Nenhum", actions: "Ações", models: "Modelos", events: "Eventos", general: "Geral", url: "URL" },
  nav: { chat: "Chat", control: "Controle", agent: "Agente", settings: "Configurações", expand: "Expandir barra lateral", collapse: "Recolher barra lateral", navigate: "Navegar" },
  tabs: { overview: "Visão Geral", channels: "Canais", sessions: "Sessões", usage: "Uso e Métricas", cron: "Tarefas Agendadas", skills: "Habilidades", chat: "Chat", config: "Configuração", aiAgents: "Agentes IA", debug: "Depuração", logs: "Logs", peers: "Dispositivos" },
  subtitles: { overview: "Status, pontos de entrada, saúde.", channels: "Canais e configurações.", sessions: "Sessões ativas e padrões.", usage: "Uso de API e custos.", cron: "Ativações e execuções recorrentes.", skills: "Habilidades e chaves API.", chat: "Chat do gateway para intervenções rápidas.", config: "Editar coreblow.json.", aiAgents: "Agentes, modelos, habilidades, ferramentas, memória, sessão.", debug: "Snapshots, eventos, RPC.", logs: "Logs do gateway ao vivo." },
  overview: { access: { title: "Acesso ao Gateway", subtitle: "Onde o painel se conecta e como autentica.", wsUrl: "URL WebSocket", token: "Token do Gateway", password: "Senha", language: "Idioma", connectHint: "Clique em Conectar para aplicar as alterações de conexão." }, health: { title: "Saúde do Sistema", checkHealth: "Verificar saúde do sistema", started: "Sistema iniciado", pollFailed: "Verificação de saúde falhou" }, status: { connected: "Conectado", connectedServer: "Conectado ao Servidor Gateway", disconnected: "Desconectado", notConnected: "Não Conectado", reconnect: "Reconectar Gateway", reconnectWs: "Reconectar ao WebSocket", coreblowOnline: "CoreBlow Online" } },
  chat: { activeChat: "Chat Ativo", newSession: "Nova Sessão de Chat", createSession: "Criar uma nova sessão de chat", resetMessages: "Redefinir mensagens", openInChat: "Abrir no chat", selectModel: "Modelo de chat", defaultModel: "Modelo padrão", connectToChat: "Configure a URL do gateway abaixo para conectar", connectFailed: "Falha na conexão" },
  sessions: { title: "Sessões", active: "Sessões Ativas", list: "Listar sessões ativas", maxConcurrent: "Máx. Sessões Simultâneas", fetchFailed: "Falha ao buscar sessões" },
  agents: { title: "Agentes IA", defaultProvider: "Provedor Padrão", defaultModel: "Modelo Padrão", contextWindow: "Janela de Contexto", maxOutput: "Máx. Tokens de Saída", maxTurns: "Máx. Turnos por Execução", sandboxDir: "Diretório Sandbox", fetchFailed: "Falha ao buscar agentes", registeredTools: "Ferramentas Registradas" },
  skills: { title: "Habilidades", noMatch: "Nenhuma habilidade corresponde ao filtro", noRegistered: "Nenhuma habilidade registrada" },
  config: { title: "Configuração", fetchFailed: "Falha ao buscar configuração", invalidJson: "Parâmetros JSON inválidos" },
  debug: { title: "Console de Depuração", rpc: "Chamadas RPC" },
  usage: { title: "Uso e Métricas", listModels: "Listar modelos disponíveis" },
  cron: { title: "Tarefas Agendadas", runNow: "Executar agora" },
  languages: { en: "English", ar: "العربية", de: "Deutsch", es: "Español", fr: "Français", id: "Bahasa Indonesia", ja: "日本語", ko: "한국어", pt: "Português", zh: "中文" },
  errors: { unknown: "Ocorreu um erro desconhecido" },
};
