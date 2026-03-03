/**
 * Eightctl Skill
 */
export class EightctlSkill {
  name = 'eightctl';
  description = 'Eightctl skill';

  async execute(command: string, args: string[]) {
    return { skill: this.name, command, args, result: null };
  }

  getCommands() {
    return [
      { name: 'eightctl', description: 'Main command' },
      { name: 'eightctl help', description: 'Show help' },
    ];
  }
}
