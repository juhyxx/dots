Ext.define('dots.view.canvas.Queue', {

	extend: 'Ext.Base',

	mixins: {
		observable: 'Ext.util.Observable'
	},

	_queue: [],

	_pointer: 0,

	width: 500,

	constructor: function(config) {
		this.mixins.observable.constructor.call(this, config);
		this.addEvents('end');
	},

	addItem: function(entity) {
		if (Ext.isArray(entity)) {
			Ext.each(entity, this._add, this)
		} else {
			this._add(entity);
		}
	},

	_add: function(entity) {
		this._queue.push(entity);
		entity.addListener('end', this.onEnd, this);
	},

	onEnd: function(entity) {
		this._pointer = this._queue.indexOf(entity) + 1;
		this.fireEvent('end', entity.pitch + 2);
	},

	getFirst: function() {
		var len = this._queue.length;
		this._queue[this._pointer];
	},

	draw: function(context) {
		this.background.draw(context);
		for (var i = this._pointer; i < this._queue.length; i++) {
			this._queue[i].draw(context);
		}
	},

	animate: function(context) {
		var width = this.width,
			me = this;

		context.clearRect(0, 0, width, 500);
		this.draw(context);

		window.requestAnimFrame(function() {
			me.animate.call(me, context);
		});
	},
});