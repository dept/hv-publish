var fs = require('fs')
var path = require('path')

module.exports = sync

const defaultOptions = {
	ignore: [],
}

function sync(source, destination, options = {}) {
	options = Object.assign({}, defaultOptions, options)
	const sourceResolved = path.resolve(source)
	const destinationResolved = path.resolve(destination)
	console.log(`Syncing directories:
	from: ${sourceResolved}
	to: ${destinationResolved}
	ignoring: ${options.ignore.join(', ')}
`)
	require('sync-directory')(sourceResolved, destinationResolved, {
		exclude: options.ignore,
	})
}
