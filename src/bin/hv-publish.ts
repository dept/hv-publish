#!/usr/bin/env node

import * as Color from 'ansi-colors'
import parseArgs from 'minimist'
import { publish } from '../lib/publish'
import { version } from '../../package.json'
import { loadAndApplySecrets } from '../lib/secrets/infisical'

interface PublishArgs {
   netlify: string | undefined;
   cloudflare: string | undefined;
   cloudflareAccountId: string | undefined;
   hvify: string;
   platform: 'cloudflare' | 'netlify';
   commit: string;
   branch: string;
   source: string;
   project: string;
   name: string | null;
   site: string | undefined;
   sitename: string;
   version: string | null;
   help: boolean | null;
}

async function main() {
   console.log(Color.white.bgGreen.bold('HV Publish'), Color.yellow.bgGreen.bold(`v${version}`))

   // Load secrets from Infisical and apply to process.env
   await loadAndApplySecrets()

   const ARGS: PublishArgs = Object.assign(
      {
         netlify: process.env.NETLIFY_ACCESS_TOKEN,
         cloudflare: process.env.CLOUDFLARE_API_TOKEN,
         cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID,
         hvify: process.env.HVIFY_TOKEN || '',
         commit: process.env.BITBUCKET_COMMIT || process.env.GITHUB_SHA || '',
         branch: process.env.BITBUCKET_BRANCH || process.env.GITHUB_REF_NAME || '',
         source: './build',
         project: process.env.BITBUCKET_REPO_SLUG || process.env.GITHUB_REPOSITORY || '',
         name: null,
         site: undefined,
         sitename: '',
         version: null,
         help: null,
      },
      parseArgs(process.argv, {
         alias: {
            s: 'source',
            n: 'name',
            p: 'project',
            v: 'version',
            h: 'help',
         },
      })
   )


   let hasInputError = false

   if (ARGS.help) {
      console.log(`HV Publish Version: ${version}

Usage:
   hv-publish [options]

Options:
   -s, --source <path>         Path to the source directory (default: ./build)
   -p, --project <project>     Project identifier (default: BITBUCKET_REPO_SLUG or GITHUB_REPOSITORY)
   -n, --name <name>           Name of the project (default: project, see above)
   -v, --version               Show version information
   -h, --help                  Show help information
   --platform <platform>       Deployment platform, either 'cloudflare' or 'netlify' (default: cloudflare)
   --commit <commit>           Commit hash (or env: BITBUCKET_COMMIT or GITHUB_SHA)
   --branch <branch>           Branch name (or env: BITBUCKET_BRANCH or GITHUB_REF_NAME)
   --sitename <sitename>       Site name for deployment (default: generated based on project name)
   --site <site>               Site URL for deployment (default: generated based on platform)
   --netlify <netlify>         Netlify access token (or env: NETLIFY_ACCESS_TOKEN)
   --cloudflare <cloudflare>   Cloudflare API token (or env: CLOUDFLARE_API_TOKEN)
   --cloudflare-account-id <cloudflare-account-id> Cloudflare account ID (or env: CLOUDFLARE_ACCOUNT_ID)
   --hvify <hvify>             HVify token (or env: HVIFY_TOKEN)


`)
      process.exit()
   }

   if (ARGS.version) {
      console.log(`HV Publish Version: ${version}`)
      process.exit()
   }
   if (!ARGS.platform) {
      ARGS.platform = 'cloudflare'
      if (ARGS.netlify && !ARGS.cloudflare) {
         ARGS.platform = 'netlify'
      }
   }
   if (!['cloudflare', 'netlify'].includes(ARGS.platform)) {
      console.log(Color.red('- Invalid platform: ' + ARGS.platform + ' (must be one of: cloudflare, netlify)'))
      hasInputError = true
   }
   if (ARGS.platform === 'netlify' && !ARGS.netlify) {
      console.log(Color.red('- Missing: netlify or $NETLIFY_ACCESS_TOKEN'))
      hasInputError = true
   }
   if (ARGS.platform === 'cloudflare' && !ARGS.cloudflare) {
      console.log(Color.red('- Missing: cloudflare or $CLOUDFLARE_API_TOKEN'))
      hasInputError = true
   }
   if (ARGS.platform === 'cloudflare' && !ARGS.cloudflareAccountId) {
      console.log(Color.red('- Missing: cloudflareAccountId or $CLOUDFLARE_ACCOUNT_ID'))
      hasInputError = true
   }
   if (!ARGS.hvify) {
      console.log(Color.red('- Missing: hvify or $HVIFY_TOKEN'))
      hasInputError = true
   }
   if (!ARGS.commit) {
      console.log(Color.red('- Missing: commit or $BITBUCKET_COMMIT or $GITHUB_SHA'))
      hasInputError = true
   }
   if (!ARGS.branch) {
      console.log(Color.red('- Missing: branch or $BITBUCKET_BRANCH or $GITHUB_REF_NAME'))
      hasInputError = true
   }
   if (!ARGS.project) {
      console.log(Color.red('- Missing: project or $BITBUCKET_REPO_SLUG or $GITHUB_REPOSITORY'))
      hasInputError = true
   }
   if (!ARGS.name) {
      ARGS.name = `${ARGS.project}`
   }
   if (!ARGS.site) {
      ARGS.sitename = `hv-${ARGS.name}`
      ARGS.site = ARGS.netlify ? `hv-${ARGS.name}.netlify.com` : ARGS.cloudflare ? `hv-${ARGS.name}.pages.dev` : ''
   }
   if (hasInputError) {
      console.dir(ARGS, { colors: true })
      process.exit()
   }

   await publish(ARGS)
   console.log('done.')
}

main().catch((error) => console.log('Error:', error)) 