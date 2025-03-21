import SparkMD5 from '../libs/md5.min.js';
function hex_md5(input) {
  return SparkMD5.hash(input);
}

function buildBaseUrl(config) {
  const protocol = config.ssl ? 'https' : 'http';
  return `${protocol}://${config.host}:${config.port}`;
}

function generatePanAuth() {
  const e = Math.floor(Date.now() / 1000);
  const s = `${e}yrjmxtpovrzzdqgtbjdncmsywlpmyqcaawbnruddxucykfebpkuseypjegajzzpplmzrejnavcwtvciupgigyrtomdljhtmsljegvutunuizvatwtqdjheituaizfjyfzpbcvhhlaxzfatpgongrqadvixrnvastczwnolznfavqrvmjseiosmvrtcqiapmtzjfihdysqmhaijlpsrssovkpqnjbxuwkhjpfxpoldvqrnlhgdbcpnsilsmydxaxrxjzbdekzmshputmgkedetrcbmcdgljfkpbprvqncixfkavyxoibbuuyqzvcbzdgvipozeplohmcyfornhxzsadavvimivbzexfzhlndddnbywhsvjrotwzarbycpwydvpeqtuigfwzcvoswgpoakuvgdbykdjdcsdlnqskogpbsyceeyaigbgmrbnzixethpvqvvfvdcvjbilxikvklfbkcnfprzhijjnuoovulvigiqvbosnbixeplvnewmyipxuzpvocbvidnzgsrdfkejghvvyizkjlofndcuzvlhdhovpeolsyroljurbplpwbbihmdloahicnqehgjnbthmrljtzovltnlpeibodpjvemhhybmanskbtvdrgkrzoyhsjcexfrcpddoemazkfjwmrbrcloitmdzzkgxwlhnbfpjffrpryljdzdqsbacrjgohzwgbvzgevnqvxppsxqzczfgpuvigjbuhzweyeinukeurkogpotdegqhtsztdinmijjowivciviunhcjhtufzhjlmpqlngslimksdeezdzxihtmaywfvipjctuealhlovmzdodruperyysdhwjbtidwdzusifeepywsmkqbknlgdhextvlheufxivphskqvdtbcjfryxlolujmennakdqjdhtcxwnhknhzlaatuhyofenhdigojyxrluijjxeywnmopsuicglfcqyybbpynpcsnizupumtakwwnjlkfkuooqoqxhjnryylklokmzvmmgjsbbvgmwoucpvzedmqpkmazwhhvxqygrexopkmcdyniqocguykphlngjesqohhuvnkcliuawkzcmvevdbouwzvgmhtavwyhstvqwhcwjluzjopnhuisbsrloavcieskcyqftdhieduduhowgvrkimgdhyszsiknmuzvnrqqlbykbdlixosgxrdunymbixakkmgppteayqmqivxcwawyidpltevotwoxlkrucmluuluatgeskhfsrsebhniwhujpwrpknjxylidtjwebvwmbwayoepootybnlcaoixlgvjmpquxnyomoiopsjxtnorhwnlmonllastiezyvfbbgngjybtgbkxuaqdmkuqwupgzhffuyzgdnahdifaqtfmpysnlesvfoiofxvbtqkiqvdniejbyzugbkursumqddaslhqpkdrjnnsdqfthxtghxhaylgeqnknhqwpammlfnlkjuqevnxesyqsnpufvrbeohphxfabcduuklpkfoiifsqrrbsxkkmdrnkeboprnksfzwmjymjspzsrfjlwneuwzjjwejruubhhqaktxhygtjuhjmtvrklrmxdbbwooxsucmynwgcxhzdctgtchaevmpfiqfwydultmgqnionuendspvdrcctxldnyjlgnsqxaddadxeyvlcifdxksgdhaatsslhcofnxmilljpzdlumfjvcwvjrxegwbwuuwkguydhozqqnuselsoojnsefquuhpijdguofwrcjbuaugyzphkenbyhdstsldybdqsfxjhpgnerbdosbtyzdtrhyvwkzkurnmbgjtzlzcpfsuxussguelnjttmwejhreptwogekfvdsemlkvklcxeuzlboqwbngddexhsmyzqkztvlbgybbfmzbjroajaucykiqvhjrirlgawaessusvulngosviecmbpfgevxqptalguchfzkrrpruwxspggiqokepqpocezcewhyajsgxrqqqeuhwvc`;
  
  const md5 = hex_md5(s);
  return `${e}.${md5}`;
}

async function request({ method = 'GET', url, data = {} }) {
  const panAuth = generatePanAuth();
  const headers = {
    'DNT': '1',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...',
    'device-space': '',
    'content-type': 'application/json',
    'Accept': '*/*',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'pan-auth': panAuth
  };


  const config = await chrome.storage.sync.get(['host', 'port', 'ssl']);
  const baseUrl = buildBaseUrl(config);

  const options = { method, headers };
  if (method === 'POST') {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(baseUrl + url, options);
  if (!response.ok) throw new Error(`API Error: ${response.status}`);
  return await response.json();
}

async function get(url, params = {}) {
  const query = new URLSearchParams(params).toString();
  const fullUrl = query ? `${url}?${query}` : url;
  return request({ method: 'GET', url: fullUrl });
}

async function post(url, data = {}) {
  return request({ method: 'POST', url, data });
}

export { get, post };