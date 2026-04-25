import { describe, beforeEach, expect, it } from "vitest";
import { SnapshotTesting } from "./snapshot-testing.js";

let snapshots: SnapshotTesting;

beforeEach(() => {
    snapshots = new SnapshotTesting();
});

describe("SnapshotTesting — construction", () => {
    it("starts empty", () => {
        expect(snapshots.count()).toBe(0);
        expect(snapshots.list()).toEqual([]);
    });
});

describe("SnapshotTesting — match (new snapshot)", () => {
    it("creates a new snapshot on first match", () => {
        const result = snapshots.match("key1", { hello: "world" });
        expect(result.match).toBe(true);
        expect(snapshots.count()).toBe(1);
    });

    it("tracks creation in stats", () => {
        snapshots.match("a", "value");
        const stats = snapshots.getStats();
        expect(stats.created).toBe(1);
        expect(stats.matched).toBe(0);
    });
});

describe("SnapshotTesting — match (existing snapshot)", () => {
    it("matches when value is identical", () => {
        snapshots.match("key", { x: 1 });
        const result = snapshots.match("key", { x: 1 });
        expect(result.match).toBe(true);
        expect(snapshots.getStats().matched).toBe(1);
    });

    it("fails when value differs and not in update mode", () => {
        snapshots.match("key", "original");
        const result = snapshots.match("key", "changed");
        expect(result.match).toBe(false);
        expect(result.diff).toBeDefined();
        expect(snapshots.getStats().failed).toBe(1);
    });

    it("generates diff showing expected vs actual", () => {
        snapshots.match("key", "line1\nline2");
        const result = snapshots.match("key", "line1\nmodified");
        expect(result.diff).toContain("- line2");
        expect(result.diff).toContain("+ modified");
    });
});

describe("SnapshotTesting — update mode", () => {
    it("updates snapshot when in update mode", () => {
        snapshots.match("key", "original");
        snapshots.setUpdateMode(true);
        const result = snapshots.match("key", "updated");
        expect(result.match).toBe(true);
        expect(snapshots.get("key")).toBe("updated");
        expect(snapshots.getStats().updated).toBe(1);
    });
});

describe("SnapshotTesting — get / delete", () => {
    it("gets stored snapshot value", () => {
        snapshots.match("k", "stored");
        expect(snapshots.get("k")).toBe("stored");
    });

    it("returns null for unknown key", () => {
        expect(snapshots.get("unknown")).toBeNull();
    });

    it("deletes a snapshot", () => {
        snapshots.match("k", "v");
        expect(snapshots.delete("k")).toBe(true);
        expect(snapshots.count()).toBe(0);
    });

    it("returns false when deleting nonexistent key", () => {
        expect(snapshots.delete("nope")).toBe(false);
    });
});

describe("SnapshotTesting — serialization", () => {
    it("serializes objects to JSON", () => {
        snapshots.match("obj", { a: 1, b: [2, 3] });
        const stored = snapshots.get("obj");
        expect(stored).toBe(JSON.stringify({ a: 1, b: [2, 3] }, null, 2));
    });

    it("stores strings as-is", () => {
        snapshots.match("str", "hello world");
        expect(snapshots.get("str")).toBe("hello world");
    });
});
