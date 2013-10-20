var util        = require('util'),
    events      = require('events'),
    twitter     = require('ntwitter'),
    MongoClient = require('mongodb').MongoClient;

function RTStreamer(config) {
  if (false === (this instanceof RTStreamer)) {
    return new RTStreamer(config);
  }

  this.config      = config;
  this.interval_id = false;
  this.twitstream  = false;
  this.twit        = new twitter(this.config.twitter);

  events.EventEmitter.call(this);
}
util.inherits(RTStreamer, events.EventEmitter);

/**
 * Listens to stream of filtered twitter statuses, logs data to mongo collection, and emits top tweets.
 * @param  {String}   filterQuery  the search string to use
 * @param  {Number}   pollInterval how often (in ms) to emit new results
 * @param  {Number}   limit        max number of top retweets to emit
 * @param  {Function} callback     callback function
 */
RTStreamer.prototype.stream = function(filterQuery, callback) {
  var self          = this,
      validCallback = (callback && typeof callback === "function");

  // connect to the DB
  MongoClient.connect(self.config.mongodb.host, function(err, db) {
    if (err) {
      if (validCallback) {
        callback(err);
      }
      return self;
    }

    // set up the query for the top retweets
    var retweets    = db.collection('retweets'),
        queryRegExp = new RegExp(filterQuery, 'i'),
        rtQuery     = {query: queryRegExp};
        rtFields    = {},
        rtOpts      = {limit: self.config.top_retweets_limit, sort: [["retweet_count", "desc"]]},
        lastResult  = false;

    // gets the top tweets and emits results to listeners
    var updateTopRetweets = function() {
      retweets.find(rtQuery, rtFields, rtOpts, function(err, result) {
        if (!err) {
          if (result) {
            result.toArray(function(err, resultArr) {
              if (!err) {
                if (resultArr.length > 0) {
                  // only emit data if it has changed
                  if (true === topListHasChanged(lastResult, resultArr)) {
                    lastResult = resultArr;
                    self.emit('data', resultArr);
                  } else {
                    self.emit('nochange');
                  }
                } else {
                  self.emit('nodata');
                }
              } else {
                self.emit('error', err);
              }
            });
          } else {
            self.emit('nodata');
          }
        } else {
          self.emit('error', err);
        }
      });
    };

    // sees if there's any difference between the last set of results and this one
    var topListHasChanged = function(lastResult, resultArr) {
      var changed = false;

      if (lastResult !== false && lastResult.length === resultArr.length) {
        for (var i = 0; i < resultArr.length; i++) {
          if (resultArr[i].tweet_id !== lastResult[i].tweet_id || resultArr[i].retweet_count !== lastResult[i].retweet_count) {
            changed = true;
            break;
          }
        }
      } else {
        changed = true;
      }

      return changed;
    };

    // emit the previous standings as the first packet if this query has already been requested
    updateTopRetweets();

    // listen to the stream and populate the DB
    self.twit.stream('statuses/filter', {'track':filterQuery}, function(stream) {
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
            retweets.update({tweet_id: tweet.retweeted_status.id_str}, newTweet, {upsert: true}, function(err, result) {
              if (err) {
                self.emit('error', err);
              }
            });
          }
        })
        .on('error', function(e) {
          self.emit('error', e);
          self.stopStream();
        })
        .on('end', function (response) {
          self.stopStream();
        })
        .on('destroy', function (response) {
          // a 'silent' disconnection from Twitter, no end/error event fired
        });

      // check for a new list to emit every once in awhile
      self.interval_id = setInterval(updateTopRetweets, self.config.poll_interval);

      if (validCallback) {
        callback(null, self);
      }
    });
  });

  return self;
};


// stops listening/logging/emitting of data.
RTStreamer.prototype.stopStream = function(callback) {
  // stop listening/logging
  if (this.twitstream !== false) {
    this.twitstream.destroy();
  }

  // stop emitting
  if (this.interval_id !== false) {
    clearInterval(this.interval_id);
  }

  if (callback && typeof callback === "function") {
    callback();
  }

  return this;
};


// returns whether or not data is currently streaming
RTStreamer.prototype.isStreaming = function() {
  return (this.twitstream !== false);
};

module.exports = RTStreamer;