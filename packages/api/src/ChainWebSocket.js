const WebSocket = require('isomorphic-ws')

const SOCKET_DEBUG = false;
const MAX_SEND_LIFE = 5
const MAX_RECV_LIFE = MAX_SEND_LIFE * 2;


class ChainWebSocket {
  constructor(ws_server = "wss://127.0.0.1:8090", statusCb, connectTimeout = 5000, autoReconnect=true, keepAliveCb=null) {
    this.statusCb = statusCb;

    this.status = null

    this.current_reject = null;
    this.on_reconnect = null;
    this.send_life = MAX_SEND_LIFE;
    this.recv_life = MAX_RECV_LIFE;
    this.keepAliveCb = keepAliveCb;

    this.cbId = 0;
    this.responseCbId = 0;
    this.cbs = {};
    this.subs = {};
    this.unsub = {};

    this.connect_promise = this.connect(ws_server, connectTimeout)
  }

  connect = (server, connectTimeout) => {
    return new Promise((resolve, reject) => {
      this.current_reject = reject;
      this.current_resolve = resolve;

      this.ws = new WebSocket(server)
      
      //this.ws.timeoutInterval = 5000;
      this.ws.onopen = this.onOpen
      this.ws.onerror = this.onError
      this.ws.onmessage = this.onMessage
      this.ws.onclose = this.onClose

      this.connectionTimeout = setTimeout(() =>
        reject(new Error("Connection attempt timed out: " + ws_server)),
        connectTimeout
      )
    })
  }

  onOpen = () => {
    clearTimeout(this.connectionTimeout);
    this.status = "open"

    this.statusCb && this.statusCb("open");
    this.on_reconnect && this.on_reconnect();

    this.keepalive_timer = setInterval(() => {
      this.recv_life --;
      if( this.recv_life == 0){
        console.error('keep alive timeout.');

        this.ws.terminate ? this.ws.terminate() : this.ws.close()

        clearInterval(this.keepalive_timer);
        this.keepalive_timer = undefined;
        return;
      }

      this.send_life --;
      if( this.send_life == 0) {
        // this.ws.ping('', false, true);
        this.keepAliveCb && this.keepAliveCb();
        this.send_life = MAX_SEND_LIFE;
      }

    }, 5000);

    this.current_resolve()
  }

  onError = (error) => {
    //this.status = "error"
    if( this.keepalive_timer ){
      clearInterval(this.keepalive_timer);
      this.keepalive_timer = undefined;
    }
    clearTimeout(this.connectionTimeout);
    if(this.statusCb) this.statusCb("error");

    if (this.current_reject) {
      this.current_reject(error);
    }
  }

  onMessage = (message) => {
    this.recv_life = MAX_RECV_LIFE;
    this.listener(JSON.parse(message.data));
  }

  onClose = () => {
    this.status = "close"

    if( this.keepalive_timer ){
      clearInterval(this.keepalive_timer);
      this.keepalive_timer = undefined;
    }

    for(var cbId = this.responseCbId + 1; cbId <= this.cbId; cbId +=1 ){
      this.cbs[cbId].reject(new Error('connection closed'));
    }

    this.statusCb && this.statusCb("closed");
    this.closeCb && this.closeCb();
  }

  call = (params) => {
    if( this.ws.readyState !== 1){
      return Promise.reject(new Error('websocket state error:' + this.ws.readyState));
    }
    let method = params[1];
    if(SOCKET_DEBUG)
      console.log("[ChainWebSocket] >---- call ----->  \"id\":" + (this.cbId+1), JSON.stringify(params));

    this.cbId += 1;

    if ([
      "set_subscribe_callback", 
      "subscribe_to_market",
      "broadcast_transaction_with_callback",
      "set_pending_transaction_callback"
    ].includes(method)) {
      // Store callback in subs map
      this.subs[this.cbId] = {
        callback: params[2][0]
      };

      // Replace callback with the callback id
      params[2][0] = this.cbId;
    }

    if( ["unsubscribe_from_market", "unsubscribe_from_accounts"].includes(method)) {
      if (typeof params[2][0] !== "function") {
        throw new Error("First parameter of unsub must be the original callback");
      }

      let unSubCb = params[2].splice(0, 1)[0];

      // Find the corresponding subscription
      for (let id in this.subs) {
        if (this.subs[id].callback === unSubCb) {
          this.unsub[this.cbId] = id;
          break;
        }
      }
    }

    var request = {
      method: "call",
      params
    };
    request.id = this.cbId;
    this.send_life = MAX_SEND_LIFE;

    return new Promise((resolve, reject) => {
      this.cbs[this.cbId] = {
        time: new Date(),
        resolve,
        reject
      };
      this.ws.send(JSON.stringify(request));
    });

  }

  listener = (response) => {
    if(SOCKET_DEBUG)
      console.log("[ChainWebSocket] <---- reply ----<", JSON.stringify(response));

    let sub = false,
        callback = null;

    if (response.method === "notice") {
      sub = true;
      response.id = response.params[0];
    }

    if (!sub) {
      callback = this.cbs[response.id];
      this.responseCbId = response.id;
    } else {
      callback = this.subs[response.id].callback;
    }

    if (callback && !sub) {
      response.error 
        ? callback.reject(response.error) 
        : callback.resolve(response.result)

      delete this.cbs[response.id];

      if (this.unsub[response.id]) {
        delete this.subs[this.unsub[response.id]];
        delete this.unsub[response.id];
      }

    } else if (callback && sub) {
      callback(response.params[1]);
    } else {
      console.log("Warning: unknown websocket response: ", response);
    }
  }

  login = async (user, password) => {
    await this.connect_promise
    return this.call([1, "login", [user, password]])
  }

  close = () => {
    return new Promise((res) => {
      this.closeCb = () => {
        res();
        this.closeCb = null;
      };
      this.ws.close();
      if (this.ws.readyState !== 1) res();
    })
  }
}

export default ChainWebSocket;
