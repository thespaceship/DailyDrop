export default function ContactPage() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8 }}>
          Access unavailable
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
          Your DailyDrop access is currently inactive. Contact the person who shared this link with
          you to restore access.
        </p>
      </div>
    </main>
  )
}
