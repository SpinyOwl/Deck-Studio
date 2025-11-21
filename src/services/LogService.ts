// src/services/LogService.ts

export type LogLevel = 'info' | 'warning' | 'error';

export interface LogEntry {
  readonly id: string;
  readonly message: string;
  readonly level: LogLevel;
  readonly timestamp: string;
}

type LogListener = (entries: LogEntry[]) => void;

/**
 * Stores application log entries and notifies subscribers when entries change.
 */
export class LogService {
  private readonly entries: LogEntry[] = [];

  private readonly listeners = new Set<LogListener>();

  private idCounter = 0;

  /**
   * Appends a new log entry and alerts subscribers to the updated list.
   *
   * @param message - Human-readable message to capture.
   * @param level - Severity classification for the log entry.
   */
  public add(message: string, level: LogLevel = 'info'): void {
    const nextEntry: LogEntry = {
      id: `${Date.now()}-${this.idCounter++}`,
      message,
      level,
      timestamp: new Date().toISOString(),
    };

    this.entries.push(nextEntry);
    this.notify();
  }

  /**
   * Returns a snapshot of the current log entries.
   *
   * @returns An immutable copy of stored log entries.
   */
  public getLogs(): LogEntry[] {
    return [...this.entries];
  }

  /**
   * Registers a listener to receive log entry updates.
   *
   * @param listener - Callback invoked whenever log entries change.
   * @returns Cleanup function that removes the listener.
   */
  public subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    listener(this.getLogs());

    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snapshot = this.getLogs();
    this.listeners.forEach(listener => listener(snapshot));
  }
}

export const logService = new LogService();
