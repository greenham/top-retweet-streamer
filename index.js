var fs = require('fs'),
    mime = require('mime'),
    url = require('url'),
    app = require('http').createServer(handler),
    io = require('socket.io').listen(app),
    RTStreamer = require('./rtstreamer');

function handler (req, res) {
  var path = url.parse(req.url).path;
  if ( ! path || path == '/') {
    path = '/index.html';
  }
  fs.readFile(__dirname + path, function (err, data) {
    if (err) {
      res.writeHead(500, {'Content-Type': 'text/plain'});
      return res.end('Error loading: ' + path);
    }

    res.writeHead(200, {'Content-Type': mime.lookup(path)});
    res.end(data);
  });
}

io.sockets.on('connection', function (socket) {
  // @todo handle disconnects/reconnects
  socket.on('filter', function (data, callbackFn) {
    console.log('Received filter request from client: ' + data.query);
    var streamer = new RTStreamer();
    streamer
      .on('data', function(tweets) {
        socket.emit('data', tweets);
      })
      .on('error', function(err) {
        socket.emit('error', err);
      });
    streamer.stream(data.query, 10000);
    callbackFn();
  });
});

app.listen(3000);
console.log('Listening on port 3000...');