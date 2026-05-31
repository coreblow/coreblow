import { parseDurationMs } from "../cli/parse-duration.js";

export type HeartbeatTask = {
  name: string;
  interval: string;
  prompt: string;
};

function stripScalarQuotes(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "");
}

/**
 * Parse the structured `tasks:` block from HEARTBEAT.md.
 *
 * This intentionally supports a small YAML-like subset rather than accepting
 * arbitrary YAML. HEARTBEAT.md remains a Markdown runbook first, with tasks as
 * a simple optional schedule block.
 */
export function parseHeartbeatTasks(content: string | undefined | null): HeartbeatTask[] {
  if (!content) {
    return [];
  }
  const tasks: HeartbeatTask[] = [];
  const lines = content.split(/\r?\n/);
  let inTasksBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    if (!inTasksBlock && trimmed === "tasks:") {
      inTasksBlock = true;
      continue;
    }
    if (!inTasksBlock) {
      continue;
    }

    const isTaskField =
      trimmed.startsWith("interval:") ||
      trimmed.startsWith("prompt:") ||
      trimmed.startsWith("- name:");
    if (
      !isTaskField &&
      !line.startsWith(" ") &&
      !line.startsWith("\t") &&
      trimmed &&
      !trimmed.startsWith("-")
    ) {
      inTasksBlock = false;
      continue;
    }

    if (!trimmed.startsWith("- name:")) {
      continue;
    }

    const name = stripScalarQuotes(trimmed.replace("- name:", ""));
    let interval = "";
    let prompt = "";

    for (let j = i + 1; j < lines.length; j++) {
      const nextLine = lines[j] ?? "";
      const nextTrimmed = nextLine.trim();

      if (nextTrimmed.startsWith("- name:")) {
        break;
      }
      if (
        nextTrimmed.startsWith("interval:") &&
        (nextLine.startsWith(" ") || nextLine.startsWith("\t"))
      ) {
        interval = stripScalarQuotes(nextTrimmed.replace("interval:", ""));
        continue;
      }
      if (
        nextTrimmed.startsWith("prompt:") &&
        (nextLine.startsWith(" ") || nextLine.startsWith("\t"))
      ) {
        prompt = stripScalarQuotes(nextTrimmed.replace("prompt:", ""));
        continue;
      }
      if (!nextLine.startsWith(" ") && !nextLine.startsWith("\t") && nextTrimmed) {
        inTasksBlock = false;
        break;
      }
    }

    if (name && interval && prompt) {
      tasks.push({ name, interval, prompt });
    }
  }

  return tasks;
}

export function isHeartbeatTaskDue(
  lastRunMs: number | undefined,
  interval: string,
  nowMs: number,
): boolean {
  if (lastRunMs === undefined) {
    return true;
  }
  try {
    const intervalMs = parseDurationMs(interval, { defaultUnit: "m" });
    return nowMs - lastRunMs >= intervalMs;
  } catch {
    return false;
  }
}

export function resolveDueHeartbeatTasks(params: {
  tasks?: readonly HeartbeatTask[];
  heartbeatTaskState?: Record<string, number>;
  nowMs: number;
}): HeartbeatTask[] {
  return (params.tasks ?? []).filter((task) =>
    isHeartbeatTaskDue(params.heartbeatTaskState?.[task.name], task.interval, params.nowMs),
  );
}

export function stripHeartbeatTasksBlock(content: string): string {
  const lines = content.split(/\r?\n/);
  const kept: string[] = [];
  let inTasksBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!inTasksBlock && trimmed === "tasks:") {
      inTasksBlock = true;
      continue;
    }

    if (inTasksBlock) {
      if (!trimmed) {
        continue;
      }
      const isIndented = /^[\s]/.test(line);
      if (isIndented || trimmed.startsWith("- name:")) {
        continue;
      }
      inTasksBlock = false;
    }

    kept.push(line);
  }

  return kept.join("\n");
}

export function appendHeartbeatFileDirectives(prompt: string, heartbeatFileContent?: string) {
  if (!heartbeatFileContent) {
    return prompt;
  }
  const directives = stripHeartbeatTasksBlock(heartbeatFileContent).trim();
  if (!directives || prompt.includes(directives)) {
    return prompt;
  }
  return `${prompt}\n\nAdditional context from HEARTBEAT.md:\n${directives}`;
}

export function buildHeartbeatTasksPrompt(params: {
  tasks: readonly HeartbeatTask[];
  useHeartbeatResponseTool: boolean;
}): string {
  const taskList = params.tasks.map((task) => `- ${task.name}: ${task.prompt}`).join("\n");
  const completionInstruction = params.useHeartbeatResponseTool
    ? "After completing all due tasks, use heartbeat_respond to report the outcome. Set notify=false when nothing needs the user's attention."
    : "After completing all due tasks, reply HEARTBEAT_OK.";
  return `Run the following periodic tasks (only those due based on their intervals):

${taskList}

${completionInstruction}`;
}
