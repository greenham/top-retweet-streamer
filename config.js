var config = {};

config.top_retweets_limit = 10;
config.poll_interval      = 10000;

config.db = {
  host:       'mongodb://localhost:27017/retweets',
  collection: 'rtscapped'
};

config.twitter = {
  consumer_key:        'gUdGG5cbw2VYfKipEkFpQg',
  consumer_secret:     'fnKnMO7ddRUrUrCRGh0aeMR6vqtLuM4gqoOY63ApQ70',
  access_token_key:    '1963789585-njzp3nBKbD75doKnBlEv3F1sfAfTylI8VAVOjG6',
  access_token_secret: 'rBYSdSNlfXZz5X7vWCtqtJlO1iCREJ3PwDpCa1GYw'
};

config.socket = {transports: ["websocket", "xhr-polling"]};

module.exports = config;