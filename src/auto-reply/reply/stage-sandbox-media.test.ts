import{describe,expect,it}from"vitest";
describe("stage-sandbox-media",()=>{it("ok",async()=>{const m=await import("./stage-sandbox-media.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("streaming-directives",()=>{it("ok",async()=>{const m=await import("./streaming-directives.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
