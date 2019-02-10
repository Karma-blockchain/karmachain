import * as Apis from "./Apis";
import ChainWebSocket from "./ChainWebSocket";

class Manager {
  constructor({url, urls}) {
    this.url = url;
    this.urls = urls.filter(a => a !== url);
  }

  static close() {
    return Apis.close();
  }

  logFailure(url, err) {
    console.error("Skipping to next full node API server. Error: " + (err ? JSON.stringify(err.message) : ""));
  }

  connect = async (connect = true, url = this.url, enableCrypto = false) => {
    try {
      let res = await Apis.instance(url, connect, undefined, enableCrypto).init_promise
      this.url = url;
      return res
    } catch(err) {
      await Apis.close()
      throw new Error("Unable to connect to node: " + url + ", error:" + JSON.stringify(err && err.message))
    }
  }

  connectWithFallback = async (connect = true, url = this.url, index = 0, resolve = null, reject = null, enableCrypto) => {
    if (index > this.urls.length) 
      throw new Error("Tried "+ (index) +" connections, none of which worked: " + JSON.stringify(this.urls.concat(this.url)))
    
    try {
      return await this.connect(connect, url, enableCrypto)
    } catch(err) {
      this.logFailure(url, err);
      return this.connectWithFallback(connect, this.urls[index], index + 1, resolve, reject, enableCrypto);
    }
  }

  checkConnections = async (rpc_user = "", rpc_password = "", resolve, reject) => {
    let connectionStartTimes = {};

    let fullList = this.urls.concat(this.url);
    let connectionPromises = fullList.map(async (url) => {
      let conn = new ChainWebSocket(url, () => {});
      connectionStartTimes[url] = new Date().getTime();

      try {
        await conn.login(rpc_user, rpc_password)
      
        let result = {[url]: new Date().getTime() - connectionStartTimes[url]};
        await conn.close()

        return result
      } catch(err) {
        if (url === this.url) {
          this.url = this.urls[0];
        } else {
          this.urls = this.urls.filter(a => a !== url);
        }
        await conn.close()
        return null
      }
    })

    try {
      let res = await Promise.all(connectionPromises)
      return res.filter(a => !!a).reduce((f, a) => {
        let key = Object.keys(a)[0];
        f[key] = a[key];
        return f;
      }, {})
    } catch(err) {
      return this.checkConnections(rpc_user, rpc_password, resolve, reject);
    }
  }
}

export default Manager;
