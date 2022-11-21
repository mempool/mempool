var net = require('net');

var IPCheck = module.exports = function(input) {
  var self = this;

  if (!(self instanceof IPCheck)) {
    return new IPCheck(input);
  }

  self.input = input;
  self.parse();
};

IPCheck.prototype.parse = function() {
  var self = this;

  if (!self.input || typeof self.input !== 'string') return self.valid = false;

  var ip;

  var pos = self.input.lastIndexOf('/');
  if (pos !== -1) {
    ip = self.input.substring(0, pos);
    self.mask = +self.input.substring(pos + 1);
  } else {
    ip = self.input;
    self.mask = null;
  }

  self.ipv = net.isIP(ip);
  self.valid = !!self.ipv && !isNaN(self.mask);

  if (!self.valid) return;

  // default mask = 32 for ipv4 and 128 for ipv6
  if (self.mask === null) self.mask = self.ipv === 4 ? 32 : 128;

  if (self.ipv === 4) {
    // difference between ipv4 and ipv6 masks
    self.mask += 96;
  }

  if (self.mask < 0 || self.mask > 128) {
    self.valid = false;
    return;
  }

  self.address = [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ];

  if(self.ipv === 4){
    self.parseIPv4(ip);
  }else{
    self.parseIPv6(ip);
  }
};

IPCheck.prototype.parseIPv4 = function(ip) {
  var self = this;

  // ipv4 addresses live under ::ffff:0:0
  self.address[10] = self.address[11] = 0xff;

  var octets = ip.split('.');
  for (var i = 0; i < 4; i++) {
    self.address[i + 12] = parseInt(octets[i], 10);
  }
};


var V6_TRANSITIONAL = /:(\d+\.\d+\.\d+\.\d+)$/;

IPCheck.prototype.parseIPv6 = function(ip) {
  var self = this;

  var transitionalMatch = V6_TRANSITIONAL.exec(ip);
  if(transitionalMatch){
    self.parseIPv4(transitionalMatch[1]);
    return;
  }

  var bits = ip.split(':');
  if (bits.length < 8) {
    ip = ip.replace('::', Array(11 - bits.length).join(':'));
    bits = ip.split(':');
  }

  var j = 0;
  for (var i = 0; i < bits.length; i += 1) {
    var x = bits[i] ? parseInt(bits[i], 16) : 0;
    self.address[j++] = x >> 8;
    self.address[j++] = x & 0xff;
  }
};

IPCheck.prototype.match = function(cidr) {
  var self = this;

  if (!(cidr instanceof IPCheck)) cidr = new IPCheck(cidr);
  if (!self.valid || !cidr.valid) return false;

  var mask = cidr.mask;
  var i = 0;

  while (mask >= 8) {
    if (self.address[i] !== cidr.address[i]) return false;

    i++;
    mask -= 8;
  }

  var shift = 8 - mask;
  return (self.address[i] >>> shift) === (cidr.address[i] >>> shift);
};


IPCheck.match = function(ip, cidr) {
  ip = ip instanceof IPCheck ? ip : new IPCheck(ip);
  return ip.match(cidr);
};
