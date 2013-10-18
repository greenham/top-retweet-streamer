var twitter     = require('ntwitter'),
    MongoClient = require('mongodb').MongoClient,
    util        = require('util'),
    events      = require('events');

function RTStreamer() {
  if (false === (this instanceof RTStreamer)) {
    return new RTStreamer();
  }

  events.EventEmitter.call(this);
}
util.inherits(RTStreamer, events.EventEmitter);

RTStreamer.prototype.stream = function(filterQuery, pollInterval) {
  var self = this;

  // connect to the DB
  MongoClient.connect("mongodb://localhost:27017/retweets", function(err, db) {
    if (err) {
      console.error('Could not connect to database: ' + err);
      process.exit();
    }

    var twit = new twitter({
      consumer_key: 'gUdGG5cbw2VYfKipEkFpQg',
      consumer_secret: 'fnKnMO7ddRUrUrCRGh0aeMR6vqtLuM4gqoOY63ApQ70',
      access_token_key: '1963789585-njzp3nBKbD75doKnBlEv3F1sfAfTylI8VAVOjG6',
      access_token_secret: 'rBYSdSNlfXZz5X7vWCtqtJlO1iCREJ3PwDpCa1GYw'
    });

    var retweets = db.collection('retweets'),
        rtQuery  = {query: filterQuery};
        rtFields = {screen_name: true, retweet_count: true, text: true},
        rtOpts   = {limit: 10, sort: [["retweet_count", "desc"]]};

    var displayTweets = function(tweets) {
      var rank = 1;
      tweets.each(function(err, tweet) {
        if ( ! err && tweet !== null) {
          console.log(rank+'.\t['+tweet.retweet_count+' RTs]\t@'+tweet.screen_name+': '+tweet.text.replace(/(\r\n|\r|\n)/gm,''));
          rank++;
        }
      });
    };

    //console.log('\033[2JTracking Top 10 Retweets for: ' + filterQuery);

    // For a filter that has already has been requested before, return the previous top 10 standings as the first packet.
    retweets.find(rtQuery, rtFields, rtOpts, function(err, result) {
      if (result) {
        //displayTweets(result);
        result.toArray(function(err, resultArr) {
          self.emit('data', resultArr);
        });
      }
    });

    twit.stream('statuses/filter', {'track':filterQuery}, function(stream) {
      stream
        .on('data', function (tweet) {
          if (tweet.retweeted_status && tweet.retweeted_status.retweet_count > 0) {
            var newTweet = {
              query: filterQuery,
              tweet_id: tweet.retweeted_status.id,
              screen_name: tweet.retweeted_status.user.screen_name,
              retweet_count: tweet.retweeted_status.retweet_count,
              text: tweet.retweeted_status.text
            };
            retweets.update({tweet_id: tweet.retweeted_status.id}, newTweet, {upsert: true}, function(err, result) {});
          }
        })
        .on('error', function(e) {
          console.log('Twitter stream error: ' + e);
          process.exit();
        });

      // poll for new top 10 every 10 seconds...
      setInterval(function() {
        retweets.find(rtQuery, rtFields, rtOpts, function(err, result) {
          if (result) {
            //console.log('\033[2JTracking Top 10 Retweets for: ' + filterQuery);
            //displayTweets(result);
            result.toArray(function(err, resultArr) {
              self.emit('data', resultArr);
            });
          }
        });
      }, pollInterval);
    });
  });
};

module.exports = RTStreamer;