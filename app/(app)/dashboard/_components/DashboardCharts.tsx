"use client";

/**
 * ============================================================================
 * KOMPONEN GRAFIK DASHBOARD (DASHBOARD CHARTS)
 * ============================================================================
 * 
 * Komponen interaktif sisi klien (Client Component) untuk visualisasi analitik bisnis:
 * 1. Grafik Batang (Bar Chart): Membandingkan Pendapatan (Revenue) vs Beban (Expense)
 *    selama 12 bulan terakhir dengan interaksi hover tooltip berbasis SVG dinamis.
 * 2. Grafik Donat (Donut Chart): Menampilkan komposisi dan proporsi biaya operasional
 *    (HPP, Gaji, Sewa, Pemasaran, Utilitas, dsb.) dengan kalkulasi persentase otomatis.
 * ============================================================================
 */

import { useState } from "react";

type BarData = {
  month: string;
  rev: number;
  exp: number;
};

const DEFAULT_MONTHS: BarData[] = [
  { month: "Nov", rev: 385, exp: 352 },
  { month: "Des", rev: 412, exp: 371 },
  { month: "Jan", rev: 398, exp: 366 },
  { month: "Feb", rev: 376, exp: 348 },
  { month: "Mar", rev: 421, exp: 382 },
  { month: "Apr", rev: 405, exp: 371 },
  { month: "Mei", rev: 438, exp: 395 },
  { month: "Jun", rev: 452, exp: 402 },
  { month: "Jul", rev: 461, exp: 415 },
  { month: "Agu", rev: 447, exp: 408 },
  { month: "Sep", rev: 469, exp: 424 },
  { month: "Okt", rev: 486.5, exp: 445.25 },
];

const DEFAULT_DONUT = [
  { label: "Harga Pokok Penjualan", val: 302.4, color: "#2ED3B7" },
  { label: "Gaji & Tunjangan", val: 98.65, color: "#4CC9D8" },
  { label: "Sewa Kantor & Gudang", val: 15.0, color: "#7BD8AE" },
  { label: "Pemasaran & Iklan", val: 13.85, color: "#F2C14E" },
  { label: "Listrik, Air & Internet", val: 9.35, color: "#A5E8CE" },
  { label: "Transportasi & BBM", val: 6.0, color: "#BFE3D2" },
];

function formatJt(v: number) {
  return "Rp " + v.toFixed(2).replace(".", ",") + " jt";
}

