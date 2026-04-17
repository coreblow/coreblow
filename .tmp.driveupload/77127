/**
 * Weather Skill
 */
export class WeatherSkill {
  name = 'weather';
  description = 'Weather skill';

  async execute(command: string, args: string[]) {
    return { skill: this.name, command, args, result: null };
  }

  getCommands() {
    return [
      { name: 'weather', description: 'Main command' },
      { name: 'weather help', description: 'Show help' },
    ];
  }
}
