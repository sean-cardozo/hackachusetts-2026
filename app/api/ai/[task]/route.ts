// POST /api/ai/:task  (Requirement 5.1, 5.9)
//
// Tasks: column-map, drug-match, supplier-reason, rfq, ask.
//   unknown task            -> 404 { error }
//   body over 1 MB          -> 413 { error }
//   body is not valid JSON  -> 400 { error }
//   invalid input           -> 400 { error, issues }
//   success                 -> 200 AiResult { task, result, confidence, source, sourceNote }
//   anything else           -> the rule-based fallback, or 500 { error } with no details
//
// This file never logs the request body and never touches the AI key (lib/ai.ts reads it).

import { NextResponse } from "next/server";
import { AiInputError, isAiTask, runAiTask } from "../../../../lib/ai"; // relative so Vitest (no alias config) can import this route

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 1_000_000; // 1 MB

const noStore = { headers: { "Cache-Control": "no-store" } };

function errorResponse(status: number, error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status, ...noStore });
}

export async function POST(request: Request, { params }: { params: { task: string } }) {
  const task = params.task;
  if (!isAiTask(task)) {
    return errorResponse(404, "Unknown AI task. Use column-map, drug-match, supplier-reason, rfq or ask.");
  }

  // Body size guard: check the declared length first, then the real length.
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return errorResponse(413, "Request body is too large (1 MB limit).");
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return errorResponse(400, "Request body must be valid JSON.");
  }
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    return errorResponse(413, "Request body is too large (1 MB limit).");
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return errorResponse(400, "Request body must be valid JSON.");
  }

  try {
    const result = await runAiTask(task, body);
    return NextResponse.json(result, noStore);
  } catch (error) {
    if (error instanceof AiInputError) {
      return errorResponse(400, error.message, { issues: error.issues });
    }
    // Unexpected failure: try the rule-based path with no model call. No details are returned.
    try {
      const fallback = await runAiTask(task, body, { env: {} });
      return NextResponse.json(fallback, noStore);
    } catch {
      return errorResponse(500, "Something went wrong.");
    }
  }
}
