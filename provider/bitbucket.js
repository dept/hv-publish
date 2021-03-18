const Color = require('ansi-colors')
const base64 = require('base-64')
const fetch = require('node-fetch')

module.exports = {
	identify() {
		return !!env('BITBUCKET_REPO_OWNER')
	},
	getOptions() {
		return {
			branch: env('BITBUCKET_BRANCH'),
			path: env('BITBUCKET_REPO_OWNER') && env('BITBUCKET_REPO_SLUG') && `${env('BITBUCKET_REPO_OWNER')}/${env('BITBUCKET_REPO_SLUG')}-build`,
			number: env('BITBUCKET_BUILD_NUMBER') || 0,
			commit: env('BITBUCKET_COMMIT'),
			help: null,
			version: null,
		}
	},
	async getRepository(options) {
		let repoPath = options.path

		log(`Checking availability of bitbucket build repository: ${repoPath}`)
		const repoInfo = await this.getApi(`repositories/${repoPath}`)
		log(JSON.stringify(repoInfo), 'yellow')

		if (!repoInfo.error) {
			log(`☑️  Found build repository «${repoInfo.name}»`)
		} else {
			log(`➕  Creating new build repository ${repoPath}`)
			const currentProject = await this.getApi(`repositories/${env('BITBUCKET_REPO_OWNER')}/${env('BITBUCKET_REPO_SLUG')}`)
			log(`Source project: ${JSON.stringify(currentProject)}`)
			const newProjectData = {
				scm: currentProject.scm,
				is_private: currentProject.is_private,
				name: `${currentProject.name} (Build)`,
				project: {
					key: currentProject.project.key,
				},
			}
			const newProjectResult = await this.getApi(`repositories/${repoPath}`, {
				method: 'POST',
				body: JSON.stringify(newProjectData),
			})
			log(`New destination project: ${JSON.stringify(newProjectResult)}`)
		}
		return `https://${env('BB_AUTH_STRING')}@bitbucket.org/${repoPath}.git`
	},
	async getApi(path, options = {}) {
		return await getJSON(`https://api.bitbucket.org/2.0/${path}`, options)
	},
}

async function getJSON(url, options = {}) {
	const auth = env('BB_AUTH_STRING')
	const response = await fetch(
		url,
		Object.assign(
			{
				method: 'GET',
				headers: {
					Authorization: `Basic ${base64.encode(auth)}`,
					'Content-Type': `application/json`,
				},
			},
			options
		)
	)
	const json = await response.json()
	return json
}

function log(msg, color = null) {
	if (color) {
		console.log(Color[color](msg))
	} else {
		console.log(msg)
	}
}

function env(key) {
	return process.env[key]
}
