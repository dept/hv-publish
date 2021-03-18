const log = require('./log')

module.exports = function exec(cmd) {
	return new Promise((resolve, reject) => {
		log(addSpaceToBeginning(trimLines(cmd)).replace(' ', '►'), 'gray')
		require('child_process').exec(cmd, (error, stdout, stderr) => {
			if (error) {
				log(addSpaceToBeginning(stderr), 'red')
				reject(error, stderr)
			} else {
				log(addSpaceToBeginning(stdout), 'green')
				resolve(stdout)
			}
		})
	})
}

function addSpaceToBeginning(str) {
	return str.replace(/^/gm, '   ')
}

function trimLines(str) {
	return str.replace(/^\s+/gm, '')
}
