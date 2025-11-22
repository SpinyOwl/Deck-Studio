// src/components/LogsPanel/LogsPanel.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { logService, type LogEntry } from '../../services/LogService';
import './LogsPanel.css';

interface Props {
  readonly collapsed: boolean;
}

const SCROLL_THRESHOLD_PX = 8;

/**
 * Presents build, lint, and runtime logs in a dedicated panel.
 */
export const LogsPanel: React.FC<Props> = ({ collapsed }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsubscribe = logService.subscribe(setLogs);

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !isAtBottom) return;

    container.scrollTop = container.scrollHeight;
  }, [logs, isAtBottom]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const distanceFromBottom =
        container.scrollHeight - (container.scrollTop + container.clientHeight);
      setIsAtBottom(distanceFromBottom <= SCROLL_THRESHOLD_PX);
    };

    handleScroll();
    container.addEventListener('scroll', handleScroll);

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const renderedLogs = useMemo(
    () =>
      logs.map(entry => {
        const timestamp = new Date(entry.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        const level = entry.level.toUpperCase();

        return (
          <tr key={entry.id} className={`logs__row logs__row--${entry.level}`}>
            <td className="logs__cell logs__cell--timestamp">{timestamp}</td>
            <td className="logs__cell logs__cell--level" aria-label={`Log level: ${level}`}>
              <span className="logs__level">[{level}]</span>
            </td>
            <td className="logs__cell logs__cell--message">
              <span className="logs__message">{entry.message}</span>
            </td>
          </tr>
        );
      }),
    [logs],
  );

  return (
    <section className={`logs panel ${collapsed ? 'panel--collapsed' : 'panel--expanded'}`}>
      <div className="panel__header">
        <div className="panel__title">Logs</div>
        <div aria-hidden="true" className="logs__count">{logs.length} entries</div>
      </div>
      <div className="panel__body logs__body" ref={scrollContainerRef}>
        {logs.length === 0 ? (
          <div className="placeholder-text">Build, lint, and runtime logs will appear here.</div>
        ) : (
          <table className="logs__table" cellSpacing={0} cellPadding={0}>
            <thead>
              <tr>
                <th className="logs__header logs__header--timestamp" scope="col">
                  Time
                </th>
                <th className="logs__header logs__header--level" scope="col">
                  Level
                </th>
                <th className="logs__header logs__header--message" scope="col">
                  Message
                </th>
              </tr>
            </thead>
            <tbody>{renderedLogs}</tbody>
          </table>
        )}
      </div>
    </section>
  );
};
