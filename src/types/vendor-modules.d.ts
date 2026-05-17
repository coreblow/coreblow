declare module "qrcode-terminal" {
  export function generate(...args: unknown[]): void;
}

declare module "markdown-it" {
  class MarkdownIt {
    constructor(...args: unknown[]);
    enable(...args: unknown[]): this;
    disable(...args: unknown[]): this;
    render(...args: unknown[]): string;
    parse(...args: unknown[]): unknown[];
  }

  export = MarkdownIt;
}
