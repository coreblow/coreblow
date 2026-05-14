import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = {
    LOG_FILE: process.env.LOG_FILE,
    LOG_LEVEL: process.env.LOG_LEVEL,
    VITEST: process.env.VITEST,
};

async function importLogger() {
    vi.resetModules();
    return import("./logger.js");
}

afterEach(() => {
    if (ORIGINAL_ENV.LOG_FILE === undefined) {
        delete process.env.LOG_FILE;
    } else {
        process.env.LOG_FILE = ORIGINAL_ENV.LOG_FILE;
    }
    if (ORIGINAL_ENV.LOG_LEVEL === undefined) {
        delete process.env.LOG_LEVEL;
    } else {
        process.env.LOG_LEVEL = ORIGINAL_ENV.LOG_LEVEL;
    }
    if (ORIGINAL_ENV.VITEST === undefined) {
        delete process.env.VITEST;
    } else {
        process.env.VITEST = ORIGINAL_ENV.VITEST;
    }
});

describe("utils/logger", () => {
    it("defaults legacy Pino logging to silent in Vitest", async () => {
        process.env.VITEST = "true";
        delete process.env.LOG_FILE;
        delete process.env.LOG_LEVEL;

        const { getLogLevel } = await importLogger();

        expect(getLogLevel()).toBe("silent");
    });

    it("honors explicit LOG_LEVEL in Vitest", async () => {
        process.env.VITEST = "true";
        process.env.LOG_LEVEL = "warn";

        const { getLogLevel } = await importLogger();

        expect(getLogLevel()).toBe("warn");
    });
});
