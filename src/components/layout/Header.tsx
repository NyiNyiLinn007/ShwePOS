'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';

interface HeaderProps {
  title: string;
  titleMm?: string;
  subtitle?: string;
  subtitleMm?: string;
  children?: React.ReactNode;
}

export default function Header({
  title,
  titleMm,
  subtitle,
  subtitleMm,
  children,
}: HeaderProps) {
  const { language, toggleLanguage } = useAppStore();
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString('en-US', {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }) +
          ' • ' +
          now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const displayTitle = language === 'mm' && titleMm ? titleMm : title;
  const displaySubtitle =
    language === 'mm' && subtitleMm ? subtitleMm : subtitle;

  return (
    <header className="page-header">
      <div className="page-title-group">
        <h1
          className={`page-title${language === 'mm' ? ' mm-text' : ''}`}
        >
          {displayTitle}
        </h1>
        {displaySubtitle && (
          <p
            className={`page-subtitle${language === 'mm' ? ' mm-text' : ''}`}
          >
            {displaySubtitle}
          </p>
        )}
      </div>

      <div className="page-actions">
        {currentTime && (
          <span
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-muted)',
              marginRight: 'var(--space-sm)',
            }}
          >
            {currentTime}
          </span>
        )}

        <button
          className="btn btn-secondary btn-sm"
          onClick={toggleLanguage}
          title={language === 'en' ? 'Switch to Myanmar' : 'Switch to English'}
        >
          {language === 'en' ? '🇲🇲 MM' : '🇬🇧 EN'}
        </button>

        {children}
      </div>
    </header>
  );
}
