var fs  = require('fs'),
    url = require('url'),
    app = require('http').createServer(handler),
    io  = require('socket.io').listen(app),
    RTStreamer = require('./rtstreamer');

function handler (req, res) {
  var path = url.parse(req.url).path;
  if ( ! path || path == '/') {
    path = '/index.html';
  }
  // @todo read mime type of file and write Content-Type header appropriately
  fs.readFile(__dirname + path,
  function (err, data) {
    if (err) {
      res.writeHead(500);
      return res.end('Error loading ' + path);
    }

    res.writeHead(200);
    res.end(data);
  });
}

io.sockets.on('connection', function (socket) {
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