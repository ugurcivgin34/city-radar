// The City Radar API base URL is public configuration (docs/security.md): EXPO_PUBLIC_* values
// are embedded in the app and visible to users, so no secret may ever be placed here.

export class ApiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiConfigError';
  }
}

// scheme://host[:port][/path] — non-empty host, numeric port, no user:password@, no query/fragment.
const HTTP_URL = /^https?:\/\/[^\s/?#@:]+(:\d{1,5})?(\/[^\s?#]*)?$/i;

export function parseApiBaseUrl(raw: string | undefined): string {
  const value = raw?.trim();
  if (!value) {
    throw new ApiConfigError(
      'EXPO_PUBLIC_API_BASE_URL is not set. Copy mobile/.env.example to mobile/.env and set it.',
    );
  }
  if (!HTTP_URL.test(value)) {
    throw new ApiConfigError(
      'EXPO_PUBLIC_API_BASE_URL must be an absolute http(s) URL with a host, an optional numeric port, no credentials, query or fragment.',
    );
  }
  return value.replace(/\/+$/, '');
}

export function getApiBaseUrl(): string {
  // Read statically: Expo inlines EXPO_PUBLIC_* variables only for direct property access.
  return parseApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
}
