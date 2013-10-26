var config = {};

config.tweets = {
  recent_time_limit_hours:    24
};

config.db = {
  host:       'mongodb://localhost:27017/retweets',
  collection: 'rtstream'
};

/*config.twitter = {
  consumer_key:        'YOUR-CONSUMER-KEY',
  consumer_secret:     'YOUR-CONSUMER-SECRET',
  access_token_key:    'YOUR-ACCESS-TOKEN-KEY',
  access_token_secret: 'YOUR-ACCESS-TOKEN-SECRET'
};*/
// NOTE: This is just a random developer account which is limited to one connection
// to the Streaming API at a time. It's highly recommended to change these to your own credentials.
config.twitter = {
  consumer_key:        'gUdGG5cbw2VYfKipEkFpQg',
  consumer_secret:     'fnKnMO7ddRUrUrCRGh0aeMR6vqtLuM4gqoOY63ApQ70',
  access_token_key:    '1963789585-njzp3nBKbD75doKnBlEv3F1sfAfTylI8VAVOjG6',
  access_token_secret: 'rBYSdSNlfXZz5X7vWCtqtJlO1iCREJ3PwDpCa1GYw'
};

config.socket = {transports: ["websocket", "xhr-polling"]};

module.exports = config;