export type ExportStepStatus = 'in-progress' | 'completed' | 'failed';

export interface ExportStep {
  readonly id: string;
  readonly label: string;
  readonly status: ExportStepStatus;
  readonly detail?: string;
}

export interface ExportStatusSnapshot {
  readonly isVisible: boolean;
  readonly steps: ExportStep[];
  readonly result: 'idle' | 'in-progress' | 'success' | 'error';
  readonly errorMessage: string | null;
}

type ExportStatusListener = (status: ExportStatusSnapshot) => void;

/**
 * Centralizes updates about the current export lifecycle for UI subscribers.
 */
export class ExportStatusService {
  private status: ExportStatusSnapshot = {
    isVisible: false,
    steps: [],
    result: 'idle',
    errorMessage: null,
  };

  private listeners = new Set<ExportStatusListener>();

  private hideTimeout: ReturnType<typeof setTimeout> | null = null;

  private idCounter = 0;

  /**
   * Registers a listener for export status updates.
   *
   * @param listener - Callback invoked whenever the export status changes.
   * @returns Function to unsubscribe the listener.
   */
  subscribe(listener: ExportStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Resets the status and prepares the service for a fresh export session.
   */
  beginExport(): void {
    this.clearHideTimeout();
    this.status = {
      isVisible: true,
      steps: [],
      result: 'in-progress',
      errorMessage: null,
    };
    this.notify();
  }

  /**
   * Adds a new step to the export progress list.
   *
   * @param label - Human-readable description for the step.
   * @returns Identifier for the step, useful for future updates.
   */
  startStep(label: string): string {
    const id = `${Date.now()}-${this.idCounter += 1}`;
    const step: ExportStep = {id, label, status: 'in-progress'};
    this.status = {
      ...this.status,
      steps: [...this.status.steps, step],
    };
    this.notify();

    return id;
  }

  /**
   * Updates a step with optional detail text while keeping its current status.
   *
   * @param id - Identifier of the step to update.
   * @param detail - Supplementary message to display beneath the step label.
   */
  updateStepDetail(id: string, detail: string): void {
    this.replaceStep(id, step => ({...step, detail}));
  }

  /**
   * Marks a step as successfully completed.
   *
   * @param id - Identifier of the step to mark completed.
   * @param detail - Optional completion detail text.
   */
  completeStep(id: string, detail?: string): void {
    this.replaceStep(id, step => ({...step, status: 'completed', detail}));
  }

  /**
   * Flags a step as failed and records the error message for the session.
   *
   * @param id - Identifier of the step that failed.
   * @param errorMessage - Description of the failure.
   */
  failStep(id: string, errorMessage: string): void {
    this.replaceStep(id, step => ({...step, status: 'failed', detail: errorMessage}));
    this.failExport(errorMessage);
  }

  /**
   * Signals that the export finished successfully and schedules dismissal.
   */
  completeExport(): void {
    this.status = {
      ...this.status,
      result: 'success',
    };
    this.notify();
    this.scheduleHide();
  }

  /**
   * Records an unrecoverable export error and dismisses the overlay.
   *
   * @param errorMessage - Description of the error to surface to the user.
   */
  failExport(errorMessage: string): void {
    this.status = {
      ...this.status,
      isVisible: true,
      result: 'error',
      errorMessage,
    };
    this.notify();
    this.scheduleHide();
  }

  /**
   * Provides a snapshot of the latest export status without subscribing.
   *
   * @returns Current export status snapshot.
   */
  getStatus(): ExportStatusSnapshot {
    return {...this.status, steps: [...this.status.steps]};
  }

  private replaceStep(id: string, updater: (step: ExportStep) => ExportStep): void {
    this.status = {
      ...this.status,
      steps: this.status.steps.map(step => (step.id === id ? updater(step) : step)),
    };
    this.notify();
  }

  private scheduleHide(): void {
    this.clearHideTimeout();
    this.hideTimeout = setTimeout(() => {
      this.status = {
        isVisible: false,
        steps: [],
        result: 'idle',
        errorMessage: null,
      };
      this.notify();
    }, 1200);
  }

  private clearHideTimeout(): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }

  private notify(): void {
    this.listeners.forEach(listener => listener(this.status));
  }
}

export const exportStatusService = new ExportStatusService();
