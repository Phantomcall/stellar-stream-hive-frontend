"use client";

import Link from "next/link";
import { format } from "date-fns";
import { useStream } from "@/hooks/useStream";
import { useWallet } from "@/hooks/useWallet";
import { LiveBalance } from "@/components/stream/LiveBalance";
import { StreamProgress } from "@/components/stream/StreamProgress";
import { StreamTimeline } from "@/components/stream/StreamTimeline";
import { StreamStatusBadge } from "@/components/stream/StreamStatusBadge";
import { WithdrawButton } from "@/components/stream/WithdrawButton";
import { CancelButton } from "@/components/stream/CancelButton";
import { CopyButton } from "@/components/ui/CopyButton";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  formatRate,
  formatTokenAmount,
  shortenAddress,
  stellarExpertAccountUrl,
  stellarExpertTxUrl,
} from "@/lib/format";
import { getStreamContractId, isStreamContractConfigured } from "@/lib/contracts";
import { AVERAGE_LEDGER_SECONDS } from "@/lib/streaming";
import { STELLAR_EXPERT_NETWORK } from "@/lib/stellar";

export default function StreamDetailPage({ params }: { params: { id: string } }) {
  const { stream, isLoading, error, notConfigured, refetch } = useStream(params.id);
  const wallet = useWallet();

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-4xl justify-center px-4 py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (notConfigured) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <EmptyState
          title="Contracts not yet configured"
          description="The Stream contract ID hasn't been set for this environment yet. Once the stellar-stream-hive-contract repo deploys to testnet, set NEXT_PUBLIC_STREAM_CONTRACT_ID to view live stream data here."
        />
      </div>
    );
  }

  if (error || !stream) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <ErrorState message={error ?? "Stream not found."} onRetry={refetch} />
      </div>
    );
  }

  const isActive = stream.status === "active" || stream.status === "cliff";
  // The contract allows cancelling any stream that is not Cancelled or Completed,
  // including Pending/scheduled ones (sender is refunded in full for unstarted streams).
  const isCancellable =
    stream.cancellable &&
    (stream.status === "active" || stream.status === "cliff" || stream.status === "scheduled");
  const totalTokens = Number(stream.totalAmount) / 10 ** stream.token.decimals;
  const totalSeconds = (stream.endLedger - stream.startLedger) * AVERAGE_LEDGER_SECONDS;
  const ratePerSecond = totalSeconds > 0 ? totalTokens / totalSeconds : 0;
  const rate = formatRate(ratePerSecond, stream.token.symbol);
  const contractConfigured = isStreamContractConfigured();
  const contractId = contractConfigured ? getStreamContractId() : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-sm text-muted hover:text-white">
          ← Back home
        </Link>
        <div className="flex items-center gap-3">
          <CopyButton
            value={() => (typeof window !== "undefined" ? window.location.href : "")}
            label="Copy link"
          />
          <StreamStatusBadge status={stream.status} />
        </div>
      </div>

      <div className="card mb-6">
        <div className="mb-1 flex items-center gap-1 text-xs text-muted">
          <span>Stream #{stream.id}</span>
          <CopyButton value={stream.id} label="Copy ID" />
        </div>
        <LiveBalance
          totalAmount={stream.totalAmount}
          withdrawnAmount={stream.withdrawnAmount}
          startLedger={stream.startLedger}
          endLedger={stream.endLedger}
          cliffLedger={stream.cliffLedger}
          tokenSymbol={stream.token.symbol}
          tokenDecimals={stream.token.decimals}
          enabled={isActive}
        />

        <div className="my-6">
          <StreamTimeline
            startLedger={stream.startLedger}
            endLedger={stream.endLedger}
            cliffLedger={stream.cliffLedger}
            startTime={stream.startTime}
            endTime={stream.endTime}
            cliffTime={stream.cliffTime}
            enabled={isActive}
          />
        </div>

        <StreamProgress
          totalAmount={stream.totalAmount}
          withdrawnAmount={stream.withdrawnAmount}
          startLedger={stream.startLedger}
          endLedger={stream.endLedger}
          cliffLedger={stream.cliffLedger}
          tokenSymbol={stream.token.symbol}
          tokenDecimals={stream.token.decimals}
          enabled={isActive}
        />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="card">
          <h3 className="mb-3 text-sm font-semibold text-muted">Parties</h3>
          <AddressRow label="Sender" address={stream.sender} />
          <AddressRow label="Recipient" address={stream.recipient} />
        </div>
        <div className="card">
          <h3 className="mb-3 text-sm font-semibold text-muted">Stream details</h3>
          <DetailRow label="Token" value={stream.token.symbol} />
          <DetailRow
            label="Total amount"
            value={formatTokenAmount(BigInt(stream.totalAmount), stream.token.symbol, stream.token.decimals, 4)}
          />
          <DetailRow
            label="Withdrawn"
            value={formatTokenAmount(
              BigInt(stream.withdrawnAmount),
              stream.token.symbol,
              stream.token.decimals,
              4,
            )}
          />
          <DetailRow label="Rate" value={`~${rate.perDay} / day`} />
          <DetailRow label="Start" value={format(stream.startTime, "PPpp")} />
          <DetailRow label="End" value={format(stream.endTime, "PPpp")} />
          {stream.cliffTime && <DetailRow label="Cliff" value={format(stream.cliffTime, "PPpp")} />}
          <DetailRow label="Cancellable" value={stream.cancellable ? "Yes" : "No"} />
          {contractId && (
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted">Stream contract</span>
              <a
                href={stellarExpertAccountUrl(contractId, STELLAR_EXPERT_NETWORK)}
                target="_blank"
                rel="noreferrer"
                className="text-accent underline"
              >
                View on Stellar Expert
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </div>
          )}
          {stream.createTxHash && (
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted">Create tx</span>
              <a
                href={stellarExpertTxUrl(stream.createTxHash, STELLAR_EXPERT_NETWORK)}
                target="_blank"
                rel="noreferrer"
                className="text-accent underline"
              >
                View on Stellar Expert
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <WithdrawButton
          streamId={stream.id}
          recipientAddress={stream.recipient}
          connectedAddress={wallet.publicKey}
          tokenSymbol={stream.token.symbol}
          tokenDecimals={stream.token.decimals}
          onWithdrawn={refetch}
        />
        <CancelButton
          streamId={stream.id}
          senderAddress={stream.sender}
          connectedAddress={wallet.publicKey}
          cancellable={isCancellable}
          tokenSymbol={stream.token.symbol}
          tokenDecimals={stream.token.decimals}
          onCancelled={refetch}
        />
      </div>

      {!wallet.isConnected && (
        <p className="mt-4 text-sm text-muted">Connect your wallet to withdraw or manage this stream.</p>
      )}
    </div>
  );
}

function AddressRow({ label, address }: { label: string; address: string }) {
  return (
    <div className="mb-2 flex items-center justify-between text-sm last:mb-0">
      <span className="text-muted">{label}</span>
      <div className="flex items-center gap-1">
        <a
          href={stellarExpertAccountUrl(address, STELLAR_EXPERT_NETWORK)}
          target="_blank"
          rel="noreferrer"
          className="text-accent underline"
        >
          {shortenAddress(address)}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        <CopyButton value={address} label="Copy address" />
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-2 flex items-center justify-between text-sm last:mb-0">
      <span className="text-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}
