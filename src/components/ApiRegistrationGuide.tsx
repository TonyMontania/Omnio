// Step-by-step guide for the API-keyed integrations.
//
// Each guide walks the user through the registration form of the
// third-party service (AniDB, IGDB, TMDb, SteamGridDB, ComicVine)
// with the exact values Omnio needs. Rendered as a modal from a
// small "?" button beside every API-key field in Settings so the
// user never has to guess which dropdown to pick or which redirect
// URL to type.
//
// Guides are static data — pure content, no fetches. When a service
// changes its registration flow, update the entry here and no other
// code needs to move.

interface Step {
  label: string
  value?: string
  hint?: string
}

interface Guide {
  id: string
  service: string
  registerUrl: string
  intro: string
  steps: Step[]
  finish: string
}

const GUIDES: Record<string, Guide> = {
  anidb: {
    id: 'anidb',
    service: 'AniDB',
    registerUrl: 'https://anidb.net/software/add',
    intro: 'AniDB needs a "Project" registered under your account. Log in first, then open the link and fill the form like this:',
    steps: [
      { label: 'Project Name', value: 'omnio (or any lowercase word)', hint: 'This exact value is what you paste into Omnio\'s "AniDB client name" field.' },
      { label: 'Type', value: 'unknown', hint: 'Also fine: "library manager".' },
      { label: 'State', value: 'in development', hint: 'Leave as-is.' },
      { label: 'Public Project?', value: 'no, private only', hint: 'You aren\'t distributing anything.' },
      { label: 'Target OS', value: '(leave empty)' },
      { label: 'Language', value: '(leave empty)' },
      { label: 'Contact', value: 'your email', hint: 'AniDB doesn\'t verify it but keep it a real address.' },
      { label: 'URL', value: '(leave empty)' },
      { label: 'Description', value: 'Personal library tracker', hint: 'Any short sentence. AniDB doesn\'t police this.' },
    ],
    finish: 'Submit — approval is instant. Copy the Project Name you picked and paste it into Settings → AniDB client name here.',
  },
  igdb: {
    id: 'igdb',
    service: 'IGDB (via Twitch dev console)',
    registerUrl: 'https://dev.twitch.tv/console/apps',
    intro: 'IGDB is served through Twitch\'s dev console. You need a free Twitch account. Click "Register Your Application" on the linked page:',
    steps: [
      { label: 'Name', value: 'omnio (or anything)', hint: 'Just a label — Twitch shows it in your app list.' },
      { label: 'OAuth Redirect URLs', value: 'http://localhost', hint: 'IGDB never redirects; any localhost URL works.' },
      { label: 'Category', value: 'Application Integration' },
      { label: 'Client Type', value: 'Confidential' },
    ],
    finish: 'After creating, copy the Client ID into the first field here. Then click "New Secret" on Twitch, confirm, and paste the shown secret into Client Secret before it disappears (Twitch never shows it again).',
  },
  tmdb: {
    id: 'tmdb',
    service: 'TMDb',
    registerUrl: 'https://www.themoviedb.org/settings/api',
    intro: 'Sign up for a free TMDb account, then open the link and click "Request an API Key" → "Developer" → "v3 auth":',
    steps: [
      { label: 'Application Type', value: 'Personal', hint: 'Not "Website".' },
      { label: 'Application Name', value: 'omnio-personal (or anything)' },
      { label: 'Application URL', value: 'https://localhost', hint: 'Any placeholder URL.' },
      { label: 'Application Summary', value: 'Personal library metadata', hint: 'One sentence.' },
      { label: 'Fill your name / email / country', value: '(as-is)' },
    ],
    finish: 'Submit and approval is instant for personal use. On the API page you now see "API Key (v3 auth)" — copy that string and paste it here.',
  },
  sgdb: {
    id: 'sgdb',
    service: 'SteamGridDB',
    registerUrl: 'https://www.steamgriddb.com/profile/preferences/api',
    intro: 'Log in with your Steam account (SteamGridDB has no separate sign-up), then open Preferences → API:',
    steps: [
      { label: 'Generate API key', value: 'Click the button', hint: 'One click generates a key tied to your account.' },
    ],
    finish: 'Copy the shown string and paste it here.',
  },
  comicvine: {
    id: 'comicvine',
    service: 'ComicVine',
    registerUrl: 'https://comicvine.gamespot.com/api/',
    intro: 'ComicVine keys are free and generated per-account. Sign up / log in with a GameSpot account, then open the linked API page — the key is shown at the top of the page after login. No form to fill.',
    steps: [
      { label: 'API Key', value: 'Copy the string at the top of the page', hint: 'It\'s a 40-character hex string.' },
    ],
    finish: 'Paste it here.',
  },
}

interface Props {
  guideId: keyof typeof GUIDES
  onClose: () => void
}

export default function ApiRegistrationGuide({ guideId, onClose }: Props) {
  const guide = GUIDES[guideId]
  if (!guide) return null
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal api-guide-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>How to fill the {guide.service} form</h2>
          <button className="modal-close" onClick={onClose} title="Close" aria-label="Close">✕</button>
        </header>
        <div className="api-guide-body">
          <p className="api-guide-intro">{guide.intro}</p>
          <p className="api-guide-open">
            <a href={guide.registerUrl} target="_blank" rel="noopener noreferrer">Open {guide.registerUrl} ↗</a>
          </p>
          {guide.steps.length > 0 && (
            <ul className="api-guide-steps">
              {guide.steps.map((step, i) => (
                <li key={i} className="api-guide-step">
                  <div className="api-guide-step-label">{step.label}</div>
                  {step.value && <div className="api-guide-step-value"><code>{step.value}</code></div>}
                  {step.hint && <div className="api-guide-step-hint">{step.hint}</div>}
                </li>
              ))}
            </ul>
          )}
          <p className="api-guide-finish"><strong>Finish:</strong> {guide.finish}</p>
        </div>
        <div className="api-guide-actions">
          <button className="primary-btn" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  )
}

export type ApiGuideId = keyof typeof GUIDES
