var util        = require('util'),
    events      = require('events'),
    twitter     = require('ntwitter'),
    MongoClient = require('mongodb').MongoClient;

function RTStreamer() {
  if (false === (this instanceof RTStreamer)) {
    return new RTStreamer();
  }

  this.interval_id = false;
  this.limit       = 10;
  this.streaming   = false;

  events.EventEmitter.call(this);
}
util.inherits(RTStreamer, events.EventEmitter);

/**
 * Listens to stream of filtered twitter statuses, logs data to mongo collection, and emits top tweets.
 * @param  {String} filterQuery  the search string to use
 * @param  {Number} pollInterval how often (in ms) to emit new results
 */
RTStreamer.prototype.stream = function(filterQuery, pollInterval, fn) {
  var self = this;

  // connect to the DB
  MongoClient.connect("mongodb://localhost:27017/retweets", function(err, db) {
    if (err) {
      self.emit('error', err);
    }

    // @note this is a developer account limited to a single connection
    var twit = new twitter({
      consumer_key: 'gUdGG5cbw2VYfKipEkFpQg',
      consumer_secret: 'fnKnMO7ddRUrUrCRGh0aeMR6vqtLuM4gqoOY63ApQ70',
      access_token_key: '1963789585-njzp3nBKbD75doKnBlEv3F1sfAfTylI8VAVOjG6',
      access_token_secret: 'rBYSdSNlfXZz5X7vWCtqtJlO1iCREJ3PwDpCa1GYw'
    });

    // set up the query for the top retweets
    var retweets    = db.collection('retweets'),
        queryRegExp = new RegExp(filterQuery, 'i'),
        rtQuery     = {query: queryRegExp};
        rtFields    = {},
        rtOpts      = {limit: self.limit, sort: [["retweet_count", "desc"]]},
        lastResult  = false;

    // get the top tweets and emit data (or nodata) to listeners
    var getTopTweets = function() {
      retweets.find(rtQuery, rtFields, rtOpts, function(err, result) {
        if ( ! err && result) {
          result.toArray(function(err, resultArr) {
            if ( ! err && resultArr.length > 0) {
              // only emit data if it has changed
              var changed = false;

              if (lastResult && lastResult.length === resultArr.length) {
                for (var i = 0; i < resultArr.length; i++) {
                  if (resultArr[i].tweet_id !== lastResult[i].tweet_id || resultArr[i].retweet_count !== lastResult[i].retweet_count) {
                    changed = true;
                    break;
                  }
                }
              } else {
                changed = true;
              }

              if (changed) {
                lastResult = resultArr;
                self.emit('data', resultArr);
              }
            } else {
              self.emit('nodata');
            }
          });
        }
      });
    };

    // emit the previous standings as the first packet if this filter has already been requested
    getTopTweets();

    // listen to the stream and populate the mongo collection
    twit.stream('statuses/filter', {'track':filterQuery}, function(stream) {
      self.streaming = true;
      stream
        .on('data', function (tweet) {
          // only consider a status if it's been retweeted
          if (tweet.retweeted_status && tweet.retweeted_status.retweet_count > 0) {
            var newTweet = {
              query:             filterQuery,
              tweet_id:          tweet.retweeted_status.id_str,
              screen_name:       tweet.retweeted_status.user.screen_name,
              profile_image_url: tweet.retweeted_status.user.profile_image_url,
              retweet_count:     tweet.retweeted_status.retweet_count,
              text:              tweet.retweeted_status.text,
              created_at:        tweet.retweeted_status.created_at
            };
            // create new tweet or update existing with new data
            retweets.update({tweet_id: tweet.retweeted_status.id_str}, newTweet, {upsert: true}, function(err, result) {});
          }
        })
        .on('error', function(e) {
          self.emit('error', e);
          self.stopStream();
        });

      // emit new list every once in a while
      self.interval_id = setInterval(getTopTweets, pollInterval);
    });
  });

  if (fn && typeof fn === "function") {
    fn();
  }
};

/**
 * Stops listening/logging of data.
 * @param  {Function} fn callback function
 * @return {void}
 */
RTStreamer.prototype.stopStream = function(fn) {
  if (this.interval_id) {
    clearInterval(this.interval_id);
  }

  this.streaming = false;

  if (fn && typeof fn === "function") {
    fn();
  }
};

/**
 * Whether or not data is currently streaming
 * @return {Boolean} [description]
 */
RTStreamer.prototype.isStreaming = function() {
  return this.streaming;
};

module.exports = RTStreamer;