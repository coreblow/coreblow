/**
 * Trello Skill
 */
export class TrelloSkill {
  name = 'trello';
  description = 'Trello skill';

  async execute(command: string, args: string[]) {
    return { skill: this.name, command, args, result: null };
  }

  getCommands() {
    return [
      { name: 'trello', description: 'Main command' },
      { name: 'trello help', description: 'Show help' },
    ];
  }
}
