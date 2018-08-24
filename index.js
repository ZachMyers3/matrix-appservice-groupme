var HTTPS       = require("https");
var Cli         = require("matrix-appservice-bridge").Cli;
var Bridge      = require("matrix-appservice-bridge").Bridge;
var AppServiceRegistration
                = require("matrix-appservice-bridge").AppServiceRegistration;
var http        = require("http");
var requestLib  = require("request");
var qs 		= require("querystring");
var config    	= require("config-yml");

const PORT = config.groupme_hook_port;
const ROOM_ID = config.slack_room_id;
const GROUPME_WEBHOOK_URL = "https://api.groupme.com/v3/bots/"
const GROUPME_BOT_ID = config.slack_room_id;
const HOMESERVER_URL = config.homeserver.url;
const USERNAME_PREFIX = config.username_prefix;

http.createServer(function (request, response) {
  console.log(request.method + " " + request.url);

  var body = "";
  request.on("data", function(chunk) {
    body += chunk
  });

  request.on("end", function() {
    var params = JSON.parse(body);
    console.log(params)
    if (params.name !== "Matrix Bridge") {
      var name = removeEmojis(params.name);
      var intent = bridge.getIntent(USERNAME_PREFIX + name + ":" + HOMESERVER_URL);
      intent.sendText(ROOM_ID, params.text);
    }
    response.writeHead(200, {"Content-Type": "application/json"});
    response.write(JSON.stringify({}));
    response.end();
  });

}).listen(PORT);

function ping() {
  this.res.writeHead(200);
  this.res.end("GroupMe <--> Matrix");
}

var Cli = require("matrix-appservice-bridge").Cli;
var Bridge = require("matrix-appservice-bridge").Bridge;
var AppServiceRegistration = require("matrix-appservice-bridge").AppServiceRegistration;

new Cli({
    registrationPath: "groupme-registration.yaml",
    generateRegistration: function(reg, callback) {
        reg.setHomeserverToken(AppServiceRegistration.generateToken());
        reg.setAppServiceToken(AppServiceRegistration.generateToken());
        reg.setSenderLocalpart("gmbot");
	var pattern = USERNAME_PREFIX + ".*"
        reg.addRegexPattern("users", pattern, true);
        callback(reg);
    },
    run: function(port, config) {
        bridge = new Bridge({
            homeserverUrl: HOMESERVER_URL,
            domain: "localhost",
            registration: "groupme-registration.yaml",

            controller: {
                onUserQuery: function(queriedUser) {
                    return {}; // auto-provision users with no additonal data
                },

                onEvent: function(request, context) {
                    var event = request.getData();
                    if (event.type !== "m.room.message" || !event.content || event.room_id !== ROOM_ID) {
                        return;
                    }
                    console.log("*************************")
                    console.log(event)
                    postMessage(event.content.body, event.user_id);

                    /*
                    requestLib({
                        method: "POST",
                        json: true,
                        uri: GROUPME_WEBHOOK_URL,
                        body: {
                            bot_id: event.user_id,
                            text: event.content.body
                        }
                    }, function(err, res) {
                        console.log(err);
                        if (err) {
                            console.log("HTTP Error: %s", err);
                        }
                        else {
                            console.log("HTTP %s", res.statusCode);
                        }
                    });
                    */
                }
            }
        });
        console.log("Matrix-side listening on port %s", port);
        bridge.run(port, config);
    }
}).run();

function postMessage(messageText, userName) {
  var botResponse, options, body, botReq;

  userName = userName.substring(1, userName.indexOf(':'));

  botResponse = userName + ":\n" + messageText;

  options = {
    hostname: 'api.groupme.com',
    path: '/v3/bots/post',
    method: 'POST'
  };

  body = {
    "bot_id" : GROUPME_BOT_ID,
    "text" : botResponse
  };

  console.log('sending ' + botResponse + ' to ' + GROUPME_BOT_ID);

  botReq = HTTPS.request(options, function(res) {
      if(res.statusCode == 202) {
        //neat
      } else {
        console.log('rejecting bad status code ' + res.statusCode);
      }
  });

  botReq.on('error', function(err) {
    console.log('error posting message '  + JSON.stringify(err));
  });
  botReq.on('timeout', function(err) {
    console.log('timeout posting message '  + JSON.stringify(err));
  });
  botReq.end(JSON.stringify(body));
}

function removeEmojis(message) {
  return message.replace(/([\uE000-\uF8FF]|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDDFF])/g, '')
}
