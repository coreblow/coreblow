/**
 * Discord Skill
 */
export class DiscordSkill {
  name = 'discord';
  description = 'Discord skill';

  async execute(command: string, args: string[]) {
    return { skill: this.name, command, args, result: null };
  }

  getCommands() {
    return [
      { name: 'discord', description: 'Main command' },
      { name: 'discord help', description: 'Show help' },
    ];
  }
}
