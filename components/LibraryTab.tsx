'use client'

import { useEffect, useState } from 'react'
import { Library, Plus, Trash2, AlertTriangle } from 'lucide-react'
import { formatCost } from '@/lib/pricing'
import type { LibraryDocument } from '@/lib/types'

interface LibraryTabProps {
  token: string
}

export default function LibraryTab({ token }: LibraryTabProps) {
  const [documents, setDocuments] = useState<LibraryDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [lastAddedCost, setLastAddedCost] = useState<number | null>(null)

  useEffect(() => {
    loadDocuments()
  }, [])

  async function loadDocuments() {
    setLoading(true)
    try {
      const res = await fetch('/api/library', { headers: { 'x-drop-token': token } })
      const data = await res.json()
      setDocuments(data.documents || [])
      if (data.error) setError(data.error)
    } catch {
      setError('Could not load the library')
    }
    setLoading(false)
  }

  async function addDocument() {
    if (!title.trim() || content.trim().length < 50 || saving) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-drop-token': token },
        body: JSON.stringify({ title, content }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add document')
      setDocuments(prev => [data.document, ...prev])
      setLastAddedCost(typeof data.cost === 'number' ? data.cost : null)
      setTitle('')
      setContent('')
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add document')
    }
    setSaving(false)
  }

  async function deleteDocument(id: string) {
    if (!window.confirm('Remove this document from the library?')) return
    try {
      const res = await fetch('/api/library', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-drop-token': token },
        body: JSON.stringify({ id }),
      })
      if (res.ok) setDocuments(prev => prev.filter(d => d.id !== id))
    } catch {
      // Leave the list as-is; the next load will reconcile.
    }
  }

  return (
    <div className="stack-16">
      <section className="card">
        <div className="section-head">
          <span className="section-title">
            <Library size={15} />
            Knowledge library
          </span>
          {documents.length > 0 && <span className="badge">{documents.length}</span>}
        </div>

        <p className="hint" style={{ marginBottom: 12 }}>
          Documents added here — earnings reports, research, your own notes — are summarized and
          included as context in every briefing.
        </p>

        {showForm ? (
          <div className="stack-8">
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="label" htmlFor="doc-title">
                Title
              </label>
              <input
                id="doc-title"
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. NVDA Q1 earnings notes"
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="label" htmlFor="doc-content">
                Content
              </label>
              <textarea
                id="doc-content"
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={8}
                placeholder="Paste the document text here"
              />
            </div>
            <button
              className="btn btn-primary btn-block"
              onClick={addDocument}
              disabled={saving || !title.trim() || content.trim().length < 50}
            >
              {saving ? (
                <>
                  <span className="spinner" /> Summarizing and saving...
                </>
              ) : (
                'Add to library'
              )}
            </button>
            <button className="btn btn-ghost btn-block" onClick={() => setShowForm(false)} disabled={saving}>
              Cancel
            </button>
          </div>
        ) : (
          <button className="btn btn-ghost btn-block" onClick={() => setShowForm(true)}>
            <Plus size={16} /> Add document
          </button>
        )}

        {error && (
          <div className="error-box" style={{ marginTop: 12 }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            {error}
          </div>
        )}

        {lastAddedCost !== null && (
          <p className="meta-line" style={{ marginTop: 12 }}>
            Last summary cost: {formatCost(lastAddedCost)}
          </p>
        )}
      </section>

      {loading ? (
        <div className="status-row" style={{ padding: '0 4px' }}>
          <span className="dot dot-loading" /> Loading library
        </div>
      ) : (
        documents.map(doc => (
          <section key={doc.id} className="card">
            <div className="section-head" style={{ marginBottom: 6 }}>
              <span className="section-title">{doc.title}</span>
              <button
                className="btn-icon btn-icon-danger"
                onClick={() => deleteDocument(doc.id)}
                aria-label="Delete document"
              >
                <Trash2 size={15} />
              </button>
            </div>
            <p className="meta-line" style={{ marginBottom: 8 }}>
              Added{' '}
              {new Date(doc.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
            {doc.summary && (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {doc.summary}
              </p>
            )}
          </section>
        ))
      )}
    </div>
  )
}
