var fs  = require('fs'),
    app = require('http').createServer(handler),
    io  = require('socket.io').listen(app),
    RTStreamer = require('./rtstreamer');

function handler (req, res) {
  fs.readFile(__dirname + '/index.html',
  function (err, data) {
    if (err) {
      res.writeHead(500);
      return res.end('Error loading index.html');
    }

    res.writeHead(200);
    res.end(data);
  });
}

io.sockets.on('connection', function (socket) {
  socket.on('filter', function (data) {
    console.log('Received filter request from client: ' + data.query);
    var streamer = new RTStreamer();
    streamer.on('data', function(tweets) {
      socket.emit('data', tweets);
    });
    streamer.stream(data.query, 5000);
  });
});

app.listen(3000);
console.log('Listening on port 3000...');