export function DashboardCharts({
  data = DEFAULT_MONTHS,
  donut = DEFAULT_DONUT,
}: {
  data?: BarData[];
  donut?: typeof DEFAULT_DONUT;
}) {
  const [activeTooltip, setActiveTooltip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

  // Bar Chart SVG dimensions
  const W = 620;
  const H = 280;
  const pl = 38;
  const pr = 12;
  const pt = 20;
  const pb = 32;
  const max = 520;
  const cw = (W - pl - pr) / data.length;
  const bw = Math.max(6, Math.min(18, cw * 0.32));

  // Donut Chart calculations
  const donutTotal = donut.reduce((a, d) => a + d.val, 0);
  const R = 62;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="dash-grid">
      {/* Kartu Pendapatan vs Beban */}
      <div className="card">
        <div className="card-head">
          <div>
            <h3>Pendapatan vs Beban</h3>
            <p>12 bulan terakhir · dalam juta Rupiah</p>
          </div>
          <div className="spacer" />
          <div className="legend">
            <span>
              <i style={{ background: "var(--accent)" }} />
              Pendapatan
            </span>
            <span>
              <i style={{ background: "#A79BF2" }} />
              Beban
            </span>
          </div>
        </div>

        <div className="chart-box">
          {activeTooltip && (
            <div
              className="chart-tip"
              style={{
                opacity: 1,
                left: `${activeTooltip.x}px`,
                top: `${activeTooltip.y}px`,
              }}
            >
              {activeTooltip.text}
            </div>
          )}

          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            role="img"
            aria-label="Grafik batang pendapatan versus beban 12 bulan"
          >
            {/* Grid lines */}
            {[0, 1, 2, 3, 4].map((g) => {
              const v = g * 130;
              const y = pt + (H - pt - pb) * (1 - v / max);
              return (
                <g key={g}>
                  <line
                    x1={pl}
                    y1={y}
                    x2={W - pr}
                    y2={y}
                    stroke="var(--line)"
                    strokeWidth="1"
                  />
                  <text
                    x={pl - 7}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="11"
                    fill="var(--muted)"
                  >
                    {v}
                  </text>
                </g>
              );
            })}

            {/* Bars & Labels */}
            {data.map((d, i) => {
              const cx = pl + cw * i + cw / 2;
              const rh = (H - pt - pb) * (d.rev / max);
              const eh = (H - pt - pb) * (d.exp / max);
              const base = H - pb;

              return (
                <g key={d.month}>
                  {/* Revenue Bar */}
                  <rect
                    x={cx - bw - 2}
                    y={base - rh}
                    width={bw}
                    height={rh}
                    rx="3"
                    fill="var(--accent)"
                    className="cursor-pointer transition-opacity hover:opacity-80"
                    onPointerEnter={(e) => {
                      const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                      const x = e.clientX - (rect?.left ?? 0);
                      const y = e.clientY - (rect?.top ?? 0) - 20;
                      setActiveTooltip({
                        text: `${d.month} — Pendapatan ${formatJt(d.rev)} · Beban ${formatJt(d.exp)} · Laba ${formatJt(d.rev - d.exp)}`,
                        x: Math.max(10, Math.min(x, W - 240)),
                        y: Math.max(10, y),
                      });
                    }}
                    onPointerLeave={() => setActiveTooltip(null)}
                  />

                  {/* Expense Bar */}
                  <rect
                    x={cx + 2}
                    y={base - eh}
                    width={bw}
                    height={eh}
                    rx="3"
                    fill="#A79BF2"
                    className="cursor-pointer transition-opacity hover:opacity-80"
                    onPointerEnter={(e) => {
                      const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                      const x = e.clientX - (rect?.left ?? 0);
                      const y = e.clientY - (rect?.top ?? 0) - 20;
                      setActiveTooltip({
                        text: `${d.month} — Pendapatan ${formatJt(d.rev)} · Beban ${formatJt(d.exp)} · Laba ${formatJt(d.rev - d.exp)}`,
                        x: Math.max(10, Math.min(x, W - 240)),
                        y: Math.max(10, y),
                      });
                    }}
                    onPointerLeave={() => setActiveTooltip(null)}
                  />

                  {/* Month Label */}
                  <text
                    x={cx}
                    y={H - 10}
                    textAnchor="middle"
                    fontSize="10.5"
                    fill="var(--muted)"
                  >
                    {d.month}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Kartu Komposisi Beban */}
      <div className="card">
        <div className="card-head">
          <div>
            <h3>Komposisi Beban</h3>
            <p>Oktober 2026 · total {formatJt(donutTotal)}</p>
          </div>
        </div>

        <div className="donut-wrap">
          <div className="shrink-0 flex justify-center py-2">
            <svg
              width="156"
              height="156"
              viewBox="0 0 180 180"
              role="img"
              aria-label="Donat komposisi beban"
            >
              {donut.map((item, idx) => {
                const frac = item.val / donutTotal;
                const strokeDasharray = `${frac * C - 3} ${C}`;
                const strokeDashoffset = -offset * C;
                offset += frac;

                return (
                  <circle
                    key={idx}
                    cx="90"
                    cy="90"
                    r={R}
                    fill="none"
                    stroke={item.color}
                    strokeWidth="26"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    transform="rotate(-90 90 90)"
                  >
                    <title>
                      {item.label}: {formatJt(item.val)}
                    </title>
                  </circle>
                );
              })}
              <text x="90" y="84" textAnchor="middle" fontSize="12" fill="var(--muted)">
                Total Beban
              </text>
              <text
                x="90"
                y="106"
                textAnchor="middle"
                fontSize="16"
                fontWeight="800"
                fill="var(--ink)"
              >
                {formatJt(donutTotal)}
              </text>
            </svg>
          </div>

          <div className="donut-legend">
            {donut.map((d, i) => (
              <div key={i} className="dl-row">
                <i style={{ background: d.color }} />
                <span className="dl-name">{d.label}</span>
                <b>{formatJt(d.val)}</b>
                <span className="dl-pct">
                  {((d.val / donutTotal) * 100).toFixed(1).replace(".", ",")}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

