var util = require('util');
var EventEmitter = require('events').EventEmitter;

var dataflows = function(settings){
  var df = this;

  settings = settings || {};

  df.sid = settings.sid || null;
  df.host = settings.host || null;
  df.path = '/api/dataprocessing/v2/dataflows?limit=9999&offset=0&orderBy=lastRun&type=MYSQL,REDSHIFT,ETL,SPARK';
  df.method = 'GET';
  // endpoint to get execution history, not built out, not really useful
  // https://misys.domo.com/api/dataprocessing/v1/dataflows/215/executions?limit=100&offset=0
  df.data = {};
  df.json = '';

}

dataflows.prototype.get = function(settings){
  var df = this;
  settings = settings || {};
  var hist = settings.history === true;

  df.sid = settings.sid || df.sid;
  df.host = settings.host || df.host;

  if(!df.host || !df.sid){
    df.emit('error', 'df1', `Unable to get dataflows due to missing sid(${df.sid}) or host(${df.host})`);
  }

  var get = require('https').request({
    hostname: df.host
    ,path: df.path
    ,method: df.method
    ,headers: {
      'X-DOMO-Authentication' : df.sid
    }
  }, (res) => {
    res.setEncoding('utf8');
    var response = '';

    res.on('data', (chunk) =>{
      response += chunk;
    });

    res.on('end',() =>{
      if(res.statusCode != 200){
        df.emit('error', 'df2', `Unable to get Dataflows! Status ${res.statusCode}: ${res.statusMessage}`)
      }else{

        let tmp = JSON.parse(response);
        var fields = ['created','databaseType','description','enabled','executionCount','executionSuccessCount','id','inputs','lastExecution','modified','name','numInputs','numOutputs','outputs','responsibleUserId','runState'];
        if(Array.isArray(tmp.onboardFlows)){

          tmp = tmp.onboardFlows.map(flow=>{
            let rec = [];

            if(flow.lastExecution){
              let t = flow.lastExecution;
              let {beginTime, lastUpdated} = t;
              flow.lastExecution = {
                beginTime:beginTime
                ,lastUpdated:lastUpdated
              }
            }
            if(flow.inputs){
              flow.inputs = flow.inputs.map(ds => {
                return {id: ds.dataSourceId, trigger: ds.executeFlowWhenUpdated}
              })
            };
            if(flow.outputs){
              flow.outputs = flow.outputs.map(ds => {
                return {id: ds.dataSourceId};
              })
            };
            fields.forEach(field =>{

              if(flow[field]){
                rec.push(flow[field]);
              }else{
                rec.push('')
              }
            });
            return rec;
          });
        };
        df.data = {fields: fields, rows: tmp};
        df.json = JSON.stringify(df.data ).replace(/(['\\])/g,"\\$1");
        if(hist){
          //console.log('Dataflows Data', df.data.rows[0]);
          process.exit();
        }else{
          df.emit('success');
        }
      }
    });
  });

  get.end();
}

util.inherits(dataflows, EventEmitter);

module.exports = {new: function(settings){return new dataflows(settings);}};
