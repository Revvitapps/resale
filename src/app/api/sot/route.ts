import { NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import fs from "fs/promises";
import path from "path";
import { computeFinancials, fromCsvRecord } from "@/lib/sot";

export async function GET() {
  try {
    const csvPath = path.resolve(process.cwd(), "..", "vista-sot-master.csv");
    const file = await fs.readFile(csvPath, "utf8");
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
