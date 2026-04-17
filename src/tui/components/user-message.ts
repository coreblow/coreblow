import { theme } from "../theme/theme.js";
import { MarkdownMessageComponent } from "./markdown-message.js";

export class UserMessageComponent extends MarkdownMessageComponent {
  constructor(text: string) {
    super(text, 1, {
      bgColor: (line: any) => theme.userBg(line),
      color: (line: any) => theme.userText(line),
    });
  }
}
