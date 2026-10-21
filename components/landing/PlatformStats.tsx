"use client";

import { useEffect, useState } from "react";
import { fetchPlatformStats, isApiConfigured } from "@/lib/api";
import { Spinner } from "@/components/ui/Spinner";
import type { PlatformStats } from "@/types";

/**
 * Platform-wide stats sourced from the indexer API. If the API is not
 * configured or unreachable, this shows an honest "not available yet" state
 * rather than fabricating numbers.
 */
export function PlatformStats() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchPlatformStats().then((result) => {
      if (!cancelled) {
        setStats(result);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted">
        {isApiConfigured()
          ? "Platform stats are temporarily unavailable."
          : "Platform stats will appear here once the Stellar Stream Hive API is deployed."}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard label="Streams created" value={stats.totalStreams.toLocaleString()} />
      <StatCard label="Active streams" value={stats.totalActiveStreams.toLocaleString()} />
      {/*
       * `total_streamed` from the API (/stats) sums raw base units across ALL
       * tokens, regardless of their decimal precision or symbol. Formatting it
       * as 7-decimal XLM would be wrong whenever non-XLM tokens are present.
       * We display it as plain base units with an honest label so no misleading
       * token symbol or decimal conversion is applied.
       * See: stellar-stream-hive-api /stats endpoint docs for the wire format.
       */}
      <StatCard
        label="Total streamed (base units, all tokens)"
        value={BigInt(stats.totalStreamedBaseUnits).toLocaleString()}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card text-center">
      <p className="mono-tabular text-3xl font-bold text-primary">{value}</p>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </div>
  );
}
