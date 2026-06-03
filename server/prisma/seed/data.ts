// Lightweight, dependency-free text generation for seed data. We build a fixed
// pool of sentences up front and index into it, rather than generating text per
// row (which would dominate runtime at a million posts).

const WORDS = [
  'owl',
  'night',
  'code',
  'coffee',
  'deploy',
  'cache',
  'stream',
  'event',
  'queue',
  'index',
  'latency',
  'scale',
  'graph',
  'feed',
  'signal',
  'noise',
  'commit',
  'branch',
  'review',
  'ship',
  'forest',
  'moon',
  'quiet',
  'swift',
  'silent',
  'feather',
  'hoot',
  'dusk',
  'dawn',
  'pixel',
  'vector',
  'matrix',
  'token',
  'thread',
  'lock',
  'retry',
  'shard',
  'replica',
  'cursor',
  'keyset',
];

const NAMES = [
  'Alex',
  'Sam',
  'Jordan',
  'Taylor',
  'Casey',
  'Morgan',
  'Riley',
  'Jamie',
  'Avery',
  'Quinn',
  'Parker',
  'Rowan',
  'Sage',
  'Skyler',
  'Drew',
  'Reese',
  'Finley',
  'Hayden',
  'Emerson',
  'Marlowe',
];

function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

/** Build a reusable pool of sentences to index into when creating posts. */
export function buildSentencePool(size: number, rand: () => number): string[] {
  const pool: string[] = [];
  for (let i = 0; i < size; i++) {
    const length = 4 + Math.floor(rand() * 12);
    const words: string[] = [];
    for (let w = 0; w < length; w++) {
      words.push(pick(WORDS, rand));
    }
    const sentence = words.join(' ');
    pool.push(sentence.charAt(0).toUpperCase() + sentence.slice(1));
  }
  return pool;
}

/** A display name like "Sam Riley". */
export function makeName(rand: () => number): string {
  return `${pick(NAMES, rand)} ${pick(NAMES, rand)}`;
}
