/**
 * agents/session-slug.ts
 * Human-readable session ID generation.
 */
const ADJECTIVES = ['swift','calm','bold','keen','warm','cool','pure','safe','fast','wise','deep','dark','soft','loud','rare','blue','gold','iron','jade','ruby'];
const NOUNS = ['fox','owl','elk','ray','bay','oak','gem','arc','sky','dew','sun','ash','bee','cat','fin','ink','jet','log','net','pin'];

export function createSessionSlug(isTaken?: (id: string) => boolean): string {
    let attempts = 0;
    while (attempts < 100) {
        const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
        const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
        const num = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const id = `${adj}-${noun}-${num}`;
        if (!isTaken || !isTaken(id)) return id;
        attempts++;
    }
    return `session-${Date.now().toString(36)}`;
}
