const ERR_MESSAGE_MAX_LEN = 256;

export function scrubDoctorErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  let stripped = "";
  for (let index = 0; index < raw.length; index++) {
    const code = raw.charCodeAt(index);
    if (code > 0x1f && code !== 0x7f) {
      stripped += raw.charAt(index);
    }
  }
  return stripped.length <= ERR_MESSAGE_MAX_LEN
    ? stripped
    : `${stripped.slice(0, ERR_MESSAGE_MAX_LEN - 3)}...`;
}
