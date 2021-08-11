const Color = require('ansi-colors')
const axios = require('axios')
const Netlify = require('netlify')
const FS = require('fs')
const getCommitInfo = require('../lib/getCommitInfo')
const { getCommitMessage } = require('../lib/shared')
const exec = require('./exec')
let commit, ARGS

// Deploy to Netlify
// =================

async function deployToNetlify() {
	const netlify_name = `${ARGS.sitename}`
	const netlify_site = `${ARGS.site}`

	console.log(Color.bold('Deploying to Netlify'))
	const client = new Netlify(ARGS.netlify)
	let site = false

	try {
		console.log(Color.cyan('Checking site'), netlify_site)
		site = await client.getSite({
			site_id: netlify_site,
		})
	} catch (error) {
		// Creating a site (if not yet)

		console.log(Color.cyan('Site not found. Creating'), netlify_site)

		site = await client.createSite({
			body: {
				name: netlify_name,
				force_ssl: true,
			},
		})

		// Assigning site to HV Team
		// this is unfortunately not part of Netlify's open api

		console.log(Color.cyan('Assigning to HV Team'))

		await axios({
			url: `https://api.netlify.com/api/v1/sites/${site.id}/transfer`,
			data: {
				account_id: '5a573203a6188f7ad3e2362c',
			},
			method: 'POST',
			headers: {
				Authorization: `Bearer ${ARGS.netlify}`,
			},
		})
	}

	console.log(Color.cyan('Site for'), netlify_site)
	//console.dir(site, { colors: true })

	// Add headers file

	FS.writeFileSync(`${ARGS.source}/_headers`, '/*\n  Cache-Control: public, max-age=31536000\n')

	// Uploading files, actually deploying

	const functionsDir = `${ARGS.source}/functions`

	const result = await client.deploy(netlify_site, ARGS.source, {
		fnDir: FS.existsSync(functionsDir) ? functionsDir : null,
		draft: true,
		message: commit.subject,
		parallelUpload: 30,
		statusCb: (statusObj) => {
			console.log(`- ${statusObj.msg}`)
		},
	})

	console.log(Color.cyan('Deployed to'), netlify_site)
	// console.dir(result, { colors: true })

	console.log(Color.green.bold(`Successfully deployed to`), Color.magenta.bold(result.deploy.deploy_ssl_url))

	return result.deploy.deploy_ssl_url
}

// Save to Firebase
// =================

async function saveToHvify(data) {
	console.log(Color.bold('Saving to HVify'))
	console.dir(data, { colors: true })
	let save2repoOutput
	try {
		save2repoOutput = JSON.parse(FS.readFileSync('.save2repo.json'))
	} catch (e) {
		console.log('ℹ️  Found no .save2repo.json file.')
	}

	if (save2repoOutput) {
		const { messages, ...build_repo } = save2repoOutput
		Object.assign(data, { build_repo })
	}
	const result = (
		await axios({
			url: `https://hv.dev/api/deploy?token=${ARGS.hvify}`,
			data,
			method: 'POST',
		})
	).data
	console.log('⬇   ⬇   ⬇   ⬇   ⬇   ⬇   ⬇   ⬇')
	console.dir(result, { colors: true })
	if (!save2repoOutput) {
		console.log('Saving .hv-publish.json for potential save2repo followup')
		FS.writeFileSync('.hv-publish.json', JSON.stringify(result, null, 2))
	} else {
		const message = getCommitMessage({
			...save2repoOutput,
			...result,
		})
		try {
			process.chdir('__repo__')
			await exec(`git commit --amend -m "${message}"`)
			await exec(`git push --force origin ${save2repoOutput.branch}`)
			process.chdir('..')
			// await exec(`rm -rf __repo__`)
		} catch (error) {
			console.log(Color.red(`Could not update build commit: ${error.message}`))
		}
	}

	return result
}

// Publish (Main)
// =================

async function publish(args) {
	ARGS = args
	commit = await getCommitInfo(ARGS.commit, ARGS.branch)
	const deploy_url = await deployToNetlify()

	return saveToHvify({
		url: deploy_url,
		commit: commit.hash,
		branch: commit.branch,
		project: ARGS.project,
		message: commit.subject,
		comitted_at: commit.date,
		author: `${commit.author.name} <${commit.author.email}>`,
	})
}

module.exports = publish
