import Dexie, { Table } from "dexie";

import type { AppStats, Card, Offer, SpendLog } from "./types";

declare global {
  var __perksKeeperDb: PerksKeeperDB | undefined;
}

class PerksKeeperDB extends Dexie {
  cards!: Table<Card>;
  offers!: Table<Offer>;
  spendLogs!: Table<SpendLog>;
  stats!: Table<AppStats, string>;

  constructor() {
    super("perks_keeper");

    this.version(1).stores({
      cards: "id, issuer, name, createdAt, updatedAt",
      offers:
        "id, cardId, merchant, category, expireAt, createdAt, updatedAt, cashbackEarned",
      spendLogs: "id, offerId, createdAt",
    });

    this.version(2)
      .stores({
        cards: "id, issuer, name, createdAt, updatedAt",
        offers:
          "id, cardId, status, category, expireAt, createdAt, updatedAt, cashbackEarned",
        spendLogs: "id, offerId, createdAt",
        stats: "&id",
      })
      .upgrade(async (tx) => {
        const offerTable = tx.table<Offer>("offers");
        await offerTable.toCollection().modify((offer) => {
          const next = offer as Offer;
          if (!("status" in next) || !next.status) {
            next.status = "active";
          }
          if (!("creditedToLifetime" in next) || next.creditedToLifetime == null) {
            next.creditedToLifetime = false;
          }
          if (!("archivedAt" in next)) {
            next.archivedAt = undefined;
          }
        });

        const statsTable = tx.table<AppStats, string>("stats");
        const existing = await statsTable.get("app");
        if (!existing) {
          await statsTable.put({
            id: "app",
            lifetimeCashbackEarned: 0,
            lastUpdatedAt: Date.now(),
          });
        }
      });

    this.version(3)
      .stores({
        cards: "id, issuer, name, createdAt, updatedAt",
        offers:
          "id, cardId, status, rewardType, category, expireAt, createdAt, updatedAt, cashbackEarned",
        spendLogs: "id, offerId, createdAt",
        stats: "&id",
      })
      .upgrade(async (tx) => {
        const offerTable = tx.table<Offer>("offers");
        await offerTable.toCollection().modify((offer) => {
          const next = offer as Offer;
          if (!next.rewardType) {
            next.rewardType = "percentage";
          }
          if (next.rewardType === "percentage") {
            if (next.rewardAmount == null) {
              next.rewardAmount = next.cashbackCap ?? 0;
            }
            if (next.spendThreshold == null && next.rate > 0) {
              next.spendThreshold = (next.cashbackCap ?? 0) / next.rate;
            }
          } else {
            if (next.rewardAmount == null) {
              next.rewardAmount = next.cashbackCap ?? 0;
            }
            if (next.spendThreshold == null) {
              next.spendThreshold = 0;
            }
          }
        });
      });
  }
}

export function getDb(): PerksKeeperDB {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available in this environment.");
  }

  if (!globalThis.__perksKeeperDb) {
    globalThis.__perksKeeperDb = new PerksKeeperDB();
  }

  return globalThis.__perksKeeperDb;
}

export type { PerksKeeperDB };
