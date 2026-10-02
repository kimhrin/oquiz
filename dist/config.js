// Public service origin only. Dify credentials must never be stored here.
export const ONLINE_PROXY_ORIGIN = 'https://oquiz.khrhappy0147.chatgpt.site';
export function proxyEndpoint(pathname) {
  if (typeof location === 'undefined') return pathname;
  if (['http:', 'https:'].includes(location.protocol) && ['127.0.0.1', 'localhost'].includes(location.hostname)) return new URL(pathname, location.origin).href;
  if (ONLINE_PROXY_ORIGIN) return new URL(pathname, ONLINE_PROXY_ORIGIN).href;
  if (typeof location !== 'undefined' && ['http:', 'https:'].includes(location.protocol)) {
    return new URL(pathname, location.origin).href;
  }
  throw Error('PROXY_NOT_DEPLOYED');
}
