/**
 * SherpaOnnxTts Skill
 */
export class SherpaOnnxTtsSkill {
  name = 'sherpa-onnx-tts';
  description = 'Sherpa Onnx Tts skill';

  async execute(command: string, args: string[]) {
    return { skill: this.name, command, args, result: null };
  }

  getCommands() {
    return [
      { name: 'sherpa-onnx-tts', description: 'Main command' },
      { name: 'sherpa-onnx-tts help', description: 'Show help' },
    ];
  }
}
