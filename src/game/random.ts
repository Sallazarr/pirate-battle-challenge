let seededState: number | null = null;

export function setRandomSeed(seed: number) {
  seededState = seed >>> 0;
}

export function random() {
  if (seededState === null) return Math.random();
  seededState = (seededState * 1664525 + 1013904223) >>> 0;
  return seededState / 0x100000000;
}
