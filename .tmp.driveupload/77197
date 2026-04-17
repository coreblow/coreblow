/**
 * SpotifyPlayer Skill
 */
export class SpotifyPlayerSkill {
  name = 'spotify-player';
  description = 'Spotify Player skill';

  async execute(command: string, args: string[]) {
    return { skill: this.name, command, args, result: null };
  }

  getCommands() {
    return [
      { name: 'spotify-player', description: 'Main command' },
      { name: 'spotify-player help', description: 'Show help' },
    ];
  }
}
