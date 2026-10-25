'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, type Pelanggan } from '@/lib/supabase'
import { formatRupiah } from '@/lib/utils'

type ChartView = 'annual' | 'quarterly'

const BULAN_FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const BULAN_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des']
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']

function formatCompact(val: number): string {
  if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)}M`
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}jt`
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}rb`
  return val > 0 ? String(val) : '0'
}

function encodePeriod(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}
function decodePeriod(val: string) {
  const [y, m] = val.split('-').map(Number)
  return { year: y, month: m }
}

type ChartItem = { label: string; omset: number; laba: number; margin: number }
type TooltipState = { visible: boolean; x: number; y: number; item: ChartItem | null }

type MonthlyItem = { label: string; curr: { omset: number; laba: number } }

function MonthlyBarChart({ data, selectedMonth }: { data: MonthlyItem[]; selectedMonth: number }) {
  const [hovIdx, setHovIdx] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const W = 560, H = 200
  const PAD = { top: 24, right: 40, bottom: 28, left: 52 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  const maxVal = Math.max(...data.map(d => d.curr.omset), 1)
  const n = data.length
  const groupW = chartW / n
  const barPad = groupW * 0.08
  const barW = (groupW - barPad * 2) / 2

  const yTicks = 4
  const yTickVals = Array.from({ length: yTicks + 1 }, (_, i) => (maxVal / yTicks) * i)

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const mx = (e.clientX - rect.left) * (W / rect.width) - PAD.left
    const idx = Math.floor(mx / groupW)
    if (idx >= 0 && idx < n) setHovIdx(idx)
    else setHovIdx(null)
  }

  return (
    <div className="w-full">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full block"
        style={{ minWidth: '280px' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHovIdx(null)}>
        {/* Grid + Y axis */}
        {yTickVals.map((v, i) => {
          const y = PAD.top + chartH - (v / maxVal) * chartH
          return (
            <g key={i}>
              <line x1={PAD.left} y1={y} x2={PAD.left + chartW} y2={y}
                stroke="#374151" strokeWidth="0.5" strokeDasharray="3,3" />
              <text x={PAD.left - 4} y={y + 3.5} textAnchor="end" fill="#6B7280" fontSize="8">
                {formatCompact(v)}
              </text>
            </g>
          )
        })}
        {/* Bars */}
        {data.map((d, i) => {
          const gx = PAD.left + i * groupW + barPad
          const omsetH = (d.curr.omset / maxVal) * chartH
          const labaH = (d.curr.laba / maxVal) * chartH
          const hov = hovIdx === i
          const isSel = i === selectedMonth
          return (
            <g key={i}>
              {/* Omset bar */}
              <rect x={gx} y={PAD.top + chartH - omsetH} width={barW} height={Math.max(omsetH, 0)}
                rx="2" fill={hov || isSel ? '#A855F7' : '#7C3AED'} opacity="0.9" />
              {/* Laba bar */}
              <rect x={gx + barW} y={PAD.top + chartH - labaH} width={barW} height={Math.max(labaH, 0)}
                rx="2" fill={hov || isSel ? '#60A5FA' : '#3B82F6'} opacity="0.85" />
              {/* Label omset */}
              {d.curr.omset > 0 && (
                <text x={gx + barW / 2} y={PAD.top + chartH - omsetH - 3}
                  textAnchor="middle" fill="#C4B5FD" fontSize="7.5" fontWeight="500">
                  {formatCompact(d.curr.omset)}
                </text>
              )}
              {/* Label laba */}
              {d.curr.laba > 0 && (
                <text x={gx + barW + barW / 2} y={PAD.top + chartH - labaH - 3}
                  textAnchor="middle" fill="#93C5FD" fontSize="7.5" fontWeight="500">
                  {formatCompact(d.curr.laba)}
                </text>
              )}
              {/* X label bulan */}
              <text x={gx + barW} y={PAD.top + chartH + 12}
                textAnchor="middle"
                fill={isSel ? '#A78BFA' : '#6B7280'}
                fontSize="9"
                fontWeight={isSel ? '600' : '400'}>
                {d.label}
              </text>
            </g>
          )
        })}
        {/* Tooltip */}
        {hovIdx !== null && data[hovIdx].curr.omset > 0 && (() => {
          const d = data[hovIdx]
          const gx = PAD.left + hovIdx * groupW + barPad
          const cx = gx + barW
          const tx = Math.min(Math.max(cx - 52, 2), W - 108)
          const ty = 4
          return (
            <g>
              <rect x={tx} y={ty} width={108} height={48} rx="6"
                fill="#1F2937" stroke="#374151" strokeWidth="0.8" />
              <text x={tx + 8} y={ty + 13} fill="#E5E7EB" fontSize="9" fontWeight="600">{d.label}</text>
              <rect x={tx + 8} y={ty + 19} width={6} height={6} rx="1" fill="#7C3AED" />
              <text x={tx + 18} y={ty + 25} fill="#C4B5FD" fontSize="8">Omset: {formatCompact(d.curr.omset)}</text>
              <rect x={tx + 8} y={ty + 32} width={6} height={6} rx="1" fill="#3B82F6" />
              <text x={tx + 18} y={ty + 38} fill="#93C5FD" fontSize="8">Laba: {formatCompact(d.curr.laba)}</text>
            </g>
          )
        })()}
      </svg>
    </div>
  )
}

function DoubleBarChart({ data }: { data: ChartItem[] }) {
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, item: null })
  const svgRef = useRef<SVGSVGElement>(null)

  const W = 560, H = 200
  const PAD = { top: 24, right: 52, bottom: 28, left: 44 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  const maxOmset = Math.max(...data.map(d => d.omset), 1)
  const maxMargin = Math.max(...data.map(d => d.margin), 1)
  const n = data.length
  const groupW = chartW / n
  const barPad = groupW * 0.15
  const barW = (groupW - barPad * 2) / 2

  const yTicks = 4
  const yTickVals = Array.from({ length: yTicks + 1 }, (_, i) => (maxOmset / yTicks) * i)
  const maxMarginCeil = Math.ceil(maxMargin / 5) * 5 || 100
  const yTickMargin = Array.from({ length: yTicks + 1 }, (_, i) => (maxMarginCeil / yTicks) * i)

  const marginPoints = data.map((d, i) => {
    const cx = PAD.left + i * groupW + groupW / 2
    const cy = PAD.top + chartH - (d.margin / maxMarginCeil) * chartH
    return `${cx},${cy}`
  })
  const linePath = `M ${marginPoints.join(' L ')}`

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const mx = (e.clientX - rect.left) * (W / rect.width) - PAD.left
    const idx = Math.floor(mx / groupW)
    if (idx >= 0 && idx < data.length) {
      const cx = PAD.left + idx * groupW + groupW / 2
      const cy = PAD.top + chartH - (data[idx].margin / maxMarginCeil) * chartH
      setTooltip({ visible: true, x: cx, y: cy, item: data[idx] })
    }
  }

  return (
    <div className="w-full">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full block"
        style={{ minWidth: '280px' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(t => ({ ...t, visible: false }))}>
        {/* Grid + Y axis kiri */}
        {yTickVals.map((v, i) => {
          const y = PAD.top + chartH - (v / maxOmset) * chartH
          return (
            <g key={i}>
              <line x1={PAD.left} y1={y} x2={PAD.left + chartW} y2={y}
                stroke="#374151" strokeWidth="0.5" strokeDasharray="3,3" />
              <text x={PAD.left - 4} y={y + 3.5} textAnchor="end" fill="#6B7280" fontSize="8">
                {formatCompact(v)}
              </text>
            </g>
          )
        })}
        {/* Y axis kanan — margin */}
        {yTickMargin.map((v, i) => {
          const y = PAD.top + chartH - (v / maxMarginCeil) * chartH
          return (
            <text key={i} x={PAD.left + chartW + 4} y={y + 3.5} textAnchor="start" fill="#10B981" fontSize="8">
              {v.toFixed(0)}%
            </text>
          )
        })}
        {/* Bars */}
        {data.map((d, i) => {
          const gx = PAD.left + i * groupW + barPad
          const omsetH = (d.omset / maxOmset) * chartH
          const labaH = (d.laba / maxOmset) * chartH
          const hov = tooltip.visible && tooltip.item?.label === d.label
          return (
            <g key={i}>
              <rect x={gx} y={PAD.top + chartH - omsetH} width={barW} height={Math.max(omsetH, 0)}
                rx="2" fill={hov ? '#A855F7' : '#7C3AED'} opacity="0.9" />
              <rect x={gx + barW} y={PAD.top + chartH - labaH} width={barW} height={Math.max(labaH, 0)}
                rx="2" fill={hov ? '#60A5FA' : '#3B82F6'} opacity="0.85" />
              {d.omset > 0 && (
                <text x={gx + barW / 2} y={PAD.top + chartH - omsetH - 3}
                  textAnchor="middle" fill="#C4B5FD" fontSize="7.5" fontWeight="500">
                  {formatCompact(d.omset)}
                </text>
              )}
              {d.laba > 0 && (
                <text x={gx + barW + barW / 2} y={PAD.top + chartH - labaH - 3}
                  textAnchor="middle" fill="#93C5FD" fontSize="7.5" fontWeight="500">
                  {formatCompact(d.laba)}
                </text>
              )}
              <text x={gx + barW} y={PAD.top + chartH + 12}
                textAnchor="middle" fill="#9CA3AF" fontSize="9">{d.label}</text>
            </g>
          )
        })}
        {/* Net margin line */}
        {data.length > 1 && (
          <path d={linePath} fill="none" stroke="#34D399" strokeWidth="1.5"
            strokeLinejoin="round" strokeLinecap="round" />
        )}
        {data.map((d, i) => {
          const cx = PAD.left + i * groupW + groupW / 2
          const cy = PAD.top + chartH - (d.margin / maxMarginCeil) * chartH
          const hov = tooltip.visible && tooltip.item?.label === d.label
          return (
            <circle key={i} cx={cx} cy={cy} r={hov ? 4 : 2.5}
              fill={hov ? '#34D399' : '#065F46'} stroke="#34D399" strokeWidth="1.5" />
          )
        })}
        {/* Tooltip */}
        {tooltip.visible && tooltip.item && (() => {
          const item = tooltip.item!
          const tx = Math.min(Math.max(tooltip.x - 52, 2), W - 112)
          const ty = Math.max(tooltip.y - 68, 4)
          return (
            <g>
              <rect x={tx} y={ty} width={112} height={62} rx="6"
                fill="#1F2937" stroke="#374151" strokeWidth="0.8" />
              <text x={tx + 8} y={ty + 14} fill="#E5E7EB" fontSize="9" fontWeight="600">{item.label}</text>
              <rect x={tx + 8} y={ty + 20} width={6} height={6} rx="1" fill="#7C3AED" />
              <text x={tx + 18} y={ty + 26} fill="#C4B5FD" fontSize="8">Omset: {formatCompact(item.omset)}</text>
              <rect x={tx + 8} y={ty + 33} width={6} height={6} rx="1" fill="#3B82F6" />
              <text x={tx + 18} y={ty + 39} fill="#93C5FD" fontSize="8">Laba: {formatCompact(item.laba)}</text>
              <circle cx={tx + 11} cy={ty + 49} r="3" fill="#34D399" />
              <text x={tx + 18} y={ty + 52} fill="#34D399" fontSize="8">Margin: {item.margin.toFixed(1)}%</text>
            </g>
          )
        })()}
      </svg>
    </div>
  )
}

export default function LaporanPage() {
  const [transaksi, setTransaksi] = useState<Pelanggan[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null)
  const [chartView, setChartView] = useState<ChartView>('annual')
  const [chartYear, setChartYear] = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('pelanggan')
      .select('*, ps_units(*), karyawan(*)')
      .order('created_at', { ascending: true })
    if (data) setTransaksi(data as Pelanggan[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Set periode default ke bulan ini — hanya di client setelah mount
  useEffect(() => {
    const now = new Date()
    setSelectedPeriod(encodePeriod(now.getFullYear(), now.getMonth()))
  }, [])

  // Dropdown: bulan yang ada data + bulan saat ini, desc (terbaru di atas)
  const periodOptions = (() => {
    const keys = new Set<string>()
    if (selectedPeriod) keys.add(selectedPeriod)
    transaksi.forEach(t => {
      const d = new Date(t.created_at)
      keys.add(encodePeriod(d.getFullYear(), d.getMonth()))
    })
    return [...keys].sort((a, b) => b.localeCompare(a))
  })()

  const activePeriod = selectedPeriod ?? periodOptions[0] ?? null
  const { year: selectedYear, month: selectedMonth } = activePeriod
    ? decodePeriod(activePeriod)
    : { year: 0, month: 0 }

  // chartYear default ke selectedYear kalau belum pernah dipilih manual
  const activeChartYear = chartYear ?? selectedYear

  // Set chartYear default ke selectedYear setelah data tersedia
  useEffect(() => {
    if (chartYear === null && selectedPeriod) {
      const { year } = decodePeriod(selectedPeriod)
      setChartYear(year)
    }
  }, [selectedPeriod, chartYear])
  // Summary: transaksi bulan yang dipilih
  const filtered = transaksi.filter(t => {
    const d = new Date(t.created_at)
    return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth
  })
  const omset = filtered.reduce((s, t) => s + t.total, 0)
  const komisi = filtered.reduce((s, t) => s + (t.karyawan ? (t.total * t.karyawan.komisi_persen) / 100 : 0), 0)
  const labaBersih = omset - komisi

  // Income Statement — Annual: 5 tahun terakhir dari tahun dipilih
  const last5Years = Array.from({ length: 5 }, (_, i) => selectedYear - 4 + i)
  const annualData: ChartItem[] = last5Years.map(year => {
    const items = transaksi.filter(t => new Date(t.created_at).getFullYear() === year)
    const total = items.reduce((s, t) => s + t.total, 0)
    const k = items.reduce((s, t) => s + (t.karyawan ? (t.total * t.karyawan.komisi_persen) / 100 : 0), 0)
    const laba = total - k
    return { label: String(year), omset: total, laba, margin: total > 0 ? (laba / total) * 100 : 0 }
  })

  // Income Statement — Quarterly: Q1–Q4 tahun dipilih
  const quarterlyData: ChartItem[] = QUARTERS.map((q, qi) => {
    const start = qi * 3
    const items = transaksi.filter(t => {
      const d = new Date(t.created_at)
      return d.getFullYear() === selectedYear && d.getMonth() >= start && d.getMonth() < start + 3
    })
    const total = items.reduce((s, t) => s + t.total, 0)
    const k = items.reduce((s, t) => s + (t.karyawan ? (t.total * t.karyawan.komisi_persen) / 100 : 0), 0)
    const laba = total - k
    return { label: q, omset: total, laba, margin: total > 0 ? (laba / total) * 100 : 0 }
  })

  const stockbitData = chartView === 'annual' ? annualData : quarterlyData

  // Tahun yang ada datanya (untuk dropdown chart bulanan)
  const availableYears = [...new Set(transaksi.map(t => new Date(t.created_at).getFullYear()))]
    .sort((a, b) => b - a)
  if (!availableYears.includes(selectedYear)) availableYears.unshift(selectedYear)

  // Bar chart 12 bulan — pakai activeChartYear (independen dari dropdown periode)
  const dataPerBulan = Array.from({ length: 12 }, (_, i) => {
    const items = transaksi.filter(t => {
      const d = new Date(t.created_at)
      return d.getFullYear() === activeChartYear && d.getMonth() === i
    })
    const total = items.reduce((s, t) => s + t.total, 0)
    const k = items.reduce((s, t) => s + (t.karyawan ? (t.total * t.karyawan.komisi_persen) / 100 : 0), 0)
    return {
      label: BULAN_SHORT[i],
      curr: { omset: total, laba: total - k },
    }
  })
  const maxVal = Math.max(...dataPerBulan.map(d => d.curr.omset), 1)

  const perPS = filtered.reduce((acc, t) => {
    const nama = t.ps_units?.nama ?? 'Unknown'
    if (!acc[nama]) acc[nama] = { count: 0, total: 0 }
    acc[nama].count++
    acc[nama].total += t.total
    return acc
  }, {} as Record<string, { count: number; total: number }>)

  const qrisTotal = filtered.filter(t => t.metode_bayar === 'qris').reduce((s, t) => s + t.total, 0)
  const cashTotal = filtered.filter(t => t.metode_bayar === 'cash').reduce((s, t) => s + t.total, 0)

  // Belum mount di client — jangan render sampai periode tersedia
  if (!activePeriod) return null

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header + Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Laporan Keuangan</h1>
          <p className="text-gray-400 text-sm mt-0.5">Tracking omset, laba, dan perkembangan bisnis</p>
        </div>
        {/* Satu dropdown periode: "Oktober 2026", "September 2026", dst */}
        <select
          value={activePeriod}
          onChange={e => setSelectedPeriod(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500 cursor-pointer min-w-[170px]"
        >
          {periodOptions.map(p => {
            const { year, month } = decodePeriod(p)
            return <option key={p} value={p}>{BULAN_FULL[month]} {year}</option>
          })}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {/* Income Statement (kiri) + Summary cards (kanan) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-gray-900 border border-gray-700 rounded-2xl p-4 md:p-5">
              <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                <h2 className="text-white font-semibold text-sm md:text-base">Income Statement</h2>
                <div className="flex bg-gray-800 border border-gray-700 rounded-lg overflow-hidden text-xs">
                  <button onClick={() => setChartView('annual')}
                    className={`px-3 py-1.5 font-medium transition-colors ${chartView === 'annual' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>
                    Annual
                  </button>
                  <button onClick={() => setChartView('quarterly')}
                    className={`px-3 py-1.5 font-medium transition-colors ${chartView === 'quarterly' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>
                    Quarterly
                  </button>
                </div>
              </div>
              <p className="text-gray-500 text-xs mb-4">
                {chartView === 'quarterly' ? `Q1–Q4 ${selectedYear}` : `${last5Years[0]} – ${last5Years[4]}`}
              </p>
              <DoubleBarChart data={stockbitData} />
              <div className="flex items-center gap-4 mt-2 pt-3 border-t border-gray-800 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="w-8 h-2 rounded bg-purple-700 inline-block" />
                  <span className="text-gray-400 text-xs">Omset</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-8 h-2 rounded bg-blue-500 inline-block" />
                  <span className="text-gray-400 text-xs">Laba Bersih</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <svg width="24" height="10" viewBox="0 0 24 10">
                    <line x1="0" y1="5" x2="24" y2="5" stroke="#34D399" strokeWidth="1.5" />
                    <circle cx="12" cy="5" r="2.5" fill="#34D399" />
                  </svg>
                  <span className="text-green-400 text-xs">Net Margin</span>
                </div>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="flex flex-col gap-3">
              {[
                { label: 'Transaksi', value: `${filtered.length}x`, color: 'text-blue-400', bg: 'bg-blue-900/20 border-blue-800', icon: '📋', sub: 'Total sesi' },
                { label: 'Omset', value: formatRupiah(omset), color: 'text-purple-400', bg: 'bg-purple-900/20 border-purple-800', icon: '💰', sub: 'Pendapatan kotor' },
                { label: 'Komisi', value: formatRupiah(komisi), color: 'text-yellow-400', bg: 'bg-yellow-900/20 border-yellow-800', icon: '👤', sub: 'Biaya karyawan' },
                { label: 'Laba Bersih', value: formatRupiah(labaBersih), color: 'text-green-400', bg: 'bg-green-900/20 border-green-800', icon: '📈', sub: `Margin ${omset > 0 ? ((labaBersih / omset) * 100).toFixed(1) : '0'}%` },
              ].map(s => (
                <div key={s.label} className={`${s.bg} border rounded-2xl p-3 md:p-4 flex-1`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span>{s.icon}</span>
                    <p className="text-gray-400 text-xs">{s.label}</p>
                  </div>
                  <p className={`text-base md:text-lg font-bold ${s.color} truncate`}>{s.value}</p>
                  <p className="text-gray-600 text-[10px] mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bar chart 12 bulan — double bar per bulan gaya Income Statement */}
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 md:p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              {/* Dropdown tahun sebagai judul */}
              <select
                value={activeChartYear}
                onChange={e => setChartYear(parseInt(e.target.value))}
                className="bg-transparent text-white font-semibold text-sm md:text-base focus:outline-none cursor-pointer border-none appearance-none pr-5 bg-no-repeat"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundPosition: 'right 2px center' }}
              >
                {availableYears.map(y => (
                  <option key={y} value={y} className="bg-gray-800">{y}</option>
                ))}
              </select>
              {/* Legend */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-8 h-2 rounded bg-purple-700 inline-block" />
                  <span className="text-gray-400 text-xs">Omset</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-8 h-2 rounded bg-blue-500 inline-block" />
                  <span className="text-gray-400 text-xs">Laba Bersih</span>
                </div>
              </div>
            </div>

            {/* Double bar SVG — sama persis dengan Income Statement */}
            <MonthlyBarChart data={dataPerBulan} selectedMonth={selectedMonth} />
          </div>

          {/* Omset per PS + Metode Bayar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 md:p-5">
              <h2 className="text-white font-semibold mb-3 text-sm md:text-base">Omset per PS</h2>
              {Object.keys(perPS).length === 0 ? (
                <p className="text-gray-500 text-sm">Tidak ada data</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(perPS).sort((a, b) => b[1].total - a[1].total).map(([nama, data]) => (
                    <div key={nama}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-white">{nama}</span>
                        <span className="text-gray-400 text-xs">{data.count}x · {formatRupiah(data.total)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full">
                        <div className="h-1.5 bg-purple-500 rounded-full"
                          style={{ width: `${omset > 0 ? (data.total / omset) * 100 : 0}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 md:p-5">
              <h2 className="text-white font-semibold mb-3 text-sm md:text-base">Metode Pembayaran</h2>
              {omset === 0 ? (
                <p className="text-gray-500 text-sm">Tidak ada data</p>
              ) : (
                <div className="space-y-3">
                  {[
                    { label: 'QRIS', value: qrisTotal, color: 'bg-blue-500' },
                    { label: 'Cash', value: cashTotal, color: 'bg-yellow-500' },
                  ].map(m => {
                    const pct = omset > 0 ? (m.value / omset) * 100 : 0
                    return (
                      <div key={m.label}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-white">{m.label}</span>
                          <span className="text-gray-400 text-xs">{pct.toFixed(1)}% · {formatRupiah(m.value)}</span>
                        </div>
                        <div className="h-1.5 bg-gray-800 rounded-full">
                          <div className={`h-1.5 ${m.color} rounded-full`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Tabel transaksi */}
          <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
            <div className="p-4 md:p-5 border-b border-gray-700">
              <h2 className="text-white font-semibold text-sm md:text-base">
                Detail Transaksi — {BULAN_FULL[selectedMonth]} {selectedYear} ({filtered.length})
              </h2>
            </div>
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-sm">Tidak ada transaksi pada periode ini</div>
            ) : (
              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-xs md:text-sm">
                  <thead className="sticky top-0 bg-gray-800">
                    <tr>
                      {['Tanggal', 'Pelanggan', 'PS', 'Total', 'Komisi', 'Laba', 'Bayar'].map(h => (
                        <th key={h} className="text-left px-3 md:px-4 py-3 text-gray-400 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t, i) => {
                      const k = t.karyawan ? (t.total * t.karyawan.komisi_persen) / 100 : 0
                      return (
                        <tr key={t.id} className={`border-b border-gray-800 hover:bg-gray-800/30 ${i % 2 === 0 ? '' : 'bg-gray-800/10'}`}>
                          <td className="px-3 md:px-4 py-2.5 text-gray-400 whitespace-nowrap">
                            {new Date(t.created_at).toLocaleDateString('id-ID')}
                          </td>
                          <td className="px-3 md:px-4 py-2.5 text-white">{t.nama}</td>
                          <td className="px-3 md:px-4 py-2.5 text-purple-400">{t.ps_units?.nama}</td>
                          <td className="px-3 md:px-4 py-2.5 text-white font-medium whitespace-nowrap">{formatRupiah(t.total)}</td>
                          <td className="px-3 md:px-4 py-2.5 text-yellow-400 whitespace-nowrap">{formatRupiah(k)}</td>
                          <td className="px-3 md:px-4 py-2.5 text-green-400 font-medium whitespace-nowrap">{formatRupiah(t.total - k)}</td>
                          <td className="px-3 md:px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded text-xs ${t.metode_bayar === 'qris' ? 'bg-blue-900/50 text-blue-400' : 'bg-yellow-900/50 text-yellow-400'}`}>
                              {t.metode_bayar.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
