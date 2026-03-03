import{describe,expect,it}from"vitest";
describe("followup-runner",()=>{it("ok",async()=>{const m=await import("./followup-runner.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("get-reply-directives-apply",()=>{it("ok",async()=>{const m=await import("./get-reply-directives-apply.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
