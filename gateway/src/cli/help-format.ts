/** CoreBlow — Help Formatter */
export function formatCommandHelp(name: string, description: string, options?: Array<{ flag: string; desc: string }>): string { let help = name + " — " + description + "\n"; if (options) { help += "\nOptions:\n"; for (const opt of options) help += "  " + opt.flag + "  " + opt.desc + "\n"; } return help; }
