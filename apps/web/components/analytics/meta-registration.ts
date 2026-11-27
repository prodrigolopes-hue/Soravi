export const META_REGISTRATION_EVENT = "soravi:professional-registration";

export interface MetaRegistrationDetail {
  handled: boolean;
  complete: () => void;
}

// Tracking must never block account creation if the Pixel is unavailable.
export function notifyMetaRegistration(timeoutMs = 1500): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(finish, timeoutMs);
    const detail: MetaRegistrationDetail = { handled: false, complete: finish };
    window.dispatchEvent(new CustomEvent(META_REGISTRATION_EVENT, { detail }));
    if (!detail.handled) finish();
  });
}
