export function shouldInitializeGoogleAnalytics(
  analyticsEnabled: boolean,
  initialized: boolean,
): boolean {
  return analyticsEnabled && !initialized;
}

export function shouldConfigureGoogleAnalytics(
  analyticsEnabled: boolean,
  scriptLoaded: boolean,
  configured: boolean,
): boolean {
  return analyticsEnabled && scriptLoaded && !configured;
}

export function shouldSendGoogleAnalyticsPageView(
  analyticsEnabled: boolean,
  scriptLoaded: boolean,
  previousPathname: string | null,
  pathname: string,
): boolean {
  return (
    analyticsEnabled &&
    scriptLoaded &&
    previousPathname !== pathname
  );
}
