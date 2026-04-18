/** CoreBlow — Media Tool Shared */ export const MAX_FILE_SIZE = 25 * 1024 * 1024; export function isFileSizeValid(size: number): boolean { return size <= MAX_FILE_SIZE; }
