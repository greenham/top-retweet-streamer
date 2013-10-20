$( document ).ready(function() {
  var socket  = io.connect('http://localhost'),
      rtDiv   = $('#rt-container'),
      theList = rtDiv.find('#rt-list'),
      searchForm = $('#search-form'),
      searchTerm = false;

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
            <span class="badge badge-success">'+tweet.retweet_count.toLocaleString()+' RTs</span>\
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

  var reconnectNotice = false;

  socket
    .on('connecting', function() {
      console.log('Connecting to socket...');
      searchForm.find('button').addClass('btn-success').removeAttr('disabled');
    })
    .on('connect_failed', function() {
      console.error('Connection to socket failed!');
      searchForm.find('button').removeClass('btn-success').attr('disabled', true);
      $.pnotify({title: 'Error', text: 'Could not connect to server!', type: 'error', history: false});
    })
    .on('connect', function() {
      console.log('Socket connected!');
    })
    .on('disconnect', function() {
      console.warn('Socket disconnected!');
      searchForm.find('button').removeClass('btn-success').attr('disabled', true);
      $.pnotify({title: 'Warning', text: 'Lost connection to server! Please wait while we try to re-establish a connection...', type: 'error', history: false});
    })
    .on('reconnecting', function() {
      console.warn('Reconnecting to socket...');
      if ( ! reconnectNotice) {
        reconnectNotice = $.pnotify({title: 'Status', text: 'Attempting reconnection...', nonblock: true, hide: false, closer: false, sticker: false, history: false});
      }
    })
    .on('reconnect_failed', function() {
      console.error('Reconnection to socket failed!');
      if (reconnectNotice.pnotify_remove) {
        reconnectNotice = false;
        reconnectNotice.pnotify_remove();
      }
      $.pnotify({title: 'Error', text: 'Could not reconnect to server!', type: 'error', history: false});
    })
    .on('reconnect', function() {
      console.log('Reconnected to socket!');
      if (reconnectNotice.pnotify_remove) {
        reconnectNotice = false;
        reconnectNotice.pnotify_remove();
      }
      // resend previous filter so we can start getting results again
      if (searchTerm) {
        socket.emit('filter', { query: searchTerm }, function() {
          $.pnotify({title: 'Status', text: 'Reconnected to server! Updates will start again soon...', type: 'success', history: false});
        });
      } else {
        searchForm.find('button').addClass('btn-success').removeAttr('disabled');
        $.pnotify({title: 'Status', text: 'Reconnected to server!', type: 'success', history: false});
      }
    })
    .on('error', function(e) {
      console.error(e);
      $.pnotify({title: 'Error', text: 'Something went wrong!', type: 'error', history: false});
    })
    .on('message', function(msg) {
      console.log(msg);
      $.pnotify({title: 'Notification', text: msg, history: false});
    })
    .on('nodata', function() {
      theList.fadeOut('fast', function() {
        theList.html('No retweets found yet... please wait... <img src="/assets/img/ajax-loader.gif">');
        theList.fadeIn();
      });
    })
    .on('data', function(tweets) {
      theList.fadeOut('fast', function() {
        theList.html('');
        if (tweets.length > 0) {
            $.each(tweets, function(index, tweet) {
              tweet.rank = index+1;
              var newTweet = $('<div></div>');
              newTweet.html(formatTweet(tweet));
              theList.append(newTweet);
            });
        } else {
          // @note this shouldn't happen on this event (see 'nodata'), but... just in case
          theList.html('No retweets found yet... please wait... <img src="/assets/img/ajax-loader.gif">');
        }
        theList.fadeIn();
      });
    });

  searchForm.on('submit', function(e) {
    e.preventDefault();
    searchTerm = searchForm.find('input[name="search-term"]').val();
    if (searchTerm) {
      socket.emit('filter', { query: searchTerm }, function() {
        searchForm.fadeOut('fast', function() {
          rtDiv.find('h2').html(searchTerm);
          $('.masthead').fadeOut(function() {
            rtDiv.fadeIn();
          });
        });
      });
    }
    return false;
  });
});