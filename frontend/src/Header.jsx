import React from 'react';
import './App.css';

const Header = ({ userName, riskLevel }) => {
  const getStatusColor = () => {
    if (riskLevel === 'high') return '#ef4444';
    if (riskLevel === 'low') return '#10b981';
    return '#6366f1';
  };

  return (
    <header className="main-header">
      <div className="header-left">
        <h1 className="logo">P.O.V</h1>
      </div>
      <div className="header-right">
        <div className="user-status">
          <span className="status-dot" style={{ backgroundColor: getStatusColor() }}></span>
          <span className="user-name">{userName}</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
