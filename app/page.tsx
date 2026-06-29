import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export default function Home() {
  // If they hit the root without a valid session, show a blank page
  // Access is only via /drop/[token]
  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0a0a'
    }}>
      <p style={{ color: '#333', fontSize: '14px' }}>Nothing here.</p>
    </main>
  )
}
