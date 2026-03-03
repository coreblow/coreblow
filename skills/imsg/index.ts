/**
 * Imsg Skill
 */
export class ImsgSkill {
  name = 'imsg';
  description = 'Imsg skill';

  async execute(command: string, args: string[]) {
    return { skill: this.name, command, args, result: null };
  }

  getCommands() {
    return [
      { name: 'imsg', description: 'Main command' },
      { name: 'imsg help', description: 'Show help' },
    ];
  }
}
