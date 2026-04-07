/**
 * gateway/protocol/index.ts — Core RPC protocol types, errors, and validation primitives.
 */

// ─── Errors ─────────────────────────────────────────────────────────

export const ErrorCodes = {
    INVALID_REQUEST: 'invalid_request',
    UNAUTHORIZED: 'unauthorized',
    UNAVAILABLE: 'unavailable',
    NOT_FOUND: 'not_found',
    INTERNAL_ERROR: 'internal_error',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

export interface ErrorShape {
    code: string;
    message: string;
    details?: unknown;
}

export function errorShape(code: string, message: string, details?: unknown): ErrorShape {
    return { code, message, ...(details ? { details } : {}) };
}

// ─── Protocol Version ───────────────────────────────────────────────

export const PROTOCOL_VERSION = 3 as const;

// ─── Protocol Types ─────────────────────────────────────────────────

export interface RequestFrame {
    type: "req";
    id: string;
    method: string;
    params?: unknown;
}

export interface ResponseFrame {
    type: "res";
    id: string;
    ok: boolean;
    payload?: unknown;
    error?: {
        code?: string;
        message?: string;
        details?: unknown;
    };
}

export interface EventFrame {
    type: "evt";
    event: string;
    payload?: unknown;
    seq?: number;
}

export interface HelloOk {
    protocol: number;
    sessionKey?: string;
    auth?: {
        deviceToken?: string;
        role?: string;
        scopes?: string[];
    };
    policy?: {
        tickIntervalMs?: number;
    };
}

export interface ConnectParams {
    minProtocol?: number;
    maxProtocol?: number;
    auth?: {
        token?: string;
        bootstrapToken?: string;
        deviceToken?: string;
        password?: string;
    };
    role?: string;
    scopes?: string[];
    caps?: string[];
    commands?: string[];
    permissions?: Record<string, boolean>;
    pathEnv?: string;
    device?: {
        id: string;
        publicKey?: string;
        signature?: string;
        signedAt?: number;
        nonce?: string;
    };
    client?: {
        id: string;
        displayName?: string;
        version?: string;
        platform?: string;
        deviceFamily?: string;
        mode?: string;
        instanceId?: string;
    };
}

// ─── Frame Validators ───────────────────────────────────────────────

function createFrameValidator<T>(typeName: string): ((data: unknown) => data is T) & { errors?: unknown[] } {
    const fn = function (data: unknown): data is T {
        fn.errors = [];
        if (!data || typeof data !== "object" || Array.isArray(data)) {
            return false;
        }
        const obj = data as Record<string, unknown>;
        return obj.type === typeName || (typeName === "evt" && typeof obj.event === "string");
    } as ((data: unknown) => data is T) & { errors?: unknown[] };
    return fn;
}

export const validateRequestFrame = createFrameValidator<RequestFrame>("req");
export const validateResponseFrame = createFrameValidator<ResponseFrame>("res");
export const validateEventFrame = createFrameValidator<EventFrame>("evt");

// ─── Validation Utilities ───────────────────────────────────────────

export interface ValidationError {
    path?: string;
    message: string;
}

export function formatValidationErrors(errors?: ValidationError[]): string {
    if (!errors || errors.length === 0) return 'Unknown validation error';
    return errors
        .map(e => (e.path ? `${e.path}: ${e.message}` : e.message))
        .join('; ');
}

/**
 * Lightweight ad-hoc validator definition (zero-deps, replaces Ajv)
 */
export interface Validator<T = unknown> {
    (data: unknown): data is T;
    errors?: ValidationError[];
}

/**
 * Helper to build custom lightweight object validators manually (no Ajv dependency).
 */
export function buildObjectValidator<T>(
    schema: {
        required?: string[];
        properties?: Record<string, { type: string; enum?: unknown[] }>;
    }
): Validator<T> {
    const v: Validator<T> = (data: unknown): data is T => {
        v.errors = [];
        if (typeof data !== 'object' || data === null) {
            v.errors.push({ message: 'Must be an object' });
            return false;
        }

        const obj = data as Record<string, unknown>;

        if (schema.required) {
            for (const req of schema.required) {
                if (!(req in obj)) {
                    v.errors.push({ path: req, message: `Required property missing` });
                }
            }
        }

        if (schema.properties) {
            for (const [key, propConfig] of Object.entries(schema.properties)) {
                if (key in obj) {
                    const val = obj[key];
                    if (propConfig.type === 'array' && !Array.isArray(val)) {
                        v.errors.push({ path: key, message: `Must be an array` });
                    } else if (propConfig.type !== 'array' && typeof val !== propConfig.type) {
                        v.errors.push({ path: key, message: `Must be of type ${propConfig.type}` });
                    }

                    if (propConfig.enum && !propConfig.enum.includes(val)) {
                        v.errors.push({ path: key, message: `Must be one of: ${propConfig.enum.join(', ')}` });
                    }
                }
            }
        }

        return v.errors.length === 0;
    };
    return v;
}

// ─── Cron Validators ────────────────────────────────────────────────

export const validateWakeParams = buildObjectValidator<any>({
    required: ['mode', 'text'],
    properties: {
        mode: { type: 'string', enum: ['now', 'next-heartbeat'] },
        text: { type: 'string' }
    }
});

export const validateCronListParams = buildObjectValidator<any>({
    properties: {
        includeDisabled: { type: 'boolean' },
        limit: { type: 'number' },
        offset: { type: 'number' },
        query: { type: 'string' },
        enabled: { type: 'string', enum: ['all', 'enabled', 'disabled'] },
        sortBy: { type: 'string', enum: ['nextRunAtMs', 'updatedAtMs', 'name'] },
        sortDir: { type: 'string', enum: ['asc', 'desc'] }
    }
});

export const validateCronStatusParams = buildObjectValidator<any>({});

export const validateCronAddParams = buildObjectValidator<any>({
    required: ['name', 'agentId', 'schedule', 'sessionTarget'],
    properties: {
        name: { type: 'string' },
        agentId: { type: 'string' }
    }
});

export const validateCronUpdateParams = buildObjectValidator<any>({
    required: ['patch'],
    properties: {
        id: { type: 'string' },
        jobId: { type: 'string' },
        patch: { type: 'object' }
    }
});

export const validateCronRemoveParams = buildObjectValidator<any>({
    properties: {
        id: { type: 'string' },
        jobId: { type: 'string' }
    }
});

export const validateCronRunParams = buildObjectValidator<any>({
    properties: {
        id: { type: 'string' },
        jobId: { type: 'string' },
        mode: { type: 'string', enum: ['due', 'force'] }
    }
});

export const validateCronRunsParams = buildObjectValidator<any>({
    properties: {
        scope: { type: 'string', enum: ['job', 'all'] },
        id: { type: 'string' },
        jobId: { type: 'string' },
        limit: { type: 'number' },
        offset: { type: 'number' },
        query: { type: 'string' },
        sortDir: { type: 'string', enum: ['asc', 'desc'] }
    }
});
// ─── Skills Validators ──────────────────────────────────────────────

export const validateSkillsStatusParams = buildObjectValidator<any>({
    properties: {
        agentId: { type: 'string' }
    }
});

export const validateSkillsBinsParams = buildObjectValidator<any>({});

export const validateSkillsInstallParams = buildObjectValidator<any>({
    properties: {
        name: { type: 'string' },
        installId: { type: 'string' },
        timeoutMs: { type: 'number' },
        source: { type: 'string' },
        slug: { type: 'string' },
        version: { type: 'string' },
        force: { type: 'boolean' }
    }
});

export const validateSkillsUpdateParams = buildObjectValidator<any>({
    properties: {
        skillKey: { type: 'string' },
        enabled: { type: 'boolean' },
        apiKey: { type: 'string' },
        env: { type: 'object' },
        source: { type: 'string' },
        slug: { type: 'string' },
        all: { type: 'boolean' }
    }
});

// ─── Doctor & Health Validators ─────────────────────────────────────

export const validateDoctorMemoryStatusParams = buildObjectValidator<any>({});

export const validateHealthStatusParams = buildObjectValidator<any>({});

// ─── Wizard Validators ────────────────────────────────────────────────

export const validateWizardStartParams = buildObjectValidator<any>({
    required: ['mode'],
    properties: {
        mode: { type: 'string' },
        workspace: { type: 'string' }
    }
});

export const validateWizardNextParams = buildObjectValidator<any>({
    required: ['sessionId'],
    properties: {
        sessionId: { type: 'string' },
        answer: { type: 'object' }
    }
});

export const validateWizardCancelParams = buildObjectValidator<any>({
    required: ['sessionId'],
    properties: {
        sessionId: { type: 'string' }
    }
});

export const validateWizardStatusParams = buildObjectValidator<any>({
    required: ['sessionId'],
    properties: {
        sessionId: { type: 'string' }
    }
});

// ─── Config & Model Validators ────────────────────────────────────────

export const validateConfigGetParams = buildObjectValidator<any>({
    properties: {
        path: { type: 'string' }
    }
});

export const validateConfigSetParams = buildObjectValidator<any>({
    required: ['path', 'value'],
    properties: {
        path: { type: 'string' }
    } // value can be any type
});

export const validateModelsListParams = buildObjectValidator<any>({});
export const validateModelsCatalogParams = buildObjectValidator<any>({});

// ─── Sessions Validators ───────────────────────────────────────────

export const validateSessionsListParams = buildObjectValidator<any>({
    properties: { limit: { type: 'number' }, offset: { type: 'number' } }
});
export const validateSessionsCreateParams = buildObjectValidator<any>({});
export const validateSessionsPreviewParams = buildObjectValidator<any>({
    properties: { keys: { type: 'array' } }
});
export const validateSessionsResolveParams = buildObjectValidator<any>({});
export const validateSessionsPatchParams = buildObjectValidator<any>({});
export const validateSessionsDeleteParams = buildObjectValidator<any>({
    required: ['key']
});
export const validateSessionsResetParams = buildObjectValidator<any>({
    required: ['key']
});
export const validateSessionsCompactParams = buildObjectValidator<any>({
    required: ['key']
});
export const validateSessionsAbortParams = buildObjectValidator<any>({
    required: ['key']
});
export const validateSessionsSendParams = buildObjectValidator<any>({
    required: ['key', 'message']
});
export const validateSessionsMessagesSubscribeParams = buildObjectValidator<any>({
    required: ['key']
});
export const validateSessionsMessagesUnsubscribeParams = buildObjectValidator<any>({
    required: ['key']
});

// ─── Chat Validators ───────────────────────────────────────────────

export const validateChatSendParams = buildObjectValidator<any>({
    required: ['sessionKey', 'message']
});
export const validateChatAbortParams = buildObjectValidator<any>({
    required: ['sessionKey']
});
export const validateChatHistoryParams = buildObjectValidator<any>({
    required: ['sessionKey']
});
export const validateChatInjectParams = buildObjectValidator<any>({});

// ─── Agents Validators ─────────────────────────────────────────────

export const validateAgentsListParams = buildObjectValidator<any>({});
export const validateAgentsCreateParams = buildObjectValidator<any>({
    required: ['name']
});
export const validateAgentsUpdateParams = buildObjectValidator<any>({
    required: ['agentId']
});
export const validateAgentsDeleteParams = buildObjectValidator<any>({
    required: ['agentId']
});
export const validateAgentsFilesListParams = buildObjectValidator<any>({
    required: ['agentId']
});
export const validateAgentsFilesGetParams = buildObjectValidator<any>({
    required: ['agentId', 'name']
});
export const validateAgentsFilesSetParams = buildObjectValidator<any>({
    required: ['agentId', 'name', 'content']
});

// ─── Send & Channels Validators ────────────────────────────────────

export const validateSendParams = buildObjectValidator<any>({
    required: ['to']
});
export const validatePollParams = buildObjectValidator<any>({
    required: ['to', 'question', 'options']
});
export const validateChannelsStatusParams = buildObjectValidator<any>({});
export const validateChannelsLogoutParams = buildObjectValidator<any>({});

// ─── Nodes & System Validators ─────────────────────────────────────

export const validateNodeListParams = buildObjectValidator<any>({});
export const validateNodeDescribeParams = buildObjectValidator<any>({
    required: ['nodeId']
});
export const validateNodeInvokeParams = buildObjectValidator<any>({
    required: ['nodeId', 'command']
});
export const validateNodeEventParams = buildObjectValidator<any>({});
export const validateNodePairRequestParams = buildObjectValidator<any>({});
export const validateNodePairListParams = buildObjectValidator<any>({});
export const validateNodePairApproveParams = buildObjectValidator<any>({
    required: ['requestId']
});
export const validateNodePairRejectParams = buildObjectValidator<any>({
    required: ['requestId']
});
export const validateNodePairVerifyParams = buildObjectValidator<any>({
    required: ['nodeId', 'token']
});
export const validateNodeRenameParams = buildObjectValidator<any>({
    required: ['nodeId', 'displayName']
});
export const validateNodePendingAckParams = buildObjectValidator<any>({});
export const validateNodePendingDrainParams = buildObjectValidator<any>({});
export const validateNodePendingEnqueueParams = buildObjectValidator<any>({ required: ['nodeId', 'type'] });

export const validateLogsTailParams = buildObjectValidator<any>({});

export const validateDevicesListParams = buildObjectValidator<any>({});
export const validateDevicesUnpairParams = buildObjectValidator<any>({ required: ['deviceId'] });

export const validateSetHeartbeatsParams = buildObjectValidator<any>({ required: ['enabled'] });
export const validateSystemEventParams = buildObjectValidator<any>({ required: ['text'] });

// ─── Wave 85: Media & Peripherals Validators ───────────────────────

export const validateTtsSynthesizeParams = buildObjectValidator<any>({ required: ['text'] });
export const validateTtsVoicesParams = buildObjectValidator<any>({});

export const validateTalkStartParams = buildObjectValidator<any>({});
export const validateTalkStopParams = buildObjectValidator<any>({});
export const validateTalkTranscribeParams = buildObjectValidator<any>({ required: ['audioBase64'] });

export const validateWebStatusParams = buildObjectValidator<any>({});

export const validatePushRegisterParams = buildObjectValidator<any>({ required: ['token'] });
export const validatePushUnregisterParams = buildObjectValidator<any>({ required: ['token'] });

export const validateUpdateCheckParams = buildObjectValidator<any>({});
export const validateUpdateApplyParams = buildObjectValidator<any>({ required: ['version'] });

export const validateVoicewakeConfigureParams = buildObjectValidator<any>({});

export const validateUsageSessionsParams = buildObjectValidator<any>({});

// ─── Wave 90: Approvals Validators ─────────────────────────────

export const validateExecApprovalRequestParams = buildObjectValidator<any>({ required: ['command'] });
export const validateExecApprovalResolveParams = buildObjectValidator<any>({ required: ['id', 'decision'] });
export const validatePluginApprovalRequestParams = buildObjectValidator<any>({ required: ['title', 'description'] });
export const validatePluginApprovalResolveParams = buildObjectValidator<any>({ required: ['id', 'decision'] });
export const validateExecApprovalsGetParams = buildObjectValidator<any>({});
export const validateExecApprovalsSetParams = buildObjectValidator<any>({ required: ['rules'] });
export const validateExecApprovalsNodeGetParams = buildObjectValidator<any>({ required: ['nodeId'] });
export const validateExecApprovalsNodeSetParams = buildObjectValidator<any>({ required: ['nodeId', 'rules'] });

// ─── Wave 91: Secrets Validators ───────────────────────────────

export const validateSecretsResolveParams = buildObjectValidator<any>({ required: ['commandName', 'targetIds'] });
export const validateSecretsResolveResult = buildObjectValidator<any>({ required: ['assignments', 'inactiveRefPaths'] });

// ─── Wave 92: Tools Validators ─────────────────────────────────

export const validateToolsCatalogParams = buildObjectValidator<any>({});
export const validateToolsEffectiveParams = buildObjectValidator<any>({ required: ['sessionKey'] });

// ─── Wave 93: Agent Validators ─────────────────────────────────

export const validateAgentWaitParams = buildObjectValidator<any>({ required: ['runId'] });

// ─── Wave 94: Session Validators ───────────────────────────────

export const validateSessionPatchParams = buildObjectValidator<any>({ required: ['sessionKey'] });
export const validateSessionResetParams = buildObjectValidator<any>({ required: ['sessionKey'] });
export const validateSessionResolveParams = buildObjectValidator<any>({ required: ['query'] });
export const validateSessionCompactParams = buildObjectValidator<any>({ required: ['sessionKey'] });

