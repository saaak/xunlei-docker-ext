import SparkMD5 from '../libs/md5.min.js';
import { 
  PLATFORM_DOCKER, 
  PLATFORM_FNOS, 
  PREFIX_DOCKER, 
  PREFIX_FNOS,
  URL_SERVER_VERSION,
  URL_HIGH_VERSION_AUTH 
} from './constants.js';

const SERVER_VERSION_CACHE_KEY = 'xunleiCachedServerVersion';
const SERVER_VERSION_TIMESTAMP_KEY = 'xunleiServerVersionCacheTime';
const SERVER_VERSION_CACHE_DURATION = 1 * 60 * 60 * 1000; // 1 小时 (毫秒)

const HIGH_VERSION_TOKEN_CACHE_DURATION = 10 * 60 * 1000; 

let cachedHighVersionToken = null; 
let highVersionTokenCacheTime = 0;

function hex_md5(input) {
  return SparkMD5.hash(input);
}

/**
 * 根据平台配置获取 URL 前缀。
 * @param {string} platform - 平台类型 ('docker' | 'fnos')。
 * @returns {string} URL 前缀。
 */
function getPathPrefix(platform) {
  return platform === PLATFORM_FNOS ? PREFIX_FNOS : PREFIX_DOCKER;
}

/**
 * 根据配置构建基础 URL。
 * @param {object} config - 包含 host, port, 和 ssl 的配置对象。
 * @returns {string} 构建的基础 URL，例如 "http://127.0.0.1:2345"。
 */
function buildBaseUrl(config) {
  const protocol = config.ssl ? 'https' : 'http';
  return `${protocol}://${config.host}:${config.port}`;
}

/**
 * 获取迅雷服务器的版本号。
 * 会优先从本地缓存读取，缓存过期或不存在时再从网络获取。
 * @param {string} baseUrl - 迅雷服务的基础 URL。
 * @param {string} platform - 平台类型。
 * @returns {Promise<string|null>} 服务器版本号字符串，如果获取失败则返回 null。
 */
async function fetchXunleiServerVersion(baseUrl, platform) {
  try {
    const cachedData = await chrome.storage.local.get([SERVER_VERSION_CACHE_KEY, SERVER_VERSION_TIMESTAMP_KEY]);
    const cachedVersion = cachedData[SERVER_VERSION_CACHE_KEY];
    const cacheTime = cachedData[SERVER_VERSION_TIMESTAMP_KEY];

    if (cachedVersion && cacheTime && (Date.now() - cacheTime < SERVER_VERSION_CACHE_DURATION)) {
      return cachedVersion;
    }
  } catch (e) {
    console.warn('读取版本缓存失败:', e);
  }

  try {
    const prefix = getPathPrefix(platform);
    const statusUrl = `${baseUrl}${prefix}${URL_SERVER_VERSION}`;
    const response = await fetch(statusUrl);
    if (!response.ok) {
      console.error('获取迅雷版本失败 (网络):', response.status, await response.text());
      return null;
    }
    const data = await response.json();
    const runningVersion = data.running_version;

    if (runningVersion) {
      try {
        await chrome.storage.local.set({
          [SERVER_VERSION_CACHE_KEY]: runningVersion,
          [SERVER_VERSION_TIMESTAMP_KEY]: Date.now()
        });
      } catch (e) {
        console.warn('缓存版本失败:', e);
      }
    }
    return runningVersion;
  } catch (error) {
    console.error('获取版本时发生错误 (网络):', error);
    return null;
  }
}

/**
 * 比较版本号，检查当前版本是否至少为目标版本。
 * @param {string} currentVersion - 当前版本号字符串。
 * @param {string} targetVersion - 目标版本号字符串。
 */
function isVersionAtLeast(currentVersion, targetVersion) {
  if (!currentVersion || !targetVersion) return false;
  const currentParts = currentVersion.split('.').map(Number);
  const targetParts = targetVersion.split('.').map(Number);

  for (let i = 0; i < targetParts.length; i++) {
    const current = currentParts[i] || 0;
    const target = targetParts[i] || 0;
    if (current > target) return true;
    if (current < target) return false;
  }
  return currentParts.length >= targetParts.length;
}

/**
 * 为高版本迅雷 (>=3.21.0) 生成 pan-auth token。
 * 该 token 从首页 HTML 中提取，并进行内存缓存。
 * @param {string} baseUrl - 迅雷服务的基础 URL。
 * @param {string} platform - 平台类型。
 * @returns {Promise<string|null>} pan-auth token，如果获取失败则返回 null。
 */
