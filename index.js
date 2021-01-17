let Service, Characteristic;
const http = require("http");

const BUTTON_RESET_TIMEOUT = 100; // in milliseconds


module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("homebridge-viera", "Viera", VIERA);
};

function VIERA(log, config) {
  this.log = log;
  this.name = config.name;
  this.HOST = config.ip;

  this.muteStatus = false;
}

VIERA.prototype.getServices = function() {
  this.informationService = new Service.AccessoryInformation();
  this.informationService.setCharacteristic(
    Characteristic.Manufacturer,
    "Panasonic"
  );

  this.tvService = new Service.Television(this.name);
  this.tvService
    .getCharacteristic(Characteristic.Active)
    .on("set", this.setOn.bind(this))
    .on("get", this.getOn.bind(this));

  this.televisionSpeakerService = new Service.TelevisionSpeaker(this.name);

  this.televisionSpeakerService
      .setCharacteristic(Characteristic.VolumeControlType, Characteristic.VolumeControlType.ABSOLUTE);

  this.televisionSpeakerService
    .getCharacteristic(Characteristic.VolumeSelector)
    .on("set", this.setVolume.bind(this));

  this.televisionSpeakerService
      .getCharacteristic(Characteristic.Mute)
      .on("set", this.setMute.bind(this));

  this.tvService.addLinkedService(this.televisionSpeakerService);

  this.volumeUpService = this.createStatelessSwitchService('1) Volume Up', 'volumeUpService', this.setVolumeUp.bind(this));

  this.muteService = this.createStatelessSwitchService('3) Mute', 'muteService', this.setMute.bind(this));

  this.volumeDownService = this.createStatelessSwitchService('2) Volume Down', 'volumeDownService', this.setVolumeDown.bind(this));


  return [this.tvService, this.televisionSpeakerService, this.informationService, this.volumeUpService, this.muteService, this.volumeDownService];
};

VIERA.prototype.getOn = function(callback) {
  const me = this;
  let getRequest = {
    host: me.HOST,
    port: 55000,
    timeout: 1000,
    method: "GET",
    path: "/nrc/control_0"
  };

  let timedOut = false;
  let req = http.request(getRequest, res => {
    me.log("Query Power Status on " + me.HOST);
    me.log(`Response Status : ${res.statusCode}`);
    me.log(`Response Headers: ${JSON.stringify(res.headers)}`);

    res.on("data", chunk => {
      me.log(`Received response:" ${chunk}`);
    });

    res.on("end", () => {
      me.log("Responded, TV is ON");
      callback(null, true);
    });
  });

  req.on("timeout", () => {
    me.log("Did not respond, TV is OFF");
    req.abort();
    timedOut = true;
  });

  req.on("error", ex => {
    timedOut ? callback(null, false) : callback(ex);
  });

  req.end();
};

VIERA.prototype.setOn = function(on, callback) {
  const me = this;
  if (on) {
    me.log("Not Supported");
    callback(null, false);
    return;
  }

  let url = "/nrc/control_0";

  let body =
    "<?xml version='1.0' encoding='utf-8'?> " +
    "<s:Envelope xmlns:s='http://schemas.xmlsoap.org/soap/envelope/' s:encodingStyle='http://schemas.xmlsoap.org/soap/encoding/'> " +
    " <s:Body> " +
    "   <u:X_SendKey xmlns:u='urn:panasonic-com:service:p00NetworkControl:1'> " +
    "     <X_KeyEvent>NRC_POWER-ONOFF</X_KeyEvent> " +
    "   </u:X_SendKey> " +
    " </s:Body> " +
    "</s:Envelope>" +
    "";

  let postRequest = {
    host: me.HOST,
    path: url,
    port: 55000,
    timeout: 2000,
    method: "POST",
    headers: {
      "Content-Length": Buffer.byteLength(body),
      "Content-Type": 'text/xml; charset="utf-8"',
      SOAPACTION: '"urn:panasonic-com:service:p00NetworkControl:1#X_SendKey"',
      Accept: "text/xml"
    }
  };

  me.log(`Request Headers: ${JSON.stringify(postRequest.headers)}`);

  let req = http.request(postRequest, res => {
    me.log("Requesting Power Off from TV");
    me.log(body.length + ":" + body);

    res.setEncoding("utf8");

    me.log(`Response Status : ${res.statusCode}`);
    me.log(`Response Headers: ${JSON.stringify(res.headers)}`);

    res.on("data", chunk => {
      me.log(`Received response:" ${chunk}`);
    });

    res.on("end", () => {
      me.log("No more data in response.");
      callback(null, false);
    });
  });

  let timedOut = false;

  req.on("timeout", () => {
    me.log("Did not respond, TV is OFF");
    req.abort();
    timedOut = true;
  });

  req.on("error", ex => {
    timedOut ? callback(null, false) : callback(ex);
  });

  req.write(body);
  req.end();
};

