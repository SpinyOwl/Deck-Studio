// src/services/LogService.ts

export type LogLevel = 'info' | 'warning' | 'error' | 'debug';

export interface LogEntry {
  readonly id: string;
  readonly message: string;
  readonly level: LogLevel;
  readonly timestamp: string;
  readonly sourceFile: string;
  readonly stackTrace?: string; // Added stackTrace field
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
   * @param addTrace - Whether to include the full stack trace.
   */
  public log(message: string, level: LogLevel = 'info', addTrace: boolean = false): void {
    console.log(level, message);
    const error = new Error();
    const stackTrace = addTrace ? error.stack : undefined;

    const nextEntry: LogEntry = {
      id: `${Date.now()}-${this.idCounter++}`,
      message,
      level,
      timestamp: new Date().toISOString(),
      sourceFile: this.resolveCallerFile(error),
      stackTrace,
    };

    this.entries.push(nextEntry);
    this.notify();
  }

  public info(message: string, addTrace: boolean = false): void {
    this.log(message, 'info', addTrace);
  }

  public warning(message: string, addTrace: boolean = false): void {
    this.log(message, 'warning', addTrace);
  }

  public error(message: string, addTrace: boolean = false): void {
    this.log(message, 'error', addTrace);
  }

  public debug(message: string, addTrace: boolean = false): void {
    this.log(message, 'debug', addTrace);
  }

  /**
   * Returns a snapshot of the current log entries.
   *
   * @returns An immutable copy of stored log entries.
   */
  public getLogs(): LogEntry[] {
    return this.entries.map(entry => ({ ...entry }));
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

  /**
   * Attempts to identify the calling source file from the current stack trace.
   *
   * @param error - The error object to extract the stack from.
   * @returns The sanitized source path or "unknown" when unavailable.
   */
  private resolveCallerFile(error: Error): string {
    const stack = error.stack;
    if (!stack) {
      return 'unknown';
    }

    const frames = stack
      .split('\n')
      .map(line => line.trim())
      .slice(1);

    for (const frame of frames) {
      const match = frame.match(/\(?([^)]+):\d+:\d+\)?$/);
      if (!match) {
        continue;
      }

      const rawPath = match[1];
      if (rawPath.includes('LogService')) {
        continue;
      }

      const normalizedPath = this.normalizePath(rawPath);

      const pathSegments = normalizedPath.split(/[\\/]/);
      return pathSegments[pathSegments.length - 1] ?? 'unknown';
    }

    return 'unknown';
  }

  /**
   * Trims extraneous URL details and limits the displayed path depth for readability.
   *
   * @param path - Raw path extracted from the stack trace.
   * @returns Condensed path focusing on the source file location.
   */
  private normalizePath(path: string): string {
    console.log(path);
    const sanitized = path
      .replace(/^.*:\/\//, '')
      .replace(/^[^/]*\//, '')
      .replace(/\?.*$/, '')
      .replace(/#/g, '')
      .replace(/\\/g, '/');
    console.log(sanitized);

    const segments = sanitized.split('/');
    return segments.slice(-3).join('/');
  }

  private notify(): void {
    this.listeners.forEach(listener => listener(this.getLogs()));
  }
}

export const logService = new LogService();
