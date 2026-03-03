/**
 * Notion Skill
 */
export class NotionSkill {
  name = 'notion';
  description = 'Notion skill';

  async execute(command: string, args: string[]) {
    return { skill: this.name, command, args, result: null };
  }

  getCommands() {
    return [
      { name: 'notion', description: 'Main command' },
      { name: 'notion help', description: 'Show help' },
    ];
  }
}
