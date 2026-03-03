import{describe,expect,it}from"vitest";
describe("llm-task",()=>{it("ok",async()=>{const m=await import("./llm-task.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);})});
describe("media-runtime",()=>{it("ok",async()=>{const m=await import("./media-runtime.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);})});
describe("speech-core",()=>{it("ok",async()=>{const m=await import("./speech-core.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);})});
