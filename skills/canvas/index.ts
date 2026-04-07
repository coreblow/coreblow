/**
 * Canvas Skill
 */
export class CanvasSkill {
  name = 'canvas';
  description = 'Canvas skill';

  async execute(command: string, args: string[]) {
    return { skill: this.name, command, args, result: null };
  }

  getCommands() {
    return [
      { name: 'canvas', description: 'Main command' },
      { name: 'canvas help', description: 'Show help' },
    ];
  }
}
