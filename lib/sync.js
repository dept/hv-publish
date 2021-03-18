var fs = require('fs')
var path = require('path')

module.exports = sync

const defaultOptions = {
	ignore: [],
}

function sync(source, destination, options = {}) {
	options = Object.assign({}, defaultOptions, options)
	require('sync-directory')(path.resolve(source), path.resolve(destination), {
		exclude: options.ignore,
	})
}
