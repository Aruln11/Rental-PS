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
  const [identitasFiles, setIdentitasFiles] = useState<File[]>([])
  const [identitasPreviews, setIdentitasPreviews] = useState<string[]>([])
  const [existingUrls, setExistingUrls] = useState<string[]>([])
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
      if (editData.identitas_url) {
        const urls = Array.isArray(editData.identitas_url)
          ? editData.identitas_url
          : [editData.identitas_url]
        setExistingUrls(urls)
      }
    }
  }, [editData])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setIdentitasFiles(prev => [...prev, ...files])
    const previews = files.map(f => URL.createObjectURL(f))
    setIdentitasPreviews(prev => [...prev, ...previews])
    // Reset input agar file yang sama bisa dipilih ulang
    e.target.value = ''
  }

  const removeNewFile = (index: number) => {
    setIdentitasFiles(prev => prev.filter((_, i) => i !== index))
    setIdentitasPreviews(prev => {
      URL.revokeObjectURL(prev[index])
      return prev.filter((_, i) => i !== index)
    })
  }

  const removeExistingUrl = (index: number) => {
    setExistingUrls(prev => prev.filter((_, i) => i !== index))
  }

  const isVideo = (src: string, file?: File) => {
    if (file) return file.type.startsWith('video')
    return src.match(/\.(mp4|webm|mov|avi)$/i) !== null
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
      // Mulai dari URL yang sudah ada (tidak dihapus user)
      let identitas_url: string[] = [...existingUrls]

      // Upload file-file baru
      if (identitasFiles.length > 0) {
        const uploadPromises = identitasFiles.map(async (file) => {
          const ext = file.name.split('.').pop()
          const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
          const { error: uploadError } = await supabase.storage
            .from('identitas')
            .upload(fileName, file, { upsert: true })
          if (uploadError) throw uploadError
          const { data } = supabase.storage.from('identitas').getPublicUrl(fileName)
          return data.publicUrl
        })
        const newUrls = await Promise.all(uploadPromises)
        identitas_url = [...identitas_url, ...newUrls]
      }

      const mulai = editData ? new Date(editData.jam_mulai) : new Date()
      const selesai = hitungJamSelesai(mulai, jumlahJam)
      const harga = selectedPs?.harga_per_jam ?? 0
      const total = harga * jumlahJam

      const payload = {
        nama: form.nama.trim(),
        no_telepon: form.no_telepon.trim(),
        identitas_url: identitas_url.length > 0 ? identitas_url : null,
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
        <label className="block text-sm text-gray-400 mb-1.5">
          Upload Identitas
          <span className="text-gray-600 ml-1">(foto/video, bisa lebih dari 1)</span>
        </label>

        {/* Preview file yang sudah ada (edit mode) */}
        {existingUrls.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-2">
            {existingUrls.map((url, i) => (
              <div key={url} className="relative group rounded-lg overflow-hidden border border-gray-700">
                {isVideo(url) ? (
                  <video src={url} className="w-full h-20 object-cover" />
                ) : (
                  <img src={url} alt={`Identitas ${i + 1}`} className="w-full h-20 object-cover" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button type="button" onClick={() => removeExistingUrl(i)}
                    className="bg-red-600 text-white rounded-full p-1 hover:bg-red-500">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <span className="absolute bottom-1 left-1 text-xs bg-black/60 text-white px-1 rounded">
                  {isVideo(url) ? '🎥' : '🖼️'} {i + 1}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Preview file baru */}
        {identitasPreviews.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-2">
            {identitasPreviews.map((preview, i) => (
              <div key={preview} className="relative group rounded-lg overflow-hidden border border-purple-700">
                {isVideo(preview, identitasFiles[i]) ? (
                  <video src={preview} className="w-full h-20 object-cover" />
                ) : (
                  <img src={preview} alt={`Upload ${i + 1}`} className="w-full h-20 object-cover" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button type="button" onClick={() => removeNewFile(i)}
                    className="bg-red-600 text-white rounded-full p-1 hover:bg-red-500">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <span className="absolute bottom-1 left-1 text-xs bg-purple-700/80 text-white px-1 rounded">
                  Baru {i + 1}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Tombol tambah file */}
        <label className="flex items-center gap-3 border-2 border-dashed border-gray-600 rounded-xl px-4 py-3 hover:border-purple-500 transition-colors cursor-pointer">
          <svg className="w-6 h-6 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-gray-500 text-sm">
            {existingUrls.length + identitasPreviews.length > 0
              ? `${existingUrls.length + identitasPreviews.length} file dipilih — klik untuk tambah lagi`
              : 'Klik untuk upload foto/video KTP atau identitas lain'}
          </span>
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      </div>

      {/* Pilih PS */}
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">Pilih PS *</label>
        <div className="grid grid-cols-5 gap-2">
          {psUnits.map((ps) => {
            const total = ps.jumlah_unit ?? 1
            const dipakai = ps.sedang_dipakai ?? 0
            const tersedia = Math.max(0, total - dipakai)
            const penuh = tersedia === 0 && !editData // saat edit, tetap bisa pilih PS yang sama
            const isSelected = form.ps_id === ps.id
            return (
              <button
                key={ps.id}
                type="button"
                disabled={penuh}
                onClick={() => !penuh && setForm({ ...form, ps_id: ps.id })}
                className={`py-3 rounded-xl border font-medium text-sm transition-all flex flex-col items-center gap-0.5
                  ${isSelected
                    ? 'bg-purple-600 border-purple-500 text-white'
                    : penuh
                      ? 'bg-gray-800/40 border-gray-700 text-gray-600 cursor-not-allowed'
                      : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-purple-500'
                  }`}
              >
                <span>{ps.nama}</span>
                <span className="text-xs opacity-70">{formatRupiah(ps.harga_per_jam)}/jam</span>
                <span className={`text-[10px] font-semibold mt-0.5 ${
                  isSelected ? 'text-purple-200' : penuh ? 'text-red-500' : 'text-green-400'
                }`}>
                  {penuh ? '🔴 Penuh' : `${tersedia}/${total}`}
                </span>
              </button>
            )
          })}
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
