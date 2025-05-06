import Color from 'ansi-colors'
import * as FS from 'fs'
import base64 from 'base-64'
import { getCommitInfo } from './getCommitInfo'
import { getCommitMessage } from './shared'
import { exec } from './exec'
import deployToNetlify from './publish/netlify'
import deployToCloudflare from './publish/cloudflare'
import fetch from 'node-fetch'

interface CommitAuthor {
	name: string;
	email: string;
}

interface CommitInfo {
	hash: string;
	branch: string;
	subject: string;
	date: string;
	author: CommitAuthor;
}

interface PublishArgs {
	platform?: 'cloudflare' | 'netlify';
	cloudflareAccountId?: string;
	cloudflare?: string;
	netlify?: string;
	sitename: string;
	source: string;
	branch: string;
	project: string;
	hvify: string;
	site?: string;
	commit: string;
}

interface HvifyData {
	url: string;
	commit: string;
	branch: string;
	project: string;
	message: string;
	comitted_at: string;
	author: string;
	build_repo?: Record<string, unknown>;
}

let commit: CommitInfo
let ARGS: PublishArgs


// Save to Firebase
// =================

async function saveToHvify(data: HvifyData) {
	console.log(Color.bold('Saving to HVify'))
	console.dir(data, { colors: true })
	let save2repoOutput
	try {
		save2repoOutput = JSON.parse(FS.readFileSync('.save2repo.json', 'utf-8'))
	} catch (e) {
		console.log('ℹ️  Found no .save2repo.json file.')
	}

	if (save2repoOutput) {
		const { messages, ...build_repo } = save2repoOutput
		Object.assign(data, { build_repo })
	}

	const response = await fetch(`https://dept.dev/api/deploy?token=${ARGS.hvify}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(data),
	})
	const result = await response.json()

	// if we are on bitbucket, save part of result to commit
	await setBitbucketStatus(
		`dept.dev v${result.deploy.index} for ${process.env.BITBUCKET_BRANCH} of ${process.env.BITBUCKET_REPO_SLUG}`,
		`https://${result.deploy.project}-v${result.deploy.index}.dept.dev`,
		"dev"
	)
	await setBitbucketStatus(
		`dept.dev (raw) v${result.deploy.index} for ${process.env.BITBUCKET_BRANCH} of ${process.env.BITBUCKET_REPO_SLUG}`,
		result.deploy.url,
		"raw"
	)

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
		} catch (error) {
			console.log(Color.red(`Could not update build commit: ${error}`))
		}

		if (save2repoOutput.tag) {
			let tag = save2repoOutput.tag

			if (typeof tag === 'boolean' && result?.deploy?.index) {
				tag = `v${result.deploy.index}`
			}

			if (typeof tag === 'string') {
				try {
					process.chdir('__repo__')
					await exec(`git tag ${tag}`)
					await exec(`git push origin ${tag}`)
					process.chdir('..')
				} catch (error) {
					console.log(Color.red(`Could not update tag: ${error}`))
				}
			}
		}
	}

	return result
}

// Publish (Main)
// =================

async function publish(args: PublishArgs) {
	ARGS = args
	commit = await getCommitInfo(ARGS.commit, ARGS.branch)

	let deploy_url: string

	// Determine which platform to deploy to
	if (ARGS.platform === 'cloudflare') {
		if (!ARGS.cloudflareAccountId || !ARGS.cloudflare) {
			throw new Error('Missing required Cloudflare configuration (cloudflareAccountId or cloudflareToken)')
		}
		deploy_url = await deployToCloudflare({
			accountId: ARGS.cloudflareAccountId,
			sitename: ARGS.sitename,
			source: ARGS.source,
			apiToken: ARGS.cloudflare,
			branch: ARGS.branch,
			commit
		})
	} else {
		// Default to Netlify
		if (!ARGS.netlify || !ARGS.site) {
			throw new Error('Missing required Netlify configuration (netlify token or site)')
		}
		deploy_url = await deployToNetlify({
			sitename: ARGS.sitename,
			site: ARGS.site,
			netlify: ARGS.netlify,
			source: ARGS.source,
			commit
		})
	}

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

async function setBitbucketStatus(name: string, url: string, key = "build") {
	const MANDATORY_ENV_VARS = ["BITBUCKET_BRANCH", "BB_AUTH_STRING", "BITBUCKET_REPO_OWNER", "BITBUCKET_REPO_SLUG"]
	if (MANDATORY_ENV_VARS.every(key => process.env[key])) {
		const auth = process.env.BB_AUTH_STRING!
		try {
			console.log(`Setting bitbucket commit status «${name}» ...`)
			await fetch(`https://api.bitbucket.org/2.0/repositories/${process.env.BITBUCKET_REPO_OWNER}/${process.env.BITBUCKET_REPO_SLUG}/commit/${process.env.BITBUCKET_COMMIT}/statuses/build`, {
				method: 'POST',
				headers: {
					'Authorization': `Basic ${base64.encode(auth)}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					key,
					state: "SUCCESSFUL",
					name,
					url,
				}),
			})
			console.log(`   ✅ Bitbucket commit status «${name}» set`)
		} catch (error) {
			console.log(Color.red(`❌ Could not set bitbucket commit status: ${error}`))
		}
	} else {
		console.log(`ℹ️  Not setting bitbucket commit status: missing environment variables: ${MANDATORY_ENV_VARS.filter(key => !process.env[key]).join(", ")}`)
	}
}

export { publish }

