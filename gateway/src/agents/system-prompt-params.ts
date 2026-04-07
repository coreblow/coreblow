/** System prompt parameter types. */
export interface SystemPromptParams { identity?: string; persona?: string; capabilities?: string[]; tools?: string[]; instructions?: string; context?: string; }
export function mergePromptParams(...params: Partial<SystemPromptParams>[]): SystemPromptParams { return Object.assign({}, ...params); }
