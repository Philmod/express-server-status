var moment = require('moment');
var requests = { total: 0 };
var requests_per_minute = [];

for(var i=0;i<60;i++)
  requests_per_minute[i] = 0;

var uptime_start = new Date();
var exec = require('child_process').exec;
var git_data = { };
exec(__dirname+'/lib/get_git_data.sh', function(err, res, stderr) {
  var cols = res.trim().split(',');
  git_data.branch = cols[0];
  git_data.sha = cols[1].substr(0,7);
});

var sum = function(arr, from, length) {
  var total = 0;
  for(var i=from-length;i<from;i++) {
    total += arr[(i+arr.length)%arr.length];
  }
  return total;
}

var average = function(arr, from, length) {
  var total = sum(arr, from, length);
  return Math.round(total/arr.length);
}

var resetCounter = function() {
  var minute = (new Date).getMinutes();
  requests_per_minute[(minute+1)%59] = 0;
}
// Every minute, we reset the oldest entry
setInterval(resetCounter, 60*1000);

module.exports = function(app, options) {
  
  var server = { status: "up" };
  
  try {
    var package = require.main.require('./package.json');
    server.description = package.description;
    server.version = package.version;
  } catch(e) {}
  
  app.get('*', function(req, res, next) {
    requests.total++;
    var minute = (new Date).getMinutes();
    requests_per_minute[minute]++;
    return next();
  });
  
  return function(req, res, next) {
    
    req.stats = {}
    req.stats.start = new Date;
       
    // decorate response#end method from express
    var end = res.end;
    res.end = function () {
      req.stats.responseTime = (new Date) - req.stats.start;
      // call to original express#res.end()
      res.setHeader('X-Response-Time', req.stats.responseTime);
      end.apply(res, arguments);
    } 
    
    var minute = (new Date).getMinutes();
    server.uptime = Math.round((new Date() - uptime_start) / 1000);
    server.uptime_human = moment(uptime_start).fromNow();
     
    // requests.per_minute = requests_per_minute;
    requests.last_minute = sum(requests_per_minute, minute, 1);
    requests.last_5mn_avg = sum(requests_per_minute, minute, 5);
    requests.last_15mn_avg = average(requests_per_minute, 0, 15);
    server.requests = requests;
    const status = { server, git: git_data };
    
    res.send(status);
    
  };
  
}