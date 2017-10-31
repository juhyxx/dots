module.exports = {
	files: {
		javascripts: {
			joinTo: {
				'vendor.js': /node_modules/,
				'app.js': /^app/,
				'goertzel.js': /node_modules\/geortzeljs\/build\/geortzel\.js/
			}

		},
		stylesheets: {
			joinTo: 'app.css'
		}
	},

	plugins: {
		babel: {
			presets: ['es2015']
		}
	},
	npm: {

		globals: {
			Goertzel: 'goertzeljs'
		}
	}
};
