/**
 * CoreBlow — Memory Bootstrap (Powered by Cory Built-in Memory)
 *
 * Factory that creates a CoryBootstrapService and MemoryOrchestrator from CoreBlow config.
 * Resolves ~ paths, validates config, and wires zero-config Cory memory by default.
 */

import * as os from 'node:os';
import * as path from 'node:path';
import { CoryBootstrapService, type CoryConfig } from './cory.js';
import { MemoryOrchestrator, type MemoryConfig } from './memory-orchestrator.js';

/**
 * Resolve ~ to home directory.
 */
function resolvePath(p: string): string {
    if (p.startsWith('~/')) {
        return path.join(os.homedir(), p.slice(2));
    }
    if (p === '~') {
        return os.homedir();
    }
    return path.resolve(p);
}

/**
 * Memory config from CoreBlow config schema.
 * Matches the shape of ValidatedCoreBlowConfig['memory'].
 */
export interface MemorySchemaConfig {
    transcriptDir: string;
    coryStateDir?: string;
    defaultRetrievalCount: number;
    maxFileSizeBytes: number;
    compactionStrategy: 'truncate' | 'summarize';
    rag: {
        enabled: boolean;
        engine: 'local' | 'ollama' | 'openai' | 'gemini' | 'voyage' | 'mistral' | 'auto';
        apiKey?: string;
        maxDocuments: number;
    };
}

/**
 * Create a standalone CoryBootstrapService (registered with ServiceRegistry on startup).
 */
export function createCoryMemoryService(config?: CoryConfig): CoryBootstrapService {
    return new CoryBootstrapService(config);
}

/**
 * Create a MemoryOrchestrator (backed by Cory Built-in Memory) from CoreBlow config.
 */
export function createMemoryOrchestrator(memoryConfig: MemorySchemaConfig): MemoryOrchestrator {
    const transcriptDir = resolvePath(memoryConfig.transcriptDir);
    const coryStateDir = memoryConfig.coryStateDir
        ? resolvePath(memoryConfig.coryStateDir)
        : path.join(transcriptDir, 'cory');

    const config: MemoryConfig = {
        transcriptDir,
        coryStateDir,
        transcript: {
            defaultRetrievalCount: memoryConfig.defaultRetrievalCount,
            maxFileSizeBytes: memoryConfig.maxFileSizeBytes,
            compactionStrategy: memoryConfig.compactionStrategy,
        },
    };

    if (memoryConfig.rag.enabled) {
        config.rag = {
            enabled: true,
            engine: memoryConfig.rag.engine,
            apiKey: memoryConfig.rag.apiKey,
            maxDocuments: memoryConfig.rag.maxDocuments,
        };
    }

    return new MemoryOrchestrator(config);
}

/**
 * Create a default MemoryOrchestrator with zero-config Cory Built-in Memory enabled.
 */
export function createDefaultMemoryOrchestrator(): MemoryOrchestrator {
    return createMemoryOrchestrator({
        transcriptDir: '~/.coreblow/sessions',
        coryStateDir: '~/.coreblow/memory',
        defaultRetrievalCount: 20,
        maxFileSizeBytes: 512 * 1024,
        compactionStrategy: 'summarize',
        rag: {
            enabled: false,
            engine: 'local',
            maxDocuments: 10_000,
        },
    });
}
