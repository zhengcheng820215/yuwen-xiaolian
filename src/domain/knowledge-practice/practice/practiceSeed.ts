export function hashPracticeSeed(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const result = [...items];
  const random = createSeededRandom(hashPracticeSeed(seed));
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function createPracticeSessionId(now: string, randomUUID?: () => string): string {
  const compact = now.replace(/[^0-9A-Za-z]/g, '').toLowerCase();
  const suffix = (randomUUID?.() || `${Date.now()}-${Math.random()}`)
    .replace(/[^0-9A-Za-z]/g, '')
    .slice(0, 8)
    .toLowerCase();
  if (!compact || !suffix) throw new Error('Unable to create practice session identity.');
  return `kp-session-${compact}-${suffix}`;
}

export function createPracticeSeed(sessionId: string, mode: string, category?: string): string {
  return `${sessionId}|${mode}|${category || 'all'}`;
}
