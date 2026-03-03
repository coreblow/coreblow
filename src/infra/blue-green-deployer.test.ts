import { describe, expect, it, beforeEach } from "vitest";
import { BlueGreenDeployer } from "./blue-green-deployer.js";

describe("BlueGreenDeployer", () => {
  let deployer: BlueGreenDeployer;

  beforeEach(() => {
    deployer = new BlueGreenDeployer();
  });

  it("deploys to standby slot", async () => {
    const result = await deployer.deploy("v1.0.0");
    expect(result.success).toBe(true);
    expect(result.slot).toBe("green"); // blue is active by default, so green is standby
  });

  it("switches traffic to standby", async () => {
    await deployer.deploy("v1.0.0");
    const result = deployer.switchTraffic();
    expect(result.success).toBe(true);
    expect(result.activeSlot).toBe("green");
  });

  it("rejects traffic switch when standby has no version", () => {
    const result = deployer.switchTraffic();
    expect(result.success).toBe(false);
    expect(result.activeSlot).toBe("blue");
  });

  it("supports canary routing", async () => {
    await deployer.deploy("v1.0.0");
    deployer.setCanary(100); // 100% canary = always route to standby

    // With 100% canary, should always return the non-active slot
    const routes = new Set<string>();
    for (let i = 0; i < 20; i++) {
      routes.add(deployer.routeRequest());
    }
    expect(routes.has("green")).toBe(true);
  });

  it("clamps canary percentage to 0-100", () => {
    deployer.setCanary(-10);
    expect(deployer.getStatus().canaryPercent).toBe(0);
    deployer.setCanary(200);
    expect(deployer.getStatus().canaryPercent).toBe(100);
  });

  it("rollback switches traffic back", async () => {
    // Deploy v1 to green (standby), switch to green
    await deployer.deploy("v1.0.0");
    deployer.switchTraffic();
    expect(deployer.getStatus().activeSlot).toBe("green");

    // Deploy v2 to blue (now standby), so rollback has a version to switch to
    await deployer.deploy("v2.0.0");
    const success = deployer.rollback();
    expect(success).toBe(true);
    expect(deployer.getStatus().activeSlot).toBe("blue");
  });

  it("records deployment history", async () => {
    await deployer.deploy("v1.0.0");
    deployer.switchTraffic();
    const history = deployer.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].from).toBe("blue");
    expect(history[0].to).toBe("green");
    expect(history[0].version).toBe("v1.0.0");
  });

  it("runs health check during deploy if set", async () => {
    deployer.setHealthCheck("green", async () => false);
    const result = await deployer.deploy("v2.0.0");
    expect(result.success).toBe(false);
  });

  it("getStatus returns current state", () => {
    const status = deployer.getStatus();
    expect(status.activeSlot).toBe("blue");
    expect(status.blue.name).toBe("blue");
    expect(status.green.name).toBe("green");
    expect(status.canaryPercent).toBe(0);
  });
});
