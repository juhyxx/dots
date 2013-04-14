Ext.define('dots.view.NoteView', {

	extend: 'Ext.Component',

	xtype: 'noteview',

	title: 'NoteView',

	cls: 'NoteView',

	autoEl: {
		tag: 'canvas',
		width: 500,
		height: 500
	},

	width: 500,

	config: {
		offset: 20
	},

	_queue: undefined,

	requires: [
		'dots.view.canvas.Queue',
		'dots.view.canvas.Note',
		'dots.view.canvas.Lines'],

	initComponent: function() {
		this.callParent();

		window.requestAnimFrame = (function(callback) {
			return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || function(callback) {
				window.setTimeout(callback, 1000 / 60);
			};
		})();
		this.addEvents('noteFall');
		this.on({
			scope: this,
			afterrender: this.prepareAnimation
		});
	},

	prepareAnimation: function(component) {
		var canvas = this.el.dom,
			context = canvas.getContext("2d"),
			width = this.getWidth();
			
		context.webkitImageSmoothingEnabled = true;
		this._queue = Ext.create('dots.view.canvas.Queue', {
			background: Ext.create('dots.view.canvas.Lines', {
				offset: this.offset
			}),
			listeners: {
				end: function(index) {
					//console.log(index)
				}
			}
		});

		this._queue.animate(context);
	},

	showNote: function(note) {
		var width = this.getWidth();

		this._queue.addItem(Ext.create('dots.view.canvas.Note', {
			offset: this.offset,
			x: width - 50,
			pitch: note - 2
		}));
	}
});