/**
 * Gog Skill
 */
export class GogSkill {
  name = 'gog';
  description = 'Gog skill';

  async execute(command: string, args: string[]) {
    return { skill: this.name, command, args, result: null };
  }

  getCommands() {
    return [
      { name: 'gog', description: 'Main command' },
      { name: 'gog help', description: 'Show help' },
    ];
  }
}
