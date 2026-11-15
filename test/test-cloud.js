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
    cookies: {
      getAll: async () => [],
      get: async () => null,
      set: async () => {},
      remove: async () => {}
    },
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

  console.log('--- 3. Testing Resource Parser Compatibility ---');
  const mockRawResources = [
    { name: 'video.mp4', file_size: 1048576, file_index: 0, is_dir: false },
    {
      file_name: 'Subtitles',
      kind: 'drive#folder',
      dir: {
        resources: [
          { name: 'en.srt', size: '2048', index: 1 }
        ]
      }
    }
  ];

  function parseResources(resList) {
    if (!Array.isArray(resList)) return [];
    return resList.map(resource => {
      const isDir = Boolean(
        resource.is_dir ||
        resource.isDirectory ||
        resource.kind === 'drive#folder' ||
        (resource.dir && resource.dir.resources)
      );
      const childList = isDir ? (resource.dir?.resources || resource.children || resource.sub_files || []) : [];
      return {
        name: resource.name || resource.file_name || resource.title || '未命名文件',
        isDirectory: isDir,
        children: isDir ? parseResources(childList) : [],
        file_index: resource.file_index !== undefined ? resource.file_index : (resource.index !== undefined ? resource.index : 0),
        file_size: parseInt(resource.file_size || resource.size || 0, 10)
      };
    });
  }

  const parsed = parseResources(mockRawResources);
  console.log('Parsed resources:', JSON.stringify(parsed, null, 2));
  if (parsed.length !== 2) throw new Error('Parsed length mismatch');
  if (parsed[0].name !== 'video.mp4' || parsed[0].file_size !== 1048576) throw new Error('Item 0 mismatch');
  if (!parsed[1].isDirectory || parsed[1].children.length !== 1) throw new Error('Directory parsing failed');
  if (parsed[1].children[0].name !== 'en.srt' || parsed[1].children[0].file_size !== 2048) throw new Error('Subfile mismatch');

  console.log('All tests passed successfully!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
