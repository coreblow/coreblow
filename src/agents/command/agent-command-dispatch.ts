/** CoreBlow — Agent Command Dispatch */ export async function dispatchAgentCommand(command: string, args: string[]): Promise<unknown> { return { command, args, result: null }; }
