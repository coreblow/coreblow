import { describe, beforeEach, expect, it } from "vitest";
import { FixtureManager } from "./fixture-manager.js";

let manager: FixtureManager;

interface User {
    id: number;
    name: string;
    role: string;
}

beforeEach(() => {
    manager = new FixtureManager();
});

describe("FixtureManager — construction", () => {
    it("constructs with zero factories", () => {
        expect(manager.count()).toBe(0);
        expect(manager.list()).toEqual([]);
    });
});

describe("FixtureManager — define / create", () => {
    it("defines and creates a fixture", () => {
        manager.define<User>("user", (overrides) => ({
            id: 1,
            name: "Test User",
            role: "admin",
            ...overrides,
        }));
        expect(manager.count()).toBe(1);
        const user = manager.create<User>("user");
        expect(user).toEqual({ id: 1, name: "Test User", role: "admin" });
    });

    it("applies overrides to factory output", () => {
        manager.define<User>("user", (overrides) => ({
            id: 1,
            name: "Default",
            role: "viewer",
            ...overrides,
        }));
        const user = manager.create<User>("user", { name: "Custom" });
        expect(user.name).toBe("Custom");
        expect(user.role).toBe("viewer");
    });

    it("throws for unknown fixture name", () => {
        expect(() => manager.create("nonexistent")).toThrow('Fixture "nonexistent" not found');
    });
});

describe("FixtureManager — createMany", () => {
    it("creates multiple instances", () => {
        let counter = 0;
        manager.define<User>("user", () => ({ id: ++counter, name: `User ${counter}`, role: "user" }));
        const users = manager.createMany<User>("user", 3);
        expect(users).toHaveLength(3);
        expect(users[0].id).toBe(1);
        expect(users[2].id).toBe(3);
    });
});

describe("FixtureManager — defineSet / loadSet", () => {
    it("defines and loads a fixture set", () => {
        manager.define<User>("user", (overrides) => ({
            id: 1, name: "Default", role: "user", ...overrides,
        }));
        manager.defineSet("admins", [
            { name: "user", overrides: { role: "admin", name: "Alice" } },
            { name: "user", overrides: { role: "admin", name: "Bob" } },
        ]);
        const admins = manager.loadSet("admins") as User[];
        expect(admins).toHaveLength(2);
        expect(admins[0].role).toBe("admin");
        expect(admins[1].name).toBe("Bob");
    });

    it("returns empty array for unknown set", () => {
        expect(manager.loadSet("nonexistent")).toEqual([]);
    });

    it("lists set names", () => {
        manager.defineSet("group1", []);
        manager.defineSet("group2", []);
        expect(manager.listSets()).toEqual(["group1", "group2"]);
    });
});

describe("FixtureManager — list", () => {
    it("lists registered fixture names", () => {
        manager.define("a", () => ({}));
        manager.define("b", () => ({}));
        expect(manager.list()).toEqual(["a", "b"]);
    });
});
