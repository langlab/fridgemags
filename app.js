var sys = require("sys")
  , express = require('express')
  , nowjs = require("now")
  , port = 3000
	, fs = require('fs')
	, mongoose = require('mongoose')
	, Schema = mongoose.Schema
	, db = mongoose.connect('mongodb://localhost/frig')
	, net = require('net')
	, repl = require('repl');
 

// a repl server to check server values
connections = 0;
net.createServer(function (socket) {
  connections += 1;
  repl.start("fmag> ", socket);
}).listen("/tmp/fmags");

nj = nowjs; // expose to repl

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
	fData: {any: {}}
});

mongoose.model('frig',FrigSchema);
var frigModel = mongoose.model('frig');

var ktch = skitchen.kitchen;

frigs = {}; // a structure to hold all of the currently open frig 

clientGroups = {}; // a structure to keep track of which frig group a now clientId is in

tsup = _.extend({}, Backbone.Events); // event aggregator


Backbone.sync = function(method,model,options) {
	console.log('Server sync called ',method,model.id);
	switch (method) {
		case 'create':
			model.id = model.get('code');
			var fr = new frigModel({
				code: model.id,
				fData: model.xport()
			});
			fr.save(function(err) {
				console.log(err?'error creating':'created!!');
			});
			break;
		case 'update':
			//console.log('updating: '+model.id+' with '+JSON.stringify(model.xport()));
			frigModel.findOne({code: model.id},function(err,f) {
				f.fData = model.xport();
				f.save(function(err) {
					console.log(err?err:'success updated '+model.id);
				});
			});
			// frigModel.update({code: model.id},{$set: {data: model.xport(), last: Date.now()}});
			break;
		case 'read':
			frigModel.findOne({code: model.id},function(err,fr) {
				model.mport(fr.fData.toObject());
				console.log('fetched!!');
				tsup.trigger('frigFetchComplete');
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


// functions to call from the client side
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
	
	makeNew: function(wordArr,cb) {
		
		var code = ktch.gpw.generate(6);
		
		if (!frigs[code]) { 
			frigs[code] = new ktch.Frig({code: code});
		}
		
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
		
		cb(code);
	},
	
	saveToDB: function(code,cb) {
		frigs[code].save();
	},

	pump: function(code,configJSON) {
		
		var wordArr = [];
		
		if (!frigs[code]) { 
			frigs[code] = new ktch.Frig({code: code});
		}
		
		traverse(configJSON.words,function(k,w) { // get all of the strings out of the words structure
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
		var grp = nowjs.getGroup(code);
		//console.log('recvd mag update from client '+clientId,JSON.stringify(m));
		m.lastTouchedBy = 'server';
		//console.log('ltb changed '+JSON.stringify(m));
		frigs[code].mags.get(m.id).set(m,{silent:true});
		if (grp.exclude([clientId]).now.client) { // notify all other clients on this frig about the mag move
			grp.exclude([clientId]).now.client.updateMag(m);
		}
	},
	
	updateClient: function(c) {
		var code = clientGroups[c.clientId];
		var grp = nowjs.getGroup(code);
		//console.log('recvd client update from client '+c.clientId,JSON.stringify(c));
		frigs[code].clients.getByClientId(c.clientId,function(cl) {
			cl.set(c,{silent:true});
		});
		if (grp.exclude([c.clientId]).now.client) { // notify all other clients on this frig about the client move
			grp.exclude([c.clientId]).now.client.updateClient(c);
		}
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
			tsup.bind('frigFetchComplete',function() { // gotta wait until the fetch is done before sending it back! see the event binding at Backbone.sync read override above
				cb(frigs[code].xport());
				tsup.unbind('frigFetchComplete');
			});
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
	
	disconnectClient: function(clientId,code,cb) {
		if (frigs[code]) {
			frigs[code].clients.disconnect(clientId);
			frigs[code].save(); // when a user disconnects, save a copy of the current frig status for this code to the database
		}
		
		var grp = nowjs.getGroup(code); // find the frig group that the user was in
		grp.count(function(c) { // if there are any members left there...
			if (c) {
				grp.now.client.removeClient(clientId); // notify them that the user is gone
			} else {
				delete frigs[code]; // if there are no more users, delete the frig in  memory
				// question: would it be better to do a setTimeout instead? and clear the timeOut when someone else connects?
			}
		});

		delete clientGroups[clientId]; // make sure that the user's client group in the index array is reset to null
		cb();
	},
	
	connectClient: function(clientId,code,cb) {
		console.log('connecting client '+clientId+' to '+code);
		var th = this;
		
		var grp = nowjs.getGroup(code); // get the now group for the frig to connect to
		grp.addUser(clientId); // add the now user to the group
		
		svr.getFrig(code, function(f) {
			frigs[code].clients.connect(clientId,function(c) {
				if (grp.exclude([clientId]).now.client) {
					grp.exclude([clientId]).now.client.addClient(c);
				}
				clientGroups[clientId] = code;
				//console.log('returning '+frigs[code].xport)
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
	var grpCode = clientGroups[self.clientId];
	
	
	svr.disconnectClient(self.clientId,grpCode,function() {
		console.log(self.clientId+' just disconnected from '+grpCode);
	});
	
});
