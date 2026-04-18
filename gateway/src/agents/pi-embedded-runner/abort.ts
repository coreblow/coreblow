/** CoreBlow — PI Abort */ export class PiAbortError extends Error { constructor() { super("PI execution aborted"); this.name = "PiAbortError"; } }
