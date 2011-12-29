var r = require('mersenne');
var gpw = require('./gpw');



var BModel = Backbone.Model.extend({
  // builds and return a simple object ready to be JSON stringified
  xport: function (opt) {
    var result = {},
      settings = _({
        recurse: true
      }).extend(opt || {});


    function process(targetObj, source) {
      targetObj.id = source.id || null;
      targetObj.cid = source.cid || null;
      targetObj.attrs = source.toJSON();
      _.each(source, function (value, key) {
        // since models store a reference to their collection
        // we need to make sure we don't create a circular refrence
        if (settings.recurse) {
          if (key !== 'collection' && source[key] instanceof Backbone.Collection) {
            targetObj.collections = targetObj.collections || {};
            targetObj.collections[key] = {};
            targetObj.collections[key].models = [];
            targetObj.collections[key].id = source[key].id || null;
            _.each(source[key].models, function (value, index) {
              process(targetObj.collections[key].models[index] = {}, value);
            });
          } else if (source[key] instanceof Backbone.Model) {
            targetObj.models = targetObj.models || {};
            process(targetObj.models[key] = {}, value);
          }
        }
      });
    }



    process(result, this);



    return result;
  },



  // rebuild the nested objects/collections from data created by the xport method
  mport: function (data, silent) {
    function process(targetObj, data) {
      targetObj.id = data.id || null;
      targetObj.set(data.attrs, {silent: silent});
      // loop through each collection
      if (data.collections) {
        _.each(data.collections, function (collection, name) {
          targetObj[name].id = collection.id;
          collection.models[collection.id] = targetObj[name];
          _.each(collection.models, function (modelData, index) {
            var newObj = targetObj[name]._add({}, {silent: silent});
            process(newObj, modelData);
          });
        });
      }



      if (data.models) {
        _.each(data.models, function (modelData, name) {
          process(targetObj[name], modelData);
        });
      }
    }



    process(this, data);



    return this;
  }
});

var Frigs = Backbone.Collection.extend({
	model: Frig
});

var Frig = BModel.extend({
// code: url chunk to retrieve the frig
// mags: collection of magnets on the frig
// clients: collection of clients that have ever connected
	
	initialize: function() {
		// if (typeof(this._id) !== 'undefined') {
		// 	this.id = this._id;
		// 	this.set({id: this_id});
		// }
		
		// if (typeof(this.get('code') == 'undefined')) {
		// 	this.set({code: this.options.code});
		// }
		
		if (typeof(this.get('config') == 'undefined')) {
			this.set({config: {
				bg: {
					style: {

					},
					html: 'rearrange creatively',
					relSize: 0.1
				},
				clients: {
					colors: ['#9C0','#639','#69C','#FF6FCF','#FF8000','#800040','#800040','#191919','#699']
				}
			}});
		}
		
		this.mags = new Mags();
		this.clients = new Clients();
	}
	
});

var Mag = BModel.extend({
	modelType: 'mag',
	
	initialize: function() {
		var th = this;
		this.attributes.size = 0.03;
		if (typeof(this.id) == 'undefined') this.id = ''+Date.now()+r.rand(100)+gpw.generate(4);
		this.set({id: this.id});
		if (typeof(th.get('x')) == 'undefined') {
			th.set({x: r.rand(100)/100, y: r.rand(100)/100, rot: r.rand(5)-2});
		}
	}
});

var Mags = Backbone.Collection.extend({
	model: Mag,
	modelType: 'mag',
	
	initialize: function() {
		
		this.bind('add',function(m) {
			m.set({'cid': m.cid});
			//now.mags.add(now.core.clientId,m);
		});
		
		this.bind('change',function(m) {
				//m.save();
		});
		
	},
	addWord: function(wd) {
		this.add({word: wd});
	},
	
	clearAll: function() {
		this.models.forEach(function(m) {
			m.remove()
		});
	}

});

var Client = BModel.extend({
	modelType: 'client'
});

var Clients = Backbone.Collection.extend({
	model: Client,
	modelType: 'client',
	initialize: function() {
		this.colors = ['#9C0','#639','#69C','#FF6FCF','#FF8000','#800040','#800040','#191919','#699'];
	},
	
	connect: function(clientId,cb) {
		var th = this;
		cl = new Client({
			id: th.makeNewId(),
			clientId: clientId,
			color: this.colors[r.rand(th.colors.length)-1],
			online: true,
			lastLogon: new Date()
		});
		th.add(cl);
		cb(cl);
	},
	
	disconnect: function(clientId) {
		var th = this;
		th.getByClientId(clientId,function(c) {
			th.remove(c);
		});
	},
	
	makeNewId: function() {
		return gpw.generate(6);
	},
	
	getByClientId: function(clientId,cb) {
		cb(this.find(function(c) {
			return (c.get('clientId') == clientId);
		}));
	},
	
	getAllOnline: function(clientId,cb) {
		cb(this.filter(function(c) {
			return (c.get('online'));
		}));
	}
	
});

exports.Frig = Frig;
exports.Client = Client;
exports.Clients = Clients;
exports.Mag = Mag;
exports.Mags = Mags;

