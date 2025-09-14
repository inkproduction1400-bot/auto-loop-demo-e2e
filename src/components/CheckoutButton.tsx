"use client";

import { useState } from "react";

type Props = {
  amount: number;                  // 例: 5000
  currency?: string;               // 例: jpy
  defaultMock?: boolean;           // 初期モックON/OFF
};

type Outcome = "success" | "decline" | "cancel";

export default function CheckoutButton({ amount, currency = "jpy", defaultMock = true }: Props) {
  const [loading, setLoading] = useState(false);
  const [useMock, setUseMock] = useState(defaultMock);
  const [outcome, setOutcome] = useState<Outcome>("success");

  const startCheckout = async () => {
    try {
      setLoading(true);
      const qs = new URLSearchParams();
      if (useMock) qs.set("mock", "1");

      const res = await fetch(`/api/checkout?${qs.toString()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(useMock ? { "x-e2e-mock": "1" } : {}),
        },
        body: JSON.stringify({
          amount,
          currency,
          metadata: { via: "ui", outcome }, // outcome は Outcome 型
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error((json as { error?: string })?.error ?? "checkout failed");
      if (!(json as { url?: string })?.url) throw new Error("missing redirect url");

      window.location.href = (json as { url: string }).url;
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "不明なエラーが発生しましたで御座る");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2 border rounded-xl p-4">
      <div className="flex items-center gap-2">
        <label className="cursor-pointer flex items-center gap-2">
          <input
            type="checkbox"
            checked={useMock}
            onChange={(e) => setUseMock(e.target.checked)}
          />
          <span>Mock 決済を使うで御座る</span>
        </label>

        {useMock && (
          <select
            className="border rounded px-2 py-1"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as Outcome)}
            title="モック時の結果を選べるで御座る"
          >
            <option value="success">success</option>
            <option value="decline">decline</option>
            <option value="cancel">cancel</option>
          </select>
        )}
      </div>

      <button
        onClick={startCheckout}
        disabled={loading}
        className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
      >
        {loading ? "Processing…" : `決済へ進む（${amount} ${currency.toUpperCase()}）で御座る`}
      </button>
    </div>
  );
}
