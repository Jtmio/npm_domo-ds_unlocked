var util = require('util');
var EventEmitter = require('events').EventEmitter;
var e = require(__dirname+'/escape');
var rl = require('readline');



var auth = function(settings){
  var a = this;

  settings = settings || {};

  a.host = settings.host || '';
  a.path = settings.path || '/api/domoweb/auth/login';
  a.method = settings.method || 'POST';
  a.sid = settings.sid || '';
  a.username = settings.username || '';
  a.password = settings.password || '';
}

auth.prototype.login = function(){
  var a = this;
  if(a.username !== '' && a.password !== ''){
    a.connect();
    return;
  };
  process.stdout.write(' There are a few things we need from you first...\n\n'.gray);

        var ll = require('readline');
        var rl = require('readline').createInterface({input: process.stdin, output: process.stdout});

        var getHost = function(){
            rl.question('Which Instance? ('+'instance'.cyan+'.domo.com): ', (host)=>{
                a.host = host.replace('\.domo\.com','')+'.domo.com';

                if(a.host == 'domo.domo.com'){
                    a.emit('error', 'a1', "You cannot use this tool on Domo.Domo!");
                }

                process.stdout.write(e.lineUp(1)+e.clearLine());

                process.stdout.write('Instance: '+a.host.gray+'\r\n');
                rl.pause();
                getUser();
            });
        }

        var getUser = function(){
            rl.question('What is your username ('+'someone@somewhere.com'.cyan+'): ', (usr)=>{

                if(!/@domo\.com/i.test(usr)){
                    a.emit('error', 'a3', 'This tool is only for internal Domo use only.'.red
                        +'\n\nYou must have a domo.com email addres to use this tool.'.gray);
                }
                a.username = usr;

                process.stdout.write(e.lineUp(1)+e.clearLine());

                process.stdout.write('Username: '+a.username.gray+'\r\n');
                rl.pause();
                getPassword();
            });
        }

        var getPassword = function(){
            process.stdout.write('Password: ');
            password = '';

            process.stdin.resume();

            process.stdin.setEncoding('utf8');
            process.stdin.on('data',function(pwd){
      switch(pwd){
        case '\n':
        case '\r':
        case '\u0004':
          process.stdin.pause();
          process.stdout.write(e.lineUp(1)+e.clearLine()+e.cursorLeft(200)+'Password: *\r\n');
          a.password = password;
          a.connect();
          break;
        default:
          password += pwd;
          process.stdout.write(e.clearLine()+e.cursorLeft(200)+'Password: '+Array(password.length+1).join("*"));
      };
    });
  };

  getHost();

}

auth.prototype.connect = function(){
  var a = this;

  var req = require('https').request({
    hostname: a.host
    ,path: a.path
    ,method: a.method
    ,headers: {
      "Content-Type": "application/json"
    }
  }, (res) => {
    res.setEncoding('utf8');
    var json = '';

    res.on('data', (chunk) =>{
      json += chunk;
    });

    res.on('end', () =>{
      if(res.statusCode != 200){
        // console.log(Object.keys(res).join(`\n`).blue);
        // console.log('json',json);
        a.emit('error', 'a2', "Unable to log in! "+`Status: ${res.statusCode} - ${res.statusMessage}`);

      }else{
        a.sid = JSON.parse(json).sid;
        a.password = '';
        a.emit('success');
      }
    });
  });

  req.write(JSON.stringify({
    'username' : a.username
    ,'password' : a.password
    ,'base64' : false
  }));

  req.end();
}


util.inherits(auth, EventEmitter);

module.exports = {new: function(settings){return new auth(settings);}};
