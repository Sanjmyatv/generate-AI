"use client";

import { startTransition, useActionState, useState } from "react";
import { savePricingSettingsAction, type PricingSettingsState } from "@/app/actions/admin";
import type { PricingConfig } from "@/lib/pricing";

const inputClass = "mt-1 block w-full rounded-xl border border-foreground/30 bg-transparent px-3 py-2";
const initialState: PricingSettingsState = { errors: {}, message: null, changes: null };

/** Trims float noise: 0.05 * 100 is 5.000000000000001. */
const pct = (fraction: number) => String(Math.round(fraction * 10000) / 100);

const fmtCredits = (n: number | null) => (n === null ? "-" : n.toLocaleString("en-US"));

/**
 * The numbers behind every credit price. Saving first shows which templates with automatic credits would change
 * (old → new); nothing is applied until it is confirmed, and templates priced by hand are never touched.
 */
export function PricingSettingsForm({
  config,
  reference,
}: {
  config: PricingConfig;
  /** The reference video's price and what it would earn at Higgsfield's list price (the discount-ends risk). */
  reference: { credits: number; seconds: number; marginAtListPct: number };
}) {
  // Cancel remounts the form, which also clears the preview.
  const [formKey, setFormKey] = useState(0);
  return <Form key={formKey} config={config} reference={reference} onCancel={() => setFormKey((k) => k + 1)} />;
}

function Form({
  config,
  reference,
  onCancel,
}: {
  config: PricingConfig;
  reference: { credits: number; seconds: number; marginAtListPct: number };
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(savePricingSettingsAction, initialState);
  const err = state.errors;
  const field = (name: string, label: string, value: string, hint?: string) => (
    <label className="block text-xs font-semibold">
      {label}
      <input name={name} defaultValue={value} inputMode="decimal" className={inputClass} />
      {hint && <span className="mt-1 block font-normal text-foreground/60">{hint}</span>}
      {err[name] && <span className="mt-1 block font-normal text-red-500">{err[name]}</span>}
    </label>
  );

  return (
    <form
      onSubmit={(e) => {
        // Submit by hand so React does not reset the fields when the action answers with the preview.
        e.preventDefault();
        const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        startTransition(() => action(data));
      }}
      className="mt-6 rounded-2xl border border-foreground/15 p-4"
    >
      <h2 className="text-sm font-semibold">Pricing settings</h2>
      <p className="mt-1 text-xs text-foreground/60">
        credits = ceil(provider cost × USD rate × K ÷ credit value), where K = (1 + retry buffer) ÷ (1 − target margin −
        gateway fee). Rounded up once, on the whole video. Used by the template editor, the pricing page and checkout.
      </p>

      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        {field("creditValueMnt", "Credit value (₮)", String(config.creditValueMnt), "Price of 1 credit in every pack.")}
        {field("targetMarginPct", "Target margin (%)", String(config.targetMarginPct))}
        {field("retryPct", "Retry buffer (%)", pct(config.retryRate), "Added on top of the provider cost.")}
        {field("feePct", "Payment gateway fee (%)", pct(config.gatewayFeeRate), "Taken from revenue.")}
        {field("usdMnt", "USD → MNT rate", String(config.usdMnt), "Default: USD_MNT_RATE on the server.")}
        {field("videoUsdPerSecond", "Video cost, 480p ($ per second)", String(config.videoUsdPerSecond), "Real rate on our account (manual).")}
        {field("hdMultiplier", "720p cost multiplier", String(config.hdMultiplier), "Verify with one real 720p render.")}
        {field("referenceSeconds", "Reference video length (s)", String(config.referenceSeconds), "What a pack's “N videos” counts.")}
        {field("listUsdPerSecond", "Higgsfield list price, 480p ($ per second)", String(config.listUsdPerSecond), "Only for the risk line below.")}
        <label className="block text-xs font-semibold">
          Price source
          <select name="priceSource" defaultValue={config.priceSource} className={inputClass}>
            <option value="MANUAL">Manual per-second rate</option>
            <option value="HIGGSFIELD">Higgsfield lookup (account price, else list price)</option>
          </select>
          <span className="mt-1 block font-normal text-foreground/60">
            Active now: {config.priceSource === "MANUAL" ? `manual rate $${config.videoUsdPerSecond}/s` : "Higgsfield lookup"}. The lookup is
            labelled account price or list price in the editor; bulk repricing always uses the manual rate.
          </span>
        </label>
      </div>

      <p className="mt-3 text-xs text-foreground/70">
        Margin at Higgsfield list price: a {reference.credits}-credit video ({reference.seconds} s, 480p) would earn{" "}
        <span className={`font-semibold ${reference.marginAtListPct < 50 ? "text-red-500" : ""}`}>
          {reference.marginAtListPct.toFixed(0)}%
        </span>{" "}
        if the discount on our account ended.
      </p>

      {state.message && (
        <p role="alert" className="mt-3 text-sm text-red-500">
          {state.message}
        </p>
      )}

      {state.changes && (
        <div className="mt-4 rounded-xl border border-amber-500/50 p-3">
          <p className="text-sm font-semibold">
            {state.changes.length} template{state.changes.length === 1 ? "" : "s"} with automatic credits will change
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-foreground/60">
                <tr>
                  <th className="py-1 pr-2 font-medium">Template</th>
                  <th className="py-1 pr-2 font-medium">Length</th>
                  <th className="py-1 pr-2 font-medium">480p credits</th>
                  <th className="py-1 font-medium">720p credits</th>
                </tr>
              </thead>
              <tbody>
                {state.changes.map((c) => (
                  <tr key={c.id} className="border-t border-foreground/10">
                    <td className="py-1 pr-2">{c.name}</td>
                    <td className="py-1 pr-2">{c.seconds} s</td>
                    <td className="py-1 pr-2">
                      {fmtCredits(c.oldCredits)} → <span className="font-semibold">{fmtCredits(c.newCredits)}</span>
                    </td>
                    <td className="py-1">
                      {fmtCredits(c.oldCreditsHd)} → <span className="font-semibold">{fmtCredits(c.newCreditsHd)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-foreground/60">Templates priced by hand are not changed.</p>
          <div className="mt-3 flex gap-2">
            <button name="intent" value="confirm" disabled={pending} className="rounded-full btn-primary px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-50">
              Confirm and apply
            </button>
            <button type="button" onClick={onCancel} className="rounded-full border border-foreground/30 px-4 py-2 text-sm font-semibold">
              Cancel
            </button>
          </div>
        </div>
      )}

      {!state.changes && (
        <button disabled={pending} className="mt-4 rounded-full btn-primary px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-50">
          {pending ? "Checking…" : "Save settings"}
        </button>
      )}
    </form>
  );
}
