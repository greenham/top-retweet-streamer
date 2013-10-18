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
      self.emit('error', err);
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

    var getTopTweets = function() {
      retweets.find(rtQuery, rtFields, rtOpts, function(err, result) {
        if ( ! err && result) {
          result.toArray(function(err, resultArr) {
            if ( ! err && resultArr) {
              self.emit('data', resultArr);
            }
          });
        }
      });
    };

    // For a filter that has already has been requested before, return the previous top 10 standings as the first packet.
    getTopTweets();

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
          self.emit('error', e);
        });

      // poll for new top 10 every 10 seconds...
      setInterval(getTopTweets, pollInterval);
    });
  });
};

module.exports = RTStreamer;