/**
 * Bluebubbles Skill
 */
export class BluebubblesSkill {
  name = 'bluebubbles';
  description = 'Bluebubbles skill';

  async execute(command: string, args: string[]) {
    return { skill: this.name, command, args, result: null };
  }

  getCommands() {
    return [
      { name: 'bluebubbles', description: 'Main command' },
      { name: 'bluebubbles help', description: 'Show help' },
    ];
  }
}
