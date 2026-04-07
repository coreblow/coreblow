/**
 * Obsidian Skill
 */
export class ObsidianSkill {
  name = 'obsidian';
  description = 'Obsidian skill';

  async execute(command: string, args: string[]) {
    return { skill: this.name, command, args, result: null };
  }

  getCommands() {
    return [
      { name: 'obsidian', description: 'Main command' },
      { name: 'obsidian help', description: 'Show help' },
    ];
  }
}
