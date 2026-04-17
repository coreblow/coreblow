/**
 * OpenaiWhisperApi Skill
 */
export class OpenaiWhisperApiSkill {
  name = 'openai-whisper-api';
  description = 'Openai Whisper Api skill';

  async execute(command: string, args: string[]) {
    return { skill: this.name, command, args, result: null };
  }

  getCommands() {
    return [
      { name: 'openai-whisper-api', description: 'Main command' },
      { name: 'openai-whisper-api help', description: 'Show help' },
    ];
  }
}
