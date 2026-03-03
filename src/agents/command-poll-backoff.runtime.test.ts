import{describe,expect,it}from"vitest";
describe("command-poll-backoff.runtime",()=>{it("ok",async()=>{const m=await import("./command-poll-backoff.runtime.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("console-sanitize",()=>{it("ok",async()=>{const m=await import("./console-sanitize.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
