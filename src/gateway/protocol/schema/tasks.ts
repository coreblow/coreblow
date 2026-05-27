import { Type } from "typebox";
import { NonEmptyString } from "./primitives.js";

export const TaskLedgerStatusSchema = Type.Union([
  Type.Literal("queued"),
  Type.Literal("running"),
  Type.Literal("completed"),
  Type.Literal("failed"),
  Type.Literal("cancelled"),
  Type.Literal("timed_out"),
]);

const TimestampSchema = Type.Union([Type.String(), Type.Integer({ minimum: 0 })]);

export const TaskSummarySchema = Type.Object(
  {
    id: NonEmptyString,
    status: TaskLedgerStatusSchema,
    kind: Type.Optional(NonEmptyString),
    runtime: Type.Optional(NonEmptyString),
    title: Type.Optional(NonEmptyString),
    agentId: Type.Optional(NonEmptyString),
    sessionKey: Type.Optional(NonEmptyString),
    childSessionKey: Type.Optional(NonEmptyString),
    ownerKey: Type.Optional(NonEmptyString),
    runId: Type.Optional(NonEmptyString),
    taskId: Type.Optional(NonEmptyString),
    flowId: Type.Optional(NonEmptyString),
    parentTaskId: Type.Optional(NonEmptyString),
    sourceId: Type.Optional(NonEmptyString),
    createdAt: Type.Optional(TimestampSchema),
    updatedAt: Type.Optional(TimestampSchema),
    startedAt: Type.Optional(TimestampSchema),
    endedAt: Type.Optional(TimestampSchema),
    progressSummary: Type.Optional(Type.String()),
    terminalSummary: Type.Optional(Type.String()),
    error: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const TasksListParamsSchema = Type.Object(
  {
    status: Type.Optional(
      Type.Union([TaskLedgerStatusSchema, Type.Array(TaskLedgerStatusSchema)]),
    ),
    agentId: Type.Optional(NonEmptyString),
    sessionKey: Type.Optional(NonEmptyString),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 500 })),
    cursor: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const TasksListResultSchema = Type.Object(
  {
    tasks: Type.Array(TaskSummarySchema),
    nextCursor: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const TasksGetParamsSchema = Type.Object(
  { taskId: NonEmptyString },
  { additionalProperties: false },
);

export const TasksGetResultSchema = Type.Object(
  { task: TaskSummarySchema },
  { additionalProperties: false },
);

export const TasksCancelParamsSchema = Type.Object(
  {
    taskId: NonEmptyString,
    reason: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const TasksCancelResultSchema = Type.Object(
  {
    found: Type.Boolean(),
    cancelled: Type.Boolean(),
    reason: Type.Optional(Type.String()),
    task: Type.Optional(TaskSummarySchema),
  },
  { additionalProperties: false },
);
