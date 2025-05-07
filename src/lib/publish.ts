import Color from 'ansi-colors'
import * as FS from 'fs'
import base64 from 'base-64'
import { getCommitInfo } from './getCommitInfo'
import { getCommitMessage } from './shared'
import deployToNetlify from './publish/netlify'
import deployToCloudflare from './publish/cloudflare'
import { gitExec } from './util/gitExec'

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
			await gitExec(['commit', '--amend', '-m', message])
			await gitExec(['push', '--force', 'origin', save2repoOutput.branch])
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
					await gitExec(['tag', tag])
					await gitExec(['push', 'origin', tag])
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

	// check first if there is a build directory
	if (!FS.existsSync(ARGS.source)) {
		throw new Error(`Build directory "${ARGS.source}" does not exist`)
	}

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

	const result = await saveToHvify({
		url: deploy_url,
		commit: commit.hash,
		branch: commit.branch,
		project: ARGS.project,
		message: commit.subject,
		comitted_at: commit.date,
		author: `${commit.author.name} <${commit.author.email}>`,
	})

	if (process.env.GITHUB_TOKEN) {
		try {

			const statusConfig = {
				sha: process.env.GITHUB_SHA!,
				repo: process.env.GITHUB_REPOSITORY!.split('/')[1],
				owner: process.env.GITHUB_REPOSITORY!.split('/')[0],
				github_token: process.env.GITHUB_TOKEN,
			}
			await setGithubStatus({
				state: 'success',
				description: `Deploy to ${ARGS.platform} succeeded`,
				context: 'dept.dev',
				target_url: deploy_url,
				...statusConfig,
			})
			await setGithubStatus({
				state: 'success',
				description: `Deploy to dept.dev succeeded (v${result.deploy.index})`,
				context: 'dept.dev',
				target_url: `https://${result.deploy.project}-v${result.deploy.index}.dept.dev`,
				...statusConfig,
			})
		} catch (error) {
			console.warn(
				`❌ Could not set GitHub status. You probably want to set permissions for the GITHUB_TOKEN to allow status updates, e.g.:
			
jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      statuses: write
      contents: read
`
			)
		}
	}

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

async function setGithubStatus({
	state,
	description,
	context,
	target_url,
	sha,
	repo,
	owner,
	github_token,
}: {
	state: 'error' | 'failure' | 'pending' | 'success',
	description: string,
	context: string,
	target_url?: string,
	sha: string,
	repo: string,
	owner: string,
	github_token: string,
}) {
	const url = `https://api.github.com/repos/${owner}/${repo}/statuses/${sha}`
	const body = {
		state,
		description,
		context,
		...(target_url ? { target_url } : {}),
	}
	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${github_token}`,
			'Accept': 'application/vnd.github+json',
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(body),
	})
	if (!response.ok) {
		const error = await response.text()
		throw new Error(`Failed to set GitHub status: ${error}`)
	}
	console.log(`✅ GitHub commit status «${context}» set`)
}

export { publish }

