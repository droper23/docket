/** Exact origin allowlist for the two BYU learning products this script supports. */
export function isLearningSuiteHost(hostname: string): boolean {
  return hostname === "learningsuite.byu.edu";
}

export function isMaxHost(hostname: string): boolean {
  return hostname === "max.byu.edu";
}

export function isSupportedHost(hostname: string): boolean {
  return isLearningSuiteHost(hostname) || isMaxHost(hostname);
}
