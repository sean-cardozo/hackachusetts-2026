// GET /api/feeds/nadac | orangebook | shortages
// Returns the cached JSON file. Unknown feed names get a 404.
import { NextResponse } from "next/server";
import { isFeedName, readFeed } from "../../../../lib/feeds";

export const runtime = "nodejs";

export function GET(_request: Request, { params }: { params: { feed: string } }) {
  if (!isFeedName(params.feed)) {
    return NextResponse.json({ error: `Unknown feed "${params.feed}"` }, { status: 404 });
  }

  try {
    const { data } = readFeed(params.feed);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: `Cache for "${params.feed}" is missing or invalid` }, { status: 500 });
  }
}
