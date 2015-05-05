let net = require('net')
let fs = require('fs')
let argv = require('yargs')
    .default('dir', process.cwd())
    .argv

let mkdirp = require('mkdirp')
let path = require('path')

var client = net.connect({port: 8001},
    function() { //'connect' listener
        console.log('connected to server!')

    });
client.on('data', function(data) {
    let syncDir = '/Users/ashar61/work/dropboxSync'
    let dataJson =  JSON.parse(data)
    let action = dataJson.action
    let type = dataJson.type
    if (action == 'create' || action == 'update') {
        if (type == 'file' ) {
            fs.writeFileSync(path.join(syncDir, dataJson.path), dataJson.data)
        } else {
            mkdirp(path.join(syncDir, dataJson.path))
        }
    }
});
client.on('end', function() {
    console.log('disconnected from server')
});