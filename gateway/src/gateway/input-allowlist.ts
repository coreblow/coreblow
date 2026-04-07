const RESTRICTED_PATTERN = /[\x00-\x08\x0B-\x0C\x0E-\x1F]/;

export function isInputAllowed(input: unknown): boolean {
    if (typeof input === "string") {
        return !RESTRICTED_PATTERN.test(input);
    }
    
    if (Array.isArray(input)) {
        return input.every(isInputAllowed);
    }
    
    if (typeof input === "object" && input !== null) {
        return Object.values(input).every(isInputAllowed);
    }
    
    return true; // Numbers, booleans, etc.
}
