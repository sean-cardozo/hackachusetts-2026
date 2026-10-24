// Reads the cached feed files in data/cache/. It never uses the network.
// Run `npx tsx scripts/fetch-feeds.ts` to refresh the files.
import fs from "node:fs";
import path from "node:path";
import { FEED_NAMES, FEED_SCHEMAS } from "./feed-types";
import type { FeedDataMap, FeedName, FeedStatus } from "./feed-types";

export const DEFAULT_CACHE_DIR = path.join(process.cwd(), "data", "cache");

export function isFeedName(name: string): name is FeedName {
  return (FEED_NAMES as readonly string[]).includes(name);
}

// Reads and checks one cache file. Throws if the file is missing or has the wrong shape.
export function readFeed<K extends FeedName>(
  feed: K,
  cacheDir: string = DEFAULT_CACHE_DIR,
): { data: FeedDataMap[K]; feedStatus: FeedStatus } {
  const file = path.join(cacheDir, `${feed}.json`);
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const data = FEED_SCHEMAS[feed].parse(raw) as FeedDataMap[K];

  const feedStatus: FeedStatus = {
    feed: data.feed,
    cadence: data.cadence,
    fetchedAt: data.fetchedAt,
    effectiveDate: data.effectiveDate,
    status: data.status,
  };
  return { data, feedStatus };
}
