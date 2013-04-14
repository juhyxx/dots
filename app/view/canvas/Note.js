Ext.define('dots.view.canvas.Note', {

	extend: 'dots.view.canvas.Entity',

	config: {
		radius: 10,
		offset: 20
	},

	pitch: 0,

	draw: function(context) {
		this.x--;
		if (this.x < 0) {
			this.fireEvent('end', this);
		}
		var r = this.radius,
			x = this.x,
			y = 11 * this.offset + this.offset / 2 - (this.pitch * this.offset / 2);

		context.save();
		context.scale(1, 0.8);

		context.beginPath();
		context.arc(x, y * 1 / 0.8, r + 0.5, 0, 2 * Math.PI, false);
		context.fillStyle = 'rgba(200, 200, 200,' + (x / 100) + ')';
		context.closePath();
		context.fill();

		context.beginPath();
		context.arc(x, y * 1 / 0.8, r, 0, 2 * Math.PI, false);
		context.fillStyle = 'rgba(0, 0, 0,' + (x / 100) + ')';
		context.closePath();
		context.fill();

		context.restore();

		context.beginPath();
		context.strokeStyle = 'rgba(0, 0, 0,' + (x) / 100 + ')';

		if ([0, 1, 2, 3, 4, 5].indexOf(this.pitch) > -1) {

			this.drawLine(context, x, 9 * this.offset);

			if ([0, 1, 2, 3].indexOf(this.pitch) > -1) {
				this.drawLine(context, x, 10 * this.offset);
				if ([0, 1].indexOf(this.pitch) > -1) {
					this.drawLine(context, x, 11 * this.offset);
				}
			}
		}

		if ([17, 18, 19, 20, 21, 22].indexOf(this.pitch) > -1) {
			this.drawLine(context, x, 3 * this.offset);
			if ([19, 20, 21, 22].indexOf(this.pitch) > -1) {
				this.drawLine(context, x, 2 * this.offset);
			}
			if ([21, 22].indexOf(this.pitch) > -1) {
				this.drawLine(context, x, this.offset);
			}
		}

		context.closePath();
		context.stroke();

	}
});