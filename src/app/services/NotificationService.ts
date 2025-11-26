// src/services/NotificationService.ts

export type NotificationType = 'warning' | 'error' | 'info';

export interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  duration?: number; // Duration in milliseconds, 0 for sticky
}

type NotificationListener = (notification: Notification | null) => void;

/**
 * Manages application-wide notifications (popups).
 */
export class NotificationService {
  private currentNotification: Notification | null = null;
  private listeners = new Set<NotificationListener>();
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private idCounter = 0;

  public show(message: string, type: NotificationType = 'info', duration: number = 5000): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.currentNotification = {
      id: `${Date.now()}-${this.idCounter++}`,
      message,
      type,
      duration,
    };
    this.notify();

    if (duration > 0) {
      this.timeoutId = setTimeout(() => {
        this.hide();
      }, duration);
    }
  }

  public showWarning(message: string, duration?: number): void {
    this.show(message, 'warning', duration);
  }

  public showError(message: string, duration?: number): void {
    this.show(message, 'error', duration);
  }

  public hide(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.currentNotification = null;
    this.notify();
  }

  public getNotification(): Notification | null {
    return this.currentNotification;
  }

  public subscribe(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    listener(this.currentNotification); // Notify immediately with current state

    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach(listener => listener(this.currentNotification));
  }
}

export const notificationService = new NotificationService();
