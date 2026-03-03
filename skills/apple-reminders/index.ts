/**
 * AppleReminders Skill
 */
export class AppleRemindersSkill {
  name = 'apple-reminders';
  description = 'Apple Reminders skill';

  async execute(command: string, args: string[]) {
    return { skill: this.name, command, args, result: null };
  }

  getCommands() {
    return [
      { name: 'apple-reminders', description: 'Main command' },
      { name: 'apple-reminders help', description: 'Show help' },
    ];
  }
}
