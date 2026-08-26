export function normalizeDisplayName(value: string): string | null {
  const normalizedValue = value.trim();

  return normalizedValue.length > 0 ? normalizedValue : null;
}

export function getFirstName(value: string): string | null {
  const normalizedValue = normalizeDisplayName(value);

  if (normalizedValue === null) {
    return null;
  }

  return normalizedValue.split(/\s+/u)[0] ?? null;
}
