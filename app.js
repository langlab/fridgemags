var sys = require("sys")
  , express = require('express')
  , nowjs = require("now")
  , port = 3000
	, fs = require('fs')
	, mongoose = require('mongoose')
	, Schema = mongoose.Schema
	, db = mongoose.connect('mongodb://localhost/frig');
 
// var Backbone = require('backbone');

var skitchen = require('./js/skitchen.js');

	
// express to make life easier
var app = express.createServer();
app.register('.html', require('ejs'));
app.set('views', __dirname + '/views');
app.set('view engine', 'html');
app.set('view options', {layout: false});

app.use(express.static(__dirname + '/public'));
app.use(express.static(__dirname + '/node_modules/backbone-nowjs/'));

var bundle = require('browserify')(__dirname + '/js/entry.js');
app.use(bundle);

app.get('/', function(req, res) {
  res.render('index.html');
});

app.listen(port);

var everyone = nowjs.initialize(app);

// DB Schemas

var ObjectId = Schema.ObjectId;

// Frig

var FrigSchema = new Schema({
	code: String,
	attrs: {any: {}},
	collections: {any: {}}
});

mongoose.model('frig',FrigSchema);
var frigModel = mongoose.model('frig');

var ktch = skitchen.kitchen;
var frig = new ktch.Frig();
var frigs = [];
var clientGroups = [];

Backbone.sync = function(method,model,options) {
	console.log('Server sync called ',method,JSON.stringify(model));
	switch (method) {
		case 'create':
			model.id = model.get('code');
			var fr = new frigModel({
				code: model.id,
				data: model.xport()
			});
			fr.save(function(err) {
				console.log(err?'error creating':'created!!');
			});
			break;
		case 'update':
			frigModel.findOne({code: model.id},function(err,fr) {
				fr.toObject().data = model.xport();
				fr.save(function(err) {
					console.log(err?'error updating':'updated!!');
				});
			});
			break;
		case 'read':
			frigModel.findOne({code: model.id},function(err,fr) {
				model.mport(fr.toObject().data);
				console.log('fetched!!');
			});
			break;
	}
}


traverse = function(o,func) {
    for (i in o) {
        func.apply(this,[i,o[i]]);  
        if (typeof(o[i])=="object") {
            //going on step down in the object tree!!
            traverse(o[i],func);
        }
    }
}


//console.log(JSON.stringify(frig.mags.models));

svr = {
	
	addToDB: function(code,cb) {
		var frx = frigs[code].xport();
		var f = new frigModel({
			code: code,
			data: frx
		});
		console.log(f);
		f.save(function(resp) {
			console.log('sav resp: '+resp);
			cb(resp);
		});
	},
	
	saveToDB: function(code,cb) {
		frigs[code].save();
	},

	pump: function(code,configJSON) {
		
		var wordArr = [];
		
		if (!frigs[code]) { 
			frigs[code] = new ktch.Frig({code: code});
		}
		
		traverse(configJSON.words,function(k,w) {
			if (_.isString(w)) {
				wordArr.push(w);
			}
		});
		
		frigs[code].mags.reset();
		wordArr.forEach(function(w) {
			var m = w.match(/^([a-zA-Z\?\.\$!]*)([0-9])$/);
			if (m) {
				for (i=0;i<m[2];i++) {
					frigs[code].mags.addWord(m[1]);
				}
			} else {
				frigs[code].mags.addWord(w);
			}
		});
	},
	
	load: function(code,cb) {
		frig.load(code,cb);
	},
	
	add: function(clientId,m) {
		if (this.mags) { this.mags.push(m); } else { this.mags = [m]};
		//console.log('recvd add from client '+JSON.stringify(m));
		//everyone.exclude([clientId]).now.cmags.add(m);
	},
	
	updateConfig: function(cfig) {
		frig.set({config: cfig},{silent:true});
	},
	
	
	updateMag: function(clientId,m) {
		var code = clientGroups[clientId];
		//console.log('recvd mag update from client '+clientId,JSON.stringify(m));
		m.lastTouchedBy = 'server';
		//console.log('ltb changed '+JSON.stringify(m));
		frigs[code].mags.get(m.id).set(m,{silent:true});
		everyone.exclude([clientId]).now.client.updateMag(m);
	},
	
	updateClient: function(c) {
		var code = clientGroups[c.clientId];
		//console.log('recvd client update from client '+c.clientId,JSON.stringify(c));
		frigs[code].clients.getByClientId(c.clientId,function(cl) {
			cl.set(c,{silent:true});
		});
		everyone.exclude([c.clientId]).now.client.updateClient(c);
	},
	
	saveAll: function(clientId,mags) {
		this.mags = mags;
	},
	
	getSFrig: function(code,cb) {
		cb(frigs[code].xport());
	},
	
	getFrig: function(code,cb) {
		if (typeof(frigs[code]) == 'undefined') {
			console.log('having to get fridge from db...'+code);
			frigs[code] = new ktch.Frig();
			frigs[code].id = code;
			frigs[code].fetch();
			cb(frigs[code].xport());
		} else {
			cb(frigs[code].xport());
		}
	},
	
	getMags: function(clientId, cb) {
		//console.log((this.user)?this.user.clientId:'none');
		cb(frig.mags.toJSON());
	},
	
	getClients: function(clientId, cb) {
		frig.clients.getAllOnline(clientId,function(cls) {
			cb(cls.toJSON());
		});
	},
	
	connectClient: function(clientId,code,cb) {
		var th = this;
		var grp = nowjs.getGroup(code);
		grp.addUser(clientId);
		clientGroups[clientId] = code;
		svr.getFrig(code, function(f) {
			frigs[code].clients.connect(clientId,function(c) {
				if (grp.exclude([clientId]).now.client) {
					grp.exclude([clientId]).now.client.addClient(c);
				}
				cb(c,frigs[code].xport());
			});
			
		});
	}
	
};

everyone.now.server = svr;

nowjs.on('connect',function() {
	console.log(this.user.clientId+' just connected');
});

nowjs.on('disconnect',function() {
	var self = this.user;
	console.log(self.clientId+' just disconnected');
	var grpCode = clientGroups[self.clientId];
	if (frigs[grpCode]) {
		frigs[grpCode].clients.disconnect(self.clientId);
		frigs[grpCode].save();
	}
	var grp = nowjs.getGroup(grpCode);
	grp.count(function(c) {
		if (c) {
			grp.now.client.removeClient(self.clientId);
		}
	});
});
