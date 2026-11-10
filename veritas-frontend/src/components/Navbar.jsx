
import React, { useState } from 'react';
import './Navbar.css';

const navigation = [
  { id: 'dashboard', label: 'Skaneri', icon: 'scan' },
  { id: 'analytics', label: 'Analytics', icon: 'chart' },
  { id: 'history', label: 'Historia', icon: 'history' },
];

function NavIcon({ name, size = 17 }) {
  const shared = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  if (name === 'scan') {
    return (
      <svg {...shared}>
        <path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" />
        <path d="M7 12h10M12 7v10" />
      </svg>
    );
  }

  if (name === 'chart') {
    return (
      <svg {...shared}>
        <path d="M4 20V12M10 20V5M16 20v-9M22 20V8" />
        <path d="M2 20h20" />
      </svg>
    );
  }

  return (
    <svg {...shared}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5M12 7v5l3 2" />
    </svg>
  );
}

export default function Navbar({ setPage, currentPage }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const navigate = (page) => {
    setPage(page);
    setMenuOpen(false);
  };

  return (
    <header className="veritas-header">
      <nav className="veritas-navbar" aria-label="Navigimi kryesor">
        <button
          type="button"
          className="veritas-brand"
          onClick={() => navigate('dashboard')}
          aria-label="Veritas - faqja kryesore"
        >
          <span className="veritas-brand-symbol" aria-hidden="true">
            <svg
              width="25"
              height="25"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M12 2.5 20 6v5.2c0 5.2-3.3 8.7-8 10.3-4.7-1.6-8-5.1-8-10.3V6l8-3.5Z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="m8.3 12.1 2.5 2.5 5-5.2"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>

          <span className="veritas-brand-name">
            veritas<span>.</span>
          </span>
        </button>

        <div className="veritas-nav-links">
          {navigation.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.id)}
              className={`veritas-nav-link ${
                currentPage === item.id ? 'is-active' : ''
              }`}
              aria-current={
                currentPage === item.id ? 'page' : undefined
              }
            >
              <NavIcon name={item.icon} size={16} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <div className="veritas-nav-actions">
          <span className="veritas-system-status">
            <span className="veritas-status-dot" />
            AI Engine
          </span>

          {currentPage !== 'dashboard' && (
  <button
    type="button"
    className="veritas-start-button"
    onClick={() => navigate('dashboard')}
  >
    Analizë e re
    <span aria-hidden="true">↗</span>
  </button>
)}
        </div>

        <button
          type="button"
          className="veritas-mobile-toggle"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label={menuOpen ? 'Mbyll menynë' : 'Hap menynë'}
          aria-expanded={menuOpen}
          aria-controls="veritas-mobile-menu"
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </nav>

      <div
        id="veritas-mobile-menu"
        className={`veritas-mobile-menu ${
          menuOpen ? 'is-open' : ''
        }`}
        hidden={!menuOpen}
      >
        {navigation.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => navigate(item.id)}
            className={`veritas-mobile-link ${
              currentPage === item.id ? 'is-active' : ''
            }`}
            aria-current={
              currentPage === item.id ? 'page' : undefined
            }
          >
            <NavIcon name={item.icon} />
            {item.label}
          </button>
        ))}
      </div>
    </header>
  );
}
