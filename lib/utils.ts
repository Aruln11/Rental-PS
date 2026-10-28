export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr)
  const tanggal = new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
  const jam = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
  return `${tanggal} ${jam}`
}

export function hitungJamSelesai(jamMulai: Date, jumlahJam: number): Date {
  const selesai = new Date(jamMulai)
  selesai.setHours(selesai.getHours() + jumlahJam)
  return selesai
}

export function getStatus(jamSelesai: string, jamDikembalikan: string | null): 'aktif' | 'telat' | 'selesai' {
  if (jamDikembalikan) return 'selesai'
  const now = new Date()
  const selesai = new Date(jamSelesai)
  if (now > selesai) return 'telat'
  return 'aktif'
}

export function generateKaryawanId(existingIds: string[]): string {
  if (!existingIds || existingIds.length === 0) return 'EMP-0001'
  let maxNum = 0
  existingIds.forEach((id) => {
    const match = id.match(/^EMP-(\d+)$/)
    if (match) {
      const num = parseInt(match[1])
      if (num > maxNum) maxNum = num
    }
  })
  const nextNum = maxNum + 1
  return `EMP-${String(nextNum).padStart(4, '0')}`
}
