"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  FormEvent,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { getDb, type PerksKeeperDB } from "@/lib/db";
import { deleteOfferPermanently } from "@/lib/offer-actions";
import {
  type Card,
  type Offer,
  type OfferCategory,
  type CardIssuer,
  type OfferRewardType,
} from "@/lib/types";
import {
  computeOfferStats,
  getDaysLeft,
  normalizeOffer,
  recalcOfferProgress,
  sortOffersByExpiry,
} from "@/lib/offers";

const CATEGORY_OPTIONS: OfferCategory[] = [
  "Dining",
  "Shopping",
  "Grocery",
  "Gas",
  "Online",
  "Other",
];

const ISSUER_TAG_STYLES: Record<CardIssuer, string> = {
  Chase: "bg-blue-50 text-blue-600 border-blue-100",
  Amex: "bg-violet-50 text-violet-600 border-violet-100",
  Citi: "bg-cyan-50 text-cyan-600 border-cyan-100",
  Other: "bg-slate-50 text-slate-600 border-slate-200",
};

const CATEGORY_BADGE: Record<OfferCategory, string> = {
  Dining: "bg-orange-100 text-orange-700",
  Shopping: "bg-pink-100 text-pink-700",
  Grocery: "bg-emerald-100 text-emerald-700",
  Gas: "bg-amber-100 text-amber-700",
  Online: "bg-indigo-100 text-indigo-700",
  Other: "bg-slate-100 text-slate-700",
};

const EMPTY_CARDS: Card[] = [];
const EMPTY_OFFERS: Offer[] = [];

type ParsedOfferData = Omit<
  Offer,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "status"
  | "archivedAt"
  | "creditedToLifetime"
>;

type ParsedOfferResult = { data: ParsedOfferData } | { error: string };

interface OfferFormState {
  merchant: string;
  cardId: string;
  ratePercent: string;
  cashbackCap: string;
  cashbackEarned: string;
  totalSpendTracked: string;
  expireDate: string;
  category: OfferCategory;
  note: string;
  rewardType: OfferRewardType;
  rewardAmount: string;
  spendThreshold: string;
}

const blankForm: OfferFormState = {
  merchant: "",
  cardId: "",
  ratePercent: "",
  cashbackCap: "",
  cashbackEarned: "0",
  totalSpendTracked: "0",
  expireDate: "",
  category: "Dining",
  note: "",
  rewardType: "percentage",
  rewardAmount: "",
  spendThreshold: "",
};

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

function getTimeZoneOffsetInMinutes(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  const data: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      data[part.type] = Number(part.value);
    }
  }
  const zonedUTC = Date.UTC(
    data.year,
    data.month - 1,
    data.day,
    data.hour,
    data.minute,
    data.second,
  );
  return (date.getTime() - zonedUTC) / (60 * 1000);
}

function formatPercent(rate: number) {
  if (!Number.isFinite(rate)) return "0%";
  return `${Math.round(rate * 100)}%`;
}

function toDateInputValue(timestamp: number) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const iso = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
    .toISOString()
    .slice(0, 10);
  return iso;
}

function fromDateInput(value: string) {
  if (!value) return 0;
  const parts = value.split("-");
  if (parts.length !== 3) return 0;
  const [y, m, d] = parts.map(Number);
  const base = new Date(Date.UTC(y, m - 1, d, 23, 59, 59));
  const offsetMinutes = getTimeZoneOffsetInMinutes(base, "America/Chicago");
  const target = base.getTime() + offsetMinutes * 60 * 1000;
  return Number.isNaN(target) ? 0 : target;
}

function offerToFormState(offer: Offer): OfferFormState {
  return {
    merchant: offer.merchant,
    cardId: offer.cardId,
    ratePercent:
      offer.rewardType === "percentage" && offer.rate > 0
        ? (offer.rate * 100).toFixed(2).replace(/\.00$/, "")
        : "",
    cashbackCap:
      offer.cashbackCap > 0
        ? offer.cashbackCap.toFixed(2).replace(/\.00$/, "")
        : "",
    cashbackEarned: offer.cashbackEarned.toFixed(2),
    totalSpendTracked: offer.totalSpendTracked.toFixed(2),
    expireDate: toDateInputValue(offer.expireAt),
    category: offer.category,
    note: offer.note ?? "",
    rewardType: offer.rewardType ?? "percentage",
    rewardAmount:
      offer.rewardAmount != null
        ? offer.rewardAmount.toFixed(2).replace(/\.00$/, "")
        : "",
    spendThreshold:
      offer.spendThreshold != null
        ? offer.spendThreshold.toFixed(2).replace(/\.00$/, "")
        : "",
  };
}

