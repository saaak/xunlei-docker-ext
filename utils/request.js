// 导入 SparkMD5 库，用于低版本 token 生成
import SparkMD5 from '../libs/md5.min.js';

/**
 * 计算输入字符串的 MD5 哈希值。
 * @param {string} input - 需要计算哈希的字符串。
 * @returns {string} 输入字符串的十六进制 MD5 哈希值。
 */
function hex_md5(input) {
  return SparkMD5.hash(input);
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
 * @param {string} baseUrl - 迅雷服务的基础 URL。
 * @returns {Promise<string|null>} 服务器版本号字符串，如果获取失败则返回 null。
 */
async function fetchXunleiServerVersion(baseUrl) {
  try {
    // 构造完整的状态 API URL
    const statusUrl = `${baseUrl}/webman/3rdparty/pan-xunlei-com/index.cgi/launcher/status`;
    const response = await fetch(statusUrl);
    if (!response.ok) {
      console.error('获取迅雷服务器版本失败:', response.status, await response.text());
      return null;
    }
    const data = await response.json();
    return data.running_version; // 返回运行中的版本号
  } catch (error) {
    console.error('获取迅雷服务器版本时发生错误:', error);
    return null;
  }
}

/**
 * 比较版本号，检查当前版本是否至少为目标版本。
 * @param {string} currentVersion - 当前版本号字符串。
 * @param {string} targetVersion - 目标版本号字符串。
 * @returns {boolean} 如果当前版本大于或等于目标版本，则返回 true，否则返回 false。
 */
function isVersionAtLeast(currentVersion, targetVersion) {
  // 检查输入是否有效
  if (!currentVersion || !targetVersion) return false;
  // 分割版本号为主版本、次版本和修订版本
  const currentParts = currentVersion.split('.').map(Number);
  const targetParts = targetVersion.split('.').map(Number);

  for (let i = 0; i < targetParts.length; i++) {
    const current = currentParts[i] || 0; // 如果当前版本部分不存在，则默认为0
    const target = targetParts[i] || 0;
    if (current > target) return true;
    if (current < target) return false;
  }
  // 如果所有部分都相等，或者当前版本有更多部分（例如 3.21.0.1 vs 3.21.0），则认为满足条件
  return currentParts.length >= targetParts.length;
}

// 缓存高版本 token 及其获取时间
let cachedHighVersionToken = null;
let tokenCacheTime = 0;
const TOKEN_CACHE_DURATION = 10 * 60 * 1000; // 10 分钟的缓存有效期 (毫秒)

/**
 * 为高版本迅雷 (>=3.21.0) 生成 pan-auth token。
 * 该 token 从首页 HTML 中提取。
 * @param {string} baseUrl - 迅雷服务的基础 URL。
 * @returns {Promise<string|null>} pan-auth token，如果获取失败则返回 null。
 */
async function generatePanAuthForHighVersion(baseUrl) {
  // 检查缓存的 token 是否有效
  if (cachedHighVersionToken && (Date.now() - tokenCacheTime < TOKEN_CACHE_DURATION)) {
    return cachedHighVersionToken;
  }

  try {
    // 构造首页 URL
    const indexUrl = `${baseUrl}/webman/3rdparty/pan-xunlei-com/index.cgi/`;
    const response = await fetch(indexUrl);
    if (!response.ok) {
      console.error('高版本 token：获取首页失败:', response.status, await response.text());
      return null;
    }
    const htmlContent = await response.text();
    // 正则表达式提取 uiauth token
    const uiauthRegex = /function uiauth\(value\)\s*{\s*return\s*"([^"]+)"\s*}/;
    const match = htmlContent.match(uiauthRegex);

    if (match && match[1]) {
      cachedHighVersionToken = match[1]; // 缓存 token
      tokenCacheTime = Date.now(); // 更新缓存时间
      console.log('高版本 token 获取成功 (来自 HTML):', cachedHighVersionToken);
      return cachedHighVersionToken;
    }
    console.error('高版本 token：无法从 HTML 中提取 uiauth token。');
    return null;
  } catch (error) {
    console.error('高版本 token：获取或解析时发生错误:', error);
    return null;
  }
}

