var path = require('path')
const syncDirectory = require('./sync-directory')

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
	syncDirectory(sourceResolved, destinationResolved, {
		exclude: options.ignore,
	})
}
