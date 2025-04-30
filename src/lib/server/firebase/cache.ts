import ExpiryMap from 'expiry-map';

export const cache = new ExpiryMap<string, unknown>(1000 * 60 * 5); // 5 minutes expiry
