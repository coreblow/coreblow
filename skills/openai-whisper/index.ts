/**
 * OpenaiWhisper Skill
 */
export class OpenaiWhisperSkill {
  name = 'openai-whisper';
  description = 'Openai Whisper skill';

  async execute(command: string, args: string[]) {
    return { skill: this.name, command, args, result: null };
  }

  getCommands() {
    return [
      { name: 'openai-whisper', description: 'Main command' },
      { name: 'openai-whisper help', description: 'Show help' },
    ];
  }
}
