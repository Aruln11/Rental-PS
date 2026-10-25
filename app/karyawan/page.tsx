'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, type Karyawan, type Pelanggan } from '@/lib/supabase'
import { formatRupiah, formatDateTime, generateKaryawanId } from '@/lib/utils'
import Modal from '@/components/Modal'
import ToastContainer from '@/components/ToastContainer'
import { useToast } from '@/hooks/useToast'

type FilterPendapatan = 'hari_ini' | 'minggu_ini' | 'bulan_ini' | 'semua'
const filterLabel: Record<FilterPendapatan, string> = {
  hari_ini: 'Hari Ini', minggu_ini: 'Minggu Ini', bulan_ini: 'Bulan Ini', semua: 'Semua'
}

export default function KaryawanPage() {
  const [karyawanList, setKaryawanList] = useState<Karyawan[]>([])
  const [loading, setLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editData, setEditData] = useState<Karyawan | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [selectedKaryawan, setSelectedKaryawan] = useState<Karyawan | null>(null)
  const [transaksiKaryawan, setTransaksiKaryawan] = useState<Pelanggan[]>([])
  const [filterPendapatan, setFilterPendapatan] = useState<FilterPendapatan>('bulan_ini')
  const [loadingTransaksi, setLoadingTransaksi] = useState(false)
  const [payingIds, setPayingIds] = useState<Set<string>>(new Set())
  const [payingAll, setPayingAll] = useState(false)
  const { toasts, addToast, removeToast } = useToast()

  const [form, setForm] = useState({ nama: '', no_telepon: '', komisi_persen: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const fetchKaryawan = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('karyawan').select('*').order('nama')
    if (data) setKaryawanList(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchKaryawan() }, [fetchKaryawan])

  const fetchTransaksiKaryawan = useCallback(async (karyawanId: string, filter: FilterPendapatan) => {
    setLoadingTransaksi(true)
    let query = supabase
      .from('pelanggan')
      .select('*, ps_units(*), karyawan(*)')
      .eq('karyawan_id', karyawanId)
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
    if (data) setTransaksiKaryawan(data as Pelanggan[])
    setLoadingTransaksi(false)
  }, [])

  useEffect(() => {
    if (selectedKaryawan) fetchTransaksiKaryawan(selectedKaryawan.id, filterPendapatan)
  }, [selectedKaryawan, filterPendapatan, fetchTransaksiKaryawan])

  // Bayar komisi 1 transaksi
  const handleBayarSatu = async (transaksiId: string) => {
    setPayingIds(prev => new Set(prev).add(transaksiId))
    const { error } = await supabase
      .from('pelanggan')
      .update({ komisi_dibayar: true, komisi_dibayar_at: new Date().toISOString() })
      .eq('id', transaksiId)
    if (error) { addToast('Gagal membayar komisi', 'error') }
    else {
      addToast('Komisi berhasil dibayarkan ✅', 'success')
      if (selectedKaryawan) fetchTransaksiKaryawan(selectedKaryawan.id, filterPendapatan)
    }
    setPayingIds(prev => { const s = new Set(prev); s.delete(transaksiId); return s })
  }

  // Bayar semua komisi yang belum dibayar
  const handleBayarSemua = async () => {
    const belumDibayar = transaksiKaryawan.filter(t => !t.komisi_dibayar)
    if (belumDibayar.length === 0) { addToast('Semua komisi sudah dibayar', 'info'); return }
    setPayingAll(true)
    const ids = belumDibayar.map(t => t.id)
    const { error } = await supabase
      .from('pelanggan')
      .update({ komisi_dibayar: true, komisi_dibayar_at: new Date().toISOString() })
      .in('id', ids)
    if (error) { addToast('Gagal membayar komisi', 'error') }
    else {
      addToast(`${belumDibayar.length} komisi berhasil dibayarkan ✅`, 'success')
      if (selectedKaryawan) fetchTransaksiKaryawan(selectedKaryawan.id, filterPendapatan)
    }
    setPayingAll(false)
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.nama.trim()) errs.nama = 'Nama wajib diisi'
    if (!form.no_telepon.trim()) errs.no_telepon = 'No. telepon wajib diisi'
    const k = parseFloat(form.komisi_persen)
    if (isNaN(k) || k < 0 || k > 100) errs.komisi_persen = 'Komisi antara 0-100'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    const payload = {
      nama: form.nama.trim(),
      no_telepon: form.no_telepon.trim(),
      komisi_persen: parseFloat(form.komisi_persen),
    }
    if (editData) {
      const { error } = await supabase.from('karyawan').update(payload).eq('id', editData.id)
      if (error) addToast('Gagal mengupdate karyawan', 'error')
      else { addToast('Karyawan berhasil diupdate', 'success'); closeForm(); fetchKaryawan() }
    } else {
      const { data: freshList } = await supabase.from('karyawan').select('id')
      const id = generateKaryawanId((freshList ?? []).map((k: { id: string }) => k.id))
      const { error } = await supabase.from('karyawan').insert({ id, ...payload })
      if (error) addToast('Gagal menambah karyawan', 'error')
      else { addToast('Karyawan berhasil ditambahkan', 'success'); closeForm(); fetchKaryawan() }
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('karyawan').delete().eq('id', id)
    if (error) addToast('Gagal menghapus karyawan', 'error')
    else { addToast('Karyawan berhasil dihapus', 'success'); setDeleteId(null); fetchKaryawan() }
  }

  const openForm = (data?: Karyawan) => {
    setEditData(data ?? null)
    setForm({ nama: data?.nama ?? '', no_telepon: data?.no_telepon ?? '', komisi_persen: data ? String(data.komisi_persen) : '' })
    setErrors({})
    setIsFormOpen(true)
  }
  const closeForm = () => { setIsFormOpen(false); setEditData(null); setForm({ nama: '', no_telepon: '', komisi_persen: '' }); setErrors({}) }

  const inputClass = (field: string) =>
    `w-full bg-gray-800 border ${errors[field] ? 'border-red-500' : 'border-gray-600'} rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors`

  // Hitung summary komisi
  const totalKomisi = transaksiKaryawan.reduce((s, t) => s + (t.total * (selectedKaryawan?.komisi_persen ?? 0)) / 100, 0)
  const komisiLunas = transaksiKaryawan.filter(t => t.komisi_dibayar).reduce((s, t) => s + (t.total * (selectedKaryawan?.komisi_persen ?? 0)) / 100, 0)
  const komisiPending = totalKomisi - komisiLunas
  const totalTransaksi = transaksiKaryawan.reduce((s, t) => s + t.total, 0)
  const belumDibayarCount = transaksiKaryawan.filter(t => !t.komisi_dibayar).length

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Karyawan</h1>
          <p className="text-gray-400 text-sm mt-1">Kelola data karyawan dan komisi</p>
        </div>
        <button onClick={() => openForm()}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2.5 rounded-xl font-medium transition-colors active:scale-95">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Tambah Karyawan
        </button>
      </div>

      {/* List Karyawan */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
          </div>
        ) : karyawanList.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <p>Belum ada karyawan</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700 bg-gray-800/50">
                  {['ID', 'Nama', 'No. Telepon', 'Komisi', 'Aksi'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-gray-400 text-sm font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {karyawanList.map((k, i) => (
                  <tr key={k.id} className={`border-b border-gray-800 hover:bg-gray-800/30 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-800/10'}`}>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-gray-800 text-purple-400 px-2 py-1 rounded-lg">{k.id}</span>
                    </td>
                    <td className="px-4 py-3 text-white font-medium">{k.nama}</td>
                    <td className="px-4 py-3 text-gray-300">{k.no_telepon}</td>
                    <td className="px-4 py-3">
                      <span className="bg-green-900/30 text-green-400 border border-green-700 px-2 py-1 rounded-lg text-sm font-medium">
                        {k.komisi_persen}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setSelectedKaryawan(k)} title="Lihat Komisi"
                          className="p-1.5 text-yellow-400 hover:bg-yellow-900/30 rounded-lg transition-colors active:scale-90">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        <button onClick={() => openForm(k)} title="Edit"
                          className="p-1.5 text-blue-400 hover:bg-blue-900/30 rounded-lg transition-colors active:scale-90">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button onClick={() => setDeleteId(k.id)} title="Hapus"
                          className="p-1.5 text-red-400 hover:bg-red-900/30 rounded-lg transition-colors active:scale-90">
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
      <Modal isOpen={isFormOpen} onClose={closeForm} title={editData ? 'Edit Karyawan' : 'Tambah Karyawan'} size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Nama *</label>
            <input type="text" value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} placeholder="Nama lengkap" className={inputClass('nama')} />
            {errors.nama && <p className="text-red-400 text-xs mt-1">{errors.nama}</p>}
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">No. Telepon *</label>
            <input type="text" value={form.no_telepon} onChange={e => setForm({ ...form, no_telepon: e.target.value })} placeholder="08xxxxxxxxxx" className={inputClass('no_telepon')} />
            {errors.no_telepon && <p className="text-red-400 text-xs mt-1">{errors.no_telepon}</p>}
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Komisi (%) *</label>
            <input type="number" min="0" max="100" step="0.5" value={form.komisi_persen} onChange={e => setForm({ ...form, komisi_persen: e.target.value })} placeholder="Contoh: 10" className={inputClass('komisi_persen')} />
            {errors.komisi_persen && <p className="text-red-400 text-xs mt-1">{errors.komisi_persen}</p>}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={closeForm} className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors">Batal</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl transition-colors font-medium">
              {saving ? 'Menyimpan...' : editData ? 'Update' : 'Simpan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Komisi Modal */}
      <Modal isOpen={!!selectedKaryawan} onClose={() => setSelectedKaryawan(null)} title={`Komisi — ${selectedKaryawan?.nama}`} size="lg">
        {selectedKaryawan && (
          <div className="space-y-4">
            {/* Filter */}
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(filterLabel) as FilterPendapatan[]).map(f => (
                <button key={f} onClick={() => setFilterPendapatan(f)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors active:scale-95 ${filterPendapatan === f ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                  {filterLabel[f]}
                </button>
              ))}
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gray-800 rounded-xl p-3">
                <p className="text-gray-400 text-xs">Transaksi</p>
                <p className="text-white font-bold text-lg">{transaksiKaryawan.length}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-3">
                <p className="text-gray-400 text-xs">Total Omset</p>
                <p className="text-white font-bold text-sm">{formatRupiah(totalTransaksi)}</p>
              </div>
              <div className="bg-yellow-900/30 border border-yellow-700 rounded-xl p-3">
                <p className="text-gray-400 text-xs">Komisi Pending</p>
                <p className="text-yellow-400 font-bold text-sm">{formatRupiah(komisiPending)}</p>
                <p className="text-gray-500 text-xs mt-0.5">{belumDibayarCount} transaksi</p>
              </div>
              <div className="bg-green-900/30 border border-green-700 rounded-xl p-3">
                <p className="text-gray-400 text-xs">Komisi Lunas</p>
                <p className="text-green-400 font-bold text-sm">{formatRupiah(komisiLunas)}</p>
              </div>
            </div>

            {/* Tombol bayar semua */}
            {belumDibayarCount > 0 && (
              <button
                onClick={handleBayarSemua}
                disabled={payingAll}
                className="w-full py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-xl font-medium transition-colors active:scale-95 flex items-center justify-center gap-2"
              >
                {payingAll ? (
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                Bayar Semua Komisi Pending ({belumDibayarCount} transaksi · {formatRupiah(komisiPending)})
              </button>
            )}

            {/* Tabel transaksi */}
            <div className="overflow-x-auto max-h-64 overflow-y-auto rounded-xl border border-gray-700">
              {loadingTransaksi ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full" />
                </div>
              ) : transaksiKaryawan.length === 0 ? (
                <p className="text-center text-gray-500 py-8 text-sm">Tidak ada transaksi</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700 bg-gray-800">
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium">Tanggal</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium">Pelanggan</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium">PS</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium">Total</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium">Komisi</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium">Status</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transaksiKaryawan.map(t => {
                      const komisiNominal = (t.total * selectedKaryawan.komisi_persen) / 100
                      return (
                        <tr key={t.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                          <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">{formatDateTime(t.created_at)}</td>
                          <td className="px-3 py-2.5 text-white">{t.nama}</td>
                          <td className="px-3 py-2.5 text-purple-400">{t.ps_units?.nama}</td>
                          <td className="px-3 py-2.5 text-white whitespace-nowrap">{formatRupiah(t.total)}</td>
                          <td className="px-3 py-2.5 text-yellow-400 font-medium whitespace-nowrap">{formatRupiah(komisiNominal)}</td>
                          <td className="px-3 py-2.5">
                            {t.komisi_dibayar ? (
                              <div>
                                <span className="px-2 py-0.5 rounded-lg text-xs bg-green-900/40 text-green-400 border border-green-700 whitespace-nowrap">
                                  ✅ Lunas
                                </span>
                                {t.komisi_dibayar_at && (
                                  <p className="text-gray-500 text-xs mt-0.5">{formatDateTime(t.komisi_dibayar_at)}</p>
                                )}
                              </div>
                            ) : (
                              <span className="px-2 py-0.5 rounded-lg text-xs bg-yellow-900/40 text-yellow-400 border border-yellow-700 whitespace-nowrap">
                                ⏳ Pending
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            {!t.komisi_dibayar && (
                              <button
                                onClick={() => handleBayarSatu(t.id)}
                                disabled={payingIds.has(t.id)}
                                className="px-3 py-1 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors active:scale-95 whitespace-nowrap"
                              >
                                {payingIds.has(t.id) ? '...' : 'Bayar'}
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirm */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Konfirmasi Hapus" size="sm">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 bg-red-900/30 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-gray-300">Yakin ingin menghapus karyawan ini?</p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors">Batal</button>
            <button onClick={() => deleteId && handleDelete(deleteId)} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl transition-colors">Hapus</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
