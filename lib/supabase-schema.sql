-- Jalankan SQL ini di Supabase SQL Editor

-- Tabel karyawan
CREATE TABLE IF NOT EXISTS karyawan (
  id TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  no_telepon TEXT NOT NULL,
  komisi_persen NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel ps_units (PS 1-5)
CREATE TABLE IF NOT EXISTS ps_units (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nama TEXT NOT NULL UNIQUE,
  harga_per_jam INTEGER NOT NULL DEFAULT 0,
  jumlah_unit INTEGER NOT NULL DEFAULT 1
);

-- Insert default PS 1-5
INSERT INTO ps_units (nama, harga_per_jam) VALUES
  ('PS 1', 15000),
  ('PS 2', 15000),
  ('PS 3', 15000),
  ('PS 4', 15000),
  ('PS 5', 15000)
ON CONFLICT (nama) DO NOTHING;

-- Tabel pelanggan (transaksi rental)
CREATE TABLE IF NOT EXISTS pelanggan (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nama TEXT NOT NULL,
  no_telepon TEXT NOT NULL,
  identitas_url TEXT,
  ps_id UUID NOT NULL REFERENCES ps_units(id),
  jumlah_jam INTEGER NOT NULL,
  jam_mulai TIMESTAMPTZ NOT NULL,
  jam_selesai TIMESTAMPTZ NOT NULL,
  jam_dikembalikan TIMESTAMPTZ,
  total INTEGER NOT NULL,
  metode_bayar TEXT NOT NULL CHECK (metode_bayar IN ('qris', 'cash')),
  karyawan_id TEXT NOT NULL REFERENCES karyawan(id),
  status TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'telat', 'selesai')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Storage bucket untuk identitas
INSERT INTO storage.buckets (id, name, public) VALUES ('identitas', 'identitas', true)
ON CONFLICT (id) DO NOTHING;

-- Policy storage: allow public read
CREATE POLICY "Public read identitas" ON storage.objects
  FOR SELECT USING (bucket_id = 'identitas');

CREATE POLICY "Authenticated upload identitas" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'identitas');

CREATE POLICY "Authenticated delete identitas" ON storage.objects
  FOR DELETE USING (bucket_id = 'identitas');

-- Enable RLS (opsional, bisa dimatikan untuk dev)
-- ALTER TABLE karyawan ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ps_units ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE pelanggan ENABLE ROW LEVEL SECURITY;
