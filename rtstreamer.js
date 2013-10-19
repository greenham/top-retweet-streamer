var util        = require('util'),
    events      = require('events'),
    twitter     = require('ntwitter'),
    MongoClient = require('mongodb').MongoClient;

function RTStreamer() {
  if (false === (this instanceof RTStreamer)) {
    return new RTStreamer();
  }

  this.interval_id = null;
  this.limit = 10;

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

    // @todo move these keys to a settings file
    var twit = new twitter({
      consumer_key: 'gUdGG5cbw2VYfKipEkFpQg',
      consumer_secret: 'fnKnMO7ddRUrUrCRGh0aeMR6vqtLuM4gqoOY63ApQ70',
      access_token_key: '1963789585-njzp3nBKbD75doKnBlEv3F1sfAfTylI8VAVOjG6',
      access_token_secret: 'rBYSdSNlfXZz5X7vWCtqtJlO1iCREJ3PwDpCa1GYw'
    });

    var retweets = db.collection('retweets'),
        queryRegExp = new RegExp(filterQuery, 'i'),
        rtQuery  = {query: queryRegExp};
        rtFields = {},
        rtOpts   = {limit: self.limit, sort: [["retweet_count", "desc"]]};

    var getTopTweets = function() {
      retweets.find(rtQuery, rtFields, rtOpts, function(err, result) {
        if ( ! err && result) {
          result.toArray(function(err, resultArr) {
            if ( ! err && resultArr.length > 0) {
              self.emit('data', resultArr);
            } else {
              self.emit('nodata');
            }
          });
        }
      });
    };

    // emit the previous standings as the first packet if this filter has already been requested
    getTopTweets();

    twit.stream('statuses/filter', {'track':filterQuery}, function(stream) {
      stream
        .on('data', function (tweet) {
          if (tweet.retweeted_status && tweet.retweeted_status.retweet_count > 0) {
            //console.dir(tweet);
            var newTweet = {
              query: filterQuery,
              tweet_id: tweet.retweeted_status.id_str,
              screen_name: tweet.retweeted_status.user.screen_name,
              profile_image_url: tweet.retweeted_status.user.profile_image_url,
              retweet_count: tweet.retweeted_status.retweet_count,
              text: tweet.retweeted_status.text,
              created_at: tweet.retweeted_status.created_at
            };
            retweets.update({tweet_id: tweet.retweeted_status.id_str}, newTweet, {upsert: true}, function(err, result) {});
          }
        })
        .on('error', function(e) {
          self.emit('error', e).stopStream();
        });

      // poll for new tweets every 10 seconds...
      self.interval_id = setInterval(getTopTweets, pollInterval);
    });
  });
};

RTStreamer.prototype.stopStream = function(callbackFn) {
  var self = this;

  if (self.interval_id) {
    clearInterval(self.interval_id);
  }

  if (callbackFn && typeof callbackFn === "function") {
    callbackFn();
  }
};

module.exports = RTStreamer;