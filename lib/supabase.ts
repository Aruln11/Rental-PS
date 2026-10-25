import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Karyawan = {
  id: string
  nama: string
  no_telepon: string
  komisi_persen: number
  created_at: string
}

export type PsUnit = {
  id: string
  nama: string
  harga_per_jam: number
  jumlah_unit: number
}

export type Pelanggan = {
  id: string
  nama: string
  no_telepon: string
  identitas_url: string | null
  ps_id: string
  jumlah_jam: number
  jam_mulai: string
  jam_selesai: string
  jam_dikembalikan: string | null
  total: number
  metode_bayar: 'qris' | 'cash'
  karyawan_id: string
  status: 'aktif' | 'telat' | 'selesai'
  komisi_dibayar: boolean
  komisi_dibayar_at: string | null
  created_at: string
  ps_units?: PsUnit
  karyawan?: Karyawan
}
