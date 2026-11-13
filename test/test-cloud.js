import { sha1Hex, md5Hex, getDeviceSign, getCaptchaSign } from '../utils/xlCrypto.js';
import { xlCloud } from '../utils/xlCloud.js';

async function runTests() {
  console.log('--- 1. Testing Crypto Routines ---');
  const testDeviceId = '11223344556677889900aabbccddeeff';
  const ds = await getDeviceSign(testDeviceId);
  console.log('device_sign:', ds);
  if (!ds.startsWith('div101.' + testDeviceId)) {
    throw new Error('device_sign format invalid');
  }

  const { timestamp, sign } = getCaptchaSign(testDeviceId);
  console.log('captcha_sign:', sign, 'timestamp:', timestamp);
  if (!sign.startsWith('1.')) {
    throw new Error('captcha_sign format invalid');
  }

  console.log('--- 2. Mocking Chrome Storage & Testing xlCloud ---');
  const mockStorage = {
    local: {},
    sync: {}
  };

  globalThis.chrome = {
    storage: {
      local: {
        get: async (keys) => {
          const res = {};
          for (const k of keys) {
            if (mockStorage.local[k] !== undefined) res[k] = mockStorage.local[k];
          }
          return res;
        },
        set: async (obj) => {
          Object.assign(mockStorage.local, obj);
        },
        remove: async (keys) => {
          const arr = Array.isArray(keys) ? keys : [keys];
          for (const k of arr) delete mockStorage.local[k];
        }
      },
      sync: {
        get: async (keys) => {
          const res = {};
          for (const k of keys) {
            if (mockStorage.sync[k] !== undefined) res[k] = mockStorage.sync[k];
          }
          return res;
        },
        set: async (obj) => {
          Object.assign(mockStorage.sync, obj);
        }
      }
    }
  };

  const did = await xlCloud.getDeviceId();
  console.log('Generated deviceId:', did, 'length:', did.length);
  if (did.length !== 32) {
    throw new Error('deviceId length should be 32');
  }

  const baseHeaders = await xlCloud.getBaseHeaders();
  console.log('Base headers:', baseHeaders);
  if (baseHeaders['x-client-id'] !== 'Xp6vsxz_7IYVw2BB') {
    throw new Error('client_id header mismatch');
  }

  console.log('All tests passed successfully!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
