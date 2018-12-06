var express       = require('express');
var app           = express();
var http          = require('http').Server(app);
var io            = require('socket.io')(http);
var twitter       = require('twitter');
var _             = require('lodash');
var mongodb       = require('mongodb');
var MongoClient   = mongodb.MongoClient;
var MongoCursor   = mongodb.Cursor;
var config        = require('./config.json');
var state         = {
  trackedTerms: []
};

app.use(express.static('assets'));

app.get('/', (req, res) => {
	res.sendFile(__dirname + '/index.html');
});

// connect to the DB
console.log(`Attempting connection to ${config.db.host}`);
MongoClient.connect(config.db.host, { useNewUrlParser: true }, (err, client) => {
  if (err) {
    console.error('Unable to connect to database: ', JSON.stringify(err));
    process.exit(1);
  }

  const db = client.db(config.db.db);
  const collection = db.collection(config.db.collection);

  collection.isCapped(function (err, capped) {
    if (err) {
      console.error(`Error detecting if ${config.db.collection} is a capped collection. Aborting.`);
      process.exit(1);
    }
    if (!capped) {
      console.error(`${config.db.collection} is not a capped collection. Aborting.`);
      process.exit(2);
    }
    console.log('Successfully connected to database.');

    initSocket(collection);
  });
});

var initSocket = (collection) => {
	io.on('connection', (socket) => {
		//console.log('a user connected to the socket');
		socket.retweetThreshold = 0;
		feedClient(socket, collection);
	});
};

var feedClient = (socket, collection) => {
  var rtstream = false;
  socket
    .on('filter', (data, callback) => {
      handleFilter(socket, collection, data.query, (err, stream) => {
        if (err) {
        	console.log(err);
        } else {
        	rtstream = stream;
        }
        callback(err);
      });
    })
    .on('set threshold', function (threshold) {
      socket.retweetThreshold = threshold;
      //console.log(`updated threshold for client to ${threshold}`)
    })
    .on('disconnect', function () {
      if (rtstream !== false) {
        //console.log('Client disconnected. Stopping stream...');
        rtstream.destroy();
      } else {
      	//console.log('client disconnected, no stream to stop');
      }
    });
}

var handleFilter = (socket, collection, filterQuery, callback) => {
  if (!callback || typeof callback !== "function") {
    throw new Error('callback is required');
  }

  //console.log('Received search request from client: ' + filterQuery);

  var retweets    = collection,
      queryRegExp = new RegExp(filterQuery, 'i'),
      rtQuery     = {"query": queryRegExp},
      rtOpts      = {
        sort: [['$natural', -1]],
        limit: 1,
        tailable: true,
        awaitdata: true
      };

  // start tracking and emitting the top retweets for the connected client and requested filter
  tailCollection(retweets, rtQuery, (tweet) => {
    if (tweet !== null && tweet.tweet_id) {
      socket.emit('data', tweet);
    }
  });

  // start listening to the live Twitter stream and populating the DB
  var twit = new twitter(config.twitter);
  twit.stream('statuses/filter', {"track": filterQuery, "language": 'en'}, (stream) => {
  	let isTweet = false;
    stream
      .on('data', (tweet) => {
        // only consider a status if
        // 1. it's actually a retweet
        // 2. it's been retweeted more than the current threshold set for the client
				isTweet = _.conforms({
				  contributors: _.isObject,
				  id_str: _.isString,
				  text: _.isString,
				});

        if (isTweet && tweet.retweeted_status) {
					if (tweet.retweeted_status.retweet_count > socket.retweetThreshold) {
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
	            retweets.insertOne(newTweet, (err, result) => {
	              if (err) {
	                console.error(err);
	              }
	            });
	          } else {
	            //console.log('This tweet is too old!');
	          }
	        } else {
	          //console.log('This tweet does not meet the threshold of ' + socket.retweetThreshold + '!');
	        }
        }
      })
      .on('error', (e) => {
      	console.log('error from twitter streaming API', e);
        console.log(e.source);
        //stream.destroy();
      })
      .on('end', (res) => {
      	//console.log('twitter streaming API stream ended');
        stream.destroy();
      })
      .on('destroy', (res) => {
        // a 'silent' disconnection from Twitter, no end/error event fired
      	//console.log('twitter streaming API stream destroyed');
      });

    callback(null, stream);
  });
}

var tailCollection = (collection, filter, next) => {
  if ('function' !== typeof next) throw('Callback function not defined');

  var cursorOptions = {
    tailable: true,
    awaitdata: true,
    numberOfRetries: -1
  };

  var stream = collection.find(filter, cursorOptions).stream();

  stream.on('data', next);
}

http.listen(config.port, () => {
	console.log(`HTTP Server started on *:${config.port}`);
});