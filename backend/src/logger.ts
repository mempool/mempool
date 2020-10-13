import * as dgram from 'dgram';

class Logger {
  static priorities = {
    emerg: 0,
    alert: 1,
    crit: 2,
    err: 3,
    warn: 4,
    notice: 5,
    info: 6,
    debug: 7
  };
  static facilities = {
    kern: 0,
    user: 1,
    mail: 2,
    daemon: 3,
    auth: 4,
    syslog: 5,
    lpr: 6,
    news: 7,
    uucp: 8,
    local0: 16,
    local1: 17,
    local2: 18,
    local3: 19,
    local4: 20,
    local5: 21,
    local6: 22,
    local7: 23
  };

  // @ts-ignore
  public emerg: ((msg: string) => void);
  // @ts-ignore
  public alert: ((msg: string) => void);
  // @ts-ignore
  public crit: ((msg: string) => void);
  // @ts-ignore
  public err: ((msg: string) => void);
  // @ts-ignore
  public warn: ((msg: string) => void);
  // @ts-ignore
  public notice: ((msg: string) => void);
  // @ts-ignore
  public info: ((msg: string) => void);
  // @ts-ignore
  public debug: ((msg: string) => void);

  private name = 'mempool';
  private fac: any;
  private loghost: string;
  private logport: number;
  private client: dgram.Socket;

  constructor(fac) {
    let prio;
    this.fac = fac != null ? fac : Logger.facilities.local0;
    this.loghost = '127.0.0.1';
    this.logport = 514;
    for (prio in Logger.priorities) {
      if (true) {
        this.addprio(prio);
      }
    }
    this.client = dgram.createSocket('udp4');
  }

  private addprio(prio): void {
    this[prio] = (function(_this) {
      return function(msg) {
        return _this.msg(prio, msg);
      };
    })(this);
  }

  private tag() {
    let e, stack, stacklevel, tag;
    stacklevel = 4;
    try {
      const err = new Error().stack;
      if (err) {
        stack = err.replace(/^\s+at\s+/gm, '').replace(/^Object.<anonymous>\s*\(/gm, '{anonymous}()@').split('\n');
        tag = stack[stacklevel].split(' ')[1];
        tag = '(' + tag.split('/').reverse()[0];
      } else {
        tag = '';
      }
    } catch (_error) {
      e = _error;
      tag = '';
    }
    return tag;
  }

  private msg(priority, msg) {
    let consolemsg, prionum, syslogmsg;
    if (typeof msg === 'string' && msg.length > 0) {
      while (msg[msg.length - 1].charCodeAt(0) === 10) {
        msg = msg.slice(0, msg.length - 1);
      }
    }
    prionum = Logger.priorities[priority] || Logger.priorities.info;
    const tag = this.tag();
    syslogmsg = `<${(this.fac * 8 + prionum)}> ${this.name}[${process.pid}]: ${tag}: ${priority.toUpperCase()} ${msg}`;
    consolemsg = `${this.ts()} [${process.pid}] ${priority.toUpperCase()}: ${msg}`;

    this.syslog(syslogmsg);
    if (priority === 'warning') {
      priority = 'warn';
    }
    if (priority === 'debug') {
      priority = 'info';
    }
    if (priority === 'err') {
      priority = 'error';
    }
    return (console[priority] || console.error)(consolemsg);
  }

  private syslog(msg) {
    let msgbuf;
    msgbuf = Buffer.from(msg);
    this.client.send(msgbuf, 0, msgbuf.length, this.logport, this.loghost, function(err, bytes) {
      if (err) {
        console.log(err);
      }
    });
  }

  private leadZero(n: number): number | string {
    if (n < 10) {
      return '0' + n;
    }
    return n;
  }

  private ts() {
    let day, dt, hours, minutes, month, months, seconds;
    dt = new Date();
    hours = this.leadZero(dt.getHours());
    minutes = this.leadZero(dt.getMinutes());
    seconds = this.leadZero(dt.getSeconds());
    month = dt.getMonth();
    day = dt.getDate();
    if (day < 10) {
      day = ' ' + day;
    }
    months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[month] + ' ' + day + ' ' + hours + ':' + minutes + ':' + seconds;
  }
}

export default new Logger(Logger.facilities.local7);
