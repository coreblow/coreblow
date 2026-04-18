/** CoreBlow — Agent Command Types */ export type CommandResult = { success: boolean; output?: string; error?: string }; export type CommandHandler = (args: string[]) => Promise<CommandResult>;