/**
 * 为低版本迅雷 (<3.21.0) 生成 pan-auth token。
 * 这是您原有的 token 生成逻辑。
 * @returns {string} pan-auth token。
 */
function generatePanAuthForLowVersion() {
  const e = Math.floor(Date.now() / 1000);
  // 这个超长字符串是低版本 token 生成算法的一部分
  const s = `${e}yrjmxtpovrzzdqgtbjdncmsywlpmyqcaawbnruddxucykfebpkuseypjegajzzpplmzrejnavcwtvciupgigyrtomdljhtmsljegvutunuizvatwtqdjheituaizfjyfzpbcvhhlaxzfatpgongrqadvixrnvastczwnolznfavqrvmjseiosmvrtcqiapmtzjfihdysqmhaijlpsrssovkpqnjbxuwkhjpfxpoldvqrnlhgdbcpnsilsmydxaxrxjzbdekzmshputmgkedetrcbmcdgljfkpbprvqncixfkavyxoibbuuyqzvcbzdgvipozeplohmcyfornhxzsadavvimivbzexfzhlndddnbywhsvjrotwzarbycpwydvpeqtuigfwzcvoswgpoakuvgdbykdjdcsdlnqskogpbsyceeyaigbgmrbnzixethpvqvvfvdcvjbilxikvklfbkcnfprzhijjnuoovulvigiqvbosnbixeplvnewmyipxuzpvocbvidnzgsrdfkejghvvyizkjlofndcuzvlhdhovpeolsyroljurbplpwbbihmdloahicnqehgjnbthmrljtzovltnlpeibodpjvemhhybmanskbtvdrgkrzoyhsjcexfrcpddoemazkfjwmrbrcloitmdzzkgxwlhnbfpjffrpryljdzdqsbacrjgohzwgbvzgevnqvxppsxqzczfgpuvigjbuhzweyeinukeurkogpotdegqhtsztdinmijjowivciviunhcjhtufzhjlmpqlngslimksdeezdzxihtmaywfvipjctuealhlovmzdodruperyysdhwjbtidwdzusifeepywsmkqbknlgdhextvlheufxivphskqvdtbcjfryxlolujmennakdqjdhtcxwnhknhzlaatuhyofenhdigojyxrluijjxeywnmopsuicglfcqyybbpynpcsnizupumtakwwnjlkfkuooqoqxhjnryylklokmzvmmgjsbbvgmwoucpvzedmqpkmazwhhvxqygrexopkmcdyniqocguykphlngjesqohhuvnkcliuawkzcmvevdbouwzvgmhtavwyhstvqwhcwjluzjopnhuisbsrloavcieskcyqftdhieduduhowgvrkimgdhyszsiknmuzvnrqqlbykbdlixosgxrdunymbixakkmgppteayqmqivxcwawyidpltevotwoxlkrucmluuluatgeskhfsrsebhniwhujpwrpknjxylidtjwebvwmbwayoepootybnlcaoixlgvjmpquxnyomoiopsjxtnorhwnlmonllastiezyvfbbgngjybtgbkxuaqdmkuqwupgzhffuyzgdnahdifaqtfmpysnlesvfoiofxvbtqkiqvdniejbyzugbkursumqddaslhqpkdrjnnsdqfthxtghxhaylgeqnknhqwpammlfnlkjuqevnxesyqsnpufvrbeohphxfabcduuklpkfoiifsqrrbsxkkmdrnkeboprnksfzwmjymjspzsrfjlwneuwzjjwejruubhhqaktxhygtjuhjmtvrklrmxdbbwooxsucmynwgcxhzdctgtchaevmpfiqfwydultmgqnionuendspvdrcctxldnyjlgnsqxaddadxeyvlcifdxksgdhaatsslhcofnxmilljpzdlumfjvcwvjrxegwbwuuwkguydhozqqnuselsoojnsefquuhpijdguofwrcjbuaugyzphkenbyhdstsldybdqsfxjhpgnerbdosbtyzdtrhyvwkzkurnmbgjtzlzcpfsuxussguelnjttmwejhreptwogekfvdsemlkvklcxeuzlboqwbngddexhsmyzqkztvlbgybbfmzbjroajaucykiqvhjrirlgawaessusvulngosviecmbpfgevxqptalguchfzkrrpruwxspggiqokepqpocezcewhyajsgxrqqqeuhwvc`;
  const md5 = hex_md5(s);
  return `${e}.${md5}`;
}