VIERA.prototype.setVolume = function(state, callback) {
  const me = this;

  const button = state === Characteristic.VolumeSelector.INCREMENT ? 'VOLUP' : 'VOLDOWN';
  me.log(button);

  let url = "/nrc/control_0";

  let body =
    "<?xml version='1.0' encoding='utf-8'?> " +
    "<s:Envelope xmlns:s='http://schemas.xmlsoap.org/soap/envelope/' s:encodingStyle='http://schemas.xmlsoap.org/soap/encoding/'> " +
    " <s:Body> " +
    "   <u:X_SendKey xmlns:u='urn:panasonic-com:service:p00NetworkControl:1'> " +
    "     <X_KeyEvent>NRC_" + button + "-ONOFF</X_KeyEvent> " +
    "   </u:X_SendKey> " +
    " </s:Body> " +
    "</s:Envelope>" +
    "";

  let postRequest = {
    host: me.HOST,
    path: url,
    port: 55000,
    timeout: 2000,
    method: "POST",
    headers: {
      "Content-Length": Buffer.byteLength(body),
      "Content-Type": 'text/xml; charset="utf-8"',
      SOAPACTION: '"urn:panasonic-com:service:p00NetworkControl:1#X_SendKey"',
      Accept: "text/xml"
    }
  };

  me.log(`Request Headers: ${JSON.stringify(postRequest.headers)}`);

  let req = http.request(postRequest, res => {
    me.log("Requesting Volume " + button + " from TV");
    me.log(body.length + ":" + body);

    res.setEncoding("utf8");

    me.log(`Response Status : ${res.statusCode}`);
    me.log(`Response Headers: ${JSON.stringify(res.headers)}`);

    res.on("data", chunk => {
      me.log(`Received response:" ${chunk}`);
    });

    res.on("end", () => {
      me.log("No more data in response.");
      callback(null, false);
    });
  });

  let timedOut = false;

  req.on("timeout", () => {
    me.log("Did not respond, TV is OFF");
    req.abort();
    timedOut = true;
  });

  req.on("error", ex => {
    timedOut ? callback(null, false) : callback(ex);
  });

  req.write(body);
  req.end();
};

VIERA.prototype.setVolumeUp = function(state, callback) {
  this.setVolume( Characteristic.VolumeSelector.INCREMENT, (a, b) => {
    this.resetVolumeControlButtons();
    callback();
  });
};
VIERA.prototype.setVolumeDown = function(state, callback) {
  this.setVolume( Characteristic.VolumeSelector.DECREMENT, (a, b) => {
    this.resetVolumeControlButtons();
    callback();
  });
};
VIERA.prototype.resetVolumeControlButtons = function() {
  setTimeout(() => {
    if (this.volumeUpService) this.volumeUpService.getCharacteristic(Characteristic.On).updateValue(false);
    if (this.volumeDownService) this.volumeDownService.getCharacteristic(Characteristic.On).updateValue(false);
    if (this.muteService) this.muteService.getCharacteristic(Characteristic.On).updateValue(false);
  }, BUTTON_RESET_TIMEOUT);
};
VIERA.prototype.createStatelessSwitchService = function(name, id, setterFn) {
  let newStatelessSwitchService = new Service.Switch(name, id);
  newStatelessSwitchService
      .getCharacteristic(Characteristic.On)
      .on('get', this.getStatelessSwitchState.bind(this))
      .on('set', (state, callback) => {
        setterFn(state, callback);
      });
  return newStatelessSwitchService;
};
VIERA.prototype.getStatelessSwitchState = function(callback) {
  callback(null, false);
};
VIERA.prototype.setMute = function(set, callback) {
  const me = this;

  me.log("IM MUTING");
  let url = "/nrc/control_0";

  let body =
    "<?xml version='1.0' encoding='utf-8'?> " +
    "<s:Envelope xmlns:s='http://schemas.xmlsoap.org/soap/envelope/' s:encodingStyle='http://schemas.xmlsoap.org/soap/encoding/'> " +
    " <s:Body> " +
    "   <u:X_SendKey xmlns:u='urn:panasonic-com:service:p00NetworkControl:1'> " +
    "     <X_KeyEvent>NRC_MUTE-ONOFF</X_KeyEvent> " +
    "   </u:X_SendKey> " +
    " </s:Body> " +
    "</s:Envelope>" +
    "";

  let postRequest = {
    host: me.HOST,
    path: url,
    port: 55000,
    timeout: 2000,
    method: "POST",
    headers: {
      "Content-Length": Buffer.byteLength(body),
      "Content-Type": 'text/xml; charset="utf-8"',
      SOAPACTION: '"urn:panasonic-com:service:p00NetworkControl:1#X_SendKey"',
      Accept: "text/xml"
    }
  };

  me.log(`Request Headers: ${JSON.stringify(postRequest.headers)}`);

  let req = http.request(postRequest, res => {
    me.log("Requesting Mute from TV");
    me.log(body.length + ":" + body);

    res.setEncoding("utf8");

    me.log(`Response Status : ${res.statusCode}`);
    me.log(`Response Headers: ${JSON.stringify(res.headers)}`);

    res.on("data", chunk => {
      me.log(`Received response:" ${chunk}`);
    });

    res.on("end", () => {
      me.log("No more data in response.");
      callback(null, false);
      this.resetVolumeControlButtons();
    });
  });

  let timedOut = false;

  req.on("timeout", () => {
    me.log("Did not respond, TV is OFF");
    req.abort();
    timedOut = true;
  });

  req.on("error", ex => {
    timedOut ? callback(null, false) : callback(ex);
  });

  req.write(body);
  req.end();
};

/*
new VIERA(
    (msg) => {
      console.log(msg);
    },
    {name: "tv", ip: "192.168.1.66"}
).setOn(false, (ms, on) => {
  console.log(ms + on);
});



new VIERA(
    (msg) => {
      console.log(msg);
    },
    {name: "tv", ip: "192.168.1.66"}
).getOn((ms, on) => {
  console.log(ms + on);
});
*/
