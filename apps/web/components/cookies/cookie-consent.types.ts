export type CookieConsentStatus = "pending" | "accepted" | "rejected";

export interface CookieConsentPreference {
  version: 1;
  analytics: "accepted" | "rejected";
  advertising?: "accepted" | "rejected";
  updatedAt: string;
}

export interface CookieConsentStorageValue extends CookieConsentPreference {
  status: CookieConsentStatus;
}
