import React, {useEffect, useMemo, useState} from 'react';
import {exportStatusService, type ExportStatusSnapshot, type ExportStep} from '../../services/ExportStatusService';
import './ExportStatusPopup.css';

/**
 * Renders a modal overlay describing the current PDF export progress.
 *
 * @returns Dialog element showing incremental export updates.
 */
export function ExportStatusPopup(): React.ReactElement | null {
  const [status, setStatus] = useState<ExportStatusSnapshot>(exportStatusService.getStatus());

  useEffect(() => {
    const unsubscribe = exportStatusService.subscribe(setStatus);

    return () => {
      unsubscribe();
    };
  }, []);

  const isActive = status.isVisible || status.result === 'in-progress';

  const statusLabel = useMemo(() => {
    if (status.result === 'error') {
      return 'Export failed';
    }

    if (status.result === 'success') {
      return 'Export completed';
    }

    return 'Exporting deck…';
  }, [status.result]);

  const renderIcon = (step: ExportStep): string => {
    if (step.status === 'completed') {
      return 'check_circle';
    }

    if (step.status === 'failed') {
      return 'error';
    }

    return 'pending';
  };

  if (!isActive) {
    return null;
  }

  return (
    <div className="export-status__overlay" role="dialog" aria-modal="true" aria-labelledby="export-status__title">
      <section className="export-status" aria-live="polite">
        <header className="export-status__header">
          <div className="export-status__badge" aria-hidden="true">
            <span className="material-symbols-outlined" aria-hidden="true">description</span>
          </div>
          <div className="export-status__heading">
            <p className="export-status__eyebrow">PDF export</p>
            <h2 id="export-status__title" className="export-status__title">{statusLabel}</h2>
            {status.errorMessage ? (
              <p className="export-status__error" role="alert">{status.errorMessage}</p>
            ) : null}
          </div>
        </header>

        <ol className="export-status__steps" aria-live="polite">
          {status.steps.map(step => (
            <li key={step.id} className="export-status__step" data-status={step.status}>
              <span className="material-symbols-outlined" aria-hidden="true">{renderIcon(step)}</span>
              <div className="export-status__step-body">
                <p className="export-status__step-label">{step.label}</p>
                {step.detail ? <p className="export-status__step-detail">{step.detail}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
