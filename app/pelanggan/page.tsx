'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, type Pelanggan, type Karyawan, type PsUnit } from '@/lib/supabase'
import { formatRupiah, formatDateTime, getStatus } from '@/lib/utils'
import Modal from '@/components/Modal'
import ToastContainer from '@/components/ToastContainer'
import { useToast } from '@/hooks/useToast'
import FormPelanggan from './FormPelanggan'
import KonfirmasiSelesai from './KonfirmasiSelesai'

export default function PelangganPage() {
  const [pelangganList, setPelangganList] = useState<Pelanggan[]>([])
  const [karyawanList, setKaryawanList] = useState<Karyawan[]>([])
  const [psUnits, setPsUnits] = useState<PsUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editData, setEditData] = useState<Pelanggan | null>(null)
  const [selesaiData, setSelesaiData] = useState<Pelanggan | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('semua')
  const [galeriData, setGaleriData] = useState<{ nama: string; urls: string[] } | null>(null)
  const [galeriIdx, setGaleriIdx] = useState(0)
  const { toasts, addToast, removeToast } = useToast()

  // Normalisasi identitas_url — data lama bisa berupa string, bukan array
  const toUrlArray = (val: string[] | string | null | undefined): string[] => {
    if (!val) return []
    if (Array.isArray(val)) return val
    return [val]
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: pel }, { data: kar }, { data: ps }, { data: aktif }] = await Promise.all([
      supabase
        .from('pelanggan')
        .select('*, ps_units(*), karyawan(*)')
        .order('created_at', { ascending: false }),
      supabase.from('karyawan').select('*').order('nama'),
      supabase.from('ps_units').select('*').order('nama'),
      supabase.from('pelanggan').select('ps_id').eq('status', 'aktif'),
    ])
    if (pel) setPelangganList(pel)
    if (kar) setKaryawanList(kar)
    if (ps) {
      // Hitung berapa unit sedang dipakai per PS
      const pemakaian: Record<string, number> = {}
      ;(aktif ?? []).forEach((t: { ps_id: string }) => {
        pemakaian[t.ps_id] = (pemakaian[t.ps_id] ?? 0) + 1
      })
      const enriched = (ps as PsUnit[]).map(p => ({
        ...p,
        sedang_dipakai: pemakaian[p.id] ?? 0,
      }))
      setPsUnits(enriched)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-update status setiap menit
  useEffect(() => {
    const interval = setInterval(() => {
      setPelangganList((prev) =>
        prev.map((p) => ({
          ...p,
          status: getStatus(p.jam_selesai, p.jam_dikembalikan),
        }))
      )
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('pelanggan').delete().eq('id', id)
    if (error) {
      addToast('Gagal menghapus data', 'error')
    } else {
      addToast('Data berhasil dihapus', 'success')
      setDeleteId(null)
      fetchData()
    }
  }

  const handleSelesai = async (pelanggan: Pelanggan) => {
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('pelanggan')
      .update({ status: 'selesai', jam_dikembalikan: now })
      .eq('id', pelanggan.id)
    if (error) {
      addToast('Gagal mengupdate status', 'error')
    } else {
      addToast('PS berhasil dikembalikan ✅', 'success')
      setSelesaiData(null)
      fetchData()
    }
  }

  const filteredList = pelangganList.filter((p) => {
    const status = getStatus(p.jam_selesai, p.jam_dikembalikan)
    if (filterStatus === 'semua') return true
    return status === filterStatus
  })

  const statusBadge = (p: Pelanggan) => {
    const status = getStatus(p.jam_selesai, p.jam_dikembalikan)
    const config = {
      aktif: 'bg-green-900/50 text-green-400 border border-green-700',
      telat: 'bg-red-900/50 text-red-400 border border-red-700',
      selesai: 'bg-gray-800 text-gray-400 border border-gray-600',
    }
    const label = {
      aktif: '🟢 Aktif',
      telat: '🔴 Telat',
      selesai: '✅ Selesai',
    }
    return (
      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${config[status]}`}>
        {label[status]}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Pelanggan</h1>
          <p className="text-gray-400 text-sm mt-1">Kelola transaksi rental PS</p>
        </div>
        <button
          onClick={() => { setEditData(null); setIsFormOpen(true) }}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2.5 rounded-xl font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Tambah Transaksi
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Aktif', count: pelangganList.filter(p => getStatus(p.jam_selesai, p.jam_dikembalikan) === 'aktif').length, color: 'text-green-400', bg: 'bg-green-900/20 border-green-800' },
          { label: 'Telat', count: pelangganList.filter(p => getStatus(p.jam_selesai, p.jam_dikembalikan) === 'telat').length, color: 'text-red-400', bg: 'bg-red-900/20 border-red-800' },
          { label: 'Selesai', count: pelangganList.filter(p => getStatus(p.jam_selesai, p.jam_dikembalikan) === 'selesai').length, color: 'text-gray-400', bg: 'bg-gray-800/50 border-gray-700' },
        ].map((stat) => (
          <div key={stat.label} className={`${stat.bg} border rounded-xl p-4`}>
            <p className="text-gray-400 text-sm">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.count}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {['semua', 'aktif', 'telat', 'selesai'].map((f) => (
          <button
            key={f}
            onClick={() => setFilterStatus(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              filterStatus === f
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
          </div>
        ) : filteredList.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p>Belum ada transaksi</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700 bg-gray-800/50">
                  <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Pelanggan</th>
                  <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Identitas</th>
                  <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">PS</th>
                  <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Waktu</th>
                  <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Mulai</th>
                  <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Selesai</th>
                  <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Total</th>
                  <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Bayar</th>
                  <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Karyawan</th>
                  <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map((p, i) => (
                  <tr key={p.id} className={`border-b border-gray-800 hover:bg-gray-800/30 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-800/10'}`}>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-white font-medium">{p.nama}</p>
                        <p className="text-gray-500 text-xs">{p.no_telepon}</p>
                      </div>
                    </td>
                    {/* Identitas thumbnail */}
                    <td className="px-4 py-3">
                      {(() => {
                        const urls = toUrlArray(p.identitas_url)
                        return urls.length > 0 ? (
                          <button
                            onClick={() => { setGaleriData({ nama: p.nama, urls }); setGaleriIdx(0) }}
                            className="relative group flex-shrink-0"
                            title="Lihat identitas"
                          >
                            {urls[0].match(/\.(mp4|webm|mov)$/i) ? (
                              <div className="w-10 h-10 rounded-lg bg-gray-800 border border-gray-600 flex items-center justify-center group-hover:border-purple-500 transition-colors">
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </div>
                            ) : (
                              <img
                                src={urls[0]}
                                alt="Identitas"
                                className="w-10 h-10 rounded-lg object-cover border border-gray-600 group-hover:border-purple-500 transition-colors"
                              />
                            )}
                            {urls.length > 1 && (
                              <span className="absolute -top-1.5 -right-1.5 bg-purple-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                                {urls.length}
                              </span>
                            )}
                          </button>
                        ) : (
                          <span className="text-gray-600 text-xs">—</span>
                        )
                      })()}
                    </td>
                    <td className="px-4 py-3 text-purple-400 font-medium">{p.ps_units?.nama}</td>
                    <td className="px-4 py-3">
                      <span className="bg-purple-900/30 text-purple-300 border border-purple-700 px-2 py-1 rounded-lg text-sm font-medium">
                        {p.jumlah_jam} jam
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-sm whitespace-nowrap">
                      {(() => {
                        const d = new Date(p.jam_mulai)
                        return (
                          <div>
                            <p>{new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)}</p>
                            <p className="text-gray-300 text-xs">{new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d)}</p>
                          </div>
                        )
                      })()}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-sm whitespace-nowrap">
                      {(() => {
                        const d = new Date(p.jam_selesai)
                        return (
                          <div>
                            <p>{new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)}</p>
                            <p className="text-gray-300 text-xs">{new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d)}</p>
                          </div>
                        )
                      })()}
                    </td>
                    <td className="px-4 py-3 text-white font-medium">{formatRupiah(p.total)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${p.metode_bayar === 'qris' ? 'bg-blue-900/50 text-blue-400' : 'bg-yellow-900/50 text-yellow-400'}`}>
                        {p.metode_bayar.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-sm">{p.karyawan?.nama}</td>
                    <td className="px-4 py-3">{statusBadge(p)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {getStatus(p.jam_selesai, p.jam_dikembalikan) !== 'selesai' && (
                          <button
                            onClick={() => setSelesaiData(p)}
                            title="Tandai Selesai"
                            className="p-1.5 text-green-400 hover:bg-green-900/30 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => { setEditData(p); setIsFormOpen(true) }}
                          title="Edit"
                          className="p-1.5 text-blue-400 hover:bg-blue-900/30 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteId(p.id)}
                          title="Hapus"
                          className="p-1.5 text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditData(null) }}
        title={editData ? 'Edit Transaksi' : 'Tambah Transaksi Baru'}
        size="lg"
      >
        <FormPelanggan
          editData={editData}
          karyawanList={karyawanList}
          psUnits={psUnits}
          onSuccess={() => {
            setIsFormOpen(false)
            setEditData(null)
            fetchData()
            addToast(editData ? 'Transaksi berhasil diupdate' : 'Transaksi berhasil disimpan ✅', 'success')
          }}
          onCancel={() => { setIsFormOpen(false); setEditData(null) }}
        />
      </Modal>

      {/* Konfirmasi Selesai Modal */}
      {selesaiData && (
        <KonfirmasiSelesai
          pelanggan={selesaiData}
          onConfirm={() => handleSelesai(selesaiData)}
          onCancel={() => setSelesaiData(null)}
        />
      )}

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Konfirmasi Hapus"
        size="sm"
      >
        <div className="text-center space-y-4">
          <div className="w-14 h-14 bg-red-900/30 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-gray-300">Yakin ingin menghapus data ini? Aksi ini tidak bisa dibatalkan.</p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors">
              Batal
            </button>
            <button onClick={() => deleteId && handleDelete(deleteId)} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl transition-colors">
              Hapus
            </button>
          </div>
        </div>
      </Modal>

      {/* Galeri Identitas Modal */}
      <Modal
        isOpen={!!galeriData}
        onClose={() => setGaleriData(null)}
        title={`Identitas — ${galeriData?.nama}`}
        size="lg"
      >
        {galeriData && (
          <div className="space-y-4">
            {/* Viewer utama */}
            <div className="relative bg-black rounded-xl overflow-hidden flex items-center justify-center min-h-64">
              {galeriData.urls[galeriIdx].match(/\.(mp4|webm|mov)$/i) ? (
                <video
                  key={galeriData.urls[galeriIdx]}
                  src={galeriData.urls[galeriIdx]}
                  controls
                  className="max-h-96 w-full object-contain"
                />
              ) : (
                <img
                  src={galeriData.urls[galeriIdx]}
                  alt={`Identitas ${galeriIdx + 1}`}
                  className="max-h-96 w-full object-contain"
                />
              )}

              {/* Navigasi prev/next */}
              {galeriData.urls.length > 1 && (
                <>
                  <button
                    onClick={() => setGaleriIdx(i => (i - 1 + galeriData.urls.length) % galeriData.urls.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setGaleriIdx(i => (i + 1) % galeriData.urls.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  {/* Counter */}
                  <span className="absolute bottom-2 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                    {galeriIdx + 1} / {galeriData.urls.length}
                  </span>
                </>
              )}
            </div>

            {/* Strip thumbnail */}
            {galeriData.urls.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {galeriData.urls.map((url, i) => (
                  <button
                    key={url}
                    onClick={() => setGaleriIdx(i)}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                      i === galeriIdx ? 'border-purple-500' : 'border-gray-700 hover:border-gray-500'
                    }`}
                  >
                    {url.match(/\.(mp4|webm|mov)$/i) ? (
                      <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    ) : (
                      <img src={url} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
