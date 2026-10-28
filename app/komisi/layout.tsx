export default function KomisiLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-gray-950 overflow-auto z-50">
      {children}
    </div>
  )
}
