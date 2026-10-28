import type { GatewayService, ServiceHealth } from "../gateway/service-registry.js";

export interface AcpExecutionOptions {
  timeoutMs?: number;
  subagentId?: string;
  maxTurns?: number;
  maxMemoryBytes?: number;
}

export interface AcpTaskMetrics {
  taskId: string;
  subagentId?: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  timedOut: boolean;
  aborted: boolean;
  turns: number;
}

export class AcpWorkerTimeoutError extends Error {
  constructor(
    public readonly taskId: string,
    public readonly timeoutMs: number,
    public readonly subagentId?: string,
  ) {
    super(
      `[OWASP ASI08 / CVE-2026-84288] ACP Worker Timeout: task '${taskId}'${
        subagentId ? ` for subagent '${subagentId}'` : ""
      } exceeded maximum execution ceiling of ${timeoutMs}ms. Execution aborted.`,
    );
    this.name = "AcpWorkerTimeoutError";
  }
}

interface ActiveTaskRecord {
  taskId: string;
  subagentId?: string;
  startTime: number;
  controller: AbortController;
  timeoutId: ReturnType<typeof setTimeout>;
  maxTurns?: number;
  turns: number;
}

export class AcpWorkerTimeoutGuard implements GatewayService {
  public readonly name = "acp-worker-timeout-guard";
  public static readonly DEFAULT_TIMEOUT_CEILING_MS = 120_000; // 120 seconds default

  private isRunning = false;
  private readonly defaultTimeoutMs: number;
  private readonly activeTasks = new Map<string, ActiveTaskRecord>();
  private readonly taskMetricsHistory: AcpTaskMetrics[] = [];
  private totalCompleted = 0;
  private totalTimedOut = 0;
  private totalAborted = 0;

  constructor(options: { defaultTimeoutMs?: number } = {}) {
    this.defaultTimeoutMs =
      options.defaultTimeoutMs ?? AcpWorkerTimeoutGuard.DEFAULT_TIMEOUT_CEILING_MS;
  }

  public async start(): Promise<void> {
    this.isRunning = true;
  }

  public async stop(): Promise<void> {
    // Abort any in-flight active tasks on shutdown
    for (const [taskId] of this.activeTasks) {
      this.abortTask(taskId, "Gateway service stopping.");
    }
    this.activeTasks.clear();
    this.isRunning = false;
  }

  public health(): ServiceHealth {
    if (!this.isRunning) {
      return { status: "down", detail: "ACP Worker Timeout Guard is stopped." };
    }
    return {
      status: "healthy",
      detail: `Active tasks: ${this.activeTasks.size}, Completed: ${this.totalCompleted}, Timed out: ${this.totalTimedOut}, Aborted: ${this.totalAborted}.`,
    };
  }

  public async executeWithTimeout<T>(
    taskId: string,
    fn: (signal: AbortSignal) => Promise<T>,
    options: AcpExecutionOptions = {},
  ): Promise<T> {
    if (!this.isRunning) {
      throw new Error("Cannot execute ACP task: AcpWorkerTimeoutGuard is not started.");
    }
    if (this.activeTasks.has(taskId)) {
      throw new Error(`Task '${taskId}' is already running.`);
    }

    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const controller = new AbortController();
    const startTime = Date.now();
    let timedOut = false;

    const timeoutId = setTimeout(() => {
      timedOut = true;
      this.totalTimedOut += 1;
      controller.abort(new AcpWorkerTimeoutError(taskId, timeoutMs, options.subagentId));
    }, timeoutMs);

    const taskRecord: ActiveTaskRecord = {
      taskId,
      subagentId: options.subagentId,
      startTime,
      controller,
      timeoutId,
      maxTurns: options.maxTurns,
      turns: 0,
    };
    this.activeTasks.set(taskId, taskRecord);

    const abortPromise = new Promise<never>((_, reject) => {
      controller.signal.addEventListener(
        "abort",
        () => {
          if (timedOut) {
            reject(new AcpWorkerTimeoutError(taskId, timeoutMs, options.subagentId));
          } else {
            const reason = controller.signal.reason;
            reject(reason instanceof Error ? reason : new Error(String(reason ?? "Aborted")));
          }
        },
        { once: true },
      );
    });

    try {
      const result = await Promise.race([fn(controller.signal), abortPromise]);
      clearTimeout(timeoutId);
      this.totalCompleted += 1;
      this.recordMetrics(taskId, options.subagentId, startTime, false, false, taskRecord.turns);
      return result;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (timedOut) {
        this.recordMetrics(taskId, options.subagentId, startTime, true, false, taskRecord.turns);
        throw new AcpWorkerTimeoutError(taskId, timeoutMs, options.subagentId);
      }
      const isAborted = controller.signal.aborted;
      if (isAborted) {
        this.totalAborted += 1;
      }
      this.recordMetrics(taskId, options.subagentId, startTime, false, isAborted, taskRecord.turns);
      throw err;
    } finally {
      this.activeTasks.delete(taskId);
    }
  }

  public recordTurn(taskId: string): void {
    const record = this.activeTasks.get(taskId);
    if (!record) return;
    record.turns += 1;
    if (record.maxTurns !== undefined && record.turns > record.maxTurns) {
      record.controller.abort(
        new Error(
          `[OWASP ASI06] Turn budget exceeded: task '${taskId}' executed ${record.turns} turns, exceeding limit of ${record.maxTurns}.`,
        ),
      );
    }
  }

  public abortTask(taskId: string, reason = "Explicitly aborted"): boolean {
    const record = this.activeTasks.get(taskId);
    if (!record) return false;
    clearTimeout(record.timeoutId);
    record.controller.abort(new Error(reason));
    this.activeTasks.delete(taskId);
    this.totalAborted += 1;
    this.recordMetrics(taskId, record.subagentId, record.startTime, false, true, record.turns);
    return true;
  }

  public isTaskRunning(taskId: string): boolean {
    return this.activeTasks.has(taskId);
  }

  public getActiveTaskCount(): number {
    return this.activeTasks.size;
  }

  public getMetricsHistory(): AcpTaskMetrics[] {
    return [...this.taskMetricsHistory];
  }

  private recordMetrics(
    taskId: string,
    subagentId: string | undefined,
    startTime: number,
    timedOut: boolean,
    aborted: boolean,
    turns: number,
  ): void {
    const now = Date.now();
    this.taskMetricsHistory.push({
      taskId,
      subagentId,
      startTime,
      endTime: now,
      durationMs: now - startTime,
      timedOut,
      aborted,
      turns,
    });
  }
}
