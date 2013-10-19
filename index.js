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

io.set('log level', 2);

io.sockets.on('connection', function (socket) {
  var streamer = new RTStreamer();

  socket
    .on('filter', function (data, callbackFn) {
      console.log('Received filter request from client: ' + data.query);

      streamer
        .on('data', function(tweets) {
          console.log('Sending '+tweets.length+' tweets to client...');
          socket.emit('data', tweets);
        })
        .on('error', function(err) {
          console.error('Streamer error: ' + err);
          socket.emit('error', err).disconnect();
        });

      streamer.stream(data.query, 10000);

      if (callbackFn && typeof callbackFn === "function") {
        callbackFn();
      }
    })
    .on('disconnect', function() {
      console.log('Client disconnected... stopping stream...');
      streamer.stopStream(function() {
        console.log('Stream stopped.');
      });
    });
});

app.listen(3000);
console.log('Listening on port 3000...');