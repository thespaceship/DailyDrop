'use client'

import { Component, ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('Unhandled UI error:', error)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="card" style={{ margin: 16 }}>
          <div className="section-title" style={{ marginBottom: 8 }}>
            <AlertTriangle size={16} color="var(--danger)" />
            Something went wrong
          </div>
          <p className="empty-text" style={{ marginBottom: 12 }}>
            {this.state.error.message || 'An unexpected error occurred.'}
          </p>
          <button className="btn btn-ghost btn-block" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