/**
 * 动态生成 pan-auth token。
 * 会先尝试获取服务器版本，然后根据版本选择合适的 token 生成策略。
 * @param {string} baseUrl - 迅雷服务的基础 URL。
 * @returns {Promise<string|null>} pan-auth token，如果生成失败则返回 null。
 */
async function generatePanAuth(baseUrl) {
  const serverVersion = await fetchXunleiServerVersion(baseUrl);

  if (serverVersion && isVersionAtLeast(serverVersion, "3.21.0")) {
    console.log(`检测到迅雷版本: ${serverVersion} (高版本)`);
    const token = await generatePanAuthForHighVersion(baseUrl);
    if (token) {
      return token;
    }
    // 如果高版本 token 获取失败，可以尝试回退到低版本逻辑或直接报错
    console.warn("高版本 token 获取失败，尝试使用低版本逻辑。");
    // return generatePanAuthForLowVersion(); // 如果希望回退
    // 或者可以抛出错误，让调用者处理
    // throw new Error("无法为高版本迅雷获取 token。");
  } else if (serverVersion) {
    console.log(`检测到迅雷版本: ${serverVersion} (低版本)`);
  } else {
    console.warn("无法确定迅雷服务器版本，默认使用低版本 token 逻辑。");
  }
  
  // 默认或低版本逻辑
  return generatePanAuthForLowVersion();
}

/**
 * 发送 HTTP 请求的核心函数。
 * @param {object} options - 请求选项。
 * @param {string} options.method - HTTP 方法 (GET, POST)。
 * @param {string} options.url - 请求的相对路径。
 * @param {object} [options.data={}] - POST 请求时发送的数据。
 * @returns {Promise<object>} 解析后的 JSON 响应数据。
 * @throws {Error} 如果 token 生成失败或 API 响应不成功。
 */
async function request({ method = 'GET', url, data = {} }) {
  // 从 chrome.storage.sync 获取配置
  const config = await chrome.storage.sync.get(['host', 'port', 'ssl']);
  if (!config.host || !config.port) {
    throw new Error('迅雷 Docker 配置未找到 (host 或 port 缺失)。请先在插件设置中配置。');
  }
  const baseUrl = buildBaseUrl(config);

  // 动态生成 panAuth token
  const panAuth = await generatePanAuth(baseUrl);
  if (!panAuth) {
    throw new Error('无法生成 pan-auth token。');
  }

  const headers = {
    'DNT': '1', // "Do Not Track" 标头
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36 Edg/90.0.818.66', // 示例 User-Agent
    'device-space': '', // 根据 API 可能需要此参数
    'content-type': 'application/json',
    'Accept': '*/*',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'pan-auth': panAuth // 关键的认证 token
  };

  const requestOptions = { method, headers };
  // 构造完整的请求 URL
  const fullUrl = baseUrl + url;

  if (method === 'POST') {
    requestOptions.body = JSON.stringify(data);
  }

  console.log(`发送请求: ${method} ${fullUrl}`, method === 'POST' ? data: '');

  const response = await fetch(fullUrl, requestOptions);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`API 请求错误: ${response.status} - ${response.statusText}`, errorText);
    throw new Error(`API 错误: ${response.status} - ${errorText}`);
  }
  return await response.json();
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

// 导出 get 和 post 方法，供 api.js 使用
export { get, post };
