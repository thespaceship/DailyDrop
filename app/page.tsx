export default function Home() {
  // Access is only via /drop/[token]. The root intentionally reveals nothing.
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Nothing here.</p>
    </main>
  )
}
