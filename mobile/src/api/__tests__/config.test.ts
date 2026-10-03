import { ApiConfigError, parseApiBaseUrl } from '../config';
import { getApiBaseUrl } from '..';

describe('parseApiBaseUrl', () => {
  it.each([
    ['https://api.example.com', 'https://api.example.com'],
    ['http://localhost:5000', 'http://localhost:5000'],
    ['  https://api.example.com/v1/  ', 'https://api.example.com/v1'],
  ])('accepts %p', (raw, expected) => {
    expect(parseApiBaseUrl(raw)).toBe(expected);
  });

  it.each([undefined, '', '   '])(
    'rejects a missing value (%p) with a configuration error',
    (raw) => {
      expect(() => parseApiBaseUrl(raw)).toThrow(ApiConfigError);
      expect(() => parseApiBaseUrl(raw)).toThrow(/EXPO_PUBLIC_API_BASE_URL is not set/);
    },
  );

  it.each([
    'ftp://api.example.com',
    'api.example.com',
    'https://',
    'https://api.example.com/?a=1',
    'https://api.example.com/#x',
    'https://exa mple.com',
  ])('rejects %p as not an absolute http(s) URL', (raw) => {
    expect(() => parseApiBaseUrl(raw)).toThrow(ApiConfigError);
    expect(() => parseApiBaseUrl(raw)).toThrow(/must be an absolute http\(s\) URL/);
  });
});

describe('getApiBaseUrl', () => {
  const original = process.env.EXPO_PUBLIC_API_BASE_URL;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.EXPO_PUBLIC_API_BASE_URL;
    } else {
      process.env.EXPO_PUBLIC_API_BASE_URL = original;
    }
  });

  it('reads EXPO_PUBLIC_API_BASE_URL', () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.example.com/';
    expect(getApiBaseUrl()).toBe('https://api.example.com');
  });

  it('fails with a configuration error when EXPO_PUBLIC_API_BASE_URL is missing', () => {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
    expect(() => getApiBaseUrl()).toThrow(ApiConfigError);
  });
});
