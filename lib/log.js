const Color = require('ansi-colors')

module.exports = function log(msg, color = null) {
	if (color) {
		console.log(Color[color](msg))
	} else {
		console.log(msg)
	}
}
