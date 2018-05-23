var util = require('util');
var EventEmitter = require('events').EventEmitter;

var Cards = function(settings){
  var c = this;

  settings = settings || {};

  c.sid = settings.sid || null;
  c.host = settings.host || null;
  c.method = 'GET';

  c.data = {};
  c.kpis = [];
  c.urnList = [];
  c.limit = 400;
  c.page = 0;
  c.timeout = null;
}

Cards.prototype.getFullList = function(settings){
  var c = this;
  settings = settings || {};

  c.sid = settings.sid || c.sid;
  c.host = settings.host || c.host;

  if(!c.host || !c.sid){
    c.emit('error', 'c1', `Unable to get cards due to missing sid(${c.sid}) or host(${c.host})`);
  }

  var get = require('https').request({
    hostname: c.host
    ,path: '/access/kpilist'
    ,method: c.method
    ,headers: {
      'X-DOMO-Authentication' : c.sid
    }
  }, (res) => {
    res.setEncoding('utf8');
    var response = '';

    res.on('data', (chunk) =>{
      response += chunk;
    });

    res.on('end',() =>{
      if(res.statusCode != 200){
        c.emit('error', 'c2', `Unable to get cards! Status ${res.statusCode}: ${res.statusMessage}`)
      }else{
        c.data = JSON.parse(response);
        for(var i in c.data){
          let kpi = c.data[i];
          c.data[i] = {
            creatorUserId: kpi.creatorUserId
            ,dataUpdated: kpi.dataUpdated
            ,description: kpi.description
            ,kpiId: kpi.kpiId
            ,kpiTitle: kpi.kpiTitle
            ,calendar: kpi.kpiMetaData.calendar
            ,chartType: kpi.kpiMetaData.chartType
            ,dataType: kpi.kpiMetaData.dataType
          }
          c.urnList.push(i+'');
          c.kpis.push(c.data[i]);

        };

        c.throttleCards();
      }
    });
  });

  get.end();

  //        https://videotraining.domo.com/access/kpilist
  // use the key, or kpiId (match) for each object to create a list to submit ot the urns path below
};

Cards.prototype.throttleCards = function(){
  var c = this;

  var start = c.page*c.limit;
  var end = start+c.limit;
  var dots = '.  ';
  if(c.page > 4){
    // process.exit();
  }
  var urns = c.urnList.slice(start,end).join();
  c.page++;

  if(urns.length > 0){
    if(c.timeout){clearInterval(c.timeout);};

    c.emit('progress', `${dots}Requesting ${start}-${end} of ${c.kpis.length}`);
    c.getURNDetails({urns});
    c.timeout = setInterval(function(){
      switch(dots){
        case '.  ':
          dots = '.. ';
          break;
        case '.. ':
          dots = '...';
          break;
        case '...':
          dots = ' ..';
          break;
        case ' ..':
          dots = '  .';
          break;
        case '  .':
          dots = '   ';
          break;
        case '   ':
          dots = '.  ';
      }
      c.emit('progress', `${dots}Requesting ${start}-${end} of ${c.kpis.length}`);
    },200);
  }else{
    if(c.timeout){clearInterval(c.timeout);};
    let fields = ['calendar','chartType', 'creatorUserId', 'dataType', 'dataUpdated', 'dataset', 'description', 'kpiId', 'kpiTitle', 'pages'];
    c.kpis = c.kpis.map(kpi => {
      let tmp = [];
      fields.forEach(field => {
        if(kpi[field]){
          tmp.push(kpi[field]);
        }else{
          tmp.push('');
        }
      })
      return tmp;
    });
    c.kpis = {
      fields: fields
      ,rows: c.kpis
    }
    c.emit('success');
  };

};

Cards.prototype.getURNDetails = function(settings){
  var c = this;
  settings = settings || {};

  c.sid = settings.sid || c.sid;
  c.host = settings.host || c.host;
  var urns = settings.urns || '';

  if(!c.host || !c.sid){
    c.emit('error', 'c3', `Unable to get urns due to missing sid(${c.sid}) or host(${c.host})`);
  }

  // available parts: owner,properties,problems,metadata,metadataOverrides,library,subscriptions,domoapp,formulas,masonData,adminAllPages
  var parts = 'subscriptions,adminAllPages'; //,formulas';

  var get = require('https').request({
    hostname: c.host
    ,path: `/api/content/v1/cards?urns=${urns}&parts=${parts}`
    ,method: c.method
    ,headers: {
      'X-DOMO-Authentication' : c.sid
    }
  }, (res) => {
    res.setEncoding('utf8');
    var response = '';

    res.on('data', (chunk) =>{
      response += chunk+'';
      chunk = '';
    });

    res.on('end',() =>{
      if(res.statusCode != 200){
        c.emit('error', 'c4', `Unable to get cards! Status ${res.statusCode}: ${res.statusMessage}`)
      }else{
        var data = JSON.parse(response);
        // console.log('data length', data.length);

        data.forEach(function(me,idx,arr){
          // if(me.formulas.formulas){
          //   c.data[me.urn+''].formulas = JSON.parse(JSON.stringify(me.formulas.formulas));
          // };
          if(me.adminAllPages){
            c.data[me.urn+''].pages = JSON.parse(JSON.stringify(me.adminAllPages.map(page=>{
              return page.pageId;
            })));
          }
          if(me.subscriptions){
            c.data[me.urn+''].dataset = me.subscriptions.map(card => {
              return card.dataSourceId;
            })[0]+'';
          };
        });
//        data = null;
//        response = null;
//        res = null;
//        get = null;
        c.throttleCards();
      };
    });
  });

  get.end();


}

util.inherits(Cards, EventEmitter);

module.exports = {new: function(settings){return new Cards(settings);}};
