/**
 * Summarize Skill
 */
export class SummarizeSkill {
  name = 'summarize';
  description = 'Summarize skill';

  async execute(command: string, args: string[]) {
    return { skill: this.name, command, args, result: null };
  }

  getCommands() {
    return [
      { name: 'summarize', description: 'Main command' },
      { name: 'summarize help', description: 'Show help' },
    ];
  }
}
