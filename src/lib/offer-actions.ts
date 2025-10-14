import { getDb, type PerksKeeperDB } from "./db";
import { computeStatus, recalcOfferProgress } from "./offers";
import type { AppStats, Offer } from "./types";

const STATS_KEY = "app";

async function getOrCreateStats(db: PerksKeeperDB): Promise<AppStats> {
  const existing = await db.stats.get(STATS_KEY);
  if (existing) {
    return existing;
  }

  const stats: AppStats = {
    id: STATS_KEY,
    lifetimeCashbackEarned: 0,
    lastUpdatedAt: Date.now(),
  };
  await db.stats.put(stats);
  return stats;
}

export async function archiveOffer(offerId: string): Promise<void> {
  const db = getDb();

  await db.transaction("rw", [db.offers, db.stats], async () => {
    const offer = await db.offers.get(offerId);
    if (!offer) return;

    let finalized: Offer = recalcOfferProgress(offer);
    finalized = {
      ...finalized,
      status: "archived",
      archivedAt: finalized.archivedAt ?? Date.now(),
      updatedAt: Date.now(),
    };

    if (!finalized.creditedToLifetime) {
      const stats = await getOrCreateStats(db);
      stats.lifetimeCashbackEarned = Number(
        (stats.lifetimeCashbackEarned + finalized.cashbackEarned).toFixed(2),
      );
      stats.lastUpdatedAt = Date.now();
      finalized.creditedToLifetime = true;
      await db.stats.put(stats);
    }

    const status = computeStatus(finalized);
    finalized = { ...finalized, status };

    await db.offers.put(finalized);
  });
}

export async function deleteOfferPermanently(offerId: string): Promise<void> {
  const db = getDb();

  await db.transaction("rw", [db.offers, db.spendLogs], async () => {
    await db.spendLogs.where("offerId").equals(offerId).delete();
    await db.offers.delete(offerId);
  });
}
