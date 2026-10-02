function canLog() {
  return typeof __DEV__ !== "undefined" && __DEV__;
}

export function devWarn(...args: unknown[]) {
  if (canLog()) {
    console.warn(...args);
  }
}

export function devLog(...args: unknown[]) {
  if (canLog()) {
    console.log(...args);
  }
}

export function devError(...args: unknown[]) {
  if (canLog()) {
    console.error(...args);
  }
}
