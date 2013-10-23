Top ReTweet Streamer
========================

A realtime top retweets streamer using node.js, mongodb, socket.io, and Twitter's Streaming API with support for searching.

Requirements
------------
- node.js/npm
- mongodb (running on port 27017)

Installation
------------

```
git clone git@github.com:greenham/top-retweet-streamer.git
cd top-retweet-streamer
npm install
node index.js
mongo localhost
> db.createCollection("rtscapped", {capped: true, max: 10, size: 5000});
```



Access via web browser: [http://localhost:3000](http://localhost:3000)

![Search interface](http://screencloud.net//img/screenshots/81b6b630472487834b231b6289874769.png)
![Top RT board](http://screencloud.net//img/screenshots/52492be406859a8396eaff1daf07276e.png)
