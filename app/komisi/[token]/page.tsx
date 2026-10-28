'use client'

import { useState, useEffect, use } from 'react'
import { supabase, type Karyawan, type Pelanggan } from '@/lib/supabase'
import { formatRupiah, formatDateTime } from '@/lib/utils'

export const dynamic = 'force-dynamic'

type FilterPendapatan = 'hari_ini' | 'minggu_ini' | 'bulan_ini' | 'semua'
const filterLabel: Record<FilterPendapatan, string> = {
  hari_ini: 'Hari Ini',
  minggu_ini: 'Minggu Ini',
  bulan_ini: 'Bulan Ini',
  semua: 'Semua',
}

export default function KomisiPublikPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [karyawan, setKaryawan] = useState<Karyawan | null>(null)
  const [transaksi, setTransaksi] = useState<Pelanggan[]>([])
  const [filter, setFilter] = useState<FilterPendapatan>('bulan_ini')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const fetchKaryawan = async () => {
      const { data } = await supabase
        .from('karyawan')
        .select('*')
        .eq('link_token', token)
        .single()
      if (!data) { setNotFound(true); setLoading(false); return }
      setKaryawan(data)
    }
    fetchKaryawan()
  }, [token])

  useEffect(() => {
    if (!karyawan) return
    const fetchTransaksi = async () => {
      setLoading(true)
      let query = supabase
        .from('pelanggan')
        .select('*, ps_units(*)')
        .eq('karyawan_id', karyawan.id)
        .order('created_at', { ascending: false })

      const now = new Date()
      if (filter === 'hari_ini') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
        query = query.gte('created_at', start)
      } else if (filter === 'minggu_ini') {
        const day = now.getDay()
        const diff = now.getDate() - day + (day === 0 ? -6 : 1)
        const start = new Date(now.getFullYear(), now.getMonth(), diff).toISOString()
        query = query.gte('created_at', start)
      } else if (filter === 'bulan_ini') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        query = query.gte('created_at', start)
      }

      const { data } = await query
      if (data) setTransaksi(data as Pelanggan[])
      setLoading(false)
    }
    fetchTransaksi()
  }, [karyawan, filter])

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-white font-semibold">Link tidak valid</p>
          <p className="text-gray-500 text-sm">Link ini tidak ditemukan atau sudah direset.</p>
        </div>
      </div>
    )
  }

  const totalKomisi = transaksi.reduce((s, t) => s + (t.total * (karyawan?.komisi_persen ?? 0)) / 100, 0)
  const komisiLunas = transaksi.filter(t => t.komisi_dibayar).reduce((s, t) => s + (t.total * (karyawan?.komisi_persen ?? 0)) / 100, 0)
  const bisaDitarik = totalKomisi - komisiLunas

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Komisi Karyawan</p>
            <p className="text-white font-bold text-lg leading-tight">{karyawan?.nama ?? '...'}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-gray-500 text-xs">Komisi</p>
            <p className="text-purple-400 font-bold">{karyawan?.komisi_persen ?? 0}%</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Filter */}
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(filterLabel) as FilterPendapatan[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors active:scale-95 ${
                filter === f ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}>
              {filterLabel[f]}
            </button>
          ))}
        </div>

        {/* Summary cards */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4">
                <p className="text-gray-400 text-xs mb-1">Total Transaksi</p>
                <p className="text-white font-bold text-2xl">{transaksi.length}</p>
              </div>
              <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4">
                <p className="text-gray-400 text-xs mb-1">Total Omset</p>
                <p className="text-white font-bold">{formatRupiah(transaksi.reduce((s, t) => s + t.total, 0))}</p>
              </div>
              <div className="bg-yellow-900/20 border border-yellow-800 rounded-2xl p-4">
                <p className="text-gray-400 text-xs mb-1">Bisa Ditarik</p>
                <p className="text-yellow-400 font-bold text-lg">{formatRupiah(bisaDitarik)}</p>
                <p className="text-gray-500 text-xs mt-0.5">{transaksi.filter(t => !t.komisi_dibayar).length} transaksi</p>
              </div>
              <div className="bg-green-900/20 border border-green-800 rounded-2xl p-4">
                <p className="text-gray-400 text-xs mb-1">Sudah Ditarik</p>
                <p className="text-green-400 font-bold text-lg">{formatRupiah(komisiLunas)}</p>
                <p className="text-gray-500 text-xs mt-0.5">{transaksi.filter(t => t.komisi_dibayar).length} transaksi</p>
              </div>
            </div>

            {/* Tabel transaksi */}
            <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-700">
                <h2 className="text-white font-semibold text-sm">Riwayat Transaksi</h2>
              </div>
              {transaksi.length === 0 ? (
                <p className="text-center text-gray-500 py-10 text-sm">Tidak ada transaksi</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700 bg-gray-800/50">
                        <th className="text-left px-4 py-2.5 text-gray-400 font-medium text-xs">Tanggal</th>
                        <th className="text-left px-4 py-2.5 text-gray-400 font-medium text-xs">Pelanggan</th>
                        <th className="text-left px-4 py-2.5 text-gray-400 font-medium text-xs">PS</th>
                        <th className="text-left px-4 py-2.5 text-gray-400 font-medium text-xs">Total</th>
                        <th className="text-left px-4 py-2.5 text-gray-400 font-medium text-xs">Komisi</th>
                        <th className="text-left px-4 py-2.5 text-gray-400 font-medium text-xs">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transaksi.map((t, i) => {
                        const komisiNominal = (t.total * (karyawan?.komisi_persen ?? 0)) / 100
                        return (
                          <tr key={t.id} className={`border-b border-gray-800 ${i % 2 === 0 ? '' : 'bg-gray-800/10'}`}>
                            <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                              {formatDateTime(t.created_at)}
                            </td>
                            <td className="px-4 py-3 text-white text-xs">{t.nama}</td>
                            <td className="px-4 py-3 text-purple-400 text-xs">{t.ps_units?.nama}</td>
                            <td className="px-4 py-3 text-white text-xs whitespace-nowrap">{formatRupiah(t.total)}</td>
                            <td className="px-4 py-3 text-yellow-400 font-medium text-xs whitespace-nowrap">{formatRupiah(komisiNominal)}</td>
                            <td className="px-4 py-3">
                              {t.komisi_dibayar ? (
                                <span className="px-2 py-0.5 rounded-lg text-xs bg-green-900/40 text-green-400 border border-green-800 whitespace-nowrap">
                                  ✅ Ditarik
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-lg text-xs bg-yellow-900/40 text-yellow-400 border border-yellow-800 whitespace-nowrap">
                                  ⏳ Menunggu
                                </span>
                              )}
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

        <p className="text-center text-gray-700 text-xs pb-4">Rental PS · Data hanya bisa dilihat, tidak bisa diubah</p>
      </div>
    </div>
  )
}
