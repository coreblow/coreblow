/**
 * Wacli Skill
 */
export class WacliSkill {
  name = 'wacli';
  description = 'Wacli skill';

  async execute(command: string, args: string[]) {
    return { skill: this.name, command, args, result: null };
  }

  getCommands() {
    return [
      { name: 'wacli', description: 'Main command' },
      { name: 'wacli help', description: 'Show help' },
    ];
  }
}
