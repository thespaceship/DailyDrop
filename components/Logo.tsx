export default function Logo() {
  return (
    <div className="brand">
      <span className="logo-mark" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 6l8 7 8-7"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M4 13l8 7 8-7"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.4"
          />
        </svg>
      </span>
      <span className="wordmark">DailyDrop</span>
    </div>
  )
}
