/**
 * Goplaces Skill
 */
export class GoplacesSkill {
  name = 'goplaces';
  description = 'Goplaces skill';

  async execute(command: string, args: string[]) {
    return { skill: this.name, command, args, result: null };
  }

  getCommands() {
    return [
      { name: 'goplaces', description: 'Main command' },
      { name: 'goplaces help', description: 'Show help' },
    ];
  }
}
