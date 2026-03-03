/**
 * Blucli Skill
 */
export class BlucliSkill {
  name = 'blucli';
  description = 'Blucli skill';

  async execute(command: string, args: string[]) {
    return { skill: this.name, command, args, result: null };
  }

  getCommands() {
    return [
      { name: 'blucli', description: 'Main command' },
      { name: 'blucli help', description: 'Show help' },
    ];
  }
}
