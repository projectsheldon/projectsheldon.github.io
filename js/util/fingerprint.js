// Backwards-compatibility shim — the real implementation moved to `device.js`
// because adblock filter lists block any request whose URL contains
// "fingerprint". New code must import from `./device.js` (via a guarded
// dynamic import — see device.js header). This file is kept so visitors with
// an old cached page/bundle that still references `fingerprint.js` don't 404;
// it simply re-exports the same API.
export {
    GetDeviceId,
    GetBrowserFingerprint,
    GetIdentityPayload,
    GetDeviceIdSync,
    GetCachedBrowserFingerprint
} from './device.js';
