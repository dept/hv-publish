#!/usr/bin/env node

const Color = require('ansi-colors');
const parseArgs = require('minimist');
const package = require('../package.json');
const FS = require('fs');
const Path = require('path');

const providers = [require('../provider/bitbucket'), require('../provider/blank')];
const provider = providers.find(provider => provider.identify());

console.log(Color.white.bgBlue.bold('HV Save2Repo'), Color.yellow.bgBlue.bold(`v${package.version}`));

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
		version: null
	},
	provider.getOptions(),
	parseArgs(process.argv, {
		alias: {
			b: 'branch',
			s: 'source',
			d: 'destination',
			p: 'path',
			h: 'help',
			v: 'version'
		}
	})
);

let hasInputError = false;

if (ARGS.version) {
	log(`HV Publish Version: ${package.version}`);
	process.exit();
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
`);
	hasInputError = true;
}
if (!ARGS.source) {
	log('- Missing: source', 'red');
	hasInputError = true;
}
if (!ARGS.branch) {
	log('- Missing: branch or $BITBUCKET_BRANCH', 'red');
	hasInputError = true;
}
if (!ARGS.path && !ARGS.destination) {
	log('- Missing: destination or $BITBUCKET_REPO_OWNER/$BITBUCKET_REPO_SLUG', 'red');
	hasInputError = true;
}
if (hasInputError) {
	console.dir(ARGS, { colors: true });
	process.exit();
}

let repoUrl = ARGS.destination;
let sourceDirectory = ARGS.source;
let branchName = ARGS.branch;
let buildNumber = ARGS.number;
let gitEmail = ARGS.git_email;
let gitName = ARGS.git_name;
const repoDir = '__repo__';

async function save2repo() {
	if (!repoUrl) {
		repoUrl = await provider.getRepository(ARGS);
	}

	log(`Our destination repository: ${repoUrl}`);

	const gitLog = await exec(`git log --pretty=format:"%s"`);
	FS.writeFileSync(Path.join(sourceDirectory, '.gitlog'), gitLog);

	log(`Checking if branch ${branchName} already exists ...`);
	const branchExists = await exec(`git ls-remote ${repoUrl} refs/*/${branchName}`);

	// create repository directory
	await exec(`mkdir ${repoDir};`);
	process.chdir(repoDir);

	if (branchExists) {
		log(`- Branch ${branchName} already exists, checking out.`);
		await exec(`git clone --branch ${branchName} --depth 25 ${repoUrl} .`);
	} else {
		log(`- Branch name ${branchName} doesn't exist yet - will create.`);
		await exec(`git clone --depth 1 ${repoUrl} .`);
		await exec(`git checkout --orphan ${branchName}`);
		await exec(`git rm -rfq --ignore-unmatch .`);
	}

	await exec(`
		git config --global user.email ${gitEmail}
		git config --global user.name ${gitName}
		git config http.postBuffer 157286400
		touch .rsync-exclude.txt
		echo ".gitignore" >> .rsync-exclude.txt
		echo ".git" >> .rsync-exclude.txt
		rsync -ac ../${sourceDirectory}/ . --delete --exclude-from='.rsync-exclude.txt'
		rm -f .rsync-exclude.txt
		git add -u
		git add -A .
	`);

	// head will limit to max n number of lines
	const lastCommitMessages = await exec(`git diff --color=never --staged .gitlog | egrep "^\\+[^\\+]" | head -n10`);
	const gitDiff = (async () => {
		try {
			return await exec(`git diff-index HEAD --`);
		} catch (error) {
			return true;
		}
	})();

	if (gitDiff) {
		await exec(`git commit -a -m "Build ${buildNumber} -- ${lastCommitMessages}"`);
		await exec(`git push origin $branch_name`);
		log(`✅  Pushed changes to build repository: Build ${buildNumber} -- ${lastCommitMessages}`);
	} else {
		log(`🆗  No changes to previous build. Nothing to commit.`);
	}

	// remove repository directory
	process.chdir('../');
	await exec(`rm -rf ${repoDir}`);
}

function log(msg, color = null) {
	if (color) {
		console.log(Color[color](msg));
	} else {
		console.log(msg);
	}
}

function exec(cmd) {
	return new Promise((resolve, reject) => {
		log(`📍${cmd}`, 'gray');
		require('child_process').exec(cmd, (error, stdout, stderr) => {
			if (error) {
				log(Color.red(stderr));
				reject(error, stderr);
			} else {
				log(Color.green(stdout));
				resolve(stdout);
			}
		});
	});
}

save2repo().then(() => log('Done!'));
