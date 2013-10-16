Backend Twitter Streamer
* For this project, build a backend twitter top 10 retweets streamer with the following conditions:

The backend should:
* Analyze a filtered statuses stream from twitter to determine the top 10 re-tweets.
* For a filter that has already has been requested before, return the previous top 10 standings as the first packet.
* A connected client should be streamed the standings of the top 10 re-tweets as they update.
* Each streamed packet should include the original author of the tweet being retweeted, the tweet, retweet count, and the position in the top 10 of the retweet.

The twitter streaming api only allows one connection per developer api account, so you will not be able to continually analyze all the previous filters in isolation. But, you should maintain the connection to at least the current filtered stream and continue analyzing the top 10 re-tweets until someone requests a different filter.

Extra Credit:
* Create a browser-based client interface for the stream
* Let a user enter a search query string or twitter handle
* Output a list of the 10 retweets for the query/handle which updates in realtime

Other caveats/limitations/exceptions:
* Use node.js and mongodb only.
* No ORM frameworks allowed.
* Don't use express.js
* Code should be hosted on github
