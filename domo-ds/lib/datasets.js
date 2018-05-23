var util = require('util');
var EventEmitter = require('events').EventEmitter;
var fields = ['cardInfo','columnCount','created','dataProviderType','displayType','id','lastTouched','lastUpdated','name','nextUpdate','owner','rowCount','state','status','streamId','transportType','type'];

var Datasets = function(settings){
  var ds = this;

  settings = settings || {};

  ds.sid = settings.sid || null;
  ds.host = settings.host || null;
  ds.method = 'GET';

  ds.data = {};
  ds.json = '';

  ds.sets = [];
  ds.nextSet = 0;
  ds.setCount = 0;
  ds.pageSize = 50;
  ds.pageCount = 0;
  ds.gotCount = 0;
  ds.fusionCount = 0;
  ds.fusionGotCount = 0;
}

Datasets.prototype.gotData = function(){
  var ds = this;

  ds.gotCount++;

  if(ds.gotCount == ds.pageCount && ds.fusionCount == ds.fusionGotCount){
    ds.emit('success');
  }else{
    ds.emit('progress', 'page '+ds.gotCount+' of '+ds.pageCount);
  }
};

Datasets.prototype.getSets = function(){
  var ds = this;
  if(ds.sets.length == 0){
    return {};
  }

  var all = [];
  ds.sets.forEach(function(me,idx,arr){
    all = all.concat(me.data);
  });

  all = all.map(row => {
    let tmp = [];
    fields.forEach(field => {
      if(row[field]){
        tmp.push(row[field]);
      }else{
        tmp.push('');
      };
    });
    if(row.inputDataSources){
      try{
        tmp.push(row.inputDataSources.inputDataSources.map(input => {
          return input.dataSourceId;
        }));
      }catch(e){}
    }else{
      tmp.push(false);
    }
    return tmp;
  })

  return {fields: [...fields, 'fusions'], rows: all};
}

Datasets.prototype.get = function(settings){
  var ds = this;
  settings = settings || {};

  ds.sid = settings.sid || ds.sid;
  ds.host = settings.host || ds.host;

  var d = new Dataset({sid: ds.sid, host: ds.host});
  d.on('error', function(code, msg){
    ds.emit('error',code, msg);
  });

  d.on('success', function(){
    ds.setCount = d.meta.totalCount;
    ds.pageCount = Math.floor(ds.setCount / ds.pageSize)+1;

    ds.emit('progress', 'page 0 of '+ds.pageCount);

    for(var i=0;i<ds.pageCount;i++){
      ds.sets.push(new Dataset({
        sid: ds.sid
        ,host: ds.host
        ,offset: i*ds.pageSize
        ,limit: ds.pageSize
      }));
    };

    var pageThrottleSize = 10;
    ds.nextSet = 0;

    for(var i=0;i<pageThrottleSize;i++){
      ds.getNext();
    };
  });

  ds.emit('progress', 'Getting dataset count...');

  d.get();
};

Datasets.prototype.getNext = function(){
  var ds = this;

  if(!(ds.nextSet < ds.sets.length)){
    return;
  };

  var theSet = ds.sets[ds.nextSet];
  ds.nextSet++;

  theSet.on('error', function(code, msg){
    ds.emit('error', code, msg);
  });

  theSet.on('success', function(){
    ds.getNext();
    ds.gotData();
  });

  theSet.on('fusion', function(){
    ds.fusionGotCount++;
    if(ds.gotCount == ds.pageCount && ds.fusionCount == ds.fusionGotCount){
      ds.emit('success');
    }else{
      ds.emit('fusion');
    }
  });

  theSet.on('addFusion', function(){
    ds.fusionCount++;
    ds.emit('fusion');
  });

  theSet.get();
}

var Dataset = function(settings){
  var ds = this;

  settings = settings || {};

  ds.sid = settings.sid || null;
  ds.host = settings.host || null;
  ds.method = 'GET';
  ds.offset = settings.offset || 0;
  ds.limit = settings.limit || 1;
  ds.path = '';
  ds.data = {};
  ds.json = '';
}

Dataset.prototype.get = function(settings){
  var ds = this;

  settings = settings || {};

  ds.offset = settings.offset || ds.offset;
  ds.limit = settings.limit || ds.limit;
  ds.sid = settings.sid || ds.sid;
  ds.host = settings.host || ds.host;
  ds.path = `/api/data/v3/datasources?limit=${ds.limit}&nameLike=&offset=${ds.offset}&orderBy=lastUpdated`;

  if(!ds.host || !ds.sid){
    ds.emit('error', 'ds1', `Unable to get datasets due to missing sid(${ds.sid}) or host(${ds.host})`);
  }

  var get = require('https').request({
    hostname: ds.host
    ,path: ds.path
    ,method: ds.method
    ,headers: {
      'X-DOMO-Authentication' : ds.sid
    }
  }, (res) => {
    res.setEncoding('utf8');
    var response = '';

    res.on('data', (chunk) =>{
      response = response + chunk;
    });

    res.on('end',() =>{
      if(res.statusCode != 200){
        ds.emit('error', 'ds2', `Unable to get datasets! Status ${res.statusCode}: ${res.statusMessage}\n${ds.path}`);
      }else{
        let tmp = JSON.parse(response);
        ds.meta = tmp._metaData;
        if(Array.isArray(tmp.dataSources)){

          tmp = tmp.dataSources.map(set => {
            let rec = {};
            fields.forEach(field =>{
              if(set[field]){
                rec[field] = set[field];
              }
            });
            return rec;
          });
        }else{

        };

        ds.data = tmp;
        ds.json = response.replace(/(['\\])/g,"\\$1");

        ds.getFusions();
        ds.emit('success');
      }
    });
  });

  get.end();
}

Dataset.prototype.getFusions = function(){
  var ds = this;

  ds.data.forEach(function(me){
    if(me.type == 'datafusion'){
      ds.emit('addFusion');
      ds.pullLineage(me);
    };
  });
};

Dataset.prototype.pullLineage = function(me){
  var ds = this;

  var get = require('https').request({
    hostname: ds.host
    ,path: '/api/data/ui/v1/warehouse/'+me.id+'/lineage'
    ,method: 'GET'
    ,headers: {
      'X-DOMO-Authentication' : ds.sid
    }
  }, (res) => {
    res.setEncoding('utf8');
    var response = '';

    res.on('data', (chunk) =>{
      response = response + chunk;
    });

    res.on('end',() =>{
      if(res.statusCode != 200){
        if(res.statusCode != '404'){
          ds.emit('error', 'ds3', `Unable to load fusion record: Status ${res.statusCode}: ${res.statusMessage}`);
        };
        me.inputDataSources = [];
      }else{
        me.inputDataSources = JSON.parse(response);
      };
      ds.fusionsGot++;
      ds.emit('fusion');
    });
  });

  get.end();
}


util.inherits(Dataset, EventEmitter);
util.inherits(Datasets, EventEmitter);

module.exports = {new: function(settings){return new Datasets(settings);}};
