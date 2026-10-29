"use client";

import { useState } from "react";
import { formatCredits } from "@/config/pricing";
import type { CreditPackage } from "@/types";

/**
 * Credit packs and the QPay step. QPay is not connected yet: choosing a pack and pressing
 * "Pay with QPay" shows where the QR code will appear, and nothing is charged.
 */
export function QPayModal({
  packages,
  required,
  balance,
  initialPackageId,
  onClose,
}: {
  packages: CreditPackage[];
  /** Credits the pending generation needs; set when the modal opens because of a shortfall. */
  required?: number;
  balance?: number;
  initialPackageId?: string;
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState(
    initialPackageId ?? packages.find((p) => p.highlighted)?.id ?? packages[0]?.id,
  );
  const [showQr, setShowQr] = useState(false);
  const selected = packages.find((p) => p.id === selectedId);
  const short = required !== undefined && balance !== undefined ? required - balance : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qpay-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-line bg-secondary p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="qpay-title" className="text-xl font-semibold text-foreground">
          {required !== undefined ? "Not enough credits" : "Buy credits"}
        </h2>
        {required !== undefined && balance !== undefined && (
          <p className="mt-2 text-sm text-muted">
            This needs {formatCredits(required)} credits and you have {formatCredits(balance)}
            {short && short > 0 ? ` — ${formatCredits(short)} more to go.` : "."}
          </p>
        )}

        <div role="radiogroup" aria-label="Credit pack" className="mt-5 space-y-3">
          {packages.map((p) => {
            const on = p.id === selectedId;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setSelectedId(p.id);
                  setShowQr(false);
                }}
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left ${
                  on ? "border-[rgba(139,92,246,0.6)] bg-[rgba(139,92,246,0.13)]" : "border-line bg-surface"
                }`}
              >
                <span>
                  <span className="flex items-center gap-2 text-[15px] font-medium text-foreground">
                    {p.name}
                    {p.highlighted && (
                      <span className="rounded-full btn-primary px-2 py-0.5 text-[10px] font-medium">Most Popular</span>
                    )}
                  </span>
                  <span className="text-[12px] text-muted">
                    {formatCredits(p.credits)} credits
                    {p.bonusCredits > 0 ? ` (includes ${formatCredits(p.bonusCredits)} bonus)` : ""}
                  </span>
                </span>
                <span className="text-[16px] font-semibold text-foreground">{formatCredits(p.priceMnt)}₮</span>
              </button>
            );
          })}
        </div>

        {showQr && selected && (
          <div className="mt-5 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line p-5 text-center">
            <div
              role="img"
              aria-label="QPay QR code placeholder"
              className="flex size-40 items-center justify-center rounded-xl bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.08)_0_8px,transparent_8px_16px)] text-xs text-muted"
            >
              QPay QR
            </div>
            <p className="text-[12px] text-muted">
              Placeholder: QPay is not connected yet, so nothing has been charged. When it is, the QR code for{" "}
              {formatCredits(selected.priceMnt)}₮ appears here and your {formatCredits(selected.credits)} credits are
              added after payment.
            </p>
          </div>
        )}

        <button
          type="button"
          disabled={!selected}
          onClick={() => setShowQr(true)}
          className="mt-5 w-full rounded-xl btn-primary py-3 text-[14px] font-medium text-foreground disabled:opacity-50"
        >
          Pay with QPay{selected ? ` · ${formatCredits(selected.priceMnt)}₮` : ""}
        </button>
        <button type="button" onClick={onClose} className="mt-3 w-full text-sm text-muted hover:text-foreground">
          Not now
        </button>
      </div>
    </div>
  );
}
