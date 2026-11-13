import SparkMD5 from '../libs/md5.min.js';

export const CLIENT_ID = "Xp6vsxz_7IYVw2BB";
export const CLIENT_SECRET = "Xp6vsy4tN9toTVdMSpomVdXpRmES";
export const CLIENT_VERSION = "8.31.0.9726";
export const PACKAGE_NAME = "com.xunlei.downloadprovider";
export const APP_ID = "40";
export const APP_KEY = "34a062aaa22f906fca4fefe9fb3a3021";
export const SIGN_PROVIDER = "access_end_point_token";
export const REDIRECT_URI = "xlaccsdk01://xunlei.com/callback?state=harbor";

const ALGORITHMS = [
  "9uJNVj/wLmdwKrJaVj/omlQ",
  "Oz64Lp0GigmChHMf/6TNfxx7O9PyopcczMsnf",
  "Eb+L7Ce+Ej48u",
  "jKY0",
  "ASr0zCl6v8W4aidjPK5KHd1Lq3t+vBFf41dqv5+fnOd",
  "wQlozdg6r1qxh0eRmt3QgNXOvSZO6q/GXK",
  "gmirk+ciAvIgA/cxUUCema47jr/YToixTT+Q6O",
  "5IiCoM9B1/788ntB",
  "P07JH0h6qoM6TSUAK2aL9T5s2QBVeY9JWvalf",
  "+oK0AN",
];

export function md5Hex(str) {
  return SparkMD5.hash(str);
}

/**
 * SHA-1 哈希计算，优先使用原生 Web Crypto，环境不支持时使用内建纯 JS 实现
 */
export async function sha1Hex(str) {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
      const buf = new TextEncoder().encode(str);
      const digest = await crypto.subtle.digest('SHA-1', buf);
      return Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch (e) {
    // 降级使用纯 JS 实现
  }
  return pureJsSha1(str);
}

// 纯 JS SHA-1 实现作为兜底
function pureJsSha1(message) {
  function rotateLeft(n, s) {
    return (n << s) | (n >>> (32 - s));
  }
  function cvtHex(val) {
    let str = "";
    for (let i = 7; i >= 0; i--) {
      str += ((val >>> (i * 4)) & 0x0f).toString(16);
    }
    return str;
  }

  const utf8 = unescape(encodeURIComponent(message));
  const words = [];
  for (let i = 0; i < utf8.length; i++) {
    words[i >> 2] |= (utf8.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
  }
  words[utf8.length >> 2] |= 0x80 << (24 - (utf8.length % 4) * 8);
  words[(((utf8.length + 8) >> 6) << 4) + 15] = utf8.length * 8;

  const w = new Array(80);
  let a = 1732584193;
  let b = -271733879;
  let c = -1732584194;
  let d = 271733878;
  let e = -1009589776;

  for (let i = 0; i < words.length; i += 16) {
    const olda = a, oldb = b, oldc = c, oldd = d, olde = e;
    for (let j = 0; j < 80; j++) {
      if (j < 16) {
        w[j] = words[i + j] | 0;
      } else {
        w[j] = rotateLeft(w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16], 1);
      }
      let t;
      if (j < 20) {
        t = (rotateLeft(a, 5) + ((b & c) | (~b & d)) + e + w[j] + 1518500249) | 0;
      } else if (j < 40) {
        t = (rotateLeft(a, 5) + (b ^ c ^ d) + e + w[j] + 1859775393) | 0;
      } else if (j < 60) {
        t = (rotateLeft(a, 5) + ((b & c) | (b & d) | (c & d)) + e + w[j] - 1894007588) | 0;
      } else {
        t = (rotateLeft(a, 5) + (b ^ c ^ d) + e + w[j] - 899497514) | 0;
      }
      e = d;
      d = c;
      c = rotateLeft(b, 30);
      b = a;
      a = t;
    }
    a = (a + olda) | 0;
    b = (b + oldb) | 0;
    c = (c + oldc) | 0;
    d = (d + oldd) | 0;
    e = (e + olde) | 0;
  }
  return cvtHex(a) + cvtHex(b) + cvtHex(c) + cvtHex(d) + cvtHex(e);
}

/**
 * 计算设备签名 devicesign
 * 算法：div101. + deviceId + md5(sha1(deviceId + package + appid + appkey))
 */
export async function getDeviceSign(deviceId) {
  const base = `${deviceId}${PACKAGE_NAME}${APP_ID}${APP_KEY}`;
  const inner = await sha1Hex(base);
  return `div101.${deviceId}${md5Hex(inner)}`;
}

/**
 * 计算人机令牌签名 captcha_sign
 * 算法：1. + md5 链 (ClientID + ClientVersion + PackageName + DeviceID + timestamp 依次与 Algorithms 各段拼接取 md5)
 */
export function getCaptchaSign(deviceId) {
  const timestamp = Date.now().toString();
  let s = `${CLIENT_ID}${CLIENT_VERSION}${PACKAGE_NAME}${deviceId}${timestamp}`;
  for (const algo of ALGORITHMS) {
    s = md5Hex(s + algo);
  }
  return { timestamp, sign: `1.${s}` };
}
