'use client'

import { useEffect, useRef, useState } from 'react'
import { Library, Plus, Trash2, AlertTriangle, Paperclip, X } from 'lucide-react'
import { formatCost } from '@/lib/pricing'
import { uploadLibraryFile } from '@/lib/storage'
import type { LibraryDocument } from '@/lib/types'

const MAX_FILE_BYTES = 15 * 1024 * 1024 // 15MB
const ACCEPTED_EXTENSIONS = ['.pdf', '.txt', '.md', '.markdown']

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
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [savingLabel, setSavingLabel] = useState('Summarizing and saving...')
  const [lastAddedCost, setLastAddedCost] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  function resetForm() {
    setTitle('')
    setContent('')
    setPdfFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')

    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setError('Only PDF, TXT, and MD files are supported right now.')
      e.target.value = ''
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('File is too large — the limit is 15MB.')
      e.target.value = ''
      return
    }

    if (!title.trim()) {
      setTitle(file.name.replace(/\.[^.]+$/, ''))
    }

    if (ext === '.pdf') {
      setPdfFile(file)
      setContent('')
    } else {
      // .txt / .md — read as plain text and reuse the existing text path.
      const text = await file.text()
      setContent(text)
      setPdfFile(null)
    }
  }

  function clearFile() {
    setPdfFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function addDocument() {
    if (!title.trim() || saving) return
    if (!pdfFile && content.trim().length < 50) return

    setSaving(true)
    setError('')
    try {
      let res: Response
      if (pdfFile) {
        setSavingLabel('Uploading file...')
        const fileUrl = await uploadLibraryFile(pdfFile)
        if (!fileUrl) throw new Error('Failed to upload the file. Please try again.')

        setSavingLabel('Reading and summarizing...')
        res = await fetch('/api/library', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-drop-token': token },
          body: JSON.stringify({ title, fileUrl, fileName: pdfFile.name }),
        })
      } else {
        setSavingLabel('Summarizing and saving...')
        res = await fetch('/api/library', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-drop-token': token },
          body: JSON.stringify({ title, content }),
        })
      }

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add document')
      setDocuments(prev => [data.document, ...prev])
      setLastAddedCost(typeof data.cost === 'number' ? data.cost : null)
      resetForm()
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

  const canSave = title.trim().length > 0 && (Boolean(pdfFile) || content.trim().length >= 50)

  return (
    <div className="stack-16 library-workspace">
      <section className="card library-controls-card">
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

            {pdfFile ? (
              <div className="item-row" style={{ marginTop: 0 }}>
                <div className="item-main">
                  <div className="item-title">{pdfFile.name}</div>
                  <div className="item-sub">{(pdfFile.size / 1024 / 1024).toFixed(1)} MB</div>
                </div>
                <button className="btn-icon btn-icon-danger" onClick={clearFile} aria-label="Remove file">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="label" htmlFor="doc-content">
                  Content
                </label>
                <textarea
                  id="doc-content"
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  rows={8}
                  placeholder="Paste the document text here, or upload a file below"
                />
              </div>
            )}

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS.join(',')}
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                id="doc-file"
              />
              <label htmlFor="doc-file" className="btn btn-ghost btn-block btn-sm" style={{ cursor: 'pointer' }}>
                <Paperclip size={14} /> {pdfFile ? 'Choose a different file' : 'Or upload a PDF, TXT, or MD file'}
              </label>
            </div>

            <button className="btn btn-primary btn-block" onClick={addDocument} disabled={saving || !canSave}>
              {saving ? (
                <>
                  <span className="spinner" /> {savingLabel}
                </>
              ) : (
                'Add to library'
              )}
            </button>
            <button
              className="btn btn-ghost btn-block"
              onClick={() => {
                resetForm()
                setShowForm(false)
              }}
              disabled={saving}
            >
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

      <div className="library-document-grid">
        {loading ? (
          <div className="status-row" style={{ padding: '0 4px' }}>
            <span className="dot dot-loading" /> Loading library
          </div>
        ) : documents.length === 0 ? (
          <section className="card desktop-library-empty" aria-label="Empty knowledge library">
            <div className="desktop-result-empty-icon">
              <Library size={20} />
            </div>
            <p className="section-title">Your research library is ready</p>
            <p className="empty-text">
              Add an earnings report, research note, or source document. Its summary will appear
              here and become durable context for future briefings.
            </p>
          </section>
        ) : (
          documents.map(doc => (
            <section key={doc.id} className="card library-document-card">
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
                <p className="library-document-summary">
                  {doc.summary}
                </p>
              )}
            </section>
          ))
        )}
      </div>
    </div>
  )
}
