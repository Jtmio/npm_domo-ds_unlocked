#! /usr/bin/env node

var colors = require('colors');
var execFile = require('child_process').execFile;
var fs = require('fs');
var path = require('path');
var doCards = false;
try{
  var login = require('./login');
  login.password = Buffer.from(login.password, 'base64').toString('ascii');
}catch(e){
  var login = {};
}


var sid = '';
var dlFile = 'ds_lineage.html';

var auth = require(__dirname+'/lib/auth').new(login);
var df = require(__dirname+'/lib/dataflows').new();
var ds = require(__dirname+'/lib/datasets').new();
var dfDone = false;
var dsDone = false;
var cdDone = true;
var doDFHistory = false;
var loadFile = true;

process.on('exit',function(){
  process.stdout.write('\n\n');
});

process.argv.forEach(function(me){
  switch (me) {
    case '-c':
      doCards = true;
      cdDone = false;
      break;
    case '-d':
      doDFHistory = true;
      // console.log('requesting dataflow history');
      break;
    case '-noload':
      loadFile = false;
      break;
    default:

  }

});

/********************
 * Auth process events
 *******************/
auth.on('error', function(code, msg){
  console.log(`\n\nError ${code}: ${msg}`.red);
  process.exit();
});

auth.on('success', function(){
  console.log("Login Successfull:".green + " Now submitting for data.".gray);
  run();
});

/********************
 * Dataflow process events
 *******************/
df.on('error', function(code, msg){
  sp.flows = 'Flows: '.red+`Error ${code}: ${msg}`;
  sp.print();
  process.exit();
});

df.on('success', function(){
  sp.flows = 'Flows: '.green+(df.data.rows.length+'').gray;
  sp.print();
  dfDone = true;
  createOutput();
});

/********************
 * Dataset process events
 *******************/
ds.on('error', function(code, msg){
  console.log(`\n\nError ${code}: ${msg}`.red);
  process.exit();
});

ds.on('success', function(){
  sp.sets = 'Sets: '.green+`${ds.pageCount} pages (${ds.setCount} ttl)`.gray;
  sp.fusions = 'Fusions: '.green + `${ds.fusionCount}`.gray;
  sp.print();
  dsDone = true;
  createOutput();
});

ds.on('progress', function(msg){
  sp.sets = 'Sets: '.cyan+msg.gray;
  sp.print();
});

ds.on('fusion', function(){
  sp.fusions = 'Fusions: '.cyan + (ds.fusionGotCount+' / '+ds.fusionCount).gray;
  sp.print();
});

var cd = require(__dirname+'/lib/cards').new({
  sid: auth.sid
  ,host: auth.host
});

cd.on('error', function(err,code,msg){
  console.log(`\n\nError ${code}: ${msg}`.red);
  process.exit();
});

cd.on('progress', function(msg){
  sp.cards = 'Cards: '.cyan + msg.gray;
  sp.print();
});

cd.on('success', function(){
  sp.cards = 'Cards: '.green + (cd.kpis.rows.length + '').gray;
  sp.print();
  cdDone = true;
  createOutput();
});

/********************
 * Run Function
 *  --No Params
 *******************/
function run(){
  sp.print(true);
  df.get({sid: auth.sid, host: auth.host, history: doDFHistory});
  ds.get({sid: auth.sid, host: auth.host});
  if(doCards){
    cd.getFullList({sid: auth.sid, host: auth.host});
  }else{
    cd.kpis = {
      fields: {}
      ,rows: []
    }
  }
}

function statPrinter(){
  var sp = this;

  sp.flows = 'Flows: 0/0'.gray;
  sp.sets = 'Sets: 0/0'.gray;
  sp.fusions = 'Fusions: 0/0'.gray;
  if(doCards){
    sp.cards = 'Cards: Getting list of cards...'.gray;
  }else{
    sp.cards = 'Cards: '.green + 'Not requested (-c)'.gray;
  }

  var e = require(__dirname+'/lib/escape');

  sp.print = function(first){
    if(!first){
      process.stdout.write(
        e.clearLine()
        +e.lineUp(1)
        +e.clearLine()
        +e.lineUp(1)
        +e.clearLine()
        +e.lineUp(1)
        +e.clearLine()
        +e.lineUp(1)
        +e.clearLine()
        +e.cursorLeft(999)
      );
    };
    process.stdout.write(`${sp.flows}\n${sp.sets}\n${sp.fusions}\n${sp.cards}`);
    process.stdout.write(`\n${abbrNum(process.memoryUsage().heapUsed)} / ${abbrNum(process.memoryUsage().heapTotal)} / ${abbrNum(process.memoryUsage().rss)}`);
  };
};

