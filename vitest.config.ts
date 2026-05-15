// Root shim: the real Vitest config lives in test/vitest/.
export {
  default,
  resolveLocalVitestMaxWorkers,
} from './test/vitest/vitest.config.ts';
