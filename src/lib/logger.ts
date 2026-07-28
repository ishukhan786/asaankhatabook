export const logger = {
  error: (...args: unknown[]) => {
    try {
      if (import.meta.env?.MODE !== 'production') console.error(...args);
      // In production you can forward logs to a monitoring service here.
    } catch {
      // noop
    }
  },
  warn: (...args: unknown[]) => {
    try { if (import.meta.env?.MODE !== 'production') console.warn(...args); } catch { /* noop */ }
  },
  info: (...args: unknown[]) => {
    try { if (import.meta.env?.MODE !== 'production') console.log(...args); } catch { /* noop */ }
  },
  debug: (...args: unknown[]) => {
    try { if (import.meta.env?.MODE !== 'production') console.debug(...args); } catch { /* noop */ }
  }
};

export default logger;
