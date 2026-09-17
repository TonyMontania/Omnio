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
    intro: 'AniDB\'s HTTP API uses a TWO-step registration: you register a "Project" (a container), and THEN you add a "Client" under it. The Client name is what Omnio uses, not the Project name. Log in first, then open the link.',
    steps: [
      { label: 'PROJECT — Project Name', value: 'omnio (or any lowercase word)', hint: 'Just a container label — this one is NOT what Omnio uses.' },
      { label: 'PROJECT — Type', value: 'unknown', hint: 'Also fine: "library manager".' },
      { label: 'PROJECT — State', value: 'in development', hint: 'Leave as-is.' },
      { label: 'PROJECT — Public Project?', value: 'no, private only', hint: 'You aren\'t distributing anything.' },
      { label: 'PROJECT — Target OS / Language / URL', value: '(leave empty)' },
      { label: 'PROJECT — Contact', value: 'your email', hint: 'AniDB doesn\'t verify it but keep it real.' },
      { label: 'PROJECT — Description', value: 'Personal library tracker', hint: 'Any short sentence.' },
      { label: 'Submit the Project form.', value: '(top of the resulting page will show a warning: "You haven\'t added a client for this project yet.")', hint: 'That warning is expected — you\'re about to fix it.' },
      { label: 'Click "Add Client"', value: 'button on the right of the project page', hint: 'Opens a tiny 3-field form titled "Register A New Client".' },
      { label: 'CLIENT — Client Name', value: 'omniohttp (lowercase, no spaces)', hint: 'THIS is the value that goes into Omnio\'s "AniDB client name" field. AniDB requires a-z lowercase only — no numbers, no capitals, no spaces. Pick anything unique.' },
      { label: 'CLIENT — API', value: 'HTTP API', hint: 'CRITICAL: the dropdown DEFAULTS to "UDP API". Switch it to "HTTP API" — Omnio only talks HTTP. If you leave it on UDP, the fetcher will get "unknown command" errors.' },
      { label: 'CLIENT — Version', value: '1', hint: 'Numeric only (0-9). Any positive integer works.' },
      { label: 'Click "+ Add Client"', value: 'green button at the bottom of the form' },
    ],
    finish: 'Copy the CLIENT name (e.g. "omniohttp"), NOT the Project name, and paste it into Settings → AniDB client name here. AniDB\'s rate limit is one request per ~2 seconds; ignoring it can get the client banned.',
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
