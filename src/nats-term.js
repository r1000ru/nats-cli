const Terminal = require('./libs/terminal');

let term = new Terminal();
term.start(process.argv.slice(2));