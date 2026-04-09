import { createSessionStateStore } from "./session-state"

const activeSessionStateStores = new Set<ReturnType<typeof createSessionStateStore>>()

export function registerSessionStateStore(
  sessionStateStore: ReturnType<typeof createSessionStateStore>,
): void {
  activeSessionStateStores.add(sessionStateStore)
}

export function unregisterSessionStateStore(
  sessionStateStore: ReturnType<typeof createSessionStateStore>,
): void {
  activeSessionStateStores.delete(sessionStateStore)
}

export function shutdownSessionStateStore(
  sessionStateStore: ReturnType<typeof createSessionStateStore>,
): void {
  sessionStateStore.shutdown()
  unregisterSessionStateStore(sessionStateStore)
}

export function resetTodoContinuationEnforcersForTesting(): void {
  for (const sessionStateStore of activeSessionStateStores) {
    sessionStateStore.shutdown()
  }
  activeSessionStateStores.clear()
}
