$( document ).ready(function() {
  var socket  = io.connect('http://localhost'),
      rtDiv   = $('#rt-container'),
      theList = rtDiv.find('#rt-list'),
      searchForm = $('#search-form'),
      searchTerm = null;

  var formatTweet = function(tweet) {
    var tweetDate = new Date(tweet.created_at);
    return '<div class="media well" id="tweet-'+tweet.tweet_id+'">\
        <h3 class="pull-left">\
          <a href="https://twitter.com/'+tweet.screen_name+'/status/'+tweet.tweet_id+'" target="_blank">#'+tweet.rank+'</a>\
        </h3>\
        <a class="pull-left" href="https://twitter.com/'+tweet.screen_name+'" target="_blank">\
          <img class="media-object" alt="@'+tweet.screen_name+'" style="width: 48px; height: 48px;" src="'+tweet.profile_image_url+'">\
        </a>\
        <div class="media-body">\
          <h4 class="media-heading">\
            <a href="https://twitter.com/'+tweet.screen_name+'" target="_blank">@'+tweet.screen_name+'</a>\
            <span class="badge badge-success">'+tweet.retweet_count.toLocaleString()+' RTs</span>\
            <small class="pull-right muted">'+tweetDate.toLocaleString()+'</small>\
          </h4>\
          <p>'+htmlifyLinks(tweet.text)+'</p>\
        </div>\
      </div>';
  };

  var htmlifyLinks = function(text) {
    var exp = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    return text.replace(exp,'<a href="$1" target="_blank">$1</a>');
  };

  var reconnectNotice = false;

  socket
    .on('connecting', function() {
      console.log('Connecting to socket...');
    })
    .on('connect_failed', function() {
      console.error('Connection to socket failed!');
      searchForm.find('button').attr('disabled', 'disabled');
      $.pnotify({
        title: 'Error',
        text: 'Could not connect to server!',
        type: 'error',
        history: false,
        styling: 'bootstrap'
      });
    })
    .on('connect', function() {
      console.log('Socket connected!');
    })
    .on('disconnect', function() {
      console.warn('Socket disconnected!');
      $.pnotify({
        title: 'Warning',
        text: 'Lost connection to server! Please wait while we try to re-establish a connection...',
        type: 'error',
        history: false,
        styling: 'bootstrap'
      });
    })
    .on('reconnecting', function() {
      console.warn('Reconnecting to socket...');
      if ( ! reconnectNotice) {
        reconnectNotice = $.pnotify({
          title: 'Status',
          text: 'Attempting reconnection...',
          nonblock: true,
          hide: false,
          closer: false,
          sticker: false,
          history: false,
          styling: 'bootstrap'
        });
      }
    })
    .on('reconnect_failed', function() {
      console.error('Reconnection to socket failed!');
      if (reconnectNotice.pnotify_remove) reconnectNotice.pnotify_remove();
      $.pnotify({
        title: 'Error',
        text: 'Could not reconnect to server!',
        type: 'error',
        history: false,
        styling: 'bootstrap'
      });
    })
    .on('reconnect', function() {
      console.log('Reconnected to socket!');
      if (reconnectNotice.pnotify_remove) reconnectNotice.pnotify_remove();
      // resend previous filter so we can start getting results again
      socket.emit('filter', { query: searchTerm }, function() {
        $.pnotify({
          title: 'Status',
          text: 'Reconnected to server! Updates will start again soon...',
          type: 'success',
          history: false,
          styling: 'bootstrap'
        });
      });
    })
    .on('error', function(e) {
      console.error(e);
      $.pnotify({
        title: 'Error',
        text: 'Something went wrong!',
        type: 'error',
        history: false,
        styling: 'bootstrap'
      });
    })
    .on('message', function(msg) {
      console.log(msg);
      $.pnotify({
        title: 'Notification',
        text: msg,
        history: false,
        styling: 'bootstrap'
      });
    })
    .on('nodata', function() {
      theList.fadeOut('fast', function() {
        theList.html('No retweets found yet... please wait... <img src="/assets/img/ajax-loader.gif">');
        theList.fadeIn();
      });
    })
    .on('data', function(tweets) {
      // @note There's probably a much more elegant experience to be achieved here
      // like storing a local array of tweet IDs and their ranks, and only updating
      // the view if something changes. Or maybe that can be done on the backend.
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