/**
 * routing/load-balance.ts
 */
export function roundRobin<T>(items: T[], counter: {value: number}): T { counter.value = (counter.value + 1) % items.length; return items[counter.value]; }
