/** CoreBlow — CLI Runner Abort */ export class CliAbortError extends Error { constructor() { super("CLI operation aborted"); this.name = "CliAbortError"; } }
