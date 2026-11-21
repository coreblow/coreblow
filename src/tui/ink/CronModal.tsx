import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import type { CronJob, CronSchedule } from "../../cron/types.js";
import { loadCronStore, saveCronStore, resolveCronStorePath } from "../../cron/store.js";
import { readCronRunLogEntriesPage, resolveCronRunLogPath } from "../../cron/run-log.js";
import { callGatewayFromCli } from "../../cli/gateway-rpc.js";
import { inkPalette } from "./theme.js";

export interface CronModalProps {
  onClose: () => void;
}

type ModalSubView = "list" | "create" | "logs" | "confirm_delete";

function formatSchedule(schedule: CronSchedule): string {
  if (schedule.kind === "cron") {
    return schedule.expr + (schedule.tz ? ` (${schedule.tz})` : "");
  }
  if (schedule.kind === "every") {
    const mins = Math.round(schedule.everyMs / 60000);
    if (mins >= 60) {
      return `every ${Math.round(mins / 60)}h`;
    }
    return `every ${mins}m`;
  }
  if (schedule.kind === "at") {
    return `at ${schedule.at}`;
  }
  return "custom";
}

export const CronModal: React.FC<CronModalProps> = ({ onClose }) => {
  const [subView, setSubView] = useState<ModalSubView>("list");
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [logsList, setLogsList] = useState<string[]>([]);
  const [activeJobLogsName, setActiveJobLogsName] = useState("");

  // Create wizard inputs
  const [createStep, setCreateStep] = useState<"name" | "schedule" | "prompt" | "target">("name");
  const [newJobName, setNewJobName] = useState("");
  const [newSchedule, setNewSchedule] = useState("*/30 * * * *");
  const [newPrompt, setNewPrompt] = useState("");
  const [newTarget, setNewTarget] = useState<"local" | "telegram" | "discord" | "slack" | "whatsapp">("local");

  // Load jobs from Gateway or local store
  const refreshJobs = useCallback(async () => {
    try {
      // 1. Try Gateway RPC
      const res = (await callGatewayFromCli("cron.list", { timeout: "4000" }, {
        includeDisabled: true,
      })) as { jobs?: CronJob[] };
      if (Array.isArray(res?.jobs)) {
        setJobs(res.jobs);
        return;
      }
    } catch {
      // Gateway offline or error, fall back to local store
    }

    try {
      const storePath = resolveCronStorePath();
      const store = await loadCronStore(storePath);
      setJobs(store.jobs || []);
    } catch (err) {
      setStatusNotice(`Failed to load jobs: ${String(err)}`);
    }
  }, []);

  useEffect(() => {
    void refreshJobs();
  }, [refreshJobs]);

  const safeIndex = Math.min(Math.max(0, selectedIndex), Math.max(0, jobs.length - 1));
  const activeJob = jobs[safeIndex];

  // Toggle enable / pause
  const toggleJob = useCallback(
    async (job: CronJob) => {
      const nextEnabled = !job.enabled;
      try {
        await callGatewayFromCli("cron.update", { timeout: "4000" }, {
          id: job.id,
          patch: { enabled: nextEnabled },
        });
      } catch {
        // Fallback to local store
        const storePath = resolveCronStorePath();
        const store = await loadCronStore(storePath);
        const target = store.jobs.find((j) => j.id === job.id);
        if (target) {
          target.enabled = nextEnabled;
          await saveCronStore(storePath, store);
        }
      }
      setStatusNotice(`Job "${job.name || job.id}" is now ${nextEnabled ? "enabled" : "paused"}.`);
      await refreshJobs();
    },
    [refreshJobs],
  );

  // Trigger one-shot execution
  const runJobNow = useCallback(
    async (job: CronJob) => {
      setStatusNotice(`Triggering run for "${job.name || job.id}"...`);
      try {
        await callGatewayFromCli("cron.run", { timeout: "10000" }, {
          id: job.id,
          mode: "force",
        });
        setStatusNotice(`✓ Triggered run for "${job.name || job.id}".`);
      } catch (err) {
        setStatusNotice(`Execution error: ${String(err)}`);
      }
      await refreshJobs();
    },
    [refreshJobs],
  );

  // Delete job
  const deleteJob = useCallback(
    async (job: CronJob) => {
      try {
        await callGatewayFromCli("cron.remove", { timeout: "4000" }, { id: job.id });
      } catch {
        const storePath = resolveCronStorePath();
        const store = await loadCronStore(storePath);
        store.jobs = store.jobs.filter((j) => j.id !== job.id);
        await saveCronStore(storePath, store);
      }
      setStatusNotice(`Deleted job "${job.name || job.id}".`);
      setSubView("list");
      await refreshJobs();
    },
    [refreshJobs],
  );

  // Load logs
  const viewLogs = useCallback(
    async (job: CronJob) => {
      setActiveJobLogsName(job.name || job.id);
      try {
        const res = (await callGatewayFromCli("cron.runs", { timeout: "4000" }, {
          id: job.id,
          limit: 10,
        })) as { entries?: Array<{ ts: number; status?: string; summary?: string; error?: string }> };
        if (Array.isArray(res?.entries) && res.entries.length > 0) {
          const lines = res.entries.map((e) => {
            const time = new Date(e.ts).toLocaleTimeString();
            const status = e.status === "ok" ? "✓" : "✗";
            return `${time} ${status} ${e.summary || e.error || "(completed)"}`;
          });
          setLogsList(lines);
          setSubView("logs");
          return;
        }
      } catch {
        // Fallback to local run log
      }

      try {
        const storePath = resolveCronStorePath();
        const logPath = resolveCronRunLogPath({ storePath, jobId: job.id });
        const page = await readCronRunLogEntriesPage(logPath, { jobId: job.id, limit: 10 });
        if (page.entries.length > 0) {
          const lines = page.entries.map((e) => {
            const time = new Date(e.ts).toLocaleTimeString();
            const status = e.status === "ok" ? "✓" : "✗";
            return `${time} ${status} ${e.summary || e.error || "(completed)"}`;
          });
          setLogsList(lines);
        } else {
          setLogsList(["No execution log entries recorded yet."]);
        }
      } catch {
        setLogsList(["No execution logs available for this job."]);
      }
      setSubView("logs");
    },
    [],
  );

  // Finish creation wizard
  const finishCreation = useCallback(async () => {
    const name = newJobName.trim() || `cron_${Date.now()}`;
    const schedule: CronSchedule = {
      kind: "cron",
      expr: newSchedule.trim() || "*/30 * * * *",
    };

    const newJob: CronJob = {
      id: `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      enabled: true,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      schedule,
      sessionTarget: "isolated",
      wakeMode: "next-heartbeat",
      payload: {
        kind: "agentTurn",
        message: newPrompt.trim() || "Automated check",
      },
      delivery: {
        mode: newTarget === "local" ? "none" : "announce",
        channel: newTarget === "local" ? undefined : (newTarget as any),
      },
      state: {},
    };

    try {
      await callGatewayFromCli("cron.add", { timeout: "4000" }, {
        job: newJob,
      });
    } catch {
      const storePath = resolveCronStorePath();
      const store = await loadCronStore(storePath);
      store.jobs.push(newJob);
      await saveCronStore(storePath, store);
    }

    setStatusNotice(`Created cron job "${name}".`);
    setSubView("list");
    setNewJobName("");
    setNewPrompt("");
    await refreshJobs();
  }, [newJobName, newSchedule, newPrompt, newTarget, refreshJobs]);

  useInput((input, key) => {
    // 1. Logs subview
    if (subView === "logs") {
      if (key.escape || key.return) {
        setSubView("list");
      }
      return;
    }

    // 2. Confirm delete subview
    if (subView === "confirm_delete") {
      if (key.escape || input === "n") {
        setSubView("list");
        return;
      }
      if (input === "y" && activeJob) {
        void deleteJob(activeJob);
        return;
      }
      return;
    }

    // 3. Create job wizard subview
    if (subView === "create") {
      if (key.escape) {
        setSubView("list");
        return;
      }
      if (createStep === "name") {
        if (key.return) {
          setCreateStep("schedule");
          return;
        }
        if (key.backspace || key.delete) {
          setNewJobName((prev) => prev.slice(0, -1));
          return;
        }
        if (input && !key.ctrl && !key.meta) {
          setNewJobName((prev) => prev + input);
        }
        return;
      }
      if (createStep === "schedule") {
        if (key.return) {
          setCreateStep("prompt");
          return;
        }
        if (key.backspace || key.delete) {
          setNewSchedule((prev) => prev.slice(0, -1));
          return;
        }
        if (input && !key.ctrl && !key.meta) {
          setNewSchedule((prev) => prev + input);
        }
        return;
      }
      if (createStep === "prompt") {
        if (key.return) {
          setCreateStep("target");
          return;
        }
        if (key.backspace || key.delete) {
          setNewPrompt((prev) => prev.slice(0, -1));
          return;
        }
        if (input && !key.ctrl && !key.meta) {
          setNewPrompt((prev) => prev + input);
        }
        return;
      }
      if (createStep === "target") {
        const targets: Array<"local" | "telegram" | "discord" | "slack" | "whatsapp"> = [
          "local",
          "telegram",
          "discord",
          "slack",
          "whatsapp",
        ];
        if (key.upArrow || key.downArrow) {
          const idx = targets.indexOf(newTarget);
          const nextIdx = (idx + 1) % targets.length;
          setNewTarget(targets[nextIdx]!);
          return;
        }
        if (key.return) {
          void finishCreation();
        }
        return;
      }
      return;
    }

    // 4. Main list view
    if (key.escape) {
      onClose();
      return;
    }

    if (input === " " || key.return) {
      if (activeJob) {
        void toggleJob(activeJob);
      }
      return;
    }

    if (input === "r" && activeJob) {
      void runJobNow(activeJob);
      return;
    }

    if (input === "l" && activeJob) {
      void viewLogs(activeJob);
      return;
    }

    if (input === "d" && activeJob) {
      setSubView("confirm_delete");
      return;
    }

    if (input === "n") {
      setCreateStep("name");
      setSubView("create");
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(jobs.length - 1, prev + 1));
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={inkPalette.accent}
      paddingX={2}
      paddingY={1}
      width={76}
    >
      <Box justifyContent="space-between">
        <Text bold color={inkPalette.accent}>
          CoreBlow 24/7 Cron Orchestrator
        </Text>
        <Text color={inkPalette.dim}>({jobs.length} jobs)</Text>
      </Box>

      {statusNotice && (
        <Box marginY={0}>
          <Text color={inkPalette.link}>{statusNotice}</Text>
        </Box>
      )}

      {/* Main Jobs List */}
      {subView === "list" && (
        <Box flexDirection="column" marginY={1}>
          <Box flexDirection="column" marginY={0}>
            {jobs.map((job, idx) => {
              const isSelected = idx === safeIndex;
              const scheduleStr = formatSchedule(job.schedule);
              const isOk = job.state.lastRunStatus === "ok";
              const isErr = job.state.lastRunStatus === "error";
              const statusIcon = isOk ? "✓" : isErr ? "✗" : "○";
              const statusColor: string = isOk
                ? inkPalette.success
                : isErr
                  ? inkPalette.error
                  : inkPalette.dim;

              const enabledBadge = job.enabled ? "[enabled]" : "[paused]";
              const badgeColor: string = job.enabled ? inkPalette.success : inkPalette.dim;
              const nextRunStr = job.state.nextRunAtMs
                ? new Date(job.state.nextRunAtMs).toLocaleTimeString()
                : "idle";

              return (
                <Box key={job.id} justifyContent="space-between">
                  <Box>
                    <Text color={isSelected ? inkPalette.accent : inkPalette.dim}>
                      {isSelected ? "❯ " : "  "}
                    </Text>
                    <Text color={statusColor}>{statusIcon} </Text>
                    <Text bold={isSelected} color={inkPalette.text}>
                      {job.name || job.id}
                    </Text>
                    <Text color={inkPalette.dim}> ({scheduleStr})</Text>
                  </Box>
                  <Box>
                    <Text color={inkPalette.dim}>next {nextRunStr} · </Text>
                    <Text color={badgeColor}>{enabledBadge}</Text>
                  </Box>
                </Box>
              );
            })}
            {jobs.length === 0 && (
              <Text color={inkPalette.dim}>No cron jobs registered. Press 'n' to add one.</Text>
            )}
          </Box>

          <Box
            borderStyle="single"
            borderTop
            borderColor={inkPalette.border}
            marginTop={1}
            justifyContent="space-between"
          >
            <Text color={inkPalette.dim}>
              <Text bold color={inkPalette.text}>Space</Text>: Pause/Resume · <Text bold color={inkPalette.text}>r</Text>: Run Now · <Text bold color={inkPalette.text}>n</Text>: New · <Text bold color={inkPalette.text}>l</Text>: Logs · <Text bold color={inkPalette.text}>d</Text>: Delete · <Text bold color={inkPalette.text}>Esc</Text>: Close
            </Text>
          </Box>
        </Box>
      )}

      {/* Creation Wizard */}
      {subView === "create" && (
        <Box flexDirection="column" marginY={1}>
          <Text bold color={inkPalette.accentSoft}>
            Create New 24/7 Cron Job (Step: {createStep})
          </Text>

          {createStep === "name" && (
            <Box flexDirection="column" marginY={1}>
              <Text color={inkPalette.dim}>Job Name or Identifier:</Text>
              <Box>
                <Text color={inkPalette.accent}>❯ </Text>
                <Text color={inkPalette.text}>{newJobName || "e.g. daily-summary"}</Text>
              </Box>
              <Text color={inkPalette.dim}>Press Enter to continue, Esc to cancel.</Text>
            </Box>
          )}

          {createStep === "schedule" && (
            <Box flexDirection="column" marginY={1}>
              <Text color={inkPalette.dim}>Cron Expression or Interval:</Text>
              <Box>
                <Text color={inkPalette.accent}>❯ </Text>
                <Text color={inkPalette.text}>{newSchedule}</Text>
              </Box>
              <Text color={inkPalette.dim}>Examples: */30 * * * * (every 30m), 0 9 * * * (daily 9am).</Text>
            </Box>
          )}

          {createStep === "prompt" && (
            <Box flexDirection="column" marginY={1}>
              <Text color={inkPalette.dim}>Instruction Prompt or System Command:</Text>
              <Box>
                <Text color={inkPalette.accent}>❯ </Text>
                <Text color={inkPalette.text}>{newPrompt || "e.g. Check system health and summarize"}</Text>
              </Box>
            </Box>
          )}

          {createStep === "target" && (
            <Box flexDirection="column" marginY={1}>
              <Text color={inkPalette.dim}>Delivery Target (▲▼ to cycle):</Text>
              <Box marginY={0}>
                <Text color={inkPalette.accent}>❯ </Text>
                <Text bold color={inkPalette.text}>{newTarget.toUpperCase()}</Text>
              </Box>
              <Text color={inkPalette.dim}>Press Enter to save and activate job.</Text>
            </Box>
          )}
        </Box>
      )}

      {/* Logs View */}
      {subView === "logs" && (
        <Box flexDirection="column" marginY={1}>
          <Box justifyContent="space-between" marginBottom={1}>
            <Text bold color={inkPalette.accentSoft}>
              Run Logs: {activeJobLogsName}
            </Text>
            <Text color={inkPalette.dim}>({logsList.length} entries)</Text>
          </Box>
          <Box flexDirection="column">
            {logsList.map((logLine, i) => (
              <Text key={i} color={inkPalette.text}>
                {logLine}
              </Text>
            ))}
          </Box>
          <Box borderStyle="single" borderTop borderColor={inkPalette.border} marginTop={1}>
            <Text color={inkPalette.dim}>Press Enter or Esc to return to jobs list.</Text>
          </Box>
        </Box>
      )}

      {/* Confirm Delete */}
      {subView === "confirm_delete" && activeJob && (
        <Box flexDirection="column" marginY={1}>
          <Text bold color={inkPalette.error}>
            Delete cron job "{activeJob.name || activeJob.id}"?
          </Text>
          <Text color={inkPalette.dim}>
            Press <Text bold color={inkPalette.error}>y</Text> to permanently delete, or <Text bold color={inkPalette.text}>n</Text> / Esc to cancel.
          </Text>
        </Box>
      )}
    </Box>
  );
};
