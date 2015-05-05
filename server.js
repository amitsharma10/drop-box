let path = require('path')
let fs = require('fs')
let express = require('express')
let morgan = require('morgan')
let nodeify = require('bluebird-nodeify')
let mime = require('mime-types')
let rimraf = require('rimraf')
let mkdirp = require('mkdirp')
let chokidar = require('chokidar')
let net = require ('net')

let argv = require('yargs')
    .default('dir', process.cwd())
    .argv

require('songbird')

const NODE_ENV = process.env.NODE_ENV
const PORT = process.env.PORT || 8000
const ROOT_DIR = path.resolve(argv.dir)

let app = express()

if (NODE_ENV === 'development') {
    app.use(morgan('dev'))
}

app.listen(PORT, ()=> console.log(`Http Server started on port - ${PORT}`))


app.get('*', setFileMeta, sendHeaders, (req, res) => {
    if (res.body) {
        res.json(res.body)
        return
    }

    fs.createReadStream(req.filePath).pipe(res)
})

app.head('*', setFileMeta, sendHeaders, (req, res) => res.end())

app.delete('*', setFileMeta, (req, res, next) => {
    async ()=>{
        if (!req.stat) return res.send(400, 'Invalid Path')

        if (req.stat.isDirectory()) {
            await rimraf.promise(req.filePath)
        } else await fs.promise.unlink(req.filePath)
        res.end()
    }().catch(next)
})

app.put('*', setFileMeta, setDirDetails, (req, res, next) => {
    async ()=>{
        if (req.stat) return res.send(405, 'File exists')
        await mkdirp.promise(req.dirPath)

        if (!req.isDir) req.pipe(fs.createWriteStream(req.filePath))
        res.end()
    }().catch(next)
})

app.post('*', setFileMeta, setDirDetails, (req, res, next) => {
    async ()=>{
        if (!req.stat) return res.send(405, 'File does not exist')
        if (req.isDir || req.stat.isDirectory()) return res.send(405, 'Path is a directory')

        await fs.promise.truncate(req.filePath, 0)
        req.pipe(fs.createWriteStream(req.filePath))
        res.end()
    }().catch(next)
})


function setDirDetails(req, res, next) {
    let filePath = req.filePath
    let endsWithSlash = filePath.charAt(filePath.length-1) === path.sep
    let hasExt = path.extname(filePath) !== ''
    req.isDir = endsWithSlash || !hasExt
    req.dirPath = req.isDir ? filePath : path.dirname(filePath)
    next()
}

function setFileMeta(req, res, next) {
    req.filePath = path.resolve(path.join(ROOT_DIR, req.url))
    if (req.filePath.indexOf(ROOT_DIR) !== 0) {
        res.send(400, 'Invalid path')
        return
    }
    fs.promise.stat(req.filePath)
        .then(stat => req.stat = stat, ()=> req.stat = null)
        .nodeify(next)
}

function sendHeaders(req, res, next) {
    nodeify(async ()=> {
        if (req.stat.isDirectory()) {
            let files = await fs.promise.readdir(req.filePath)
            res.body = JSON.stringify(files)
            res.setHeader('Content-Length', res.body.length)
            res.setHeader('Content-Type', 'application/json')
            return
        }

        res.setHeader('Content-Length', req.stat.size)
        res.setHeader('Content-Type', mime.contentType(path.extname(req.filePath)))
    }(), next)
}


//-- TCP
var server = net.createServer(function(c) { //'connection' listener
    console.log('client connected')
    c.on('end', function() {
        console.log('client disconnected');
    })
    listenToFS(c)
});

async function listenToFS (c){

    chokidar.watch(ROOT_DIR, {ignored: /[\/\\]\./})
        .on('all', (event, path) => {
            let response = JSON.parse('{}')
            let action = ''
            console.log (event)
            if (event === 'add' || event === 'addDir' ){
                action = 'create'
            } else if (event == 'unlink'){
                action = 'delete'
            } else if (event == 'change') {
                action = 'change'
            }

            let stat =  fs.statSync(path)
            let type = stat.isDirectory() ?'dir':'file'
            var fileContents = stat.isDirectory() ? null : new Buffer(fs.readFileSync(path)).toString()
            var lastUpdated = stat.mtime
            response.action = action;
            response.path = path.substring(ROOT_DIR.length);
            response.type = type
            response.contents = fileContents
            response.updated = lastUpdated
            console.log(response)
            c.write(JSON.stringify(response))
            c.pipe(c)
        })
}

server.listen(8001, function() { //'listening' listener
    console.log('TCP Server started on port -  8001')
    console.log(`TCP Server is watching : ${ROOT_DIR}` )
});