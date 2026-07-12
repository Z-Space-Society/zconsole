import { useState } from 'react'
import { Onboarding, type Profile } from 'local-first-auth/react'
import { useLocalFirstAuth } from '../hooks/useLocalFirstAuth'

/**
 * Full-page profile creation. Unlike the onboarding modal, this is a dedicated
 * route (/events/new-user) so a profile can be created in a plain browser — then
 * promoted to admin via the displayed DID.
 */
export function NewUser() {
  const { handleOnboardingComplete } = useLocalFirstAuth()
  const [created, setCreated] = useState<Profile | null>(null)
  const [copied, setCopied] = useState(false)

  const onComplete = (profile: Profile) => {
    // Inject the API (plain browser) + add the user to the database.
    handleOnboardingComplete()
    setCreated(profile)
  }

  const copyDid = async () => {
    if (!created) return
    try {
      await navigator.clipboard.writeText(created.did)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable — the DID is still selectable on screen */
    }
  }

  if (created) {
    return (
      <div className="ev-root">
        <div className="w-full max-w-lg mx-auto px-6 py-12">
          <div className="card p-8">
            <div className="text-5xl mb-4 text-center">🎉</div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1 text-center">
              Profile created
            </h1>
            <p className="text-gray-500 text-center mb-6">
              Welcome, {created.name}! Your profile lives in this browser.
            </p>

            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mt-4 mb-2">
              Your DID
            </label>
            <div className="flex items-center gap-2 mb-6">
              <code className="flex-1 text-xs bg-gray-100 rounded-lg px-3 py-2 break-all select-all">
                {created.did}
              </code>
              <button
                onClick={copyDid}
                className="shrink-0 px-3 py-2 text-sm font-medium bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="ev-root">
      <div className="w-full max-w-lg mx-auto px-4 py-10">
        <div className="rounded-2xl shadow-xl overflow-hidden">
          <Onboarding skipSocialStep={true} onComplete={onComplete} />
        </div>
      </div>
    </div>
  )
}
