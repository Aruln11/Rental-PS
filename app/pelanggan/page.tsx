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
  const { toasts, addToast, removeToast } = useToast()

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: pel }, { data: kar }, { data: ps }] = await Promise.all([
      supabase
        .from('pelanggan')
        .select('*, ps_units(*), karyawan(*)')
        .order('created_at', { ascending: false }),
      supabase.from('karyawan').select('*').order('nama'),
      supabase.from('ps_units').select('*').order('nama'),
    ])
    if (pel) setPelangganList(pel)
    if (kar) setKaryawanList(kar)
    if (ps) setPsUnits(ps)
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
                  <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">PS</th>
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
                    <td className="px-4 py-3 text-purple-400 font-medium">{p.ps_units?.nama}</td>
                    <td className="px-4 py-3 text-gray-300 text-sm">{formatDateTime(p.jam_mulai)}</td>
                    <td className="px-4 py-3 text-gray-300 text-sm">{formatDateTime(p.jam_selesai)}</td>
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
    </div>
  )
}
