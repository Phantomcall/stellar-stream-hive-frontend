"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchStreamsByRecipient, fetchStreamsBySender, isApiConfigured } from "@/lib/api";
import type { Stream } from "@/types";

export type StreamRole = "sender" | "recipient";

export interface UseStreamsResult {
  streams: Stream[];
  isLoading: boolean;
  error: string | null;
  apiConfigured: boolean;
  refetch: () => Promise<void>;
}

/**
 * Loads all streams where `address` plays `role` (sender or recipient), for
 * the /sending and /receiving pages. Backed by the indexer API — there is no
 * efficient way to enumerate "all streams for an address" directly from
 * on-chain contract storage, so this requires NEXT_PUBLIC_API_BASE_URL to be
 * configured; otherwise it resolves to an empty list and `apiConfigured` is
 * false so the page can explain why instead of pretending there's no data.
 */
export function useStreams(address: string | null, role: StreamRole): UseStreamsResult {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!address) {
      setStreams([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const results = role === "sender" ? await fetchStreamsBySender(address) : await fetchStreamsByRecipient(address);
      setStreams(results);
    } catch (err) {
      // A failed page (including any page after the first in a paged fetch)
      // rejects the whole request, so we never keep a partial list around.
      setError(err instanceof Error ? err.message : "Failed to load streams.");
      setStreams([]);
    } finally {
      setIsLoading(false);
    }
  }, [address, role]);

  useEffect(() => {
    load();
  }, [load]);

  return { streams, isLoading, error, apiConfigured: isApiConfigured(), refetch: load };
}
