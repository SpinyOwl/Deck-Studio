// src/app/components/NotificationPopup/NotificationPopup.tsx
import React, { useEffect, useState } from 'react';
import { notificationService, Notification } from '../../services/NotificationService';
import './NotificationPopup.css';

export const NotificationPopup: React.FC = () => {
  const [notification, setNotification] = useState<Notification | null>(null);

  useEffect(() => {
    const unsubscribe = notificationService.subscribe(setNotification);
    return () => unsubscribe();
  }, []);

  if (!notification) {
    return null;
  }

  const handleClose = () => {
    notificationService.hide();
  };

  return (
    <div className={`notification-popup notification-popup--${notification.type}`}>
      <div className="notification-popup__content">
        <p>{notification.message}</p>
        <button className="notification-popup__close" onClick={handleClose}>
          &times;
        </button>
      </div>
    </div>
  );
};
