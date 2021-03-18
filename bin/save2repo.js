#!/usr/bin/env node

const Color = require('ansi-colors')
const parseArgs = require('minimist')
const package = require('../package.json')
const FS = require('fs')
const Path = require('path')
const syncDirectories = require('../lib/syncDirectories')
const exec = require('../lib/exec')
const request = require('request-promise-native')
const log = require('../lib/log')
const { getCommitMessage } = require('../lib/shared')

const providers = [require('../provider/bitbucket'), require('../provider/blank')]
const provider = providers.find((provider) => provider.identify())

console.log(Color.white.bgBlue.bold('HV Save2Repo'), Color.yellow.bgBlue.bold(`v${package.version}`))

// Parsing Arguments
// =================

const ARGS = Object.assign(
	{
		source: './build',
		destination: null,
		branch: null,
		path: null,
		git_email: 'hvdevice@gmail.com',
		git_name: 'HV Build',
		number: null,
		help: null,
		version: null,
	},
	provider.getOptions(),
	parseArgs(process.argv, {
		alias: {
			b: 'branch',
			s: 'source',
			d: 'destination',
			p: 'path',
			h: 'help',
			v: 'version',
		},
	})
)

let hasInputError = false

if (ARGS.version) {
	log(`save2repo version: ${package.version}`)
	process.exit()
}
if (ARGS.help) {
	log(`
USAGE:

save2repo --source ./build

-s | --source path/to/source

    Website directory to upload. Default: ./build

-p | --path bitbucket_user/bitbucket_repo

    The bitbucket repository path (will only be considered if destination is not set).
    Default: $BITBUCKET_REPO_OWNER/$BITBUCKET_REPO_SLUG-build

    So if your current repository is hinderlingvolkart/project
    your destination path will be hinderlingvolkart/project-build

-d | --destination https://user:password@domain.com/path/to/repository.git

    The destination repository url with credentials.
    Default: Based on current bitbucket repository, see path parameter.

-b | --branch master

    The destination branch

-h | --help

    Prints this help.
`)
	hasInputError = true
}
if (!ARGS.source) {
	log('- Missing: source', 'red')
	hasInputError = true
}
if (!ARGS.branch) {
	log('- Missing: branch or $BITBUCKET_BRANCH', 'red')
	hasInputError = true
}
if (!ARGS.path && !ARGS.destination) {
	log('- Missing: destination or $BITBUCKET_REPO_OWNER/$BITBUCKET_REPO_SLUG', 'red')
	hasInputError = true
}
if (hasInputError) {
	console.dir(ARGS, { colors: true })
	process.exit()
}

let repoUrl = ARGS.destination
let sourceDirectory = ARGS.source
let branchName = ARGS.branch
let buildNumber = ARGS.number
let gitEmail = ARGS.git_email
let gitName = ARGS.git_name
const repoDir = '__repo__'

async function save2repo() {
	if (!repoUrl) {
		repoUrl = await provider.getRepository(ARGS)
	}
	const output = {
		origin: `bitbucket/${env('BITBUCKET_REPO_OWNER')}/${env('BITBUCKET_REPO_SLUG')}`,
		branch: branchName,
	}
	let hvPublishOutput
	try {
		hvPublishOutput = JSON.parse(FS.readFileSync('.hv-publish.json'))
	} catch (error) {}

	log(`Destination Repository: ${repoUrl}`)

	const gitLog = await exec(`git log --pretty=format:"%s"`)

	log(`Checking if branch ${branchName} already exists ...`)
	const branchExists = await exec(`git ls-remote ${repoUrl} refs/*/${branchName}`)
	log(`→  Branch exists: ${branchExists}`)

	// create repository directory
	await exec(`mkdir ${repoDir};`)
	process.chdir(repoDir)

	await exec(`echo $\{PWD##*/}`)

	if (branchExists) {
		log(`- Branch ${branchName} already exists, checking out.`)
		await exec(`git clone --branch ${branchName} --depth 10 ${repoUrl} .`)
	} else {
		log(`- Branch name ${branchName} doesn't exist yet - will create.`)
		await exec(`git clone --depth 1 ${repoUrl} .`)
		await exec(`git checkout --orphan ${branchName}`)
		await exec(`git rm -rfq --ignore-unmatch .`)
	}

	await exec(`
		git config --global user.email ${gitEmail}
		git config --global user.name ${gitName}
		git config http.postBuffer 157286400
		touch .rsync-exclude.txt
		echo ".gitignore" >> .rsync-exclude.txt
		echo ".git" >> .rsync-exclude.txt
	`)

	const ignore = FS.readFileSync('.rsync-exclude.txt')
		.toString()
		.split(/[\r\n]+/)
		.filter(Boolean)
	await syncDirectories(Path.join('..', sourceDirectory), '.', { ignore })
	FS.writeFileSync('.gitlog', gitLog)

	await exec(`
		rm -f .rsync-exclude.txt
		git add -u
		git add -A .
	`)

	// head will limit to max n number of lines
	output.messages = (await exec(`git diff --color=never --staged .gitlog | egrep "^\\+[^\\+]" | head -n10`))
		.split(/[\n\r]+/)
		.map((line) => line.replace(/^\+/, '').trim())
		.filter(Boolean)

	const gitDiff = await (async () => {
		try {
			return await exec(`git diff-index HEAD --`)
		} catch (error) {
			return true
		}
	})()

	log(`Git diff: ${gitDiff}`)

	if (gitDiff) {
		const message = getCommitMessage({
			...output,
			...hvPublishOutput,
		})
		await exec(`git commit -a -m "${message}"`)
		output.commit = (await exec(`git rev-parse HEAD`)).trim()
		await exec(`git push origin ${branchName}`)
		log(`✅  Pushed changes to build repository`)
	} else {
		log(`🆗  No changes to previous build. Nothing to commit.`)
	}

	process.chdir('../')

	if (hvPublishOutput) {
		log('💉  Patching hv.dev', 'magenta')
		const { messages, ...build_repo } = output
		const data = {
			id: hvPublishOutput.key,
			build_repo,
		}
		const result = await request({
			uri: `https://hv.dev/api/deploy?token=${env('HVIFY_TOKEN')}`,
			body: data,
			method: 'PATCH',
			json: true,
		})
		console.log('- sent: ')
		console.dir(data, { colors: true })
		console.log('- receive: ')
		console.dir(result, { colors: true })
		await exec(`rm -rf ${repoDir}`)
	} else {
		console.log('Saving .save2repo.json for potential hv-publish followup')
		FS.writeFileSync('.save2repo.json', JSON.stringify(output))
	}
	FS.writeFileSync('.save2repo.json', JSON.stringify(output))
	// remove repository directory
}

save2repo().then(() => log('✅  save2repo!'))

function env(key) {
	return process.env[key]
}
