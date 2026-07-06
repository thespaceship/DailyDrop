import { SECTION_MARKER_PATTERN } from '@/lib/constants'

interface ScriptViewProps {
  script: string
}

type Segment = { type: 'header'; text: string } | { type: 'paragraph'; text: string }

/**
 * Renders a briefing script. Lines like [MARKET SUMMARY] become styled
 * section headers; everything else renders as prose paragraphs.
 */
export default function ScriptView({ script }: ScriptViewProps) {
  const segments = parseScript(script)

  return (
    <div className="memo">
      {segments.map((segment, i) =>
        segment.type === 'header' ? (
          <div key={i} className="memo-section-title">
            {segment.text}
          </div>
        ) : (
          <p key={i}>{segment.text}</p>
        )
      )}
    </div>
  )
}

function parseScript(script: string): Segment[] {
  const segments: Segment[] = []
  let paragraph: string[] = []

  const flush = () => {
    if (paragraph.length > 0) {
      segments.push({ type: 'paragraph', text: paragraph.join('\n') })
      paragraph = []
    }
  }

  for (const rawLine of script.split('\n')) {
    const line = rawLine.trim()
    if (!line) {
      flush()
    } else if (SECTION_MARKER_PATTERN.test(line)) {
      flush()
      segments.push({ type: 'header', text: line.slice(1, -1) })
    } else {
      paragraph.push(line)
    }
  }
  flush()

  return segments
}
