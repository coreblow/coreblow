/**
 * Sonoscli Skill
 */
export class SonoscliSkill {
  name = 'sonoscli';
  description = 'Sonoscli skill';

  async execute(command: string, args: string[]) {
    return { skill: this.name, command, args, result: null };
  }

  getCommands() {
    return [
      { name: 'sonoscli', description: 'Main command' },
      { name: 'sonoscli help', description: 'Show help' },
    ];
  }
}
