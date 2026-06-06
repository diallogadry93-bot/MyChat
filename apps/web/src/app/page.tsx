export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-primary-500 mb-4">MyChat</h1>
        <p className="text-xl text-gray-500 mb-8">
          Privacy-first, AI-enhanced messaging
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-50 text-primary-700 text-sm font-medium">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Phase 0 — Monorepo initialized
        </div>
      </div>
    </main>
  )
}
