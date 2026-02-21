/**
 * CitationsPanel — Renders source citations below the avatar.
 * Shows source name, page number, and relevance rank.
 */
'use client';

import React from 'react';
import { Citation } from '@/lib/rag-client';

interface CitationsPanelProps {
  citations: Citation[];
  visible: boolean;
}

export default function CitationsPanel({ citations, visible }: CitationsPanelProps) {
  if (!visible || citations.length === 0) return null;

  return (
    <div className="citations-panel">
      <div className="citations-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
        <span>Sources</span>
      </div>

      <div className="citations-list">
        {citations.map((citation, index) => (
          <div key={index} className="citation-card">
            <div className="citation-rank">#{citation.relevance_rank}</div>
            <div className="citation-info">
              <span className="citation-name">{citation.source_name}</span>
              {citation.page !== undefined && (
                <span className="citation-page">Page {citation.page}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .citations-panel {
          width: 100%;
          max-width: 600px;
          margin: 0 auto;
          animation: slideUp 0.4s ease-out;
        }

        .citations-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 0;
          color: #94a3b8;
          font-size: 13px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .citations-list {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .citation-card {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          background: rgba(99, 102, 241, 0.08);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 12px;
          transition: all 0.2s ease;
        }

        .citation-card:hover {
          background: rgba(99, 102, 241, 0.15);
          border-color: rgba(99, 102, 241, 0.4);
          transform: translateY(-1px);
        }

        .citation-rank {
          font-size: 11px;
          font-weight: 700;
          color: #6366f1;
          background: rgba(99, 102, 241, 0.15);
          padding: 2px 6px;
          border-radius: 6px;
        }

        .citation-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .citation-name {
          font-size: 13px;
          font-weight: 500;
          color: #e2e8f0;
        }

        .citation-page {
          font-size: 11px;
          color: #64748b;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
