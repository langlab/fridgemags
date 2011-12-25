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
	config: [{any: {}}],
	initialMags: [{any: {}}],
	history: [{any: {}}],
	mags: [{any: {}}],
	clients: [{any: {}}]
});

mongoose.model('frig',FrigSchema);
var frigModel = mongoose.model('frig');

var ktch = skitchen.kitchen;
var frig = new ktch.Frig();

frig.save = function() {
	console.log('saving frig');
	// frigModel.findOne({code: this.get('code')})
}

frig.load = function(code,cb) {
	console.log('loading frig '+code);
	cb('loading frig '+code);
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

everyone.now.server = {
	
	saveNew: function(f,cb) {
		var f = new frigModel({
			code: code, 
			config: frig.get('config'),
			initialMags: frig.mags.toJSON(),
			mags: frig.mags.toJSON(),
			clients: frig.clients.toJSON()
		});
		console.log(f);
		f.save(function(resp) {
			console.log('sav resp: '+resp);
			cb(resp);
		});
	},

	pump: function(configJSON) {
		
		var wordArr = [];
		
		traverse(configJSON.words,function(k,w) {
			if (_.isString(w)) {
				wordArr.push(w);
			}
		});
		
		frig.mags.reset();
		wordArr.forEach(function(w) {
			var m = w.match(/^([a-zA-Z\?\.\$!]*)([0-9])$/);
			if (m) {
				for (i=0;i<m[2];i++) {
					frig.mags.addWord(m[1]);
				}
			} else {
				frig.mags.addWord(w);
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
		//console.log('recvd mag update from client '+clientId,JSON.stringify(m));
		m.lastTouchedBy = 'server';
		//console.log('ltb changed '+JSON.stringify(m));
		frig.mags.get(m.id).set(m,{silent:true});
		frig.save();
		everyone.exclude([clientId]).now.client.updateMag(m);
	},
	
	updateClient: function(c) {
		//console.log('recvd client update from client '+c.clientId,JSON.stringify(c));
		frig.clients.getByClientId(c.clientId,function(cl) {
			cl.set(c,{silent:true});
		});
		frig.save();
		everyone.exclude([c.clientId]).now.client.updateClient(c);
	},
	
	saveAll: function(clientId,mags) {
		this.mags = mags;
	},
	
	getLatest: function(clientId,cb) {
		cb(frig.xport());
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
	
	connectClient: function(clientId,id,cb) {
		//console.log('trying to connect '+clientId);
		frig.clients.connect(clientId,id,function(c) {
			everyone.exclude([clientId]).now.client.addClient(c);
			cb(c.toJSON());
		});
	}
	
};

nowjs.on('disconnect',function() {
	frig.clients.disconnect(this.user.clientId);
	frig.save();
	everyone.exclude([this.user.clientId]).now.client.removeClient(this.user.clientId);
});
