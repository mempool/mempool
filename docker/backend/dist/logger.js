"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
const dgram = require("dgram");
class Logger {
    constructor(fac) {
        this.name = 'mempool';
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
        this.network = this.getNetwork();
    }
    addprio(prio) {
        this[prio] = (function (_this) {
            return function (msg) {
                return _this.msg(prio, msg);
            };
        })(this);
    }
    getNetwork() {
        if (config_1.default.BISQ_BLOCKS.ENABLED) {
            return 'bisq';
        }
        if (config_1.default.MEMPOOL.NETWORK && config_1.default.MEMPOOL.NETWORK !== 'mainnet') {
            return config_1.default.MEMPOOL.NETWORK;
        }
        return '';
    }
    msg(priority, msg) {
        let consolemsg, prionum, syslogmsg;
        if (typeof msg === 'string' && msg.length > 0) {
            while (msg[msg.length - 1].charCodeAt(0) === 10) {
                msg = msg.slice(0, msg.length - 1);
            }
        }
        const network = this.network ? ' <' + this.network + '>' : '';
        prionum = Logger.priorities[priority] || Logger.priorities.info;
        syslogmsg = `<${(this.fac * 8 + prionum)}> ${this.name}[${process.pid}]: ${priority.toUpperCase()}${network} ${msg}`;
        consolemsg = `${this.ts()} [${process.pid}] ${priority.toUpperCase()}:${network} ${msg}`;
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
    syslog(msg) {
        let msgbuf;
        msgbuf = Buffer.from(msg);
        this.client.send(msgbuf, 0, msgbuf.length, this.logport, this.loghost, function (err, bytes) {
            if (err) {
                console.log(err);
            }
        });
    }
    leadZero(n) {
        if (n < 10) {
            return '0' + n;
        }
        return n;
    }
    ts() {
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
Logger.priorities = {
    emerg: 0,
    alert: 1,
    crit: 2,
    err: 3,
    warn: 4,
    notice: 5,
    info: 6,
    debug: 7
};
Logger.facilities = {
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
exports.default = new Logger(Logger.facilities.local7);
