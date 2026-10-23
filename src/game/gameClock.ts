let controlledTime: number | null = null;

export function now() {
  return controlledTime ?? Date.now();
}

export function setControlledTime(time: number | null) {
  controlledTime = time;
}

export function advanceControlledTime(deltaMs: number) {
  if (controlledTime !== null) controlledTime += deltaMs;
}
