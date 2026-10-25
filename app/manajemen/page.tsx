'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, type PsUnit } from '@/lib/supabase'
import { formatRupiah } from '@/lib/utils'
import Modal from '@/components/Modal'
import ToastContainer from '@/components/ToastContainer'
import { useToast } from '@/hooks/useToast'

export default function ManajemenPage() {
  const [psUnits, setPsUnits] = useState<(PsUnit & { sedang_dipakai?: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [editHarga, setEditHarga] = useState<Record<string, string>>({})
  const [editUnit, setEditUnit] = useState<Record<string, string>>({})
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState({ nama: '', harga_per_jam: '', jumlah_unit: '1' })
  const [formError, setFormError] = useState<Record<string, string>>({})
  const [formSaving, setFormSaving] = useState(false)
  const { toasts, addToast, removeToast } = useToast()

  const fetchPsUnits = useCallback(async () => {
    setLoading(true)
    const [{ data: psData }, { data: transaksiAktif }] = await Promise.all([
      supabase.from('ps_units').select('*').order('nama'),
      supabase.from('pelanggan').select('ps_id').eq('status', 'aktif'),
    ])

    if (psData) {
      // Hitung berapa unit sedang dipakai per PS
      const pemakaian: Record<string, number> = {}
      ;(transaksiAktif ?? []).forEach((t: { ps_id: string }) => {
        pemakaian[t.ps_id] = (pemakaian[t.ps_id] ?? 0) + 1
      })

      const enriched = (psData as PsUnit[]).map(ps => ({
        ...ps,
        sedang_dipakai: pemakaian[ps.id] ?? 0,
      }))
      setPsUnits(enriched as PsUnit[])
      const harga: Record<string, string> = {}
      const unit: Record<string, string> = {}
      enriched.forEach(ps => {
        harga[ps.id] = String(ps.harga_per_jam)
        unit[ps.id] = String(ps.jumlah_unit ?? 1)
      })
      setEditHarga(harga)
      setEditUnit(unit)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchPsUnits() }, [fetchPsUnits])

  const handleSave = async (ps: PsUnit) => {
    const newHarga = parseInt(editHarga[ps.id])
    const newUnit = parseInt(editUnit[ps.id])
    if (isNaN(newHarga) || newHarga < 0) { addToast('Harga tidak valid', 'error'); return }
    if (isNaN(newUnit) || newUnit < 1) { addToast('Jumlah unit minimal 1', 'error'); return }
    setSaving(ps.id)
    const { error } = await supabase
      .from('ps_units')
      .update({ harga_per_jam: newHarga, jumlah_unit: newUnit })
      .eq('id', ps.id)
    if (error) { addToast(`Gagal update ${ps.nama}`, 'error') }
    else { addToast(`${ps.nama} berhasil diupdate ✅`, 'success'); fetchPsUnits() }
    setSaving(null)
  }

  const handleTambah = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.nama.trim()) errs.nama = 'Nama wajib diisi'
    if (!form.harga_per_jam || parseInt(form.harga_per_jam) < 0) errs.harga_per_jam = 'Harga tidak valid'
    if (!form.jumlah_unit || parseInt(form.jumlah_unit) < 1) errs.jumlah_unit = 'Minimal 1 unit'
    setFormError(errs)
    if (Object.keys(errs).length > 0) return
    setFormSaving(true)
    const { error } = await supabase.from('ps_units').insert({
      nama: form.nama.trim(),
      harga_per_jam: parseInt(form.harga_per_jam),
      jumlah_unit: parseInt(form.jumlah_unit),
    })
    if (error) { addToast('Gagal menambah PS: ' + (error.message ?? ''), 'error') }
    else {
      addToast(`${form.nama} berhasil ditambahkan ✅`, 'success')
      setIsFormOpen(false)
      setForm({ nama: '', harga_per_jam: '', jumlah_unit: '1' })
      fetchPsUnits()
    }
    setFormSaving(false)
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('ps_units').delete().eq('id', id)
    if (error) { addToast('Gagal menghapus PS', 'error') }
    else { addToast('PS berhasil dihapus', 'success'); setDeleteId(null); fetchPsUnits() }
  }

  const psColors = [
    'from-purple-600 to-purple-800',
    'from-blue-600 to-blue-800',
    'from-green-600 to-green-800',
    'from-orange-600 to-orange-800',
    'from-red-600 to-red-800',
    'from-pink-600 to-pink-800',
    'from-teal-600 to-teal-800',
    'from-indigo-600 to-indigo-800',
  ]

  const inputClass = (field: string) =>
    `w-full bg-gray-800 border ${formError[field] ? 'border-red-500' : 'border-gray-600'} rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors`

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Manajemen</h1>
          <p className="text-gray-400 text-sm mt-1">Kelola unit PS dan harga sewa per jam</p>
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2.5 rounded-xl font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Tambah PS
        </button>
      </div>

      {/* Info */}
      <div className="bg-purple-900/20 border border-purple-700 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-400 text-sm">
            Harga dan jumlah unit yang diset di sini otomatis dipakai saat menghitung total biaya rental.
          </p>
        </div>
      </div>

      {/* PS Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {psUnits.map((ps, i) => (
            <div key={ps.id} className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden hover:border-gray-600 transition-colors">
              {/* Header */}
              <div className={`bg-gradient-to-r ${psColors[i % psColors.length]} p-5`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-lg">{ps.nama}</h3>
                      <p className="text-white/70 text-xs">
                        {Math.max(0, (ps.jumlah_unit ?? 1) - (ps.sedang_dipakai ?? 0))} / {ps.jumlah_unit ?? 1} unit tersedia
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setDeleteId(ps.id)}
                    className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                    title="Hapus PS"
                  >
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-gray-400 text-xs mb-1">Harga/Jam</p>
                    <p className="text-white font-bold">{formatRupiah(ps.harga_per_jam)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs mb-1">Total Unit</p>
                    <p className="text-white font-bold">{ps.jumlah_unit ?? 1} unit</p>
                  </div>
                </div>

                {/* Status ketersediaan unit */}
                {(() => {
                  const total = ps.jumlah_unit ?? 1
                  const dipakai = ps.sedang_dipakai ?? 0
                  const tersedia = Math.max(0, total - dipakai)
                  const pct = total > 0 ? (dipakai / total) * 100 : 0
                  return (
                    <div className="bg-gray-800 rounded-xl p-3 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Ketersediaan Unit</span>
                        <span className={tersedia === 0 ? 'text-red-400 font-medium' : 'text-green-400 font-medium'}>
                          {tersedia === 0 ? '🔴 Penuh' : `🟢 ${tersedia} tersedia`}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all ${pct >= 100 ? 'bg-red-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{dipakai} sedang dipakai</span>
                        <span>{total} total unit</span>
                      </div>
                    </div>
                  )
                })()}
                {/* Update harga */}
                <div>
                  <label className="block text-gray-400 text-xs mb-1.5">Update Harga (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={editHarga[ps.id] ?? ''}
                    onChange={(e) => setEditHarga({ ...editHarga, [ps.id]: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors"
                    placeholder="Contoh: 15000"
                  />
                </div>

                {/* Update unit */}
                <div>
                  <label className="block text-gray-400 text-xs mb-1.5">Jumlah Unit</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditUnit({ ...editUnit, [ps.id]: String(Math.max(1, parseInt(editUnit[ps.id] || '1') - 1)) })}
                      className="w-8 h-8 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center justify-center transition-colors"
                    >-</button>
                    <input
                      type="number"
                      min="1"
                      value={editUnit[ps.id] ?? '1'}
                      onChange={(e) => setEditUnit({ ...editUnit, [ps.id]: e.target.value })}
                      className="flex-1 bg-gray-800 border border-gray-600 rounded-xl px-3 py-2 text-white text-sm text-center focus:outline-none focus:border-purple-500 transition-colors"
                    />
                    <button
                      onClick={() => setEditUnit({ ...editUnit, [ps.id]: String(parseInt(editUnit[ps.id] || '1') + 1) })}
                      className="w-8 h-8 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center justify-center transition-colors"
                    >+</button>
                  </div>
                </div>

                <button
                  onClick={() => handleSave(ps)}
                  disabled={saving === ps.id}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {saving === ps.id ? (
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  Simpan Perubahan
                </button>

                {/* Contoh kalkulasi */}
                {editHarga[ps.id] && parseInt(editHarga[ps.id]) > 0 && (
                  <div className="bg-gray-800 rounded-xl p-3 space-y-1.5">
                    <p className="text-gray-400 text-xs font-medium">Contoh kalkulasi:</p>
                    {[1, 2, 3, 5].map((jam) => (
                      <div key={jam} className="flex justify-between text-xs">
                        <span className="text-gray-500">{jam} jam</span>
                        <span className="text-white">{formatRupiah(parseInt(editHarga[ps.id] || '0') * jam)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tambah PS Modal */}
      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title="Tambah PS Baru" size="sm">
        <form onSubmit={handleTambah} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Nama PS *</label>
            <input
              type="text"
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
              placeholder="Contoh: PS 6"
              className={inputClass('nama')}
            />
            {formError.nama && <p className="text-red-400 text-xs mt-1">{formError.nama}</p>}
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Harga per Jam (Rp) *</label>
            <input
              type="number"
              min="0"
              step="1000"
              value={form.harga_per_jam}
              onChange={(e) => setForm({ ...form, harga_per_jam: e.target.value })}
              placeholder="Contoh: 15000"
              className={inputClass('harga_per_jam')}
            />
            {formError.harga_per_jam && <p className="text-red-400 text-xs mt-1">{formError.harga_per_jam}</p>}
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Jumlah Unit *</label>
            <input
              type="number"
              min="1"
              value={form.jumlah_unit}
              onChange={(e) => setForm({ ...form, jumlah_unit: e.target.value })}
              placeholder="Contoh: 2"
              className={inputClass('jumlah_unit')}
            />
            {formError.jumlah_unit && <p className="text-red-400 text-xs mt-1">{formError.jumlah_unit}</p>}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setIsFormOpen(false)} className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors">Batal</button>
            <button type="submit" disabled={formSaving} className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl transition-colors font-medium">
              {formSaving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Konfirmasi Hapus" size="sm">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 bg-red-900/30 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-gray-300">Yakin ingin menghapus PS ini? Pastikan tidak ada transaksi aktif.</p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors">Batal</button>
            <button onClick={() => deleteId && handleDelete(deleteId)} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl transition-colors">Hapus</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
