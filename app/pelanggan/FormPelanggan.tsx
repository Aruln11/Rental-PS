'use client'

import { useState, useEffect } from 'react'
import { supabase, type Pelanggan, type Karyawan, type PsUnit } from '@/lib/supabase'
import { formatRupiah, formatDateTime, hitungJamSelesai, getStatus } from '@/lib/utils'

interface Props {
  editData: Pelanggan | null
  karyawanList: Karyawan[]
  psUnits: PsUnit[]
  onSuccess: () => void
  onCancel: () => void
}

export default function FormPelanggan({ editData, karyawanList, psUnits, onSuccess, onCancel }: Props) {
  const [form, setForm] = useState({
    nama: '',
    no_telepon: '',
    ps_id: '',
    jumlah_jam: '',
    metode_bayar: 'cash' as 'cash' | 'qris',
    karyawan_id: '',
  })
  const [identitasFile, setIdentitasFile] = useState<File | null>(null)
  const [identitasPreview, setIdentitasPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Preview kalkulasi
  const jamMulai = new Date()
  const selectedPs = psUnits.find((ps) => ps.id === form.ps_id)
  const jumlahJam = parseInt(form.jumlah_jam) || 0
  const jamSelesai = jumlahJam > 0 ? hitungJamSelesai(jamMulai, jumlahJam) : null
  const totalBayar = selectedPs ? selectedPs.harga_per_jam * jumlahJam : 0

  useEffect(() => {
    if (editData) {
      setForm({
        nama: editData.nama,
        no_telepon: editData.no_telepon,
        ps_id: editData.ps_id,
        jumlah_jam: String(editData.jumlah_jam),
        metode_bayar: editData.metode_bayar,
        karyawan_id: editData.karyawan_id,
      })
      if (editData.identitas_url) setIdentitasPreview(editData.identitas_url)
    }
  }, [editData])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIdentitasFile(file)
    const url = URL.createObjectURL(file)
    setIdentitasPreview(url)
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.nama.trim()) errs.nama = 'Nama wajib diisi'
    if (!form.no_telepon.trim()) errs.no_telepon = 'No. telepon wajib diisi'
    if (!form.ps_id) errs.ps_id = 'Pilih PS'
    if (!form.jumlah_jam || jumlahJam <= 0) errs.jumlah_jam = 'Jumlah jam harus lebih dari 0'
    if (!form.karyawan_id) errs.karyawan_id = 'Pilih karyawan'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)

    try {
      let identitas_url = editData?.identitas_url ?? null

      // Upload identitas jika ada file baru
      if (identitasFile) {
        const ext = identitasFile.name.split('.').pop()
        const fileName = `${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('identitas')
          .upload(fileName, identitasFile, { upsert: true })
        if (uploadError) throw uploadError
        const { data } = supabase.storage.from('identitas').getPublicUrl(fileName)
        identitas_url = data.publicUrl
      }

      const mulai = editData ? new Date(editData.jam_mulai) : new Date()
      const selesai = hitungJamSelesai(mulai, jumlahJam)
      const harga = selectedPs?.harga_per_jam ?? 0
      const total = harga * jumlahJam

      const payload = {
        nama: form.nama.trim(),
        no_telepon: form.no_telepon.trim(),
        identitas_url,
        ps_id: form.ps_id,
        jumlah_jam: jumlahJam,
        jam_mulai: mulai.toISOString(),
        jam_selesai: selesai.toISOString(),
        total,
        metode_bayar: form.metode_bayar,
        karyawan_id: form.karyawan_id,
        status: getStatus(selesai.toISOString(), editData?.jam_dikembalikan ?? null),
      }

      if (editData) {
        const { error } = await supabase.from('pelanggan').update(payload).eq('id', editData.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('pelanggan').insert(payload)
        if (error) throw error
      }

      onSuccess()
    } catch (err) {
      console.error(err)
      alert('Terjadi kesalahan, coba lagi')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = (field: string) =>
    `w-full bg-gray-800 border ${errors[field] ? 'border-red-500' : 'border-gray-600'} rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors`

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Nama & No Telepon */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Nama Pelanggan *</label>
          <input
            type="text"
            value={form.nama}
            onChange={(e) => setForm({ ...form, nama: e.target.value })}
            placeholder="Nama lengkap"
            className={inputClass('nama')}
          />
          {errors.nama && <p className="text-red-400 text-xs mt-1">{errors.nama}</p>}
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">No. Telepon *</label>
          <input
            type="text"
            value={form.no_telepon}
            onChange={(e) => setForm({ ...form, no_telepon: e.target.value })}
            placeholder="08xxxxxxxxxx"
            className={inputClass('no_telepon')}
          />
          {errors.no_telepon && <p className="text-red-400 text-xs mt-1">{errors.no_telepon}</p>}
        </div>
      </div>

      {/* Upload Identitas */}
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">Upload Identitas (foto/video)</label>
        <div className="border-2 border-dashed border-gray-600 rounded-xl p-4 hover:border-purple-500 transition-colors">
          {identitasPreview ? (
            <div className="relative">
              {identitasPreview.includes('.mp4') || identitasPreview.includes('video') || identitasFile?.type.startsWith('video') ? (
                <video src={identitasPreview} className="w-full max-h-32 object-cover rounded-lg" controls />
              ) : (
                <img src={identitasPreview} alt="Identitas" className="w-full max-h-32 object-cover rounded-lg" />
              )}
              <button
                type="button"
                onClick={() => { setIdentitasFile(null); setIdentitasPreview(null) }}
                className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-500"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center gap-2 cursor-pointer">
              <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-gray-500 text-sm">Klik untuk upload foto/video KTP atau identitas lain</span>
              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>

      {/* Pilih PS */}
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">Pilih PS *</label>
        <div className="grid grid-cols-5 gap-2">
          {psUnits.map((ps) => (
            <button
              key={ps.id}
              type="button"
              onClick={() => setForm({ ...form, ps_id: ps.id })}
              className={`py-3 rounded-xl border font-medium text-sm transition-all ${
                form.ps_id === ps.id
                  ? 'bg-purple-600 border-purple-500 text-white'
                  : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-purple-500'
              }`}
            >
              <div>{ps.nama}</div>
              <div className="text-xs opacity-70">{formatRupiah(ps.harga_per_jam)}/jam</div>
            </button>
          ))}
        </div>
        {errors.ps_id && <p className="text-red-400 text-xs mt-1">{errors.ps_id}</p>}
      </div>

      {/* Jumlah Jam */}
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">Berapa Jam *</label>
        <input
          type="number"
          min="1"
          max="24"
          value={form.jumlah_jam}
          onChange={(e) => setForm({ ...form, jumlah_jam: e.target.value })}
          placeholder="Contoh: 3"
          className={inputClass('jumlah_jam')}
        />
        {errors.jumlah_jam && <p className="text-red-400 text-xs mt-1">{errors.jumlah_jam}</p>}
      </div>

      {/* Preview kalkulasi */}
      {jumlahJam > 0 && selectedPs && (
        <div className="bg-purple-900/20 border border-purple-700 rounded-xl p-4 space-y-2">
          <p className="text-purple-300 font-medium text-sm mb-2">Preview Rental</p>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-gray-400 text-xs">📅 Jam Mulai</p>
              <p className="text-white font-medium">{formatDateTime(jamMulai.toISOString())}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">⏰ Jam Selesai</p>
              <p className="text-white font-medium">{jamSelesai ? formatDateTime(jamSelesai.toISOString()) : '-'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">💰 Total Bayar</p>
              <p className="text-purple-400 font-bold">{formatRupiah(totalBayar)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Karyawan & Metode Bayar */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Dilayani Karyawan *</label>
          <select
            value={form.karyawan_id}
            onChange={(e) => setForm({ ...form, karyawan_id: e.target.value })}
            className={inputClass('karyawan_id')}
          >
            <option value="">Pilih karyawan</option>
            {karyawanList.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nama} ({k.komisi_persen}%)
              </option>
            ))}
          </select>
          {errors.karyawan_id && <p className="text-red-400 text-xs mt-1">{errors.karyawan_id}</p>}
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Metode Pembayaran *</label>
          <div className="grid grid-cols-2 gap-2">
            {(['cash', 'qris'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setForm({ ...form, metode_bayar: m })}
                className={`py-2.5 rounded-xl border font-medium text-sm uppercase transition-all ${
                  form.metode_bayar === m
                    ? 'bg-purple-600 border-purple-500 text-white'
                    : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-purple-500'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors font-medium"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl transition-colors font-medium"
        >
          {loading ? 'Menyimpan...' : editData ? 'Update' : 'Simpan'}
        </button>
      </div>
    </form>
  )
}
