Ext.define('dots.view.canvas.Lines', {

	extend: 'dots.view.canvas.Entity',

	config: {
		offset: 20
	},

	draw: function(context) {
		var y;

		for (i = 0; i < 5; i++) {
			context.beginPath();
			y = 4 * this.offset + i * this.offset;
			context.moveTo(0, y);
			context.lineTo(500, y);
			context.closePath();
			context.strokeStyle = 'black';
			context.stroke();
		}
	}
});