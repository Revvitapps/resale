'use client';

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { CSV_HEADERS, SotRow, computeFinancials, emptyRow, fromCsvRecord, toCsvRecord } from "@/lib/sot";

type UploadLink = { name: string; url: string };

const currency = (val: number | string) => {
  const num = Number(val);
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const numberInput = (value: number | string) => (value === 0 ? "" : value.toString());
const percent = (val: number) => `${(val * 100).toFixed(1)}%`;

export default function Home() {
  const [rows, setRows] = useState<SotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [uploads, setUploads] = useState<UploadLink[]>([]);
  const [metricStyle, setMetricStyle] = useState<"glass" | "neon" | "soft">("glass");
  const [enabledMetrics, setEnabledMetrics] = useState<string[]>([
    "profit",
    "roi",
    "sellthrough",
    "avgTicket",
    "paid",
    "shipping",
  ]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/sot");
        const json = await res.json();
        if (json.rows) setRows(json.rows);
      } catch (err) {
        console.error(err);
        setStatus("Unable to load CSV from vista-sot-master.csv");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.item.toLowerCase().includes(q) ||
        r.invoice.toLowerCase().includes(q) ||
        (r.marketplace ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, row) => {
        acc.paid += row.paidTotal;
        acc.sold += row.soldFor;
        acc.realized += Number(row.realizedProfit ?? 0);
        acc.fees += row.marketplaceFees;
        acc.shipping += row.shippingCost;
        return acc;
      },
      { paid: 0, sold: 0, realized: 0, fees: 0, shipping: 0 },
    );
  }, [filtered]);

  const soldLines = useMemo(() => filtered.filter((r) => r.soldFor > 0), [filtered]);

  const metrics = useMemo(() => {
    const roi = totals.paid === 0 ? 0 : totals.realized / totals.paid;
    const sellThrough = filtered.length === 0 ? 0 : soldLines.length / filtered.length;
    const avgTicket = soldLines.length === 0 ? 0 : totals.sold / soldLines.length;

    return [
      {
        id: "profit",
        label: "Realized Profit",
        value: `$${currency(totals.realized)}`,
        sub: `After fees & shipping`,
        tone: "warm",
      },
      {
        id: "sold",
        label: "Gross Sales",
        value: `$${currency(totals.sold)}`,
        sub: `${soldLines.length} paid lines`,
        tone: "cool",
      },
      {
        id: "paid",
        label: "Cash Outlay",
        value: `$${currency(totals.paid)}`,
        sub: `${filtered.length} active lines`,
        tone: "muted",
      },
      {
        id: "roi",
        label: "ROI vs Paid",
        value: percent(roi),
        sub: "Realized / Paid",
        tone: "warm",
      },
      {
        id: "sellthrough",
        label: "Sell-through",
        value: percent(sellThrough),
        sub: `${soldLines.length}/${filtered.length || 1} lines`,
        tone: "cool",
      },
      {
        id: "avgTicket",
        label: "Avg Ticket",
        value: `$${currency(avgTicket)}`,
        sub: "Per sold line",
        tone: "muted",
      },
      {
        id: "shipping",
        label: "Shipping Spend",
        value: `$${currency(totals.shipping)}`,
        sub: "Outbound postage",
        tone: "muted",
      },
      {
        id: "fees",
        label: "Marketplace Fees",
        value: `$${currency(totals.fees)}`,
        sub: "Platform charges",
        tone: "cool",
      },
    ];
  }, [filtered.length, soldLines, totals]);

  const updateRow = (idx: number, field: keyof SotRow, value: string) => {
    setRows((prev) =>
      prev.map((row, i) =>
        i === idx
          ? computeFinancials({
              ...row,
              [field]:
                field === "item" || field === "invoice" || field === "purchaseDate" || field === "marketplace"
                  ? value
                  : Number(value) || 0,
            })
          : row,
      ),
    );
  };

  const addRow = () => setRows((prev) => [computeFinancials({ ...emptyRow }), ...prev]);

  const importCsv = (file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed =
          results.data
            ?.map((r) => fromCsvRecord(r))
            .map((r) => computeFinancials(r))
            .filter((r) => r.item.trim() !== "") || [];
        setRows((prev) => [...parsed, ...prev]);
        setStatus(`Imported ${parsed.length} rows from ${file.name}`);
      },
      error: () => setStatus("Import failed"),
    });
  };

  const exportCsv = () => {
    const rowsForCsv = rows.map(toCsvRecord);
    const data = rowsForCsv.map((r) => CSV_HEADERS.map((h) => r[h] ?? ""));
    const csv = Papa.unparse({ fields: [...CSV_HEADERS], data });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vista-sot-master-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const uploadPdf = async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const json = await res.json();
    if (json.url) {
      setUploads((prev) => [{ name: json.name, url: json.url }, ...prev]);
      setStatus(`Saved ${json.name}`);
    } else {
      setStatus("PDF upload failed");
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-6 py-10">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-r from-white/5 via-white/2 to-white/5 p-6 shadow-lg shadow-black/30 backdrop-blur-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-sky-200/80">Vista Auctions</p>
            <h1 className="text-3xl font-semibold text-white">SOT Control Room</h1>
            <p className="text-sm text-slate-200/80">
              Import the latest CSV, edit fields, attach PDFs, and export a clean file.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={addRow}
              className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/25"
            >
              + New line
            </button>
            <button
              onClick={exportCsv}
              className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-slate-900 transition hover:opacity-90"
            >
              Export CSV
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-100">
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 transition hover:bg-white/10">
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => e.target.files && importCsv(e.target.files[0])}
            />
            Import CSV
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 transition hover:bg-white/10">
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => e.target.files && uploadPdf(e.target.files[0])}
            />
            Upload PDF
          </label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice, item, marketplace"
            className="w-full max-w-xs rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-200/70 outline-none focus:border-[var(--accent)]"
          />
          {status && <span className="rounded-xl bg-white/10 px-3 py-2 text-xs text-slate-50">{status}</span>}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-[var(--card)] p-5 shadow-inner shadow-black/25">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-sky-200/70">Metrics Studio</p>
            <h2 className="text-xl font-semibold text-white">Choose the vibe and focus</h2>
            <p className="text-sm text-slate-300">Toggle styles and the KPIs you want to see.</p>
          </div>
          <div className="flex gap-2">
            {[
              { id: "glass", label: "Glass" },
              { id: "neon", label: "Neon Grid" },
              { id: "soft", label: "Soft Cards" },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setMetricStyle(m.id as typeof metricStyle)}
                className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                  metricStyle === m.id
                    ? "bg-[var(--accent)] text-slate-900 shadow-[0_0_25px_rgba(123,214,247,0.35)]"
                    : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {metrics.map((m) => {
            const active = enabledMetrics.includes(m.id);
            return (
              <button
                key={m.id}
                onClick={() =>
                  setEnabledMetrics((prev) =>
                    prev.includes(m.id) ? prev.filter((p) => p !== m.id) : [...prev, m.id],
                  )
                }
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  active
                    ? "bg-white/20 text-white border border-white/10"
                    : "border border-white/10 text-slate-200 hover:bg-white/5"
                }`}
              >
                {active ? "✓ " : ""}{m.label}
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {metrics
            .filter((m) => enabledMetrics.includes(m.id))
            .map((m) => (
              <MetricCard key={m.id} metric={m} styleMode={metricStyle} />
            ))}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-[var(--card)] p-4 shadow-inner shadow-black/20">
        <header className="flex items-center justify-between gap-2 pb-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Lines ({filtered.length})</h2>
            {loading && <p className="text-xs text-slate-300">Loading data…</p>}
          </div>
          <p className="text-xs text-slate-300">Realized = Sold – Fees – Shipping – Paid</p>
        </header>
        <div className="overflow-auto rounded-2xl border border-white/10">
          <table className="min-w-full text-sm text-white/90">
            <thead className="bg-white/10 text-xs uppercase tracking-wide text-slate-200">
              <tr>
                {[
                  "Invoice",
                  "Item",
                  "Marketplace",
                  "Paid Total",
                  "Sold For",
                  "Fees",
                  "Shipping",
                  "Realized",
                  "Edit",
                ].map((h) => (
                  <th key={h} className="px-3 py-3 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, idx) => (
                <tr key={`${row.invoice}-${idx}`} className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-3 py-2">
                    <input
                      className="w-28 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs outline-none focus:border-[var(--accent)]"
                      value={row.invoice}
                      onChange={(e) => updateRow(idx, "invoice", e.target.value)}
                    />
                    <div className="text-[11px] text-slate-300">{row.purchaseDate}</div>
                  </td>
                  <td className="px-3 py-2">
                    <textarea
                      className="h-14 w-64 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs outline-none focus:border-[var(--accent)]"
                      value={row.item}
                      onChange={(e) => updateRow(idx, "item", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-24 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs outline-none focus:border-[var(--accent)]"
                      value={row.marketplace}
                      onChange={(e) => updateRow(idx, "marketplace", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      className="w-24 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs outline-none focus:border-[var(--accent)]"
                      value={numberInput(row.paidTotal)}
                      onChange={(e) => updateRow(idx, "paidTotal", e.target.value)}
                    />
                    <div className="text-[11px] text-slate-300">Tax {numberInput(row.tax)} | Lot {numberInput(row.lotFee)}</div>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      className="w-20 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs outline-none focus:border-[var(--accent)]"
                      value={numberInput(row.soldFor)}
                      onChange={(e) => updateRow(idx, "soldFor", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      className="w-20 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs outline-none focus:border-[var(--accent)]"
                      value={numberInput(row.marketplaceFees)}
                      onChange={(e) => updateRow(idx, "marketplaceFees", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      className="w-20 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs outline-none focus:border-[var(--accent)]"
                      value={numberInput(row.shippingCost)}
                      onChange={(e) => updateRow(idx, "shippingCost", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2 font-semibold text-[var(--accent-strong)]">
                    ${currency(row.realizedProfit)}
                  </td>
                  <td className="px-3 py-2 text-right text-[11px] text-slate-300">
                    ROI {row.realizedRoi === "" ? "—" : Number(row.realizedRoi).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-[var(--card)] p-4 shadow-inner shadow-black/20">
        <h3 className="text-lg font-semibold text-white">Uploaded PDFs</h3>
        {uploads.length === 0 && <p className="text-sm text-slate-300">No PDFs uploaded in this session yet.</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {uploads.map((u) => (
            <a
              key={u.url}
              href={u.url}
              target="_blank"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white transition hover:bg-white/10"
            >
              {u.name}
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}

function MetricCard({
  metric,
  styleMode,
}: {
  metric: { label: string; value: string; sub?: string; tone?: "warm" | "cool" | "muted" };
  styleMode: "glass" | "neon" | "soft";
}) {
  const tones: Record<string, { accent: string; glow: string }> = {
    warm: { accent: "from-amber-200/70 to-amber-400/40", glow: "shadow-[0_0_35px_rgba(251,191,36,0.25)]" },
    cool: { accent: "from-sky-200/70 to-cyan-400/30", glow: "shadow-[0_0_35px_rgba(123,214,247,0.3)]" },
    muted: { accent: "from-slate-200/50 to-slate-400/20", glow: "shadow-[0_0_30px_rgba(148,163,184,0.25)]" },
  };
  const tone = tones[metric.tone ?? "muted"];

  const base = "relative overflow-hidden rounded-2xl border p-4 transition duration-200";

  const styles: Record<typeof styleMode, string> = {
    glass: `border-white/15 bg-white/5 backdrop-blur-lg text-white ${tone.glow}`,
    neon: `border-white/5 bg-gradient-to-br from-slate-900/80 via-slate-800/80 to-slate-900/60 text-white shadow-[0_0_25px_rgba(0,0,0,0.5)]`,
    soft: `border-white/10 bg-gradient-to-br from-white/10 to-white/5 text-white`,
  };

  return (
    <div className={`${base} ${styles[styleMode]}`}>
      <div className={`absolute inset-0 opacity-60 blur-2xl bg-gradient-to-br ${tone.accent}`} />
      <div className="relative flex flex-col gap-1">
        <p className="text-xs uppercase tracking-[0.2em] text-white/70">{metric.label}</p>
        <p className="text-2xl font-semibold text-white drop-shadow-sm">{metric.value}</p>
        {metric.sub && <p className="text-xs text-slate-200/80">{metric.sub}</p>}
      </div>
    </div>
  );
}
