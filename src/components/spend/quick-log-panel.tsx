"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  FormEvent,
} from "react";
import { Dialog, Transition } from "@headlessui/react";

import { getDb, type PerksKeeperDB } from "@/lib/db";
import { computeOfferStats } from "@/lib/offers";
import type { Card, Offer } from "@/lib/types";

interface QuickLogPanelProps {
  isOpen: boolean;
  offers: Offer[];
  cards: Map<string, Card>;
  initialOfferId: string | null;
  onClose: () => void;
}

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

export function QuickLogPanel({
  isOpen,
  offers,
  cards,
  initialOfferId,
  onClose,
}: QuickLogPanelProps) {
  const [db, setDb] = useState<PerksKeeperDB | null>(null);
  const [selectedId, setSelectedId] = useState<string | "">(initialOfferId ?? "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [keepOpen, setKeepOpen] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDb(getDb());
  }, []);

  const activeOffers = useMemo(() => {
    return offers.filter((offer) => offer.status === "active");
  }, [offers]);

  useEffect(() => {
    if (!isOpen) {
      setAmount("");
      setNote("");
      setStatus(null);
      setError(null);
      return;
    }

    const desired = initialOfferId && activeOffers.some((o) => o.id === initialOfferId)
      ? initialOfferId
      : activeOffers[0]?.id ?? "";
    setSelectedId(desired ?? "");
    setAmount("");
    setNote("");
    setStatus(null);
    setError(null);
  }, [isOpen, initialOfferId, activeOffers]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => {
      amountRef.current?.focus();
    }, 150);
    return () => window.clearTimeout(timer);
  }, [isOpen, selectedId]);

  const selectedOffer = useMemo(() => {
    return activeOffers.find((offer) => offer.id === selectedId) ?? null;
  }, [activeOffers, selectedId]);

  const stats = selectedOffer ? computeOfferStats(selectedOffer) : null;

  const handleClose = useCallback(() => {
    setAmount("");
    setNote("");
    setStatus(null);
    setError(null);
    onClose();
  }, [onClose]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!db || !selectedOffer) return;

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Enter a valid purchase amount greater than $0.");
      setStatus(null);
      return;
    }

    setIsSaving(true);
    setError(null);
    setStatus(null);

    try {
      const now = Date.now();
      await db.transaction("rw", [db.offers, db.spendLogs], async () => {
        await db.spendLogs.add({
          id: crypto.randomUUID(),
          offerId: selectedOffer.id,
          amount: numericAmount,
          note: note.trim() || undefined,
          createdAt: now,
        });

        const latest = await db.offers.get(selectedOffer.id);
        if (!latest) throw new Error("Offer no longer exists.");

        await db.offers.put({
          ...latest,
          totalSpendTracked: Number((latest.totalSpendTracked + numericAmount).toFixed(2)),
          updatedAt: now,
        });
      });

      setStatus("Purchase saved.");
      setAmount("");
      setNote("");

      if (keepOpen) {
        window.setTimeout(() => amountRef.current?.focus(), 50);
      } else {
        handleClose();
      }
    } catch (err) {
      console.error(err);
      setError("Unable to save this purchase. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={handleClose} className="relative z-50">
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-900/40" aria-hidden="true" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 flex justify-end">
            <Transition.Child
              as={Fragment}
              enter="transform transition ease-out duration-200"
              enterFrom="translate-x-full"
              enterTo="translate-x-0"
              leave="transform transition ease-in duration-150"
              leaveFrom="translate-x-0"
              leaveTo="translate-x-full"
            >
              <Dialog.Panel className="w-full max-w-md bg-white shadow-2xl">
                <div className="flex h-full flex-col">
                  <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-slate-900">
                        Quick log purchase
                      </Dialog.Title>
                      <p className="text-sm text-slate-500">
                        Add spend to keep your offer progress current.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleClose}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
                      aria-label="Close"
                    >
                      <span aria-hidden>×</span>
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto px-6 py-5">
                    {activeOffers.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                        No active offers available. Add a new offer first.
                      </div>
                    ) : (
                      <form className="space-y-6" onSubmit={handleSubmit}>
                        <label className="block text-sm font-medium text-slate-700">
                          Offer
                          <select
                            className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            value={selectedId}
                            onChange={(event) => setSelectedId(event.target.value)}
                          >
                            {activeOffers.map((offer) => {
                              const card = cards.get(offer.cardId);
                              return (
                                <option key={offer.id} value={offer.id}>
                                  {offer.merchant} {card ? `· ${card.name}` : ""}
                                </option>
                              );
                            })}
                          </select>
                        </label>

                        <label className="block text-sm font-medium text-slate-700">
                          Amount
                          <div className="mt-1 flex items-center rounded-xl border border-slate-200 bg-white px-3">
                            <span className="text-slate-400">$</span>
                            <input
                              ref={amountRef}
                              className="flex-1 bg-transparent px-2 py-2 text-base outline-none placeholder:text-slate-400"
                              inputMode="decimal"
                              placeholder="0.00"
                              value={amount}
                              onChange={(event) => setAmount(event.target.value)}
                            />
                          </div>
                        </label>

                        <label className="block text-sm font-medium text-slate-700">
                          Note (optional)
                          <textarea
                            className="mt-1 min-h-[88px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            placeholder="e.g., lunch at Bistro"
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            maxLength={160}
                          />
                        </label>

                        {selectedOffer && stats ? (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-xs text-slate-600">
                            <p className="font-semibold text-slate-900">
                              {selectedOffer.merchant}
                            </p>
                            <p className="mt-1">
                              Earned {formatCurrency(stats.earned)} / {formatCurrency(selectedOffer.cashbackCap)}
                            </p>
                            <p>
                              Spend {formatCurrency(stats.remainSpendToCap)} more to max
                            </p>
                          </div>
                        ) : null}

                        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                              type="checkbox"
                              checked={keepOpen}
                              onChange={(event) => setKeepOpen(event.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            Keep open for next entry
                          </label>
                          <span className="text-xs text-slate-500">
                            Clear amount after save
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="submit"
                            className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
                            disabled={isSaving || !selectedOffer}
                          >
                            {isSaving ? "Saving..." : "Save purchase"}
                          </button>
                          <button
                            type="button"
                            onClick={handleClose}
                            className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:border-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                          >
                            Close
                          </button>
                        </div>

                        {status ? (
                          <p className="text-sm text-emerald-600">{status}</p>
                        ) : null}
                        {error ? <p className="text-sm text-red-600">{error}</p> : null}
                      </form>
                    )}
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
