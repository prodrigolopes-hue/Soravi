export type SignUpAccountType = "customer" | "professional";

interface GoogleAnalyticsSignUpParameters {
  account_type: SignUpAccountType;
  send_to: string;
}

interface GoogleAnalyticsServiceRequestPublishedParameters {
  send_to: string;
}

interface GoogleAnalyticsEventFunction {
  (
    command: "event",
    eventName: "sign_up",
    parameters: GoogleAnalyticsSignUpParameters,
  ): void;
  (
    command: "event",
    eventName: "service_request_published",
    parameters: GoogleAnalyticsServiceRequestPublishedParameters,
  ): void;
}

interface GoogleAnalyticsEventWindow extends Window {
  gtag?: GoogleAnalyticsEventFunction;
}

export interface SignUpEventTracker {
  track: (
    accountType: SignUpAccountType,
    hasAnalyticsConsent: boolean,
  ) => void;
}

function getGoogleAnalyticsMeasurementId(): string | null {
  const measurementId = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID?.trim();

  return measurementId ? measurementId : null;
}

export function trackGoogleAnalyticsSignUp(
  accountType: SignUpAccountType,
  hasAnalyticsConsent: boolean,
): void {
  if (!hasAnalyticsConsent || typeof window === "undefined") {
    return;
  }

  const measurementId = getGoogleAnalyticsMeasurementId();

  if (!measurementId) {
    return;
  }

  const gtagWindow = window as GoogleAnalyticsEventWindow;

  if (
    Reflect.get(gtagWindow, `ga-disable-${measurementId}`) === true ||
    typeof gtagWindow.gtag !== "function"
  ) {
    return;
  }

  try {
    gtagWindow.gtag("event", "sign_up", {
      account_type: accountType,
      send_to: measurementId,
    });
  } catch {
    // Analytics must never prevent the confirmed registration flow.
  }
}

export function trackGoogleAnalyticsServiceRequestPublished(
  hasAnalyticsConsent: boolean,
): void {
  if (!hasAnalyticsConsent || typeof window === "undefined") {
    return;
  }

  const measurementId = getGoogleAnalyticsMeasurementId();

  if (!measurementId) {
    return;
  }

  const gtagWindow = window as GoogleAnalyticsEventWindow;

  if (
    Reflect.get(gtagWindow, `ga-disable-${measurementId}`) === true ||
    typeof gtagWindow.gtag !== "function"
  ) {
    return;
  }

  try {
    gtagWindow.gtag("event", "service_request_published", {
      send_to: measurementId,
    });
  } catch {
    // Analytics must never prevent the confirmed publication flow.
  }
}

export function shouldTrackPublishedServiceRequest(
  trackedServiceRequestIds: Set<string>,
  serviceRequestId: string,
): boolean {
  if (trackedServiceRequestIds.has(serviceRequestId)) {
    return false;
  }

  trackedServiceRequestIds.add(serviceRequestId);
  return true;
}

export function createSignUpEventTracker(): SignUpEventTracker {
  let hasProcessedSuccessfulRegistration = false;

  return {
    track(accountType, hasAnalyticsConsent) {
      if (hasProcessedSuccessfulRegistration) {
        return;
      }

      hasProcessedSuccessfulRegistration = true;
      trackGoogleAnalyticsSignUp(accountType, hasAnalyticsConsent);
    },
  };
}
