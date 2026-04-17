/**
 * Slack Skill
 */
export class SlackSkill {
  name = 'slack';
  description = 'Slack skill';

  async execute(command: string, args: string[]) {
    return { skill: this.name, command, args, result: null };
  }

  getCommands() {
    return [
      { name: 'slack', description: 'Main command' },
      { name: 'slack help', description: 'Show help' },
    ];
  }
}