async function generatePanAuthForHighVersion(baseUrl, platform) {
  if (cachedHighVersionToken && (Date.now() - highVersionTokenCacheTime < HIGH_VERSION_TOKEN_CACHE_DURATION)) {
    return cachedHighVersionToken;
  }

  try {
    const prefix = getPathPrefix(platform);
    const indexUrl = `${baseUrl}${prefix}${URL_HIGH_VERSION_AUTH}`;
    const response = await fetch(indexUrl);
    if (!response.ok) {
      console.error('高版本 token：获取首页失败:', response.status, await response.text());
      return null;
    }
    const htmlContent = await response.text();
    const uiauthRegex = /function uiauth\(value\)\s*{\s*return\s*"([^"]+)"\s*}/;
    const match = htmlContent.match(uiauthRegex);

    if (match && match[1]) {
      cachedHighVersionToken = match[1];
      highVersionTokenCacheTime = Date.now();
      return cachedHighVersionToken;
    }
    return null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

/**
 * 为低版本迅雷 (<3.21.0) 生成 pan-auth token。
 * @returns {string} pan-auth token。
 */
function generatePanAuthForLowVersion() {
  const e = Math.floor(Date.now() / 1000);
  const s = `${e}yrjmxtpovrzzdqgtbjdncmsywlpmyqcaawbnruddxucykfebpkuseypjegajzzpplmzrejnavcwtvciupgigyrtomdljhtmsljegvutunuizvatwtqdjheituaizfjyfzpbcvhhlaxzfatpgongrqadvixrnvastczwnolznfavqrvmjseiosmvrtcqiapmtzjfihdysqmhaijlpsrssovkpqnjbxuwkhjpfxpoldvqrnlhgdbcpnsilsmydxaxrxjzbdekzmshputmgkedetrcbmcdgljfkpbprvqncixfkavyxoibbuuyqzvcbzdgvipozeplohmcyfornhxzsadavvimivbzexfzhlndddnbywhsvjrotwzarbycpwydvpeqtuigfwzcvoswgpoakuvgdbykdjdcsdlnqskogpbsyceeyaigbgmrbnzixethpvqvvfvdcvjbilxikvklfbkcnfprzhijjnuoovulvigiqvbosnbixeplvnewmyipxuzpvocbvidnzgsrdfkejghvvyizkjlofndcuzvlhdhovpeolsyroljurbplpwbbihmdloahicnqehgjnbthmrljtzovltnlpeibodpjvemhhybmanskbtvdrgkrzoyhsjcexfrcpddoemazkfjwmrbrcloitmdzzkgxwlhnbfpjffrpryljdzdqsbacrjgohzwgbvzgevnqvxppsxqzczfgpuvigjbuhzweyeinukeurkogpotdegqhtsztdinmijjowivciviunhcjhtufzhjlmpqlngslimksdeezdzxihtmaywfvipjctuealhlovmzdodruperyysdhwjbtidwdzusifeepywsmkqbknlgdhextvlheufxivphskqvdtbcjfryxlolujmennakdqjdhtcxwnhknhzlaatuhyofenhdigojyxrluijjxeywnmopsuicglfcqyybbpynpcsnizupumtakwwnjlkfkuooqoqxhjnryylklokmzvmmgjsbbvgmwoucpvzedmqpkmazwhhvxqygrexopkmcdyniqocguykphlngjesqohhuvnkcliuawkzcmvevdbouwzvgmhtavwyhstvqwhcwjluzjopnhuisbsrloavcieskcyqftdhieduduhowgvrkimgdhyszsiknmuzvnrqqlbykbdlixosgxrdunymbixakkmgppteayqmqivxcwawyidpltevotwoxlkrucmluuluatgeskhfsrsebhniwhujpwrpknjxylidtjwebvwmbwayoepootybnlcaoixlgvjmpquxnyomoiopsjxtnorhwnlmonllastiezyvfbbgngjybtgbkxuaqdmkuqwupgzhffuyzgdnahdifaqtfmpysnlesvfoiofxvbtqkiqvdniejbyzugbkursumqddaslhqpkdrjnnsdqfthxtghxhaylgeqnknhqwpammlfnlkjuqevnxesyqsnpufvrbeohphxfabcduuklpkfoiifsqrrbsxkkmdrnkeboprnksfzwmjymjspzsrfjlwneuwzjjwejruubhhqaktxhygtjuhjmtvrklrmxdbbwooxsucmynwgcxhzdctgtchaevmpfiqfwydultmgqnionuendspvdrcctxldnyjlgnsqxaddadxeyvlcifdxksgdhaatsslhcofnxmilljpzdlumfjvcwvjrxegwbwuuwkguydhozqqnuselsoojnsefquuhpijdguofwrcjbuaugyzphkenbyhdstsldybdqsfxjhpgnerbdosbtyzdtrhyvwkzkurnmbgjtzlzcpfsuxussguelnjttmwejhreptwogekfvdsemlkvklcxeuzlboqwbngddexhsmyzqkztvlbgybbfmzbjroajaucykiqvhjrirlgawaessusvulngosviecmbpfgevxqptalguchfzkrrpruwxspggiqokepqpocezcewhyajsgxrqqqeuhwvc`;
  const md5 = hex_md5(s);
  return `${e}.${md5}`;
}

/**
 * 动态生成 pan-auth token。
 * @param {string} baseUrl - 迅雷服务的基础 URL。
 * @param {string} platform - 平台类型。
 * @returns {Promise<string|null>} pan-auth token，如果生成失败则返回 null。
 */
async function generatePanAuth(baseUrl, platform) {
  const serverVersion = await fetchXunleiServerVersion(baseUrl, platform); // 现在会尝试从缓存读取

  if (serverVersion && isVersionAtLeast(serverVersion, "3.21.0")) {
    const token = await generatePanAuthForHighVersion(baseUrl, platform);
    if (token) {
      return token;
    }
    console.warn("高版本 token 获取失败，尝试使用低版本逻辑。");
  } else if (serverVersion) {
  } else {
    console.warn("无法确定迅雷服务器版本，默认使用低版本 token 逻辑。");
  }
  
  return generatePanAuthForLowVersion();
}

/**
 * 发送 HTTP 请求的核心函数。
 * @param {object} options - 请求选项。
 * @param {string} options.method - HTTP 方法 (GET, POST)。
 * @param {string} options.url - 请求的相对路径。
 * @param {object} [options.data={}] - POST 请求时发送的数据。
 * @returns {Promise<object>} 解析后的 JSON 响应数据。
 */
async function request({ method = 'GET', url, data = {} }) {
  const config = await chrome.storage.sync.get(['host', 'port', 'ssl', 'platform']);
  if (!config.host || !config.port) {
    throw new Error('迅雷 Docker 配置未找到 (host 或 port 缺失)。请先在插件设置中配置。');
  }
  
  const platform = config.platform || PLATFORM_DOCKER; // 默认为 Docker
  const baseUrl = buildBaseUrl(config);

  const panAuth = await generatePanAuth(baseUrl, platform);
  if (!panAuth) {
    throw new Error('无法生成 pan-auth token。');
  }

  const headers = {
    'DNT': '1',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36 Edg/90.0.818.66',
    'device-space': '',
    'content-type': 'application/json',
    'Accept': '*/*',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'pan-auth': panAuth
  };

  const requestOptions = { method, headers };
  
  const prefix = getPathPrefix(platform);
  const fullUrl = baseUrl + prefix + url;

  if (method === 'POST') {
    requestOptions.body = JSON.stringify(data);
  }

  const response = await fetch(fullUrl, requestOptions);

  try {
    return await response.json();
  } catch (e) {
    console.error('API 响应不是有效的 JSON:', await response.text());
    throw new Error('API 响应格式错误，不是有效的 JSON。');
  }
}

/**
 * 发送 GET 请求。
 * @param {string} url - 请求的相对路径。
 * @param {object} [params={}] - URL 查询参数。
 * @returns {Promise<object>} 解析后的 JSON 响应数据。
 */
async function get(url, params = {}) {
  const query = new URLSearchParams(params).toString();
  const fullUrl = query ? `${url}?${query}` : url;
  return request({ method: 'GET', url: fullUrl });
}

/**
 * 发送 POST 请求。
 * @param {string} url - 请求的相对路径。
 * @param {object} [data={}] - 发送的 JSON 数据。
 * @returns {Promise<object>} 解析后的 JSON 响应数据。
 */
async function post(url, data = {}) {
  return request({ method: 'POST', url, data });
}

/**
 * 清除认证相关的缓存（包括 token 和服务器版本）。
 * 用于在配置变更时强制刷新认证信息。
 */
async function clearAuthCache() {
  // 清除内存缓存
  cachedHighVersionToken = null;
  highVersionTokenCacheTime = 0;
  
  // 清除本地存储的版本缓存
  try {
    await chrome.storage.local.remove([SERVER_VERSION_CACHE_KEY, SERVER_VERSION_TIMESTAMP_KEY]);
    console.log('认证缓存已清除');
  } catch (e) {
    console.error('清除认证缓存失败:', e);
  }
}

export { get, post, clearAuthCache };
