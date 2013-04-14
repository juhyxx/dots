Ext.define('dots.view.canvas.Entity', {

	extend: 'Ext.Base',

	mixins: {
		observable: 'Ext.util.Observable'
	},

	constructor: function(config) {
		this.mixins.observable.constructor.call(this, config);
		this.addEvents('end');
	},

	drawLine: function(context, x, y) {
		context.beginPath();
		context.moveTo(x - 20, y);
		context.lineTo(x + 20, y);
		context.closePath();
	},

	draw: Ext.emptyFn
});