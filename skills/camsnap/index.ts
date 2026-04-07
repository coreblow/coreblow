/**
 * Camsnap Skill
 */
export class CamsnapSkill {
  name = 'camsnap';
  description = 'Camsnap skill';

  async execute(command: string, args: string[]) {
    return { skill: this.name, command, args, result: null };
  }

  getCommands() {
    return [
      { name: 'camsnap', description: 'Main command' },
      { name: 'camsnap help', description: 'Show help' },
    ];
  }
}
