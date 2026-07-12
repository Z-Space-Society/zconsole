import { Outlet } from 'react-router-dom'
import { Onboarding } from 'local-first-auth/react'
import { AuthProvider, useLocalFirstAuth } from './hooks/useLocalFirstAuth'

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

  // Loading state — shown on the paper backdrop so it blends into the device frame.
  if (loading) {
    return (
      <div className="ev-root">
        <div className="ev-loading">Loading…</div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="ev-root">
        <div className="text-center max-w-md px-6">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-semibold mb-2">Something went wrong</h1>
          <p className="text-sm" style={{ color: 'var(--ink-2)' }}>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* The events app owns the full viewport (centered device frame). */}
      <Outlet />

      {/* Onboarding modal */}
      {isOnboardingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsOnboardingModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-lg mx-4 max-h-[90vh] overflow-auto rounded-2xl shadow-2xl">
            <Onboarding skipSocialStep={true} onComplete={handleOnboardingComplete} />
          </div>
        </div>
      )}

      {/* Reset modal (admin broadcast) */}
      {resetMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative z-10 bg-white rounded-2xl shadow-xl p-8 max-w-md mx-4 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Admin Reset</h2>
            <p className="text-gray-600">{resetMessage}</p>
            <button
              onClick={() => setResetMessage(null)}
              className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export function App() {
  return (
    <AuthProvider>
      <Layout />
    </AuthProvider>
  )
}
