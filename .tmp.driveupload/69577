#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const entry = path.join(__dirname, 'gateway', 'dist', 'index.js');

const child = spawn('node', [entry, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, COREBLOW_ROOT: __dirname },
});

child.on('exit', (code) => process.exit(code ?? 0));
