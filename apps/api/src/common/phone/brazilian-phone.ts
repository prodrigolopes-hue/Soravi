const ALLOWED_PHONE_CHARACTERS = /^\+?[0-9().\s-]+$/;
const BRAZIL_COUNTRY_CODE = "55";

export function normalizeBrazilianPhoneToE164(value: string): string | null {
  const trimmedValue = value.trim();

  if (
    trimmedValue.length === 0 ||
    !ALLOWED_PHONE_CHARACTERS.test(trimmedValue)
  ) {
    return null;
  }

  const digits = trimmedValue.replace(/\D/g, "");
  let nationalNumber: string;

  if (trimmedValue.startsWith("+")) {
    if (!digits.startsWith(BRAZIL_COUNTRY_CODE)) {
      return null;
    }

    nationalNumber = digits.slice(BRAZIL_COUNTRY_CODE.length);
  } else if (digits.length === 12 || digits.length === 13) {
    if (!digits.startsWith(BRAZIL_COUNTRY_CODE)) {
      return null;
    }

    nationalNumber = digits.slice(BRAZIL_COUNTRY_CODE.length);
  } else {
    nationalNumber = digits;
  }

  if (!/^\d{10,11}$/.test(nationalNumber)) {
    return null;
  }

  const areaCode = nationalNumber.slice(0, 2);
  const localNumber = nationalNumber.slice(2);
  const hasPlausibleAreaCode = /^[1-9]\d$/.test(areaCode);
  const isLandline = /^[2-5]\d{7}$/.test(localNumber);
  const isMobile = /^9\d{8}$/.test(localNumber);

  if (!hasPlausibleAreaCode || (!isLandline && !isMobile)) {
    return null;
  }

  return `+${BRAZIL_COUNTRY_CODE}${nationalNumber}`;
}
