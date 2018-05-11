const colors = require('colors');
    NATS = require('nats'),
    readline = require('readline');

var Terminal = function(options) {
    this._nats;
    
    this._currentCallback;

    this._rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    this._subId;

    this._rl.setPrompt('>');

    this._rl.on('line', (line)=>{
        this._onCommand(line.trim());
    })

    this._rl.on('SIGINT', ()=>{
        if (this._currentCallback) {
            this._currentCallback();
            this._currentCallback = undefined;
            return;
        }

        this._rl.close();
    });

}

Terminal.prototype._onCommand = function(line) {
    if (!line) {
        this._waitCommand();
        return;
    }

    let lineArray = line.split(' ');
    switch (lineArray[0]) {
        case 'PUB':
            this._publish(lineArray[1], lineArray.slice(2).join(' '));
            break;
        case 'SUB':
            this._subscribe(lineArray[1]);
            break;
        case 'HELP':
            this._help();
            break;
        default:
            console.log('ERROR COMMAND: '.grey + lineArray[0].red);
            console.log('USE COMMAND '.grey + 'HELP'.green);
            this._waitCommand();
    }
}

Terminal.prototype._help = function() {
    console.log('SUB'.green + ' channel_name'.grey);
    console.log('PUB'.green + ' channel_name any_data'.grey);
    this._waitCommand();
}

Terminal.prototype._publish = function(channel, data) {
    if (!channel) {
        console.log('NEED CHANNEL'.red);
        this._waitCommand();
        return;
    }
    if (!data) {
        console.log('NEED DATA'.red);
        this._waitCommand();
        return;
    }
    this._nats.publish(channel, data);
    console.log('Published'.gray);
    this._waitCommand();
}

Terminal.prototype._subscribe = function(channel) {
    if (!channel) {
        console.log('NEED CHANNEL'.red);
        this._waitCommand();
        return;
    }

    console.log(('SUBSCRIBED TO ' + channel).yellow);

    this._subId = this._nats.subscribe(channel, (message)=>{
        console.log(('MESSAGE FROM ' + channel + ': ' + message).grey);
    });

    this._currentCallback = function() {
        this._nats.unsubscribe(this._subId);
        console.log(('UNSUBSCRIBE FROM ' + channel).yellow);
        this._subId = undefined;
        this._currentCallback = undefined;
        this._waitCommand();
    }

    
}

Terminal.prototype._waitCommand = function() {
    this._rl.prompt();
}

Terminal.prototype.start = function(args) {
    let options = {
        url: 'nats://'
    };
    
    let hostIndex = args.indexOf('-h');
    options.url += hostIndex>-1 && args[hostIndex+1] ? args[hostIndex+1] : '127.0.0.1';

    let portIndex = args.indexOf('-p');
    options.url += ':' + (portIndex>-1 && args[portIndex+1] ? args[portIndex+1] : 4222);
    
    console.log(`Connecting to ${options.url}`.green);
    
    this._nats = NATS.connect(options);
    
    this._nats.on('connect', (nc)=>{
        console.log(`Connected to server ID: ${nc.info.server_id}`.green);
        console.log(`Max payload: ${nc.info.max_payload}`.green);
        this._waitCommand();
    });

    this._nats.on('disconnect', ()=>{
        console.log('Disconnected'.red);
    });

    this._nats.on('error', (err)=>{
        console.log(('Error' + err.message).red);
        this._rl.close();
    });

}
module.exports = Terminal;