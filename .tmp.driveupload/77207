/**
 * BearNotes Skill
 */
export class BearNotesSkill {
  name = 'bear-notes';
  description = 'Bear Notes skill';

  async execute(command: string, args: string[]) {
    return { skill: this.name, command, args, result: null };
  }

  getCommands() {
    return [
      { name: 'bear-notes', description: 'Main command' },
      { name: 'bear-notes help', description: 'Show help' },
    ];
  }
}
