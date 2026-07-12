import { Outlet } from 'react-router-dom'
import { Onboarding } from 'local-first-auth/react'
import { AuthProvider, useLocalFirstAuth } from './hooks/useLocalFirstAuth'
import { QRCodePanel } from './components/QRCodePanel'
import { Footer } from './components/Footer'

function Layout() {
  const {
    loading,
    error,
    isOnboardingModalOpen,
    resetMessage,
    setIsOnboardingModalOpen,
    setResetMessage,
    handleOnboardingComplete,
  } = useLocalFirstAuth()

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--darkroom)' }}>
        <div className="grid md:grid-cols-2 min-h-screen">
          <QRCodePanel />
          <div className="device">
            <div className="leak" />
            <div className="flex items-center justify-center min-h-screen">
              <div className="eyebrow">Developing…</div>
            </div>
            <div className="grain" />
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--darkroom)' }}>
        <div className="grid md:grid-cols-2 min-h-screen">
          <QRCodePanel />
          <div className="device">
            <div className="leak" />
            <div className="flex items-center justify-center min-h-screen px-6 text-center">
              <div>
                <div className="text-5xl mb-4">⚠️</div>
                <h1 className="nr-h" style={{ fontSize: 36 }}>Error</h1>
                <p className="eyebrow" style={{ textTransform: 'none' }}>{error}</p>
              </div>
            </div>
            <div className="grain" />
          </div>
        </div>
      </div>
    )
  }

  // Main layout with routes
  return (
    <div className="min-h-screen" style={{ background: 'var(--darkroom)' }}>
      <div className="grid md:grid-cols-2 min-h-screen">
        <QRCodePanel />
        <div className="device">
          <div className="leak" />
          <main>
            <Outlet />
          </main>
          <Footer />
          <div className="grain" />
        </div>
      </div>

      {/* Onboarding modal */}
      {isOnboardingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsOnboardingModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-lg mx-4 max-h-[90vh] overflow-auto rounded-2xl shadow-2xl">
            <Onboarding
              skipSocialStep={true}
              onComplete={handleOnboardingComplete}
            />
          </div>
        </div>
      )}

      {/* Reset Modal */}
      {resetMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative z-10 bg-film border border-white/10 rounded-2xl shadow-2xl p-8 max-w-md mx-4 text-center">
            <h2 className="font-display font-bold text-2xl uppercase tracking-wide text-paper mb-4">Admin Reset</h2>
            <p className="font-mono text-[12px] tracking-wide text-paper-dim">{resetMessage}</p>
            <button
              onClick={() => setResetMessage(null)}
              className="mt-6 px-6 py-2 bg-stamp text-ink font-mono font-bold text-[11px] tracking-[.14em] uppercase rounded-full hover:brightness-110 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function App() {
  return (
    <AuthProvider>
      <Layout />
    </AuthProvider>
  )
}
