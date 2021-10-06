module.exports = {
	getCommitMessage(data) {
		// TODO: remove log
		console.log('Getting commit message for')
		console.log(JSON.stringify(data, null, 2))
		const messages = data.messages ? data.messages.map((msg) => msg.replace(/"/g, "'").replace(/`/g, '\\`')) : []
		const index = (data.deploy && data.deploy.index) || ''
		const url = (data.deploy && data.deploy.url) || ''
		const moreMessages = messages.length > 1 ? '\n\nAlso includes:\n' + messages.slice(1).join('\n') : ''
		return `#${index} ${messages[0] || 'No commit messages'}
${url}${moreMessages}`
	},
}
