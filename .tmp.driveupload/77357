/**
 * Ordercli Skill
 */
export class OrdercliSkill {
  name = 'ordercli';
  description = 'Ordercli skill';

  async execute(command: string, args: string[]) {
    return { skill: this.name, command, args, result: null };
  }

  getCommands() {
    return [
      { name: 'ordercli', description: 'Main command' },
      { name: 'ordercli help', description: 'Show help' },
    ];
  }
}
