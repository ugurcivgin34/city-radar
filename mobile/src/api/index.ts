// The only public surface of the API boundary (FD-5, FD-8): code outside src/api imports from
// here, never from files inside src/api.
export { ApiConfigError, getApiBaseUrl } from './config';
