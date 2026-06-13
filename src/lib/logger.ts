export const logger = {
  error: (...args: any[]) => {
    try {
      if (import.meta.env?.MODE !== 'production') console.error(...args);
      // In production you can forward logs to a monitoring service here.
    } catch (e) {
      // noop
    }
  },
  warn: (...args: any[]) => {
    try { if (import.meta.env?.MODE !== 'production') console.warn(...args); } catch (e) {}
  },
  info: (...args: any[]) => {
    try { if (import.meta.env?.MODE !== 'production') console.log(...args); } catch (e) {}
  },
  debug: (...args: any[]) => {
    try { if (import.meta.env?.MODE !== 'production') console.debug(...args); } catch (e) {}
  }
};

export default logger;
