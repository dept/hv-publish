const exec = require('./exec')

module.exports = async function getCommitInfo(commit, branch) {
	// TODO: JSON is invalid when subject contains double quote – let's save as simple lines and read from there
	const DELIMITER = '--*--'
	const cmd = `git log --pretty=format:'%H${DELIMITER}%s${DELIMITER}%aI${DELIMITER}%aN${DELIMITER}%aE' -n 1 ${commit}`
	const output = await exec(cmd)
	console.log(output)
	const outputItems = output.split(DELIMITER)
	const result = {
		hash: outputItems[0],
		subject: outputItems[1],
		date: outputItems[2],
		author: {
			name: outputItems[3],
			email: outputItems[4],
		},
	}
	return Object.assign(result, {
		branch: branch,
	})
}
