'use client'

import { type Pelanggan } from '@/lib/supabase'
import { formatDateTime, formatRupiah } from '@/lib/utils'
import Modal from '@/components/Modal'

interface Props {
  pelanggan: Pelanggan
  onConfirm: () => void
  onCancel: () => void
}

export default function KonfirmasiSelesai({ pelanggan, onConfirm, onCancel }: Props) {
  const now = new Date()

  return (
    <Modal isOpen={true} onClose={onCancel} title="Konfirmasi Pengembalian PS" size="sm">
      <div className="space-y-4">
        <div className="bg-green-900/20 border border-green-700 rounded-xl p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Pelanggan</span>
            <span className="text-white font-medium">{pelanggan.nama}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">PS</span>
            <span className="text-purple-400 font-medium">{pelanggan.ps_units?.nama}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Jam Mulai</span>
            <span className="text-white">{formatDateTime(pelanggan.jam_mulai)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Jam Estimasi Selesai</span>
            <span className="text-white">{formatDateTime(pelanggan.jam_selesai)}</span>
          </div>
          <div className="border-t border-green-700 pt-3 flex justify-between text-sm">
            <span className="text-gray-400">🕐 Dikembalikan Jam</span>
            <span className="text-green-400 font-bold">{formatDateTime(now.toISOString())}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Total Bayar</span>
            <span className="text-white font-bold">{formatRupiah(pelanggan.total)}</span>
          </div>
        </div>

        <p className="text-gray-400 text-sm text-center">
          PS akan ditandai sebagai selesai dan waktu pengembalian dicatat sekarang.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors font-medium"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl transition-colors font-medium"
          >
            ✅ Konfirmasi Selesai
          </button>
        </div>
      </div>
    </Modal>
  )
}
