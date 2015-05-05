let net = require('net')
let fs = require('fs')
let mkdirp = require('mkdirp')
let path = require('path')
let argv = require('yargs')
    .default('dir', process.cwd())
    .argv

const ROOT_DIR = path.resolve(argv.dir)


var client = net.connect({port: 8001},
    function() { //'connect' listener
        console.log('connected to server!')

    });
client.on('data', function(data) {
    let dataJson =  JSON.parse(data)
    console.log('Received'  +  dataJson.path)
    let action = dataJson.action
    let type = dataJson.type
    console.log(dataJson)
    console.log(dataJson.contents)
    if (action == 'create' || action == 'change') {
        if (type == 'file' ) {
            console.log("I am here")
            fs.writeFileSync(path.join(ROOT_DIR, dataJson.path), dataJson.contents)
        } else {
            mkdirp(path.join(ROOT_DIR, dataJson.path))
        }
    }
});
client.on('end', function() {
    console.log('disconnected from server')
});