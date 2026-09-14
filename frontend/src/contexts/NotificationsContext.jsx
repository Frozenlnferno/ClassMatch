/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CloseIcon } from "../components/icons.jsx";

const NotificationsContext = createContext(null);

const DEFAULT_DURATIONS = {
  success: 3600,
  info: 3600,
  warning: 4200,
  danger: 5200,
};

function NotificationStack({ notifications, onDismiss }) {
  const tones = {
    success: {
      shell: "border-emerald-500/70 bg-emerald-600 text-white",
      pill: "bg-white/18 text-white",
      message: "text-emerald-50",
      close: "bg-white/14 text-emerald-50 hover:bg-white/22 hover:text-white",
    },
    danger: {
      shell: "border-rose-600/70 bg-rose-700 text-white",
      pill: "bg-white/18 text-white",
      message: "text-rose-50",
      close: "bg-white/14 text-rose-50 hover:bg-white/22 hover:text-white",
    },
    info: {
      shell: "border-blue-500/70 bg-blue-600 text-white",
      pill: "bg-white/18 text-white",
      message: "text-blue-50",
      close: "bg-white/14 text-blue-50 hover:bg-white/22 hover:text-white",
    },
    warning: {
      shell: "border-amber-500/70 bg-amber-500 text-white",
      pill: "bg-white/18 text-white",
      message: "text-amber-50",
      close: "bg-white/14 text-amber-50 hover:bg-white/22 hover:text-white",
    },
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[80] flex justify-center px-4 sm:top-5">
      <div className="flex w-full max-w-xl flex-col gap-3">
        {notifications.map((notification) => {
          const tone = tones[notification.tone] || tones.info;
          return (
            <div
              key={notification.id}
              role={notification.tone === "danger" ? "alert" : "status"}
              aria-live={notification.tone === "danger" ? "assertive" : "polite"}
              className={`motion-scale-in pointer-events-auto overflow-hidden rounded-[28px] border p-3 shadow-[0_22px_60px_-28px_rgba(15,23,42,0.35)] backdrop-blur ${tone.shell}`}
            >
              <div className="flex items-center gap-4">
                <div className={`mt-0.5 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tone.pill}`}>
                  {notification.title}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm leading-6 ${tone.message}`}>{notification.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onDismiss(notification.id)}
                  className={`motion-lift inline-flex size-9 items-center justify-center rounded-2xl transition-[transform,background-color,color] duration-200 ${tone.close}`}
                  aria-label="Dismiss notification"
                >
                  <CloseIcon className="size-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function NotificationsProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    const timeout = timersRef.current.get(id);
    if (timeout) {
      window.clearTimeout(timeout);
      timersRef.current.delete(id);
    }

    setNotifications((current) => current.filter((notification) => notification.id !== id));
  }, []);

  const notify = useCallback((input) => {
    const tone = input.tone || "info";
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const notification = {
      id,
      tone,
      title: input.title || (tone === "danger" ? "Error" : "Notice"),
      message: input.message || "",
      durationMs: input.durationMs ?? DEFAULT_DURATIONS[tone] ?? DEFAULT_DURATIONS.info,
    };

    setNotifications((current) => [notification, ...current]);

    if (notification.durationMs > 0) {
      const timeout = window.setTimeout(() => {
        dismiss(id);
      }, notification.durationMs);
      timersRef.current.set(id, timeout);
    }

    return id;
  }, [dismiss]);

  const notifySuccess = useCallback((title, message, durationMs) => (
    notify({ tone: "success", title, message, durationMs })
  ), [notify]);

  const notifyError = useCallback((title, message, durationMs) => (
    notify({ tone: "danger", title, message, durationMs })
  ), [notify]);

  useEffect(() => () => {
    timersRef.current.forEach((timeout) => window.clearTimeout(timeout));
    timersRef.current.clear();
  }, []);

  const value = useMemo(() => ({
    notify,
    notifySuccess,
    notifyError,
    dismiss,
  }), [dismiss, notify, notifyError, notifySuccess]);

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <NotificationStack notifications={notifications} onDismiss={dismiss} />
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);

  if (!context) {
    throw new Error("useNotifications must be used within a NotificationsProvider");
  }

  return context;
}
