/**
 * VoiceCall Skill
 */
export class VoiceCallSkill {
  name = 'voice-call';
  description = 'Voice Call skill';

  async execute(command: string, args: string[]) {
    return { skill: this.name, command, args, result: null };
  }

  getCommands() {
    return [
      { name: 'voice-call', description: 'Main command' },
      { name: 'voice-call help', description: 'Show help' },
    ];
  }
}
