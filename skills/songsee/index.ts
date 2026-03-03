/**
 * Songsee Skill
 */
export class SongseeSkill {
  name = 'songsee';
  description = 'Songsee skill';

  async execute(command: string, args: string[]) {
    return { skill: this.name, command, args, result: null };
  }

  getCommands() {
    return [
      { name: 'songsee', description: 'Main command' },
      { name: 'songsee help', description: 'Show help' },
    ];
  }
}
