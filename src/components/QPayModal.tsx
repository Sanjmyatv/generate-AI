"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useT } from "@/components/I18nProvider";
import { LoginModal } from "@/components/LoginModal";
import { formatCredits } from "@/config/pricing";
import { packName } from "@/lib/i18n/helpers";
import type { TKey } from "@/lib/i18n/translate";
import type { CreditPackage } from "@/types";

interface Payment {
  id: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED";
  amountMnt: number;
  credits: number;
  qrImage?: string;
  shortUrl?: string | null;
  deeplinks?: { name: string; description: string; logo: string; link: string }[];
}

type Phase = "select" | "creating" | "waiting" | "paid";

/** How often the open dialog asks our own server (never QPay) whether the payment arrived. */
const POLL_MS = 3000;

const ERROR_KEYS: Record<string, TKey> = {
  not_configured: "qpay.err.notConfigured",
  provider_error: "qpay.err.provider",
  too_many: "qpay.err.tooMany",
  package_unavailable: "qpay.err.unavailable",
};

/**
 * Buying credits with QPay: pick a pack, pay the QR code or open a bank app, and the credits
 * appear once QPay confirms. QPay tells our server by callback; this dialog just watches our
 * own database for the result.
 */
export function QPayModal({
  packages,
  required,
  balance,
  initialPackageId,
  onClose,
  onPaid,
}: {
  packages: CreditPackage[];
  /** Credits the pending generation needs; set when the dialog opens because of a shortfall. */
  required?: number;
  balance?: number;
  initialPackageId?: string;
  onClose: () => void;
  /** Called with the new balance once a payment goes through. */
  onPaid?: (balance: number) => void;
}) {
  const t = useT();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(
    initialPackageId ?? packages.find((p) => p.highlighted)?.id ?? packages[0]?.id,
  );
  const [phase, setPhase] = useState<Phase>("select");
  const [payment, setPayment] = useState<Payment | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [newBalance, setNewBalance] = useState<number | null>(null);
  const [showLogin, setShowLogin] = useState(false);

  const selected = packages.find((p) => p.id === selectedId);
  const short = required !== undefined && balance !== undefined ? required - balance : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !showLogin && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, showLogin]);

  function markPaid(balanceNow: number | undefined) {
    setPhase("paid");
    if (typeof balanceNow === "number") {
      setNewBalance(balanceNow);
      onPaid?.(balanceNow);
    }
    router.refresh(); // the header's credit balance comes from the server
  }

  // While a QR is on screen, watch our own database for the callback's result.
  const waitingId = phase === "waiting" ? payment?.id : undefined;
  useEffect(() => {
    if (!waitingId) return;
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/${waitingId}`, { cache: "no-store" });
        if (!res.ok || stopped) return;
        const data = (await res.json()) as { payment: Payment; balance?: number };
        if (data.payment.status === "SUCCEEDED") {
          stopped = true;
          markPaid(data.balance);
        }
      } catch {
        // a dropped request just means the next tick tries again
      }
    }, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
    // markPaid only uses setters and props that stay the same while waiting
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingId]);

  async function start() {
    if (!selected) return;
    setPhase("creating");
    setMessage(null);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: selected.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setPhase("select");
        setShowLogin(true);
        return;
      }
      if (!res.ok) {
        setPhase("select");
        setMessage(t(ERROR_KEYS[data.error] ?? "qpay.err.generic"));
        return;
      }
      setPayment(data.payment as Payment);
      setPhase("waiting");
    } catch {
      setPhase("select");
      setMessage(t("qpay.err.connection"));
    }
  }

  async function checkNow() {
    if (!payment) return;
    setChecking(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/payments/${payment.id}/check`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.payment?.status === "SUCCEEDED") {
        markPaid(data.balance);
      } else if (res.status === 429) {
        setMessage(t("qpay.wait.later"));
      } else if (res.status === 502) {
        setMessage(t("qpay.wait.noAnswer"));
      } else {
        setMessage(t("qpay.wait.notYet"));
      }
    } catch {
      setMessage(t("qpay.wait.connection"));
    } finally {
      setChecking(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qpay-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={phase === "creating" ? undefined : onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-line bg-secondary p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {phase === "paid" && payment ? (
          <div className="py-4 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500/15 text-3xl text-emerald-400">
              ✓
            </div>
            <h2 id="qpay-title" className="mt-4 text-xl font-semibold text-foreground">
              {t("qpay.paid.title")}
            </h2>
            <p className="mt-2 text-sm text-muted">
              {t("qpay.paid.added", { amount: formatCredits(payment.credits) })}
              {newBalance !== null && t("qpay.paid.balance", { amount: formatCredits(newBalance) })}
            </p>
            <button type="button" onClick={onClose} className="btn-primary mt-6 w-full py-3 text-[14px] font-medium">
              {t("qpay.paid.done")}
            </button>
          </div>
        ) : phase === "waiting" && payment ? (
          <div>
            <h2 id="qpay-title" className="text-xl font-semibold text-foreground">
              {t("qpay.pay.title", { amount: formatCredits(payment.amountMnt) })}
            </h2>
            <p className="mt-2 text-sm text-muted">
              {t("qpay.pay.desc", { credits: formatCredits(payment.credits) })}
            </p>

            {payment.qrImage && (
              <div className="mt-5 flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:image/png;base64,${payment.qrImage}`}
                  alt={t("qpay.pay.qrAlt")}
                  className="size-52 rounded-2xl bg-white p-2"
                />
              </div>
            )}

            {payment.deeplinks && payment.deeplinks.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-xs font-medium text-muted">{t("qpay.pay.openBank")}</p>
                <div className="grid grid-cols-4 gap-2">
                  {payment.deeplinks.map((bank) => (
                    <a
                      key={bank.name}
                      href={bank.link}
                      title={bank.description}
                      className="flex flex-col items-center gap-1 rounded-xl border border-line bg-surface px-1 py-2 text-center text-[10px] leading-tight text-foreground hover:border-purple-500/40"
                    >
                      {bank.logo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={bank.logo} alt="" className="size-8 rounded-md object-contain" />
                      )}
                      <span className="line-clamp-2">{bank.name}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {payment.shortUrl && (
              <a
                href={payment.shortUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 block text-center text-xs text-purple-300 underline underline-offset-2"
              >
                {t("qpay.pay.page")}
              </a>
            )}

            {message && <p className="mt-4 text-center text-xs text-muted">{message}</p>}
            <button
              type="button"
              onClick={() => void checkNow()}
              disabled={checking}
              className="btn-primary mt-5 w-full py-3 text-[14px] font-medium disabled:opacity-50"
            >
              {checking ? t("qpay.pay.checking") : t("qpay.pay.paid")}
            </button>
            <div className="mt-3 flex justify-between text-sm text-muted">
              <button type="button" onClick={() => setPhase("select")} className="hover:text-foreground">
                {t("qpay.pay.other")}
              </button>
              <button type="button" onClick={onClose} className="hover:text-foreground">
                {t("qpay.pay.close")}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h2 id="qpay-title" className="text-xl font-semibold text-foreground">
              {required !== undefined ? t("qpay.select.short") : t("qpay.select.buy")}
            </h2>
            {required !== undefined && balance !== undefined && (
              <p className="mt-2 text-sm text-muted">
                {t("qpay.select.needs", { required: formatCredits(required), balance: formatCredits(balance) })}
                {short && short > 0 ? t("qpay.select.more", { amount: formatCredits(short) }) : "."}
              </p>
            )}

            <div role="radiogroup" aria-label={t("qpay.select.packLabel")} className="mt-5 space-y-3">
              {packages.map((p) => {
                const on = p.id === selectedId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setSelectedId(p.id)}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left ${
                      on ? "border-[rgba(139,92,246,0.6)] bg-[rgba(139,92,246,0.13)]" : "border-line bg-surface"
                    }`}
                  >
                    <span>
                      <span className="flex items-center gap-2 text-[15px] font-medium text-foreground">
                        {packName(t, p)}
                        {p.highlighted && (
                          <span className="btn-primary rounded-full px-2 py-0.5 text-[10px] font-medium">{t("qpay.select.popular")}</span>
                        )}
                      </span>
                      <span className="text-[12px] text-muted">
                        {t("qpay.select.credits", { amount: formatCredits(p.credits) })}
                        {p.bonusCredits > 0 ? t("qpay.select.bonus", { amount: formatCredits(p.bonusCredits) }) : ""}
                      </span>
                    </span>
                    <span className="text-[16px] font-semibold text-foreground">{formatCredits(p.priceMnt)}₮</span>
                  </button>
                );
              })}
            </div>

            {message && <p className="mt-4 text-sm text-red-400">{message}</p>}
            <button
              type="button"
              disabled={!selected || phase === "creating"}
              onClick={() => void start()}
              className="btn-primary mt-5 w-full py-3 text-[14px] font-medium disabled:opacity-50"
            >
              {phase === "creating"
                ? t("qpay.select.creating")
                : `${t("qpay.select.pay")}${selected ? ` · ${formatCredits(selected.priceMnt)}₮` : ""}`}
            </button>
            <p className="mt-3 text-center text-[11px] leading-relaxed text-muted">
              {t("qpay.terms.pre")}
              <Link href="/terms" target="_blank" className="text-foreground underline underline-offset-2">{t("qpay.terms.terms")}</Link>
              {t("qpay.terms.and")}
              <Link href="/privacy" target="_blank" className="text-foreground underline underline-offset-2">{t("qpay.terms.privacy")}</Link>
              {t("qpay.terms.post")}
            </p>
            <button type="button" onClick={onClose} className="mt-3 w-full text-sm text-muted hover:text-foreground">
              {t("qpay.select.notNow")}
            </button>
          </div>
        )}
      </div>

      {showLogin && (
        <LoginModal
          redirectTo={typeof window === "undefined" ? "/pricing" : window.location.pathname + window.location.search}
          title={t("qpay.login.title")}
          description={t("qpay.login.desc")}
          onClose={() => setShowLogin(false)}
        />
      )}
    </div>
  );
}
