/**
 * src/cli-main.ts
 *
 * Dedicated CLI entry point untuk CoreBlow binary.
 * Dipanggil oleh coreblow.mjs → dist/cli-main.js (bukan dist/index.js).
 *
 * Pola OC: index.ts = library exports, cli-main.ts = CLI runner.
 * Ini memastikan `import from 'coreblow'` (library usage) tidak otomatis
 * menjalankan program CLI, sehingga tests tidak terdampak.
 */
import { buildProgram } from './cli/program/build-program.js';

await buildProgram().parseAsync();
