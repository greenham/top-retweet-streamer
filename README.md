Top ReTweet Streamer
========================

A realtime top retweets streamer using node.js, mongodb, socket.io, and Twitter's Streaming API with support for searching.

Requirements
------------
- node.js/npm
- mongodb (running on port 27017)

Installing
----------

```
git clone git@github.com:greenham/top-retweet-streamer.git
cd top-retweet-streamer
npm install
mongo localhost
db.getSiblingDB('retweets').createCollection('rtstream', {capped: true, size: 100000});
db.rtstream.insert({});
```

Configuring
-----------

Configuration items can be found in [https://github.com/greenham/top-retweet-streamer/blob/master/config.js](config.js), most notably:

1. **Twitter API credentials**

You need a Twitter account and a [https://dev.twitter.com/apps](developer application) to get these credentials.

```
config.twitter = {
  consumer_key:        'YOUR-CONSUMER-KEY',
  consumer_secret:     'YOUR-CONSUMER-SECRET',
  access_token_key:    'YOUR-ACCESS-TOKEN-KEY',
  access_token_secret: 'YOUR-ACCESS-TOKEN-SECRET'
};
```

2. **"Recent" time limit**

By default, only tweets that were tweeted in the last 24 hours are considered. You can adjust this setting here:

```
config.tweets = {
  recent_time_limit_hours:    24
};
```

Running
-------

`node index.js`

Access via web browser: [http://localhost:3000](http://localhost:3000)

![Search interface](http://screencloud.net/img/screenshots/81b6b630472487834b231b6289874769.png)
![Top RT board](http://screencloud.net/img/screenshots/aca81a016c6eb4e0056a905808d78edf.png)