export function OfferManager() {
  const [db, setDb] = useState<PerksKeeperDB | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDb(getDb());
  }, []);

  const cardsResult = useLiveQuery(
    async () => {
      if (!db) return [] as Card[];
      return db.cards.orderBy("name").toArray();
    },
    [db],
    EMPTY_CARDS,
  );
  const cards = cardsResult ?? EMPTY_CARDS;

  const offersResult = useLiveQuery(
    async () => {
      if (!db) return [] as Offer[];
      return db.offers.orderBy("createdAt").reverse().toArray();
    },
    [db],
    EMPTY_OFFERS,
  );
  const offers = offersResult ?? EMPTY_OFFERS;

  useEffect(() => {
    if (!db || !offers.length) return;
    const updates = offers
      .map((offer) => {
        const normalized = normalizeOffer(offer);
        if (normalized.status !== offer.status) {
          return normalized;
        }
        return null;
      })
      .filter((offer): offer is Offer => offer !== null);

    if (!updates.length) return;

    void db.transaction("rw", db.offers, async () => {
      await Promise.all(updates.map((offer) => db.offers.put(offer)));
    });
  }, [db, offers]);

  const cardLookup = useMemo(() => {
    const map = new Map<string, Card>();
    cards.forEach((card) => map.set(card.id, card));
    return map;
  }, [cards]);

  const activeOffers = useMemo(() => {
    return offers
      .filter((offer) => offer.status === "active")
      .slice()
      .sort(sortOffersByExpiry);
  }, [offers]);

  const formatDaysLeft = useCallback((expireAt: number) => {
    const days = getDaysLeft(expireAt);
    if (days <= 0) return "Due today";
    if (days === 1) return "1 day left";
    return `${days} days left`;
  }, []);

  const [createForm, setCreateForm] = useState<OfferFormState>(blankForm);
  const [createStatus, setCreateStatus] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSavingCreate, setIsSavingCreate] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<OfferFormState | null>(null);
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const hasCards = cards.length > 0;

  const updateCreateForm = useCallback(
    (field: keyof OfferFormState, value: string) => {
      setCreateForm((prev) => ({
        ...prev,
        [field]: value as OfferFormState[keyof OfferFormState],
      }));
      setCreateError(null);
      setCreateStatus(null);
    },
    [],
  );

  const updateEditForm = useCallback(
    (field: keyof OfferFormState, value: string) => {
      setEditForm((prev) =>
        prev
          ? {
              ...prev,
              [field]: value as OfferFormState[keyof OfferFormState],
            }
          : prev,
      );
      setEditError(null);
      setEditStatus(null);
    },
    [],
  );

  const parseOfferForm = (form: OfferFormState): ParsedOfferResult => {
    const rewardType: OfferRewardType =
      form.rewardType === "threshold" ? "threshold" : "percentage";

    const merchant = form.merchant.trim();
    if (!merchant) {
      return { error: "Merchant name is required." };
    }

    if (!form.cardId) {
      return { error: "Select a linked card." };
    }

    const expireAt = fromDateInput(form.expireDate);
    if (!expireAt) {
      return { error: "Expiration date is required." };
    }

    const rawTotalSpend = Number(form.totalSpendTracked);
    if (!Number.isFinite(rawTotalSpend) || rawTotalSpend < 0) {
      return { error: "Tracked spend cannot be negative." };
    }
    const totalSpendTracked = Number(rawTotalSpend.toFixed(2));

    const note = form.note.trim() || undefined;

    if (rewardType === "threshold") {
      const spendThreshold = Number(form.spendThreshold);
      if (!Number.isFinite(spendThreshold) || spendThreshold <= 0) {
        return { error: "Spend threshold must be greater than 0." };
      }

      const rewardAmount = Number(form.rewardAmount);
      if (!Number.isFinite(rewardAmount) || rewardAmount <= 0) {
        return { error: "Reward amount must be greater than 0." };
      }

      const earnedInput = Number(form.cashbackEarned);
      const manualEarned = Number.isFinite(earnedInput)
        ? Math.min(Math.max(0, earnedInput), rewardAmount)
        : 0;
      const thresholdMet = totalSpendTracked >= spendThreshold - 0.01;
      const computedEarned = thresholdMet ? rewardAmount : 0;
      const cashbackEarned = Math.max(manualEarned, computedEarned);

      const data: ParsedOfferData = {
        merchant,
        cardId: form.cardId,
        rate: Number((rewardAmount / spendThreshold).toFixed(6)),
        cashbackCap: Number(rewardAmount.toFixed(2)),
        cashbackEarned: Number(
          Math.min(cashbackEarned, rewardAmount).toFixed(2),
        ),
        totalSpendTracked,
        expireAt,
        category: form.category,
        note,
        rewardType: "threshold",
        rewardAmount: Number(rewardAmount.toFixed(2)),
        spendThreshold: Number(spendThreshold.toFixed(2)),
      };

      return { data };
    }

    const ratePercent = Number(form.ratePercent);
    if (!Number.isFinite(ratePercent) || ratePercent <= 0) {
      return { error: "Cashback rate must be greater than 0." };
    }

    const cashbackCap = Number(form.cashbackCap);
    if (!Number.isFinite(cashbackCap) || cashbackCap <= 0) {
      return { error: "Cashback cap must be greater than 0." };
    }

    const cashbackEarnedInput = Number(form.cashbackEarned);
    if (!Number.isFinite(cashbackEarnedInput) || cashbackEarnedInput < 0) {
      return { error: "Cashback earned cannot be negative." };
    }

    const rate = ratePercent / 100;
    if (!Number.isFinite(rate) || rate <= 0) {
      return { error: "Cashback rate must be greater than 0." };
    }

    const spendCap = cashbackCap / rate;
    const clampedSpend = Math.min(Math.max(totalSpendTracked, 0), spendCap);
    const autoEarned = Math.min(clampedSpend * rate, cashbackCap);
    const manualEarned = Math.min(cashbackEarnedInput, cashbackCap);
    const manualDiffers = Math.abs(manualEarned - autoEarned) > 0.01;

    const adjustedSpend = manualDiffers
      ? Math.min(Math.max(manualEarned / rate, 0), spendCap)
      : clampedSpend;

    const data: ParsedOfferData = {
      merchant,
      cardId: form.cardId,
      rate,
      cashbackCap,
      cashbackEarned: manualDiffers
        ? Number(manualEarned.toFixed(2))
        : Number(autoEarned.toFixed(2)),
      totalSpendTracked: Number(adjustedSpend.toFixed(2)),
      expireAt,
      category: form.category,
      note,
      rewardType: "percentage",
      rewardAmount: Number(cashbackCap.toFixed(2)),
      spendThreshold: Number((cashbackCap / rate).toFixed(2)),
    };

    return { data };
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!db) return;

    const parsed = parseOfferForm(createForm);
    if ("error" in parsed) {
      setCreateError(parsed.error);
      setCreateStatus(null);
      return;
    }

    setIsSavingCreate(true);
    setCreateError(null);
    setCreateStatus(null);

    try {
      const now = Date.now();
      const draft = recalcOfferProgress({
        id: crypto.randomUUID(),
        ...parsed.data,
        status: "active",
        archivedAt: undefined,
        creditedToLifetime: false,
        createdAt: now,
        updatedAt: now,
      });

      const normalized = normalizeOffer(draft);

      await db.offers.add(normalized);
      setCreateStatus("Offer saved.");
      setCreateForm(blankForm);
    } catch (error) {
      console.error(error);
      setCreateError("Unable to save the offer. Please try again.");
    } finally {
      setIsSavingCreate(false);
    }
  };

  const handleDelete = async (offer: Offer) => {
    if (!db) return;
    const confirmed = window.confirm(
      `Delete the offer "${offer.merchant}"? This will remove it from history as well.`,
    );
    if (!confirmed) return;

    setDeletingId(offer.id);
    try {
      await deleteOfferPermanently(offer.id);
      setEditStatus("Offer deleted.");
      setEditError(null);
    } catch (error) {
      console.error(error);
      setCreateError("Unable to delete the offer. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const startEdit = (offer: Offer) => {
    setEditingId(offer.id);
    setEditForm(offerToFormState(offer));
    setEditStatus(null);
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
    setEditStatus(null);
    setEditError(null);
  };

  const handleEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!db || !editingId || !editForm) return;

    const parsed = parseOfferForm({
      ...editForm,
      cardId: editForm.cardId,
    });

    if ("error" in parsed) {
      setEditError(parsed.error);
      setEditStatus(null);
      return;
    }

    setIsSavingEdit(true);
    setEditError(null);
    setEditStatus(null);

    try {
      const now = Date.now();
      const existing = await db.offers.get(editingId);
      if (!existing) {
        setEditError("Offer no longer exists.");
        return;
      }

      const updated: Offer = recalcOfferProgress({
        ...existing,
        ...parsed.data,
        id: existing.id,
        status: existing.status,
        archivedAt: existing.archivedAt,
        creditedToLifetime: existing.creditedToLifetime ?? false,
        createdAt: existing.createdAt,
        updatedAt: now,
      });

      const normalized =
        existing.status === "archived" ? updated : normalizeOffer(updated);

      await db.offers.put(normalized);
      setEditStatus("Offer updated.");
      setEditingId(null);
      setEditForm(null);
    } catch (error) {
      console.error(error);
      setEditError("Unable to update the offer. Please try again.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="space-y-10">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-slate-900">Add offer</h2>
          <p className="mt-2 text-sm text-slate-500">
            Link a perk to one of your cards, set the earnings cap, and track it
            from here.
          </p>
        </div>

        {!hasCards ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-sm text-slate-600">
            Add at least one card before creating offers.{" "}
            <a
              href="/cards"
              className="font-semibold text-blue-600 underline-offset-4 hover:underline"
            >
              Manage cards
            </a>
            .
          </div>
        ) : (
          <form className="space-y-6" onSubmit={handleCreate}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Merchant
                <input
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  placeholder="e.g., Local Bistro"
                  value={createForm.merchant}
                  onChange={(event) =>
                    updateCreateForm("merchant", event.target.value)
                  }
                  maxLength={80}
                />
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Linked card
                <select
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  value={createForm.cardId}
                  onChange={(event) =>
                    updateCreateForm("cardId", event.target.value)
                  }
                >
                  <option value="">Select a card</option>
                  {cards.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Offer type
              <select
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                value={createForm.rewardType}
                onChange={(event) =>
                  updateCreateForm("rewardType", event.target.value)
                }
              >
                <option value="percentage">Percentage cashback</option>
                <option value="threshold">Spend threshold reward</option>
              </select>
            </label>

            {createForm.rewardType === "percentage" ? (
              <div className="grid gap-4 md:grid-cols-3">
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Cashback rate (%)
                  <input
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    inputMode="decimal"
                    placeholder="5"
                    value={createForm.ratePercent}
                    onChange={(event) =>
                      updateCreateForm("ratePercent", event.target.value)
                    }
                  />
                </label>

                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Cashback cap ($)
                  <input
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    inputMode="decimal"
                    placeholder="50"
                    value={createForm.cashbackCap}
                    onChange={(event) =>
                      updateCreateForm("cashbackCap", event.target.value)
                    }
                  />
                </label>

                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Total spend tracked ($)
                  <input
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    inputMode="decimal"
                    placeholder="0"
                    value={createForm.totalSpendTracked}
                    onChange={(event) =>
                      updateCreateForm("totalSpendTracked", event.target.value)
                    }
                  />
                </label>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Spend threshold ($)
                  <input
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    inputMode="decimal"
                    placeholder="125"
                    value={createForm.spendThreshold}
                    onChange={(event) =>
                      updateCreateForm("spendThreshold", event.target.value)
                    }
                  />
                </label>

                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Reward amount ($)
                  <input
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    inputMode="decimal"
                    placeholder="25"
                    value={createForm.rewardAmount}
                    onChange={(event) =>
                      updateCreateForm("rewardAmount", event.target.value)
                    }
                  />
                </label>

                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Total spend tracked ($)
                  <input
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    inputMode="decimal"
                    placeholder="0"
                    value={createForm.totalSpendTracked}
                    onChange={(event) =>
                      updateCreateForm("totalSpendTracked", event.target.value)
                    }
                  />
                </label>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                {createForm.rewardType === "percentage"
                  ? "Cashback earned ($)"
                  : "Reward earned ($)"}
                <input
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  inputMode="decimal"
                  placeholder="0"
                  value={createForm.cashbackEarned}
                  onChange={(event) =>
                    updateCreateForm("cashbackEarned", event.target.value)
                  }
                />
                <span className="text-xs text-slate-500">
                  Keep this in sync with any manual adjustments you make.
                </span>
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Expiration date
                <input
                  type="date"
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  value={createForm.expireDate}
                  onChange={(event) =>
                    updateCreateForm("expireDate", event.target.value)
                  }
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Category
                <select
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  value={createForm.category}
                  onChange={(event) =>
                    updateCreateForm("category", event.target.value)
                  }
                >
                  {CATEGORY_OPTIONS.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Optional note
                <textarea
                  className="min-h-[88px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  placeholder="Stack with dining rewards, reminder to enroll, etc."
                  value={createForm.note}
                  onChange={(event) =>
                    updateCreateForm("note", event.target.value)
                  }
                  maxLength={180}
                />
              </label>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isSavingCreate || !db}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:bg-blue-400"
              >
                {isSavingCreate ? "Saving…" : "Save offer"}
              </button>
              {createStatus ? (
                <span className="text-sm text-green-600">{createStatus}</span>
              ) : null}
              {createError ? (
                <span className="text-sm text-red-600">{createError}</span>
              ) : null}
            </div>
          </form>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">
              Active offers
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Track status, edit details, or remove offers as they change.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
            {activeOffers.length} {activeOffers.length === 1 ? "offer" : "offers"}
          </span>
        </div>

        {activeOffers.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
            <p className="text-sm text-slate-500">
              No active offers right now. Add a new offer or adjust expiry and
              caps to keep tracking.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {activeOffers.map((offer) => {
              const card = cardLookup.get(offer.cardId);
              const stats = computeOfferStats(offer);
              const isEditing = editingId === offer.id;
              const daysLeftLabel = formatDaysLeft(offer.expireAt);

              return (
                <article
                  key={offer.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${card ? ISSUER_TAG_STYLES[card.issuer] : "bg-slate-100 text-slate-600 border-slate-200"}`}
                        >
                          {card ? `${card.issuer}` : "Card removed"}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${CATEGORY_BADGE[offer.category]}`}
                        >
                          {offer.category}
                        </span>
                      </div>
                      <h3 className="mt-3 text-lg font-semibold text-slate-900">
                        {offer.merchant}
                      </h3>
                      <p className="text-sm text-slate-600">
                        {card ? card.name : "Linked card unavailable"}
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        {offer.rewardType === "percentage"
                          ? `${formatPercent(offer.rate)} back up to ${formatCurrency(offer.cashbackCap)} · ${stats.remainSpendToCap <= 0 ? "Maxed" : `Spend ${formatCurrency(stats.remainSpendToCap)} more`}`
                          : `Earn ${formatCurrency(offer.rewardAmount ?? 0)} when you spend ${formatCurrency(offer.spendThreshold ?? 0)} · ${stats.remainSpendToCap <= 0 ? "Reward unlocked" : `Spend ${formatCurrency(stats.remainSpendToCap)} more to unlock`}`}
                      </p>
                      {offer.note ? (
                        <p className="mt-2 text-sm text-slate-500">
                          Note: {offer.note}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-col items-start gap-3 lg:items-end">
                      <div className="w-full overflow-hidden rounded-xl bg-white/60 shadow-inner">
                        <div className="h-2 w-full bg-slate-200">
                          <div
                            className="h-2 bg-blue-600"
                            style={{ width: `${Math.min(stats.percent * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-slate-500">
                        Earned {formatCurrency(stats.earned)} of{" "}
                        {formatCurrency(
                          offer.rewardType === "threshold"
                            ? offer.rewardAmount ?? offer.cashbackCap
                            : offer.cashbackCap,
                        )}
                      </p>
                      <p className="text-xs text-slate-500">
                        Expires{" "}
                        {new Date(offer.expireAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "numeric",
                          hour12: true,
                          timeZone: "America/Chicago",
                        })} · {daysLeftLabel}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(offer)}
                      className="inline-flex h-10 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(offer)}
                      disabled={deletingId === offer.id}
                      className="inline-flex h-10 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-600 transition hover:border-red-200 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:text-slate-400"
                    >
                      {deletingId === offer.id ? "Removing…" : "Remove"}
                    </button>
                    {editStatus && !isEditing ? (
                      <span className="text-sm text-green-600">{editStatus}</span>
                    ) : null}
                    {editError && !isEditing ? (
                      <span className="text-sm text-red-600">{editError}</span>
                    ) : null}
                  </div>

                  {isEditing && editForm ? (
                    <form
                      className="mt-6 space-y-6 rounded-2xl border border-slate-200 bg-white/70 p-5"
                      onSubmit={handleEdit}
                    >
                      <h4 className="text-base font-semibold text-slate-900">
                        Edit offer details
                      </h4>

                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                          Merchant
                          <input
                            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            value={editForm.merchant}
                            onChange={(event) =>
                              updateEditForm("merchant", event.target.value)
                            }
                            maxLength={80}
                          />
                        </label>

                        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                          Linked card
                          <select
                            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            value={editForm.cardId}
                            onChange={(event) =>
                              updateEditForm("cardId", event.target.value)
                            }
                          >
                            <option value="">Select a card</option>
                            {cards.map((cardOption) => (
                              <option key={cardOption.id} value={cardOption.id}>
                                {cardOption.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                        Offer type
                        <select
                          className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                          value={editForm.rewardType}
                          onChange={(event) =>
                            updateEditForm("rewardType", event.target.value)
                          }
                        >
                          <option value="percentage">Percentage cashback</option>
                          <option value="threshold">Spend threshold reward</option>
                        </select>
                      </label>

                      {editForm.rewardType === "percentage" ? (
                        <div className="grid gap-4 md:grid-cols-3">
                          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                            Cashback rate (%)
                            <input
                              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                              inputMode="decimal"
                              value={editForm.ratePercent}
                              onChange={(event) =>
                                updateEditForm("ratePercent", event.target.value)
                              }
                            />
                          </label>

                          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                            Cashback cap ($)
                            <input
                              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                              inputMode="decimal"
                              value={editForm.cashbackCap}
                              onChange={(event) =>
                                updateEditForm("cashbackCap", event.target.value)
                              }
                            />
                          </label>

                          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                            Total spend tracked ($)
                            <input
                              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                              inputMode="decimal"
                              value={editForm.totalSpendTracked}
                              onChange={(event) =>
                                updateEditForm(
                                  "totalSpendTracked",
                                  event.target.value,
                                )
                              }
                            />
                          </label>
                        </div>
                      ) : (
                        <div className="grid gap-4 md:grid-cols-3">
                          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                            Spend threshold ($)
                            <input
                              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                              inputMode="decimal"
                              value={editForm.spendThreshold}
                              onChange={(event) =>
                                updateEditForm(
                                  "spendThreshold",
                                  event.target.value,
                                )
                              }
                            />
                          </label>

                          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                            Reward amount ($)
                            <input
                              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                              inputMode="decimal"
                              value={editForm.rewardAmount}
                              onChange={(event) =>
                                updateEditForm(
                                  "rewardAmount",
                                  event.target.value,
                                )
                              }
                            />
                          </label>

                          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                            Total spend tracked ($)
                            <input
                              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                              inputMode="decimal"
                              value={editForm.totalSpendTracked}
                              onChange={(event) =>
                                updateEditForm(
                                  "totalSpendTracked",
                                  event.target.value,
                                )
                              }
                            />
                          </label>
                        </div>
                      )}

                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                          {editForm.rewardType === "percentage"
                            ? "Cashback earned ($)"
                            : "Reward earned ($)"}
                          <input
                            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            inputMode="decimal"
                            value={editForm.cashbackEarned}
                            onChange={(event) =>
                              updateEditForm(
                                "cashbackEarned",
                                event.target.value,
                              )
                            }
                          />
                        </label>

                        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                          Expiration date
                          <input
                            type="date"
                            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            value={editForm.expireDate}
                            onChange={(event) =>
                              updateEditForm("expireDate", event.target.value)
                            }
                          />
                        </label>
                      </div>

                      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                          Category
                          <select
                            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            value={editForm.category}
                            onChange={(event) =>
                              updateEditForm("category", event.target.value)
                            }
                          >
                            {CATEGORY_OPTIONS.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                          Optional note
                          <textarea
                            className="min-h-[88px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            value={editForm.note}
                            onChange={(event) =>
                              updateEditForm("note", event.target.value)
                            }
                            maxLength={180}
                          />
                        </label>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="submit"
                          disabled={isSavingEdit || !db}
                          className="inline-flex h-11 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:bg-blue-400"
                        >
                          {isSavingEdit ? "Saving…" : "Save changes"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:border-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                        >
                          Cancel
                        </button>
                        {editStatus ? (
                          <span className="text-sm text-green-600">
                            {editStatus}
                          </span>
                        ) : null}
                        {editError ? (
                          <span className="text-sm text-red-600">
                            {editError}
                          </span>
                        ) : null}
                      </div>
                    </form>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
