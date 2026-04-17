/**
 * Sag Skill
 */
export class SagSkill {
  name = 'sag';
  description = 'Sag skill';

  async execute(command: string, args: string[]) {
    return { skill: this.name, command, args, result: null };
  }

  getCommands() {
    return [
      { name: 'sag', description: 'Main command' },
      { name: 'sag help', description: 'Show help' },
    ];
  }
}
