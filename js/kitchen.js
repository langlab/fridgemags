var r = require('mersenne');
var gpw = require('./gpw');

Backbone.sync = function(method,model,options) {
	//console.log('server sync called ',method,JSON.stringify(model));
	switch (method) {
		case 'update':
			break;
	}
}

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
		this.mags = new Mags();
		this.clients = new Clients();
		this.set({config: {
			bg: {
				style: {
					
				},
				html: 'rearrange creatively',
				relSize: 0.1
			}	
		}});
		console.log(this.get('config'));
	}
	
});

var FrigView = Backbone.View.extend({
	initialize: function() {
		var th = this;
		th.el = $('#frig');
		this.magsView = new MagsView({collection: th.model.mags});
		this.clientsView = new ClientsView({collection: th.model.clients});
	},
	render: function() {
		var th = this;
		
		var config = th.model.get('config');
		console.log(config);
		th.el.css(config.bg.style);
		th.$('.title').html(config.bg.html);
		th.$('.title').css('font-size',th.el.height() * config.bg.relSize).center();
		th.magsView.render(th.el);
		th.clientsView.render(th.el);
		console.log('set the horizontal scroll');
		$(window).resize(function() {
			th.$('.title').css('font-size',th.el.height() * config.bg.relSize).center();
		});
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

var MagView = Backbone.View.extend({
	
	initialize: function() {
		 _.bindAll(this, 'remove');
		var th = this;
		th.options.parentCont = th.options.parentView.el;
		th.el = $('<div/>').addClass('mag');
		th.render();
		th.model.bind('change', function(m) {
			th.render();
		});
		th.model.bind('remove',th.remove)
		th.model.view = th;
		
		th.el.bind('mouseenter',function() {
			//console.log('binding..')
			$(window).bind('keydown',function(e) {
				var dir = (e.which == 37)?-1:1;
				window.getMe(function(me) {
					th.clientHold(me);
				});
				th.rotate(dir);
				
				//console.log('rotating');
			});
			
			$(window).bind('keyup',function(e) {
				th.clientRelease();
			});
			
		});
		
		th.el.bind('mouseout',function() {
			$(window).unbind('keydown');
			
		});
		
		
		
		th.el.bind('mousedown', function() {
			//console.log('mousedown',th.model.get('color'));
			window.getMe(function(me) {
				th.clientHold(me);
			});
		}).bind('mouseup', function() {
				th.clientRelease();
		});
		
	},
	
	render: function() {
		var th = this;
		if (!th.el.html().length) {
			var wd = th.model.get('word');
			if (wd.match(/(^data:image\/(png|jpg|jpeg|gif);base64)|(^http:\/\/.*\.(png|jpg|jpeg|gif)$)/)) {
				th.el.html('');
				$('<img/>').attr('src',wd).appendTo(th.el);
			} else if (wd.length < 50) {
				th.el.html(wd);
			}
		}	
		th.setLocSize().show();
		return th;
	},
	
	clientHold: function(c) {
		this.el.css({
			'background-color': c.get('color'),
			'color': 'white'
		});
		return this;
	},
	
	clientRelease: function() {
		this.el.css({
			'background-color':'white',
			'color': '#333'
		});
		return this;
	},
	
	setLocSize: function() {
		var th = this;
		var rtn = th.model.get('rot');

		th.el.css({
			'left': th.model.get('x') * th.options.parentCont.width(),
			'top':th.model.get('y') * th.options.parentCont.height(),
			'font-size': th.options.parentCont.height() * th.model.get('size')
		});
		
		if (th.model.get('heldBy')) {
			frig.clients.getByClientId(th.model.get('heldBy'), function(c) {
				th.clientHold(c);
			});
		} else {
			th.clientRelease();
		}
		
		th.el.css('-webkit-transform',('rotate('+th.model.get('rot')+'deg)'));
		th.el.css('-moz-transform',('rotate('+th.model.get('rot')+'deg)'));
				
		return th;
	},
	
	scatter: function() {
		var th = this;
		var px = th.model.get('x')*th.options.parentCont.width(), py = th.model.get('y')*th.options.parentCont.height();
		var cx = th.options.parentCont.width()/2, cy = th.options.parentCont.height()/2;
		var slope = (py-cy)/(px-cx);
		var newX = cx + ((px-cx)*100), newY = cy + (((px-cx)*100)*slope);
		th.el.animate({top: newY, left: newX},1000,'easeInExpo');
	},
	
	gather: function() {
		var th = this;
		th.el.animate({
			top: (th.model.get('y') * th.options.parentCont.height()), 
			left: (th.model.get('x') * th.options.parentCont.width())},
			1000
		);
	},
	
	
	rotate: function(dir) {
		var th = this;
		if (Math.abs(th.model.get('rot')+dir) < 20) {
			th.model.set({rot: (th.model.get('rot') + dir)});
			th.el.css('-webkit-transform',('rotate('+th.model.get('rot')+'deg)'));
			th.el.css('-moz-transform',('rotate('+th.model.get('rot')+'deg)'));
			th.model.save();
		}
		return th;
	},
	
	show: function() {
		var th = this;
		th.el.appendTo(th.options.parentCont).draggable({
			containment: 'parent',
			drag: function(event,ui) {
				th.model.set({
					x: (th.el.position().left/th.options.parentCont.width()),
					y: (th.el.position().top/th.options.parentCont.height())
				});
				th.model.save();
			},
			start: function(event,ui) {
				th.model.set({heldBy: now.core.clientId });
				th.model.save();
			},
			stop: function(event,ui) {
				th.model.set({heldBy: null});
				th.model.save();
			}
		});
		return th;
	},
	
	log: function() {
		// console.log(this.model.toJSON());
	}
	
});

var MagsView = Backbone.View.extend({
	initialize: function() {
		_.bindAll(this, 'addOne', 'addAll');
		var th = this;
		th.el = $('#frig');
		th.magViews = [];
		
		th.collection.bind('add',this.addOne);
		
		th.collection.bind('reset',this.addAll);
		
		$(window).resize(function() {
			th.refresh();
		});
		
		th.refresh();
				
	},
	
	render: function(parent) {
		var th = this;
		th.el.hide();
		th.scatter(function(t) {
			t.el.show();
			th.gather();
		});
		return th;
	},
	
	hide: function() {
		this.$('.mag').hide();
		return this;
	},
	
	show: function(cb) {
		this.$('.mag').show();
		if (cb) { cb(this); } else { return this; }
	},
	
	addAll: function() {
		var th = this;
		th.$('.mag').remove();
		this.magViews.length = 0;
		th.collection.forEach(function(mag,i) {
			th.addOne(mag);
		});
	},
	
	addOne: function(mag) {
		this.magViews.push(new MagView({model: mag, parentView: this}));
		return this;
	},
	
	refresh: function() {
		var th = this;
		// th.magViews.forEach(function(mV) {
		// 	mV.render();
		// });
		th.addAll();
		return this;
	},
	
	scatter: function(cb) {
		this.collection.forEach(function(m) {
			m.view.scatter();
		});
		if (cb) {cb(this);} else {return this;}
	},
	
	gather: function() {
		this.collection.forEach(function(m) {
			m.view.gather();
		});
		return this;
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
	
	connect: function(clientId,id,cb) {
		id = id || '';
		var th = this;
		var cl = th.get(id);
		if (cl) {
			cl.set({clientId: clientId}); 
		} else {
			cl = new Client({
				id: th.makeNewId(),
				clientId: clientId,
				color: this.colors[r.rand(th.colors.length)-1],
				online: true,
				lastLogon: new Date()
			});
			th.add(cl);
		}
		cb(cl);
	},
	
	disconnect: function(clientId) {
		var th = this;
		th.getByClientId(clientId,function(c) {
			if (c) {
				c.set({
					lastLogout: new Date(),
					online: false
				});
			}

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

var ClientView = Backbone.View.extend({
	
	initialize: function() {
		 _.bindAll(this, 'remove');
		var th = this;
		th.options.parentCont = th.options.parentView.el;
		
		th.el = $('<div/>').addClass('client');
		console.log(th.id);
		th.render();
		th.model.bind('change', function(m) {
			console.log('change cursor');
			th.render();
		});
		th.model.bind('remove',th.remove)
		th.model.view = th;
		
	},
	
	render: function() {
		var th = this;
		$(th.el).remove();
		th.setLocSize().show();
		return th;
	},
	
	
	setLocSize: function() {
		var th = this;
		var mouseLoc = th.model.get('mouseLoc');
		var parentHt = th.options.parentCont.height();
		var parentWd = th.options.parentCont.width();
		var lft = Math.floor((mouseLoc?mouseLoc.x:0) * parentWd) - (parentHt*0.018);
		var top = Math.floor((mouseLoc?mouseLoc.y:0) * parentHt)- (parentHt*0.018);
		// console.log('client '+th.model.get('clientId')+' @ '+lft+','+top);
		th.el.css({
			'left': lft,
			'top': top,
			'width': parentHt * 0.03,
			'height': parentHt * 0.03,
			'border-radius': parentHt * 0.03,
			'background-color': th.model.get('color')
		});
						
		return th;
	},
	
	show: function() {
		var th = this;
		th.el.appendTo(th.options.parentCont);
		return th;
	},
	
	scatter: MagView.scatter,
	gather: MagView.gather,
	
	log: function() {
		//console.log(this.model.toJSON());
	},
	
	scatter: function() {
		var th = this;
		var px = th.model.get('x'), py = th.model.get('y');
		var cx = th.options.parentCont.width()/2, cy = th.options.parentCont.height()/2;
		var slope = (py-cy)/(px-cx);
		var newX = cx + ((px-cx)*10), newY = cy + (((px-cx)*10)*slope);
		th.el.animate({top: newY, left: newX},1000,'easeInExpo');
	},
	
	gather: function() {
		var th = this;
		th.el.animate({
			top: (th.model.get('y') * th.options.parentCont.height()), 
			left: (th.model.get('x') * th.options.parentCont.width())}
		);
	}
	
});

var ClientsView = Backbone.View.extend({
	initialize: function() {
		_.bindAll(this, 'addOne', 'addAll');
		var th = this;
		th.el = $('#frig');
		th.clientViews = [];
		
		th.collection.bind('add',this.addOne);
		th.collection.bind('rem',this.removeOne);
		th.collection.bind('reset',this.addAll);
				
		$(window).resize(function() {
			th.refresh();
		});
		
		$(th.el).bind('mousemove',th.updateMouse);
		
	},
	
	
	updateMouse: function(e) {
		window.getMe(function(me) {
			var jEl = $(e.currentTarget);
			var px = jEl.offset().left, py = jEl.offset().top;
			var pw = jEl.width(), ph = jEl.height();
			me.set({mouseLoc: { x: (e.clientX - px)/pw, y: (e.clientY - py)/ph} });
			me.save();
		});
	},
	
	render: function(parent) {
		var th = this;
		//th.el.appendTo(parent||'body');
		//th.magViews.length = 0;
		return th;
	},
	
	addAll: function() {
		var th = this;
		th.$('.client').remove();
		this.clientViews.length = 0;
		th.collection.forEach(function(cl,i) {
			th.addOne(cl);
		});
	},
	
	addOne: function(cl) {
		cl.view = new ClientView({model: cl, parentView: this});
		return this;
	},
	
	removeOne: function(cl) {
		cl.view.remove();
	},
	
	refresh: function() {
		var th = this;		
		th.collection.forEach(function(c) {
			c.view.render();
		});
		return this;
	},
	
	scatter: function() {
		this.collection.forEach(function(m) {
			m.view.scatter();
		});
	},
	
	gather: function() {
		this.colletion.forEach(function(m) {
			m.view.gather();
		});
	}
	
});

var CreditsView = Backbone.View.extend({
	initialize: function() {
		var th = this;
		th.el = $('#geobot');
		$('#geobot .logo.hid').click(function() {
			th.start();
		});
	},
	start: function() {
		var th = this;
		window.frig.view.magsView.scatter();
		window.frig.view.$('.title').fadeOut();
		th.$('.logo').switchClass('hid','vis', 1500, 'easeInExpo');
		this.$('.credits').show().animate({
			'top': '20%', 'left': '40%'
		}, 1000,'easeInExpo', function() {
			th.$('audio')[0].play();
			th.$('.enjoy').hide().delay(2500).text(' enjoy.').fadeIn();
			th.$('audio')[0].addEventListener('ended',function() {
				console.log('end');
				th.$('.credits').fadeOut(2500).css({'top': '50%', 'left': '100%'});
				th.$('.logo').switchClass('vis', 'offScreen', 1500, 'easeOutExpo',function() {
					window.frig.view.magsView.gather();
					window.frig.view.$('.title').fadeIn();
					th.$('.logo').switchClass('offScreen','hid');
				});
			},false);
		});
	}
});

exports.Frig = Frig;
exports.FrigView = FrigView;
exports.Client = Client;
exports.Clients = Clients;
exports.ClientView = ClientView;
exports.ClientsView = ClientsView;
exports.Mag = Mag;
exports.Mags = Mags;
exports.MagView = MagView;
exports.MagsView = MagsView;
exports.CreditsView = CreditsView;
