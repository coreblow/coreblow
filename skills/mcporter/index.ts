/**
 * Mcporter Skill
 */
export class McporterSkill {
  name = 'mcporter';
  description = 'Mcporter skill';

  async execute(command: string, args: string[]) {
    return { skill: this.name, command, args, result: null };
  }

  getCommands() {
    return [
      { name: 'mcporter', description: 'Main command' },
      { name: 'mcporter help', description: 'Show help' },
    ];
  }
}
