#!/usr/bin/env node

import * as Color from 'ansi-colors'
import parseArgs from 'minimist'

interface PublishArgs {
   netlify: string | undefined;
   hvify: string | undefined;
   commit: string | undefined;
   branch: string | undefined;
   source: string;
   project: string | undefined;
   name: string | null;
   site: string | null;
   sitename?: string;
   version: string | null;
}

const ARGS: PublishArgs = Object.assign(
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

import { publish } from '../lib/publish'
import { version } from '../package.json'

console.log(Color.white.bgBlue.bold('HV Publish'), Color.yellow.bgBlue.bold(`v${version}`)) 