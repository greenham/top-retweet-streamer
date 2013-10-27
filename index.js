var fs           = require('fs'),
    mime         = require('mime'),
    url          = require('url'),
    app          = require('http').createServer(handler),
    io           = require('socket.io').listen(app),
    MongoClient  = require('mongodb').MongoClient,
    MongoCursor  = require('mongodb').Cursor,
    twitter      = require('ntwitter'),
    config       = require('./config');

// the HTTP handler
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

// connect to the DB
MongoClient.connect(config.db.host, function (err, db) {
  console.log('Attempting connection to "' + config.db.host + '"');
  if (err) {
    console.error('Unable to connect to database: ' + err);
    process.exit(1);
  }

  db.collection(config.db.collection, function (err, collection) {
    collection.isCapped(function (err, capped) {
      if (err) {
        console.error('Error detecting if "'+config.db.collection+'" is a capped collection. Aborting.');
        process.exit(1);
      }
      if (!capped) {
        console.error('"'+config.db.collection+'" is not a capped collection. Aborting.');
        process.exit(2);
      }
      console.log('Successfully connected to database.');

      startIOServer(collection);
    });
  });
});


function startIOServer(collection) {
  // configure the socket
  io.configure(function () {
    io.set("transports", config.socket.transports); // set in config.js
    io.set('log level', 2);                         // 0 -> error, 1 -> warn, 2 -> info, 3 -> debug
    io.set("polling duration", 10);
  });

  // handle socket connections
  io.sockets.on('connection', function (socket) {
    socket.set('threshold', 0, function () {
      feedClient(socket, collection);
    });
  });

  console.log("Socket server started...");
}

function feedClient(socket, collection) {
  var rtstream = false;
  socket
    .on('filter', function (data, callback) {
      handleFilter(socket, collection, data.query, function(err, stream) {
        rtstream = stream;
        callback(err);
      });
    })
    .on('set threshold', function (threshold) {
      socket.set('threshold', threshold);
    })
    .on('disconnect', function () {
      if (rtstream !== false) {
        console.log('Client disconnected. Stopping stream...');
        rtstream.destroy();
      }
    });
}

function handleFilter(socket, collection, filterQuery, callback) {
  if (!callback || typeof callback !== "function") {
    throw new Error('callback is required');
  }

  console.log('Received search request from client: ' + filterQuery);

  var retweets    = collection,
      queryRegExp = new RegExp(filterQuery, 'i'),
      rtQuery     = {query: queryRegExp},
      rtFields    = {},
      rtOpts      = {
        sort: [['$natural', 1]],
        limit: 10,
        tailable: true,
        tailableRetryInterval: 1000,
        numberOfRetries: 1000
      };

  // start tracking and emitting the top retweets for the connected client and requested filter
  retweets.find(rtQuery, rtFields, rtOpts, function (err, tweets) {
    if (!err) {
      tweets.intervalEach(300, function (err, tweet) {
        if (tweet !== null && tweet.tweet_id) {
          console.log('Received tweet for \''+filterQuery+'\'. Sending to client...');
          socket.emit('data', tweet);
        }
      });
    } else {
      console.error('Error tracking top retweets: ' + err);
    }
  });

  // start listening to the live Twitter stream and populating the DB
  var twit = new twitter(config.twitter);
  twit.stream('statuses/filter', {'track':filterQuery}, function(stream) {
    stream
      .on('data', function (tweet) {
        // only consider a status if it's been retweeted more than the current threshold set for the client
        socket.get('threshold', function (err, threshold) {
          if (tweet.retweeted_status && tweet.retweeted_status.retweet_count > threshold) {
            // and was originally tweeted within the configured timeframe
            var ts = Math.round(new Date().getTime() / 1000);
            var tsYesterday = ts - (config.tweets.recent_time_limit_hours * 3600);
            var tweetDate = new Date(tweet.retweeted_status.created_at);
            var tsTweet = Math.round(tweetDate.getTime() / 1000);

            if (tsTweet >= tsYesterday) {
              var newTweet = {
                query:             filterQuery,
                tweet_id:          tweet.retweeted_status.id_str,
                screen_name:       tweet.retweeted_status.user.screen_name,
                profile_image_url: tweet.retweeted_status.user.profile_image_url,
                retweet_count:     tweet.retweeted_status.retweet_count,
                text:              tweet.retweeted_status.text,
                created_at:        tweetDate
              };
              // add to collection
              retweets.insert(newTweet, function(err, result) {
                if (err) {
                  console.error(err);
                }
                //console.log('Tweet added');
              });
            } else {
              //console.log('This tweet is too old!');
            }
          } else {
            //console.log('This tweet does not meet the threshold of ' + threshold + '!');
          }
        });
      })
      .on('error', function(e) {
        stream.destroy();
      })
      .on('end', function (response) {
        stream.destroy();
      })
      .on('destroy', function (response) {
        // a 'silent' disconnection from Twitter, no end/error event fired
      });

    callback(null, stream);
  });
}

app.listen(3000);
console.log('Listening on port 3000...');

// takes an interval, waits that many ms before it makes the next object request
MongoCursor.prototype.intervalEach = function(interval, callback) {
  var self = this;
  if (!callback) {
    throw new Error("callback is mandatory");
  }

  if(this.state !== MongoCursor.CLOSED) {
    setTimeout(function(){
      // fetch the next object until there are no more
      self.nextObject(function(err, item) {
        if(err !== null) return callback(err, null);

        if(item !== null) {
          callback(null, item);
          self.intervalEach(interval, callback);
        } else {
          // Close the cursor if done
          self.state = MongoCursor.CLOSED;
          callback(err, null);
        }

        item = null;
      });
    }, interval);
  } else {
      callback(new Error("Cursor is closed"), null);
  }
};