const Color = require('ansi-colors')
const axios = require('axios')
const Netlify = require('netlify')
const FS = require('fs')
const getCommitInfo = require('../lib/getCommitInfo')
const { getCommitMessage } = require('../lib/shared')
const exec = require('./exec')
const base64 = require('base-64')

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
			url: `https://dept.dev/api/deploy?token=${ARGS.hvify}`,
			data,
			method: 'POST',
		})
	).data;

	// if we are on bitbucket, save part of result to commit
	await setBitbucketStatus(
		`dept.dev v${result.deploy.index} for ${process.env.BITBUCKET_BRANCH} of ${process.env.BITBUCKET_REPO_SLUG}`,
		`https://${result.deploy.project}-v${result.deploy.index}.dept.dev`,
		"dev"
	);
	await setBitbucketStatus(
		`dept.dev (raw) v${result.deploy.index} for ${process.env.BITBUCKET_BRANCH} of ${process.env.BITBUCKET_REPO_SLUG}`,
		result.deploy.url,
		"raw"
	);

	console.log('⬇   ⬇   ⬇   ⬇   ⬇   ⬇   ⬇   ⬇');
	console.dir(result, { colors: true });
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

		if (save2repoOutput.tag) {
			let tag = save2repoOutput.tag

			if (typeof tag === 'boolean' && hvPublishOutput && hvPublishOutput.deploy && hvPublishOutput.deploy.index) {
				tag = `v${hvPublishOutput.deploy.index}`
			}

			if (typeof tag === 'string') {
				try {
					process.chdir('__repo__')
					await exec(`git tag ${tag}`)
					await exec(`git push origin ${tag}`)
					process.chdir('..')
				} catch (error) {
					console.log(Color.red(`Could not update tag: ${error.message}`))
				}
			}
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



async function setBitbucketStatus(name, url, key = "build") {
	const MANDATORY_ENV_VARS = ["BITBUCKET_BRANCH", "BB_AUTH_STRING", "BITBUCKET_REPO_OWNER", "BITBUCKET_REPO_SLUG"]
	if (MANDATORY_ENV_VARS.every(key => process.env[key])) {
		const auth = process.env.BB_AUTH_STRING
		try {
			console.log(`Setting bitbucket commit status «${name}» ...`)
			const bitbucketStatusResult = (
				await axios({
					url: `https://api.bitbucket.org/2.0/repositories/${process.env.BITBUCKET_REPO_OWNER}/${process.env.BITBUCKET_REPO_SLUG}/commit/${process.env.BITBUCKET_COMMIT}/statuses/build`,
					headers: {
						Authorization: `Basic ${base64.encode(auth)}`,
						'Content-Type': `application/json`,
					},
					data: {
						"key": key,
						"state": "SUCCESSFUL",
						"name": name,
						"url": url,
					},
					method: 'POST',
				})
			).data;
			console.log(`   ✅ Bitbucket commit status «${name}» set`)
		} catch (error) {
			console.log(red(`❌ Could not set bitbucket commit status: ${error.message}`));
		}
	} else {
		console.log(`ℹ️  Not setting bitbucket commit status: missing environment variables: ` + MANDATORY_ENV_VARS.filter(key => !process.env[key]).join(", "))
	}
}

