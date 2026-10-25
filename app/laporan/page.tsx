'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, type Pelanggan } from '@/lib/supabase'
import { formatRupiah } from '@/lib/utils'

type FilterMode = 'bulanan' | 'tahunan'

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des']
const BULAN_FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

export default function LaporanPage() {
  const [transaksi, setTransaksi] = useState<Pelanggan[]>([])
  const [loading, setLoading] = useState(true)
  const [filterMode, setFilterMode] = useState<FilterMode>('bulanan')
  // Fix: pakai null dulu, set di useEffect biar tidak prerender dengan new Date()
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)

  // Set tanggal hanya di client side
  useEffect(() => {
    const now = new Date()
    setSelectedYear(now.getFullYear())
    setSelectedMonth(now.getMonth())
  }, [])

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

  const getFilteredTransaksi = useCallback(() => {
    if (selectedYear === null || selectedMonth === null) return []
    return transaksi.filter((t) => {
      const d = new Date(t.created_at)
      if (filterMode === 'bulanan') {
        return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth
      }
      return d.getFullYear() === selectedYear
    })
  }, [transaksi, filterMode, selectedYear, selectedMonth])

  const filtered = getFilteredTransaksi()
  const omset = filtered.reduce((sum, t) => sum + t.total, 0)
  const komisi = filtered.reduce((sum, t) => sum + (t.karyawan ? (t.total * t.karyawan.komisi_persen) / 100 : 0), 0)
  const labaBersih = omset - komisi

  const dataPerBulan = Array.from({ length: 12 }, (_, i) => {
    const items = transaksi.filter((t) => {
      const d = new Date(t.created_at)
      return selectedYear !== null && d.getFullYear() === selectedYear && d.getMonth() === i
    })
    const total = items.reduce((s, t) => s + t.total, 0)
    const k = items.reduce((s, t) => s + (t.karyawan ? (t.total * t.karyawan.komisi_persen) / 100 : 0), 0)
    return { bulan: BULAN[i], total, laba: total - k, count: items.length }
  })

  const availableYears = [...new Set([
    ...transaksi.map((t) => new Date(t.created_at).getFullYear()),
    ...(selectedYear ? [selectedYear] : []),
  ])].sort((a, b) => b - a)

  const dataPerTahun = availableYears.map((year) => {
    const items = transaksi.filter((t) => new Date(t.created_at).getFullYear() === year)
    const total = items.reduce((s, t) => s + t.total, 0)
    const k = items.reduce((s, t) => s + (t.karyawan ? (t.total * t.karyawan.komisi_persen) / 100 : 0), 0)
    return { tahun: year, total, laba: total - k, count: items.length }
  })

  const chartData = filterMode === 'bulanan' ? dataPerBulan : dataPerTahun
  const maxVal = Math.max(...chartData.map((d) => d.total), 1)

  const perPS = filtered.reduce((acc, t) => {
    const nama = t.ps_units?.nama ?? 'Unknown'
    if (!acc[nama]) acc[nama] = { count: 0, total: 0 }
    acc[nama].count++
    acc[nama].total += t.total
    return acc
  }, {} as Record<string, { count: number; total: number }>)

  const qrisTotal = filtered.filter(t => t.metode_bayar === 'qris').reduce((s, t) => s + t.total, 0)
  const cashTotal = filtered.filter(t => t.metode_bayar === 'cash').reduce((s, t) => s + t.total, 0)

  if (selectedYear === null) return null

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header + Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Laporan Keuangan</h1>
          <p className="text-gray-400 text-sm mt-0.5">Tracking omset, laba, dan perkembangan bisnis</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-gray-800 rounded-xl p-1">
            {(['bulanan', 'tahunan'] as FilterMode[]).map((m) => (
              <button key={m} onClick={() => setFilterMode(m)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${filterMode === m ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                {m}
              </button>
            ))}
          </div>
          {filterMode === 'bulanan' && selectedMonth !== null && (
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="bg-gray-800 border border-gray-600 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-500">
              {BULAN_FULL.map((b, i) => <option key={i} value={i}>{b}</option>)}
            </select>
          )}
          <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="bg-gray-800 border border-gray-600 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-500">
            {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Transaksi', value: `${filtered.length}x`, color: 'text-blue-400', bg: 'bg-blue-900/20 border-blue-800', icon: '📋' },
              { label: 'Omset', value: formatRupiah(omset), color: 'text-green-400', bg: 'bg-green-900/20 border-green-800', icon: '💰' },
              { label: 'Komisi', value: formatRupiah(komisi), color: 'text-yellow-400', bg: 'bg-yellow-900/20 border-yellow-800', icon: '👤' },
              { label: 'Laba Bersih', value: formatRupiah(labaBersih), color: 'text-purple-400', bg: 'bg-purple-900/20 border-purple-800', icon: '📈' },
            ].map((s) => (
              <div key={s.label} className={`${s.bg} border rounded-2xl p-3 md:p-4`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span>{s.icon}</span>
                  <p className="text-gray-400 text-xs">{s.label}</p>
                </div>
                <p className={`text-base md:text-xl font-bold ${s.color} truncate`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 md:p-6">
            <h2 className="text-white font-semibold mb-4 text-sm md:text-base">
              {filterMode === 'bulanan' ? `Per Bulan — ${selectedYear}` : 'Per Tahun'}
            </h2>
            <div className="flex items-end gap-1 md:gap-2 h-40 overflow-x-auto pb-2">
              {chartData.map((d, i) => {
                const height = (d.total / maxVal) * 100
                const label = filterMode === 'bulanan'
                  ? (d as typeof dataPerBulan[0]).bulan
                  : String((d as typeof dataPerTahun[0]).tahun)
                const isSelected = filterMode === 'bulanan'
                  ? i === selectedMonth
                  : (d as typeof dataPerTahun[0]).tahun === selectedYear
                return (
                  <div key={i} className="flex flex-col items-center gap-1 flex-1 min-w-[28px] md:min-w-[36px]">
                    {d.count > 0 && <span className="text-gray-500 text-[10px]">{d.count}</span>}
                    <div className="w-full flex flex-col justify-end" style={{ height: '120px' }}>
                      <div
                        className={`w-full rounded-t-md transition-all duration-300 ${isSelected ? 'bg-purple-500' : 'bg-gray-700 hover:bg-gray-500'}`}
                        style={{ height: `${Math.max(height, d.total > 0 ? 4 : 0)}%` }}
                        title={formatRupiah(d.total)}
                      />
                    </div>
                    <span className={`text-[10px] md:text-xs ${isSelected ? 'text-purple-400 font-medium' : 'text-gray-500'}`}>{label}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Per PS */}
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
                        <div className="h-1.5 bg-purple-500 rounded-full" style={{ width: `${omset > 0 ? (data.total / omset) * 100 : 0}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Metode Bayar */}
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 md:p-5">
              <h2 className="text-white font-semibold mb-3 text-sm md:text-base">Metode Pembayaran</h2>
              {omset === 0 ? (
                <p className="text-gray-500 text-sm">Tidak ada data</p>
              ) : (
                <div className="space-y-3">
                  {[
                    { label: 'QRIS', value: qrisTotal, color: 'bg-blue-500' },
                    { label: 'Cash', value: cashTotal, color: 'bg-yellow-500' },
                  ].map((m) => {
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
            <div className="p-4 md:p-5 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-white font-semibold text-sm md:text-base">Detail Transaksi ({filtered.length})</h2>
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
                          <td className="px-3 md:px-4 py-2.5 text-gray-400 whitespace-nowrap">{new Date(t.created_at).toLocaleDateString('id-ID')}</td>
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
