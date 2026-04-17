/**
 * OpenaiImageGen Skill
 */
export class OpenaiImageGenSkill {
  name = 'openai-image-gen';
  description = 'Openai Image Gen skill';

  async execute(command: string, args: string[]) {
    return { skill: this.name, command, args, result: null };
  }

  getCommands() {
    return [
      { name: 'openai-image-gen', description: 'Main command' },
      { name: 'openai-image-gen help', description: 'Show help' },
    ];
  }
}
