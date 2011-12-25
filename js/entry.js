console.log('entry');
window.kitchen = require('./kitchen');

var Session = Backbone.Router.extend({
	initialize: function() {
		
	}
});

var Router = Backbone.Router.extend({
	routes: {
		'': 'default'
	}
});

window.loadFromFile = function(file) {
	$.getJSON(file, function(words) {
		window.words = words;
		now.server.pump(words);
	});
}

$(function() { //jQuery load
	
	
	//console.log($.browser);	
	
	if ($.browser.msie) {
		document.location.href = 'bad.html';
	}
	
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
		};
		//console.log('client sync called',method,model);
	};
	
	now.ready(function(){
		
		window.router = new Router();
	  window.session = new Session();
	
		window.localStorage.frigInfo = JSON.stringify({
			lastClientId: now.core.clientId
		});
		
		now.server.connectClient(now.core.clientId,'fam',function(c) {
			
			
			window.frig = new kitchen.Frig();
			
			
			now.server.load('xxx',function(res) { // load a particular frig from the server
				
				console.log(res);
				
				
				
				window.frig.mags.fetch();
				window.frig.clients.fetch();
				
				window.getMe = function(cb) { // function to quickly get my client object
					window.frig.clients.getByClientId(now.core.clientId, cb);
				}

				window.getMe(function(me) {
					window.me = me;
				});//console.log

				window.frig.view = new kitchen.FrigView({model: window.frig});
				window.frig.view.render();

				//console.log(window.frig.clients);
				//window.frig.cview = new kitchen.ClientsView({collection: window.frig.clients});

				window.frig.attributes.config.bg.style = {
					position: 'fixed',
					top: '0px',
					bottom: '0px',
					left: '0px',
					right: '0px',
					'background-image': 'url("/images/bg.png")',
					opacity: '0.5',
					'-moz-user-select': 'none',
					'-webkit-user-select': 'none'
				}

				window.credits = new kitchen.CreditsView();
				
				
			}); // end frig server load block
			
			
		});
	
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
				//console.log('recvd update from the server... ',m);
				var mag = window.frig.mags.get(m.id);
				mag.set(m,{silent:true});
				$(mag.view.el).remove();
				mag.view.render();
			},
			
			addClient: function(c) {
				//console.log('recvd new client from server...',c);
				var cl = new kitchen.Client(c);
				window.frig.clients.add(cl);
				cl.view.render();
			},
			
			removeClient: function(cid) {
				//console.log('CLIENT LOGOFF from server...',cid)
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