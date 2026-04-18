/** CoreBlow — Plugin Auto Enable */
export interface AutoEnableRule { pluginName: string; condition: "always" | "if-installed" | "never"; }
export function shouldAutoEnable(rule: AutoEnableRule): boolean { return rule.condition === "always"; }
