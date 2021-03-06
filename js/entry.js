window.debug = true;
window.lg = function (str) {
	if (window.debug == true) {
		console.log(str);
	}
}

window.baseUrl = 'http://localhost:3000';

window.kitchen = require('./kitchen');
window.views = require('./views');

//event aggregator to allow views to communicate, aka "what's up?"
window.tsup = _.extend({}, Backbone.Events); 

window.getMe = function(cb) { // function to quickly get my client object
	window.frig.clients.getByClientId(now.core.clientId, cb);
}

// overriding the CRUD sync methods for client side objects in order to use nowjs
Backbone.sync = function(method,model,options) {
	switch (model.modelType) {
		case 'mag':
			//console.log('client-side syncing mag info')
			switch (method) {
				case 'read':
					//console.log('fetching mags from the server..');
					now.server.getMags(now.core.clientId,function(mgs) { 
						//console.log('recved mags ',mgs)
						frig.mags.reset();
						frig.mags.add(mgs);
					});
					break;
				case 'update':
					//console.log('sending updated mag to the server ',model.attributes);
					now.server.updateMag(now.core.clientId, model.attributes, function() {

					});
					break;
			};
			break
		case 'client':
			//console.log('client-side syncing client info');
			switch (method) {
				case 'read':
					now.server.getClients(now.core.clientId,function(cls) { 
						//console.log('recved mags ',cls)
						frig.clients.reset();
						frig.clients.add(cls);
					});
				break;
				case 'update':
					//console.log('sending updated client to the server ',model.attributes);
					now.server.updateClient(model.attributes, function() {
						
					});
				break;
			}
			break;
		case 'frig':
			switch (method) {
				case 'read':
					now.server.getLatest(function(f) {
						window.frig = f;
					});
					break;
			}
			
	};
	//console.log('client sync called',method,model);
};

var Router = Backbone.Router.extend({
	
	routes: {
		'go/:code': 'go',
		'make':'make'
	},
	
	make: function() {
		window.makeView = new views.MakeView({tsup: tsup});
		window.makeView.render();
	},
	
	go: function(code) {
		
		console.log('doing route: '+code);
		window.tsup.trigger('closeAll');
		
		// delete window.localStorage['fS'+code]; // <- for testing intro window only
		
		if (!window.localStorage['fS'+code]) { // if client has not previously visited this page
			var introView = new views.IntroView({tsup: tsup});
			introView.render();
		}
		
		now.server.connectClient(now.core.clientId,code,function(newClient,updatedFrig) {
			console.log('frig from server: ',updatedFrig);
			window.frig = new kitchen.Frig({tsup: tsup});
			window.frig.mport(updatedFrig);
			window.client = newClient;
			window.localStorage['fS'+code] = now.core.clientId;

			window.getMe(function(me) {
				window.me = me;
			});
			
			window.frig.view = new views.FrigView({model: window.frig, tsup: tsup});
			window.frig.view.render();
			window.creditsView = new views.CreditsView({tsup: tsup});
		});
		
	}
});

window.loadFromFile = function(code,file) {
	$.getJSON(file, function(words) {
		window.words = words;
		now.server.pump(code,words);
	});
}

$(function() { //jQuery load

	if ($.browser.msie) { // if bad browser, redirect
		document.location.href = 'bad.html';
	}
	
	now.ready(function(){
		
		window.router = new Router();
		
		Backbone.history.start()
	  		
	
		now.client = {
			
			loadConfig: function(cfig) {
				window.set({config: cfig},{silent:true});
				window.frig.view.render();
			},
			
			updateClient: function(c) {
				//console.log('recvd clients update from the server...',c);
				var client = window.frig.clients.get(c.id);
				client.set(c,{silent:true});
				$(client.view.el).remove();
				client.view.render();
			},
			
			updateMag: function(m) {
				console.log('recvd update from the server... ',m);
				var mag = window.frig.mags.get(m.id);
				mag.set(m,{silent:true});
				$(mag.view.el).remove();
				mag.view.render();
			},
			
			addClient: function(c) {
				console.log('recvd new client from server...',c);
				var cl = new kitchen.Client(c);
				window.frig.clients.add(cl);
				cl.view.render();
			},
			
			removeClient: function(cid) {
				console.log('CLIENT LOGOFF from server...',cid)
				window.frig.clients.getByClientId(cid,function(cl) {
					cl.view.el.hide('explode').remove();
					window.frig.clients.remove(cl);
				});
			}
		}
	
	});
	
	
	
});

jQuery.fn.center = function () {
    this.css("position","absolute");
    this.css("top", (($(window).height() - this.outerHeight()) / 2) + $(window).scrollTop() + "px");
    this.css("left", (($(window).width() - this.outerWidth()) / 2) + $(window).scrollLeft() + "px");
    return this;
}