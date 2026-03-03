/**
 * Github Skill
 */
export class GithubSkill {
  name = 'github';
  description = 'Github skill';

  async execute(command: string, args: string[]) {
    return { skill: this.name, command, args, result: null };
  }

  getCommands() {
    return [
      { name: 'github', description: 'Main command' },
      { name: 'github help', description: 'Show help' },
    ];
  }
}
