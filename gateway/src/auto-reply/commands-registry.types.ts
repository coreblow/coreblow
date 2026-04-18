/** CoreBlow — Commands Registry Types */ export interface CommandDef { name: string; description: string; handler: Function; aliases?: string[]; }
