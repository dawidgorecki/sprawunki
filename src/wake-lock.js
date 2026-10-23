// Keeps the screen on while the switch is on (spec 9.3), using the Screen Wake Lock API.
//
// The browser drops the lock by itself whenever the app goes to the background
// (another app, screen turned off), so it is requested again each time the app
// becomes visible. The switch itself is not saved: every start begins with it off.

export function isWakeLockSupported() {
  return 'wakeLock' in navigator;
}

// onFailure() is called when the browser refuses the lock (e.g. battery saver).
// The switch is then already off; the caller only has to tell the user.
export function createWakeLock({ onFailure }) {
  let enabled = false;
  // The object the browser returns for an active lock; release() ends it.
  let lock = null;

  async function acquire() {
    try {
      const newLock = await navigator.wakeLock.request('screen');
      // request() takes a moment. If the user switched off in the meantime,
      // give the lock straight back instead of keeping the screen on.
      if (enabled) {
        lock = newLock;
      } else {
        await newLock.release();
      }
    } catch {
      enabled = false;
      lock = null;
      onFailure();
    }
  }

  document.addEventListener('visibilitychange', () => {
    const lockLost = lock === null || lock.released;
    if (enabled && document.visibilityState === 'visible' && lockLost) {
      acquire();
    }
  });

  return {
    isEnabled() {
      return enabled;
    },

    async setEnabled(value) {
      enabled = value;
      if (enabled) {
        await acquire();
      } else if (lock) {
        const oldLock = lock;
        lock = null;
        await oldLock.release();
      }
    },
  };
}
