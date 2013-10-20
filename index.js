var fs = require('fs'),
    mime = require('mime'),
    url = require('url'),
    app = require('http').createServer(handler),
    io = require('socket.io').listen(app),
    RTStreamer = require('./rtstreamer');

function handler(req, res) {
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
    .on('filter', function (data, fn) {
      console.log('Received search request from client: ' + data.query);

      streamer
        .on('data', function(tweets) {
          console.log('Received '+tweets.length+' tweets for \''+data.query+'\'. Sending to client...');
          socket.emit('data', tweets);
        })
        .on('nodata', function() {
          console.log('No retweets for \''+data.query+'\' found yet...');
          socket.emit('nodata');
        })
        .on('error', function(err) {
          console.error('Streamer error: ' + err);
          socket.emit('error', err);
          socket.disconnect();
        });

      streamer.stream(data.query, 5000, function() {
        console.log('Listening to stream for \''+data.query+'\'...');
      });

      if (fn && typeof fn === "function") {
        fn();
      }
    })
    .on('disconnect', function() {
      // only stop the stream if it's been started!
      // client can disconnect without having active stream
      if (true === streamer.isStreaming()) {
        console.log('Client disconnected... Stopping stream...');
        streamer.stopStream(function() {
          console.log('Stream stopped.');
        });
      }
    });
});

app.listen(3000);
console.log('Listening on port 3000...');