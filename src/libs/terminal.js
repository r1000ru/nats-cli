const colors = require('colors');
    NATS = require('nats'),
    readline = require('readline');

var Terminal = function(options) {
    this._nats;
        
    this._channels = {}

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
        this._exit();
    });

}

Terminal.prototype._onCommand = function(line) {
    if (!line) {
        this._waitCommand();
        return;
    }

    let lineArray = line.split(' ');
    switch (lineArray[0].toUpperCase()) {
        case 'PUB':
            this._publish(lineArray[1], lineArray.slice(2).join(' '));
            break;
        case 'SUB':
            this._subscribe(lineArray[1]);
            break;
        case 'UNSUB':
            this._unsubscribe(lineArray[1]);
            break;
        case 'LIST':
            this._list();
            break;
        case 'HELP':
            this._help();
            break;
        case 'REQ':
            this._req(lineArray[1], lineArray.slice(2).join(' '));
            break;
        case 'EXIT':
            this._exit();
            break;
        default:
            console.log('ERROR COMMAND: '.grey + lineArray[0].red);
            console.log('USE COMMAND '.grey + 'HELP'.green);
            this._waitCommand();
    }
}

Terminal.prototype._help = function() {
    console.log('LIST'.green +  ' List subscribed channels');
    console.log('SUB'.green + ' channel'.grey + ' Subscribe to channel and listen incoming messages'.white);
    console.log('UNSUB'.green + ' channel'.grey + ' Unsubscribe from channel'.white);
    
    console.log('PUB'.green + ' channel message'.grey + ' Publish message to channel'.white);
    console.log('REQ'.green + ' channel message'.grey + ' Send request with message to channel and wait one response'.white);
    console.log('EXIT'.green + ' Close connection and exit'.white);
    console.log('HELP'.green + ' This man'.white);
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
        console.log('Need channel name'.red);
        this._waitCommand();
        return;
    }

    if (this._channels[channel]) {
        console.log('Already subscibed'.red);
        this._waitCommand();
        return;
    }


    console.log('Subscribed to "'.gray + channel.white + '" channel.'.gray);

    this._channels[channel] = this._nats.subscribe(channel, (message, replyTo)=>{
        if (!replyTo) {
            console.log('');
            console.log('Message from channel "'.grey + channel.white + '": '.gray + message.blue);
            this._waitCommand();
            return;
        }
        console.log('Message: ' + message);
        console.log('Request from channel "'.grey + channel.white + '": '.gray + message.blue);
        this._rl.question('Enter answer: ', (answer)=>{
            this._nats.publish(replyTo, answer);
            console.log('Answer was published in temporary channel "'.grey + replyTo.white + '": '.gray);
            this._rl.pause();
        });
    });

   this._waitCommand();
}

Terminal.prototype._list = function() {
    if (Object.keys(this._channels).length === 0) {
        console.log('There are no subscriptions'.grey);
        this._waitCommand();
        return;
    }
    console.log('Subscriptions:'.grey);
    for (let c in this._channels) {
        console.log(c.white);
    }

    this._waitCommand();
}

Terminal.prototype._unsubscribe = function(channel) {
    if (!channel) {
        console.log('Need channel name'.red);
        this._waitCommand();
        return;
    }

    if (this._channels[channel] === undefined) {
        console.log('Not subscribed'.red);
        this._waitCommand();
        return;
    }

    console.log('Fully unsubscribed from "'.gray + channel.white +'".'.gray);
    this._nats.unsubscribe(this._channels[channel]);
    delete(this._channels[channel]);
    this._waitCommand();
}

Terminal.prototype._req = function(channel, message) {
    if (!channel) {
        console.log('Need channel name'.red);
        this._waitCommand();
        return;
    }
    console.log('Request sended to channel "'.gray + channel.white + '".'.gray);
    console.log('Waiting response...'.gray);

    this._nats.request(channel, message, {max: 1}, (response)=>{
        console.log('Response received from "'.gray + channel.white + '": '.gray + response.green);
        this._waitCommand();
    })

    this._waitCommand();
}

Terminal.prototype._exit = function() {
    this._nats.close();
    this._rl.close();
    process.exit(1);    
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
    
    console.log(`Connecting to ${options.url}`.gray);
    
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