const request = require('request-promise-native');
const zipFolder = require('zip-folder');
const Netlify = require('netlify');
const Color = require('turbocolor');
const parseArgs = require('minimist');
const package = require('./package.json');

console.log(Color.white.bgBlue.bold('HV Publish'), Color.yellow.bgBlue.bold(`v${package.version}`));

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
		site: null
	},
	parseArgs(process.argv, {
		alias: {
			s: 'source',
			n: 'name',
			p: 'project'
		}
	})
);

let hasInputError = false;

if (!ARGS.netlify) {
	console.log(Color.red('- Missing: netlify or $NETLIFY_ACCESS_TOKEN'));
	hasInputError = true;
}
if (!ARGS.hvify) {
	console.log(Color.red('- Missing: hvify or $HVIFY_TOKEN'));
	hasInputError = true;
}
if (!ARGS.commit) {
	console.log(Color.red('- Missing: commit or $BITBUCKET_COMMIT'));
	hasInputError = true;
}
if (!ARGS.branch) {
	console.log(Color.red('- Missing: branch or $BITBUCKET_BRANCH'));
	hasInputError = true;
}
if (!ARGS.project) {
	console.log(Color.red('- Missing: project or $BITBUCKET_REPO_SLUG'));
	hasInputError = true;
}
if (!ARGS.site) {
	ARGS.sitename = `hv-${ARGS.project}`;
	ARGS.site = `hv-${ARGS.project}.netlify.com`;
}
if (hasInputError) {
	console.dir(ARGS, { colors: true });
	process.exit();
}

function getCommitInfo(commit, branch) {
	const cmd = `git log --pretty=format:'{%n  "hash": "%H",%n  "subject": "%s",%n  "date": "%aD",%n  "author": {%n    "name": "%aN",%n    "email": "%aE",%n  }%n},' -n 1 ${commit}`;
	const json = (execSync = require('child_process').execSync(cmd));
	return Object.assign(JSON.parse(json), {
		branch: branch
	});
}

// Deploy to Netlify
// =================

async function deployToNetlify() {
	const netlify_name = `${ARGS.sitename}`;
	const netlify_site = `${ARGS.site}`;

	console.log(Color.bold('Deploying to Netlify'));
	const client = new Netlify(ARGS.netlify);
	let site = false;

	try {
		console.log(Color.cyan('Checking site'), netlify_site);
		site = await client.getSite({
			site_id: netlify_site
		});
	} catch (error) {
		// Creating a site (if not yet)

		console.log(Color.cyan('Site not found. Creating'), netlify_site);

		site = await client.createSite({
			body: {
				name: netlify_name,
				force_ssl: true
			}
		});

		// Assigning site to HV Team
		// this is unfortunately not part of Netlify's open api

		console.log(Color.cyan('Assigning to HV Team'));

		await request({
			uri: `https://api.netlify.com/api/v1/sites/${site.id}/transfer`,
			formData: {
				account_id: '5a573203a6188f7ad3e2362c'
			},
			method: 'POST',
			headers: {
				Authorization: `Bearer ${ARGS.netlify}`
			}
		});
	}

	console.log(Color.cyan('Site for'), netlify_site);
	console.dir(site, { colors: true });
	// Uploading zip, actually deploying

	const result = await client.deploy(netlify_site, ARGS.source, {
		draft: false,
		message: commit.subject,
		parallelUpload: 30,
		statusCb: statusObj => {
			console.log(`- ${statusObj.msg}`);
		}
	});

	console.log(Color.cyan('Deployed to'), netlify_site);
	console.dir(result, { colors: true });

	console.log(Color.green.bold(`Successfully deployed to`), Color.magenta.bold(result.deploy.deploy_ssl_url));

	return result.deploy.deploy_ssl_url;
}

// Save to Firebase
// =================

async function saveToFirebase(data) {
	console.log(Color.bold('Saving to HVify'));
	console.dir(data, { colors: true });
	await request({
		uri: `https://hvify.com/api/deploy?token=${ARGS.hvify}`,
		body: data,
		method: 'POST',
		json: true
	});
}

// Publish (Main)
// =================

async function publish() {
	const deploy_url = await deployToNetlify();
	saveToFirebase({
		url: deploy_url,
		commit: commit.hash,
		branch: commit.branch,
		project: ARGS.project,
		message: commit.subject,
		comitted_at: commit.date,
		author: `${commit.author.name} <${commit.author.email}>`
	});
}

const commit = getCommitInfo(ARGS.commit, ARGS.branch);

publish()
	.then(() => console.log('done.'))
	.catch(error => console.log(error));
