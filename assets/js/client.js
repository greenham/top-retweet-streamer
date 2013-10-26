$( document ).ready(function() {
  var socket = io.connect('http://localhost'),
      rtDiv      = $('#rt-container'),
      theList    = rtDiv.find('#rt-list'),
      searchForm = $('#search-form'),
      searchTerm = false,
      topTweets  = [],
      retweetThreshold = 0,
      topRetweetLimit = 10;

  var formatTweet = function(tweet) {
    var profileUrl = 'https://twitter.com/'+tweet.screen_name,
        tweetUrl   = 'https://twitter.com/'+tweet.screen_name+'/status/'+tweet.tweet_id;

    return('\
      <div class="media well" id="tweet-'+tweet.tweet_id+'">\
        <h3 class="pull-left">\
          <a href="'+tweetUrl+'" target="_blank">#'+tweet.rank+'</a>\
        </h3>\
        <a class="pull-left" href="'+profileUrl+'" target="_blank">\
          <img class="media-object" alt="@'+tweet.screen_name+'" src="'+tweet.profile_image_url+'">\
        </a>\
        <div class="media-body">\
          <h4 class="media-heading">\
            <a href="'+profileUrl+'" target="_blank">@'+tweet.screen_name+'</a>\
            <span class="badge badge-success rtcount">'+tweet.retweet_count.toLocaleString()+' RTs</span>\
            <small class="pull-right muted" title="'+tweet.created_at+'">'+prettyDate(tweet.created_at)+'</small>\
          </h4>\
          <p>'+htmlifyLinks(tweet.text)+'</p>\
        </div>\
      </div>');
  };

  var prettyDate = function(time) {
    var date     = new Date((time || "").replace(/-/g,"/").replace(/[TZ]/g," ")),
        now      = new Date(),
        diff     = ((now.getTime() - ((date.getTime()) - (0 * 60000))) / 1000),
        day_diff = Math.floor(diff / 86400);

    return day_diff <= 0 &&
      (diff < 30 && "just now" ||
      diff < 60 && "less than a minute ago" ||
      diff < 120 && "a minute ago" ||
      diff < 3600 && Math.floor( diff / 60 ) + " minutes ago" ||
      diff < 7200 && "about an hour ago" ||
      diff < 86400 && "about " + Math.floor( diff / 3600 ) + " hours ago") ||
      day_diff == 1 && "yesterday" ||
      day_diff + " days ago";
  };

  var htmlifyLinks = function(text) {
    var exp = /(\b(https?|ftp|file):\/\/[\-A-Z0-9+&@#\/%?=~_|!:,.;]*[\-A-Z0-9+&@#\/%=~_|])/ig;
    return text.replace(exp,'<a href="$1" target="_blank">$1</a>');
  };

  var handleSearch = function(e) {
    e.preventDefault();
    searchTerm = searchForm.find('input[name="search-term"]').val();
    if (searchTerm) {
      socket.emit('filter', {query: searchTerm}, function(err) {
        if (!err) {
          searchForm.fadeOut('fast', function () {
            rtDiv.find('h2').html(searchTerm);
            $('.masthead').fadeOut(function () {
              rtDiv.fadeIn(function () {
                $('.footer').html($('.masthead').html());
              });
            });
          });
        } else {
          console.error(err);
          $.pnotify({title: 'Error', text: 'Something went wrong!', type: 'error'});
        }
      });
    } else {
      $.pnotify({title: 'Error', text: 'Please enter a search term!', type: 'error'});
    }
    return false;
  };

  searchForm.on('submit', handleSearch);

  var reconnectNotice         = false;
  $.pnotify.defaults.history  = false;
  $.pnotify.defaults.nonblock = true;

  socket
    .on('connecting', function() {
      console.log('Connecting to socket...');
      searchForm.find('button').addClass('btn-success').removeAttr('disabled');
    })
    .on('connect_failed', function() {
      console.error('Connection to socket failed!');
      searchForm.find('button').removeClass('btn-success').attr('disabled', true);
      $.pnotify({title: 'Error', text: 'Could not connect to server!', type: 'error'});
    })
    .on('data', function(tweet) {
      // add this to the list of top retweets if:
      // - this tweet is not already in the list AND
      // - we do not have the maximum number of top retweets desired yet OR
      // - this tweet has more retweets than the lowest ranked tweet
      var existingTweet = _.findWhere(topTweets, {tweet_id: tweet.tweet_id});
      if (existingTweet !== undefined) {
        // just update the count for this tweet
        console.log('Received existing tweet, updating RT count...');
        existingTweet.retweet_count = tweet.retweet_count;
        $('#tweet-'+tweet.tweet_id).find('.rtcount').fadeOut('fast', function () {
          $(this).html(tweet.retweet_count.toLocaleString()+' RTs').fadeIn('fast');
        });
        return null;
      } else {
        if (topTweets.length < topRetweetLimit) {
          console.log('Received new tweet, list is not full yet, pushing...');
          topTweets.push(tweet);
        } else if (tweet.retweet_count > retweetThreshold) {
          console.log('Received new tweet, more RTs ('+tweet.retweet_count+') than threshold ('+retweetThreshold+'), pushing...');
          topTweets.push(tweet);
        } else {
          // ignore this tweet
          return null;
        }
      }

      // trim and re-order the list
      topTweets = _.sortBy(topTweets, 'retweet_count').reverse().slice(0,topRetweetLimit);

      // update the threshold to the count of the lowest ranked tweet if the list is full
      if (topTweets.length === topRetweetLimit) {
        retweetThreshold = topTweets[topTweets.length-1].retweet_count;
        console.log('New threshold is ' + retweetThreshold);
        socket.emit('set threshold', retweetThreshold);
      }

      // @todo only refresh the entire view if the order has changed
      $('#waiting-msg').hide('fast', function () {
        theList.fadeOut('slow', function () {
          theList.html('');
          for (var i = 0; i < topTweets.length; i++) {
            topTweets[i].rank = i+1;
            newTweet = $('<div></div>');
            newTweet.html(formatTweet(topTweets[i]));
            theList.append(newTweet);
          }
          theList.fadeIn('slow');
        });
      });
    })
    .on('connect', function() {
      console.log('Socket connected!');
    })
    .on('disconnect', function() {
      console.warn('Socket disconnected!');
      searchForm.find('button').removeClass('btn-success').attr('disabled', true);
      $.pnotify({title: 'Warning', text: 'Lost connection to server! Please wait while we try to re-establish a connection...', type: 'error'});
    })
    .on('reconnecting', function() {
      console.warn('Reconnecting to socket...');
      if (!reconnectNotice) {
        reconnectNotice = $.pnotify({title: 'Status', text: 'Attempting reconnection... please wait...', hide: false, closer: false, sticker: false});
      }
    })
    .on('reconnect_failed', function() {
      console.error('Reconnection to socket failed!');
      if (reconnectNotice) {
        reconnectNotice.remove();
        reconnectNotice = false;
      }
      $.pnotify({title: 'Error', text: 'Could not reconnect to server!', type: 'error'});
    })
    .on('reconnect', function() {
      console.log('Reconnected to socket!');
      if (reconnectNotice) {
        reconnectNotice.remove();
        reconnectNotice = false;
      }
      // resend previous filter so we can start getting results again
      if (searchTerm) {
        socket.emit('filter', {query: searchTerm}, function(err) {
          if (!err) {
            $.pnotify({title: 'Status', text: 'Reconnected to server! Updates will start again soon...', type: 'success'});
          } else {
            console.error(err);
            $.pnotify({title: 'Error', text: 'Reconnected to server, but unable to receive updates!', type: 'error'});
          }
        });
      } else {
        searchForm.find('button').addClass('btn-success').removeAttr('disabled');
        $.pnotify({title: 'Status', text: 'Reconnected to server!', type: 'success'});
      }
    })
    .on('error', function(e) {
      console.error(e);
      $.pnotify({title: 'Error', text: 'Something went wrong!', type: 'error'});
    })
    .on('message', function(msg) {
      console.log(msg);
      $.pnotify({title: 'Notification', text: msg});
    });
});