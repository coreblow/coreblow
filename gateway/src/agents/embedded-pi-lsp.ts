/** Embedded LSP bridge. */
export interface LspConfig { rootUri: string; capabilities?: string[]; }
export function createLspConfig(rootUri: string): LspConfig { return { rootUri, capabilities: ['completion', 'diagnostics', 'hover'] }; }
