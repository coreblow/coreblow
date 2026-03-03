/**
 * Gemini Skill
 */
export class GeminiSkill {
  name = 'gemini';
  description = 'Gemini skill';

  async execute(command: string, args: string[]) {
    return { skill: this.name, command, args, result: null };
  }

  getCommands() {
    return [
      { name: 'gemini', description: 'Main command' },
      { name: 'gemini help', description: 'Show help' },
    ];
  }
}
