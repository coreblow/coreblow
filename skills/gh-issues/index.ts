/**
 * GhIssues Skill
 */
export class GhIssuesSkill {
  name = 'gh-issues';
  description = 'Gh Issues skill';

  async execute(command: string, args: string[]) {
    return { skill: this.name, command, args, result: null };
  }

  getCommands() {
    return [
      { name: 'gh-issues', description: 'Main command' },
      { name: 'gh-issues help', description: 'Show help' },
    ];
  }
}
