import { Dispatch, MutableRefObject, SetStateAction, useEffect, useRef, useState } from "react";
import { FIREBASE_SYNC, SYNC_DEBOUNCE_MS, SYNC_POLL_MS } from "../constants";
import { isStateNewer, normalizeState } from "../lib/state";
import type { FinanceState } from "../types";

type UseRemoteSyncOptions = {
  setState: Dispatch<SetStateAction<FinanceState>>;
  stateRef: MutableRefObject<FinanceState>;
};

export function useRemoteSync({ setState, stateRef }: UseRemoteSyncOptions) {
  const [syncStatus, setSyncStatus] = useState("Local only");
  const syncTimerRef = useRef<number | undefined>(undefined);
  const lastSyncedStateRef = useRef("");
  const hasLoadedRemoteStateRef = useRef(false);

  useEffect(() => {
    if (!isFirebaseSyncConfigured()) {
      setSyncStatus("Local only");
      return undefined;
    }

    setSyncStatus("Syncing");
    void pullRemoteState();
    const poller = window.setInterval(() => void pullRemoteState(), SYNC_POLL_MS);

    return () => {
      window.clearInterval(poller);
      window.clearTimeout(syncTimerRef.current);
    };
  }, []);

  function queueRemoteSave(nextState: FinanceState) {
    if (!isFirebaseSyncConfigured()) return;
    window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(
      () => void pushRemoteState(nextState),
      SYNC_DEBOUNCE_MS,
    );
  }

  async function pullRemoteState(options: { manual?: boolean } = {}) {
    if (!isFirebaseSyncConfigured()) return;

    try {
      setSyncStatus(options.manual ? "Syncing" : "Checking");
      const response = await fetch(remoteStateUrl(), { cache: "no-store" });
      if (!response.ok) throw new Error(`Firebase returned ${response.status}`);

      const remote = await response.json();
      if (remote) {
        const normalizedRemote = normalizeState(remote);
        const remoteSnapshot = JSON.stringify(normalizedRemote);
        const current = stateRef.current;
        const localSnapshot = JSON.stringify(current);

        if (remoteSnapshot === localSnapshot) {
          lastSyncedStateRef.current = remoteSnapshot;
          hasLoadedRemoteStateRef.current = true;
          setSyncStatus("Synced");
          return;
        }

        if (
          !hasLoadedRemoteStateRef.current ||
          isStateNewer(normalizedRemote, current)
        ) {
          stateRef.current = normalizedRemote;
          setState(normalizedRemote);
          lastSyncedStateRef.current = remoteSnapshot;
          hasLoadedRemoteStateRef.current = true;
          setSyncStatus("Synced");
          return;
        }

        await pushRemoteState(current);
        return;
      }

      hasLoadedRemoteStateRef.current = true;
      await pushRemoteState(stateRef.current);
    } catch (error) {
      console.error(error);
      setSyncStatus("Sync error");
    }
  }

  async function pushRemoteState(nextState = stateRef.current) {
    if (!isFirebaseSyncConfigured()) return;

    const snapshot = JSON.stringify(nextState);
    if (snapshot === lastSyncedStateRef.current) {
      setSyncStatus("Synced");
      return;
    }

    try {
      setSyncStatus("Saving");
      const response = await fetch(remoteStateUrl(), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: snapshot,
      });
      if (!response.ok) throw new Error(`Firebase returned ${response.status}`);

      lastSyncedStateRef.current = snapshot;
      hasLoadedRemoteStateRef.current = true;
      setSyncStatus("Synced");
    } catch (error) {
      console.error(error);
      setSyncStatus("Sync error");
    }
  }

  return {
    isFirebaseSyncConfigured,
    pullRemoteState,
    queueRemoteSave,
    syncStatus,
  };
}

function isFirebaseSyncConfigured() {
  return (
    FIREBASE_SYNC.enabled &&
    FIREBASE_SYNC.databaseUrl.trim() &&
    FIREBASE_SYNC.path.trim()
  );
}

function remoteStateUrl() {
  const baseUrl = FIREBASE_SYNC.databaseUrl.trim().replace(/\/$/, "");
  const path = FIREBASE_SYNC.path.trim().replace(/^\/|\.json$/g, "");
  return `${baseUrl}/${path}.json`;
}
