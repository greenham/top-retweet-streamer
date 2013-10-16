var twitter     = require('ntwitter');
var MongoClient = require('mongodb').MongoClient;

var query       = '#HipHopAwards';

// Connect to the db
MongoClient.connect("mongodb://localhost:27017/retweets", function(err, db) {
	if (err) {
		console.log(err);
		process.exit();
	}

	var twit = new twitter({
		consumer_key: 'gUdGG5cbw2VYfKipEkFpQg',
		consumer_secret: 'fnKnMO7ddRUrUrCRGh0aeMR6vqtLuM4gqoOY63ApQ70',
		access_token_key: '1963789585-njzp3nBKbD75doKnBlEv3F1sfAfTylI8VAVOjG6',
		access_token_secret: 'rBYSdSNlfXZz5X7vWCtqtJlO1iCREJ3PwDpCa1GYw'
	});

	twit.verifyCredentials(function (err, data) {
		if (err) {
			console.log(err);
			process.exit();
		}

		var retweets = db.collection('retweets'),
				rtQuery = {query: query};
				rtFields  = {'screen_name': true, 'retweet_count': true, 'text': true},
				rtOpts = {limit: 10, sort: ['retweet_count','desc']};

		retweets.find(rtQuery, rtFields, rtOpts, function(err, result) {
			// @todo list existing results for this query (if any)
			console.log(result);
			twit.stream('statuses/filter', {'track':query}, function(stream) {
				stream
					.on('data', function (tweet) {
						if (tweet.retweeted_status && tweet.retweeted_status.retweet_count > 0) {
							var newTweet = {
								query: query,
								tweet_id: tweet.retweeted_status.id,
								screen_name: tweet.retweeted_status.user.screen_name,
								retweet_count: tweet.retweeted_status.retweet_count,
								text: tweet.retweeted_status.text
							};
							retweets.update({tweet_id: tweet.retweeted_status.id}, newTweet, {upsert: true, w: 1}, function(err, result) {console.log(err);});
						}
					})
					.on('error', function(e) {
						console.log(e);
						process.exit();
					});
			});
		});
	});
});