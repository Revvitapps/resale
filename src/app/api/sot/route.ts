import { NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import fs from "fs/promises";
import path from "path";
import { put } from "@vercel/blob";
import { computeFinancials, fromCsvRecord, CSV_HEADERS } from "@/lib/sot";

export async function GET() {
  try {
    // Prefer Blob storage if configured, otherwise fall back to local file (useful in dev)
    const blobUrl = process.env.SOT_BLOB_URL;
    const file =
      blobUrl && blobUrl.startsWith("http")
        ? await (await fetch(blobUrl)).text()
        : await fs.readFile(path.resolve(process.cwd(), "..", "vista-sot-master.csv"), "utf8");

    const records = parse(file, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
    }) as Record<string, string>[];

    const rows = records
      .filter((r) => (r["Item"] ?? "").trim().toLowerCase() !== "totals")
      .map((r) => computeFinancials(fromCsvRecord(r)));

    return NextResponse.json({ rows });
  } catch (error) {
    console.error("Failed to load SOT CSV", error);
    return NextResponse.json({ error: "Unable to read vista-sot-master.csv" }, { status: 500 });
  }
}

// Optional: save the working CSV back to blob storage
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    const data = rows.map((r: Record<string, string>) => CSV_HEADERS.map((h) => r[h] ?? ""));
    const csv = [CSV_HEADERS.join(","), ...data.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");

    const blobPath = process.env.SOT_BLOB_PATH || "sot/master.csv";
    const { url } = await put(blobPath, csv, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return NextResponse.json({ ok: true, url });
  } catch (error) {
    console.error("Failed to save SOT CSV", error);
    return NextResponse.json({ error: "Unable to save SOT CSV" }, { status: 500 });
  }
}