function abbrNum(num){
  switch(`${num}`.length){
    case 0:
    case 1:
    case 2:
    case 3:
      return num;
      break;
    case 4:
    case 5:
    case 6:
      return (Math.floor(num/10)/100)+'K';
      break;
    case 7:
    case 8:
    case 9:
      return (Math.floor(num/10000)/100)+'M';
      break;
    case 10:
    case 11:
    case 12:
      return (Math.floor(num/10000000)/100)+'G';
      break;
    case 13:
    case 14:
    case 15:
      return (Math.floor(num/10000000000)/100)+'T';
      break;
  }
}

var sp = new statPrinter();


process.stdout.write('\n ###########################\n ##'.green
                     +' Running domo-ds       '
                     +'##\n ##'.green
                     +'  - Use ctrl-c to halt '
                     +'##\n ###########################\n\n'.green);




fs.access(path.join(__dirname,dlFile), fs.R_OK, (err) => {
  if(err){
    console.log('Error: No access to core files: '.red, err);
    if(path.sep == '/'){
      console.log('Please use "sudo" and try again: -> '.cyan + ' sudo domo-ds');
    }else{
      console.log('Please run the command prompt as an Administrator: -> '.cyan + ' (right-click and select "Run As Administrator")');
    }
    process.exit();
  };
  auth.login();
});


function createOutput(){

  if(!dsDone || !dfDone || !cdDone){
    return;
  };

  fs.readFile(path.join(__dirname,dlFile), (err, data) => {
    process.stdout.write('\n\n');

    if(err){
      console.log('Error reading file'.red);
      throw err;
    }
    var dsJSON = JSON.stringify(ds.getSets()).replace(/(['\\])/g,"\\$1");
    var dfJSON = df.json;
    var cdJSON = JSON.stringify(cd.kpis).replace(/(['\\])/g,"\\$1");
    var template = data.toString();

    var dte = new Date();
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    dte = dte.getDate()+'-'+months[dte.getMonth()]+'-'+dte.getFullYear();

    output = template;
    var fr = 'FFFFFFFFFF_PLACEHOLDER_FFFFFFFFFF';
    var dr = 'DDDDDDDDDD_PLACEHOLDER_DDDDDDDDDD';
    var ir = 'IIIIIIIIII_PLACEHOLDER_IIIIIIIIII';
    var sr = 'YYYYYYYYYY_PLACEHOLDER_YYYYYYYYYY';
    var cr = 'CCCCCCCCCC_PLACEHOLDER_CCCCCCCCCC';

    dsJSON = dsJSON.replace(/\$/g,'$$$$');
    dfJSON = dfJSON.replace(/\$/g,'$$$$');
    cdJSON = cdJSON.replace(/\$/g,'$$$$');

    output = output.replace(/(([QA]{4}){14})[\s\S]+?\1/g,'');

    output = output.replace(fr,dfJSON);
    output = output.replace(dr,dsJSON);
    output = output.replace(cr,cdJSON);
    output = output.replace(ir,auth.host);
    output = output.replace(sr,dte);
    outFile = auth.host + '.html';

    if(path.sep == '/'){
      var outDir = path.join(process.env.HOME,'Documents','domo-ds');
      var machine = 'mac';
    }else{
      var outDir = path.join(process.env.HOMEPATH,'Documents','domo-ds');
      var machine = 'windows';
    }

    if (!fs.existsSync(outDir)){
      var mkdir = require('mkdirp');
      mkdir.sync(outDir);
    }

    var fullPathOutput = path.join(outDir,outFile);

    fs.writeFile(fullPathOutput,output, (err) => {
      if(err){
        console.log('Error writing file: '.red + fullPathOutput);
        throw err
      };
      console.log('File Saved Successfully: '.green + fullPathOutput.gray);

      if(machine == 'mac' && loadFile){
        var child = execFile('open', [fullPathOutput], (error, stdout, stderr) => {
          if (error) {
            console.log('Error opening file'.red);
            throw error;
          }
//          console.log('Exiting');
        });
      }
    });
  });
}
