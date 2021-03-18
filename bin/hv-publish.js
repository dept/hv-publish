#!/usr/bin/env node

const Color = require('ansi-colors')

const parseArgs = require('minimist')

const package = require('../package.json')
const publish = require('../lib/publish.js')

console.log(Color.white.bgBlue.bold('HV Publish'), Color.yellow.bgBlue.bold(`v${package.version}`))

// Parsing Arguments
// =================

/*
    Input needed:

    netlify (default: ARGS.netlify)
    hvify (default: env.HVIFY_TOKEN)

    commit (default: env.BITBUCKET_COMMIT)
    branch (default: env.BITBUCKET_BRANCH)

    source (default: ./build)
    project (default: env.BITBUCKET_REPO_SLUG)
    site (default: hv-${project}.netlify.com)
*/

const ARGS = Object.assign(
	{
		netlify: process.env.NETLIFY_ACCESS_TOKEN,
		hvify: process.env.HVIFY_TOKEN,
		commit: process.env.BITBUCKET_COMMIT,
		branch: process.env.BITBUCKET_BRANCH,
		source: './build',
		project: process.env.BITBUCKET_REPO_SLUG,
		name: null, // the netlify site name base – defaults to project (only for compatibility)
		site: null,
		version: null,
	},
	parseArgs(process.argv, {
		alias: {
			s: 'source',
			n: 'name',
			p: 'project',
			v: 'version',
		},
	})
)

let hasInputError = false

if (ARGS.version) {
	console.log(`HV Publish Version: ${package.version}`)
	process.exit()
}
if (!ARGS.netlify) {
	console.log(Color.red('- Missing: netlify or $NETLIFY_ACCESS_TOKEN'))
	hasInputError = true
}
if (!ARGS.hvify) {
	console.log(Color.red('- Missing: hvify or $HVIFY_TOKEN'))
	hasInputError = true
}
if (!ARGS.commit) {
	console.log(Color.red('- Missing: commit or $BITBUCKET_COMMIT'))
	hasInputError = true
}
if (!ARGS.branch) {
	console.log(Color.red('- Missing: branch or $BITBUCKET_BRANCH'))
	hasInputError = true
}
if (!ARGS.project) {
	console.log(Color.red('- Missing: project or $BITBUCKET_REPO_SLUG'))
	hasInputError = true
}
if (!ARGS.name) {
	ARGS.name = `${ARGS.project}`
}
if (!ARGS.site) {
	ARGS.sitename = `hv-${ARGS.name}`
	ARGS.site = `hv-${ARGS.name}.netlify.com`
}
if (hasInputError) {
	console.dir(ARGS, { colors: true })
	process.exit()
}

publish(ARGS)
	.then(() => console.log('done.'))
	.catch((error) => console.log(error))
