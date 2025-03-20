export class ApiClient {
  constructor(host, port, ssl = true) {
    this.baseUrl = `${ssl ? 'https' : 'http'}://${host}:${port}`;
    this.headers = {
      'DNT': '1',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'device-space': '',
      'content-type': 'application/json',
      'Accept': '*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9'
    };
    this.deviceId = null;
  }

  generatePanAuth() {
    const e = Math.floor(Date.now() / 1000);
    const s = `${e}yrjmxtpovrzzdqgtbjdncmsywlpmyqcaawbnruddxucykfebpkuseypjegajzzpplmzrejnavcwtvciupgigyrtomdljhtmsljegvutunuizvatwtqdjheituaizfjyfzpbcvhhlaxzfatpgongrqadvixrnvastczwnolznfavqrvmjseiosmvrtcqiapmtzjfihdysqmhaijlpsrssovkpqnjbxuwkhjpfxpoldvqrnlhgdbcpnsilsmydxaxrxjzbdekzmshputmgkedetrcbmcdgljfkpbprvqncixfkavyxoibbuuyqzvcbzdgvipozeplohmcyfornhxzsadavvimivbzexfzhlndddnbywhsvjrotwzarbycpwydvpeqtuigfwzcvoswgpoakuvgdbykdjdcsdlnqskogpbsyceeyaigbgmrbnzixethpvqvvfvdcvjbilxikvklfbkcnfprzhijjnuoovulvigiqvbosnbixeplvnewmyipxuzpvocbvidnzgsrdfkejghvvyizkjlofndcuzvlhdhovpeolsyroljurbplpwbbihmdloahicnqehgjnbthmrljtzovltnlpeibodpjvemhhybmanskbtvdrgkrzoyhsjcexfrcpddoemazkfjwmrbrcloitmdzzkgxwlhnbfpjffrpryljdzdqsbacrjgohzwgbvzgevnqvxppsxqzczfgpuvigjbuhzweyeinukeurkogpotdegqhtsztdinmijjowivciviunhcjhtufzhjlmpqlngslimksdeezdzxihtmaywfvipjctuealhlovmzdodruperyysdhwjbtidwdzusifeepywsmkqbknlgdhextvlheufxivphskqvdtbcjfryxlolujmennakdqjdhtcxwnhknhzlaatuhyofenhdigojyxrluijjxeywnmopsuicglfcqyybbpynpcsnizupumtakwwnjlkfkuooqoqxhjnryylklokmzvmmgjsbbvgmwoucpvzedmqpkmazwhhvxqygrexopkmcdyniqocguykphlngjesqohhuvnkcliuawkzcmvevdbouwzvgmhtavwyhstvqwhcwjluzjopnhuisbsrloavcieskcyqftdhieduduhowgvrkimgdhyszsiknmuzvnrqqlbykbdlixosgxrdunymbixakkmgppteayqmqivxcwawyidpltevotwoxlkrucmluuluatgeskhfsrsebhniwhujpwrpknjxylidtjwebvwmbwayoepootybnlcaoixlgvjmpquxnyomoiopsjxtnorhwnlmonllastiezyvfbbgngjybtgbkxuaqdmkuqwupgzhffuyzgdnahdifaqtfmpysnlesvfoiofxvbtqkiqvdniejbyzugbkursumqddaslhqpkdrjnnsdqfthxtghxhaylgeqnknhqwpammlfnlkjuqevnxesyqsnpufvrbeohphxfabcduuklpkfoiifsqrrbsxkkmdrnkeboprnksfzwmjymjspzsrfjlwneuwzjjwejruubhhqaktxhygtjuhjmtvrklrmxdbbwooxsucmynwgcxhzdctgtchaevmpfiqfwydultmgqnionuendspvdrcctxldnyjlgnsqxaddadxeyvlcifdxksgdhaatsslhcofnxmilljpzdlumfjvcwvjrxegwbwuuwkguydhozqqnuselsoojnsefquuhpijdguofwrcjbuaugyzphkenbyhdstsldybdqsfxjhpgnerbdosbtyzdtrhyvwkzkurnmbgjtzlzcpfsuxussguelnjttmwejhreptwogekfvdsemlkvklcxeuzlboqwbngddexhsmyzqkztvlbgybbfmzbjroajaucykiqvhjrirlgawaessusvulngosviecmbpfgevxqptalguchfzkrrpruwxspggiqokepqpocezcewhyajsgxrqqqeuhwvc`;
    const md5 = require('crypto').createHash('md5').update(s).digest('hex');
    return `${e}.${md5}`;
  }

  updateHeaders() {
    this.headers['pan-auth'] = this.generatePanAuth();
  }

  async getDeviceId(deviceName = null) {
    try {
      this.updateHeaders();
      const response = await this.get('/webman/3rdparty/pan-xunlei-com/index.cgi/drive/v1/tasks?type=user%23runner&device_space=');
      
      if (response.status === 500) {
        throw new Error('Not logged in to Xunlei account');
      }
      
      if (response.data?.error_code === 403) {
        throw new Error('Pan auth invalid');
      }

      const tasks = response.data?.tasks || [];
      
      if (tasks.length === 0) {
        throw new Error('No remote device is bound');
      }

      if (deviceName) {
        const device = tasks.find(task => task.name === deviceName);
        if (!device) {
          throw new Error(`Device ${deviceName} not found`);
        }
        this.deviceId = device.params?.target;
      } else {
        if (tasks.length > 1) {
          console.warn(`Multiple devices found, using first one: ${tasks[0].device_name}`);
        }
        this.deviceId = tasks[0].params?.target;
      }

      console.log(`Successfully got device ID: ${this.deviceId}`);
      return this.deviceId;
    } catch (error) {
      console.error('Failed to get device ID:', error);
      throw error;
    }
  }

  async get(endpoint, params = {}) {
    this.updateHeaders();
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers,
      params
    });
    return {
      status: response.status,
      data: await response.json()
    };
  }

  async post(endpoint, data = {}) {
    this.updateHeaders();
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(data)
    });
    return {
      status: response.status,
      data: await response.json()
    };
  }

  async put(endpoint, data = {}) {
    this.updateHeaders();
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(data)
    });
    return {
      status: response.status,
      data: await response.json()
    };
  }

  async delete(endpoint) {
    this.updateHeaders();
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.headers
    });
    return {
      status: response.status,
      data: await response.json()
    };
  }
}