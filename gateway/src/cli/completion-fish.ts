/** CoreBlow — Fish Completion */ export function generateFishCompletion(commands: string[]): string { return commands.map((c) => "complete -c coreblow -a " + c).join("\n"); }
