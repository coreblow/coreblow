/**
 * ThingsMac Skill
 */
export class ThingsMacSkill {
  name = 'things-mac';
  description = 'Things Mac skill';

  async execute(command: string, args: string[]) {
    return { skill: this.name, command, args, result: null };
  }

  getCommands() {
    return [
      { name: 'things-mac', description: 'Main command' },
      { name: 'things-mac help', description: 'Show help' },
    ];
  }
}
