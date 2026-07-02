import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

type EntryInput = {
  date?: unknown;
  product?: unknown;
  quantity?: unknown;
  credit?: unknown;
  spent?: unknown;
  cookies?: unknown;
  uuid?: unknown;
  deliveryLink?: unknown;
  delivered?: unknown;
  sold?: unknown;
  soldFor?: unknown;
  entries?: unknown;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (body: unknown, init?: ResponseInit) =>
  Response.json(body, {
    ...init,
    headers: {
      ...corsHeaders,
      ...init?.headers,
    },
  });

const asString = (value: unknown) => {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value).trim();
};

const asNumber = (value: unknown, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const isEntryInput = (value: unknown): value is EntryInput =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeEntry = (input: EntryInput, index: number) => {
  const date = asString(input.date);
  const product = asString(input.product);
  const cookies = asString(input.cookies);
  const uuid = asString(input.uuid);

  const missing = [
    !date && "date",
    !product && "product",
    !cookies && "cookies",
    !uuid && "uuid",
  ].filter(Boolean);

  if (missing.length) {
    throw new Error(`Entry ${index + 1} is missing: ${missing.join(", ")}`);
  }

  const sold = Boolean(input.sold);
  const soldFor = sold ? asNumber(input.soldFor, 0) : null;

  return {
    date,
    product,
    quantity: Math.max(1, Math.floor(asNumber(input.quantity, 1))),
    credit: Math.floor(asNumber(input.credit, 0)),
    spent: asNumber(input.spent, 0),
    cookies,
    uuid,
    deliveryLink: asString(input.deliveryLink) || null,
    delivered: Boolean(input.delivered),
    sold,
    soldFor,
  };
};

export async function GET() {
  return json({
    endpoint: "/api/entries",
    method: "POST",
    body: {
      date: "02/07/2026",
      uuid: "00000000-0000-0000-0000-000000000000",
      cookies: "bulk_imported",
      product: "lion",
      quantity: 1,
      credit: 25,
      spent: 2.63,
      deliveryLink: "optional Royal Mail link or tracking code",
      delivered: false,
      sold: false,
      soldFor: null,
    },
    batchBody: {
      entries: [
        {
          date: "02/07/2026",
          uuid: "00000000-0000-0000-0000-000000000000",
          cookies: "bulk_imported",
          product: "lion",
          quantity: 1,
          credit: 25,
          spent: 2.63,
        },
      ],
    },
  });
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const rawEntries: EntryInput[] = Array.isArray(body)
      ? body.filter(isEntryInput)
      : isEntryInput(body) && Array.isArray(body.entries)
        ? body.entries.filter(isEntryInput)
        : isEntryInput(body)
          ? [body]
          : [];

    if (!rawEntries.length) {
      return json({ success: false, error: "No entries provided." }, { status: 400 });
    }

    if (rawEntries.length > 100) {
      return json({ success: false, error: "Send 100 entries or fewer per request." }, { status: 400 });
    }

    const entries = rawEntries.map((entry, index) => normalizeEntry(entry, index));

    const result = await prisma.trackerEntry.createMany({
      data: entries,
    });

    revalidatePath("/");

    return json({ success: true, count: result.count }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create entries.";
    return json({ success: false, error: message }, { status: 400 });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
