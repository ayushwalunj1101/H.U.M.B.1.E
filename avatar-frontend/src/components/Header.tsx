'use client';

import React from 'react';

interface HeaderProps {
  userName?: string;
  riskLevel?: 'unknown' | 'low' | 'high';
}

export default function Header({ userName, riskLevel }: HeaderProps) {
  const getStatusColor = () => {
    if (riskLevel === 'high') return '#ef4444';
    if (riskLevel === 'low') return '#10b981';
    return '#6366f1';
  };

  return (
    <header className="main-header">
      <div className="header-left">
        <h1 className="logo">H.U.M.B.1.E</h1>
      </div>
      <div className="header-right">
        <div className="user-status">
          <span className="status-dot" style={{ backgroundColor: getStatusColor() }} />
          <span className="user-name">{userName}</span>
        </div>
      </div>
    </header>
  );
}
