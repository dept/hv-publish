#!/usr/bin/env node

import Color from 'ansi-colors';
import parseArgs from 'minimist';
import packageJson from '../../package.json';
import * as FS from 'fs';
import * as Path from 'path';
import syncDirectories from '../lib/syncDirectories';
import { exec } from '../lib/util/exec';
import fetch from 'node-fetch';
import log from '../lib/util/log';
import { getCommitMessage } from '../lib/shared';
import { type Provider } from '../provider/types';
import bitbucket from '../provider/bitbucket';
import github from '../provider/github';
import { loadAndApplySecrets } from '../lib/secrets/infisical';
import { gitExec } from '../lib/util/gitExec';

interface Args {
   source: string;
   destination: string | null;
   branch: string | null;
   path: string | null;
   git_email: string;
   git_name: string;
   number: string | null;
   help: boolean | null;
   version: boolean | null;
   tag: boolean | string;
}

interface HvPublishOutput {
   key: string;
   deploy?: {
      index?: string;
   };
}

interface Output {
   branch: string;
   origin: string;
   messages?: string[];
   commit?: string;
   tag?: boolean | string;
}

async function main() {
   // Load secrets from Infisical and apply to process.env
   await loadAndApplySecrets();

   const providers: Provider[] = [bitbucket, github];
   const provider = providers.find((provider: any) => provider.identify());

   console.log(Color.white.bgBlue.bold('HV Save2Repo'), Color.yellow.bgBlue.bold(`v${packageJson.version}`));

   if (!provider) {
      log('No provider found', 'red');
      log("- currently available providers:")
      providers.forEach((provider: Provider) => {
         log(`- ${provider.name}`)
      })
      process.exit(1);
   }

   // Parsing Arguments
   // =================

   const ARGS: Args = Object.assign(
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
         tag: false,
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
            t: 'tag',
         },
      })
   );

   let hasInputError = false;

   if (ARGS.version) {
      log(`save2repo version: ${packageJson.version}`);
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

-t | --tag tag

    Add tag to a branch. Default is the current version number (e.g. v1.2.45)

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
   const sourceDirectory = ARGS.source;
   const branchName = ARGS.branch || '';
   const buildNumber = ARGS.number;
   const gitEmail = ARGS.git_email;
   const gitName = ARGS.git_name;
   let tagValue = ARGS.tag;

   const repoDir = '__repo__';

   function env(key: string): string | undefined {
      return process.env[key];
   }

   async function save2repo(): Promise<void> {
      if (!repoUrl) {
         repoUrl = await provider!.getRepository({
            path: ARGS.path || undefined,
         });
      }

      if (!repoUrl) {
         throw new Error('Repository URL is required');
      }

      const output: Output = {
         branch: branchName || '',
         origin: repoUrl.replace(/(https?:\/\/)[^\/]+@/, '$1'), // remove authentication
      };

      let hvPublishOutput: HvPublishOutput | undefined;
      try {
         hvPublishOutput = JSON.parse(FS.readFileSync('.hv-publish.json', 'utf-8'));
      } catch (error) { }

      log(`Destination Repository: ${repoUrl}`);

      const gitLog = await gitExec(['log', '--pretty=format:"%s"']);

      log(`Checking if branch ${branchName} already exists ...`);
      const branchExists = await gitExec(['ls-remote', repoUrl, `refs/*/${branchName}`]);
      log(`→  Branch exists: ${branchExists}`);

      // create repository directory
      await exec(`mkdir ${repoDir};`);
      process.chdir(repoDir);

      await exec(`echo $\{PWD##*/}`);

      if (branchExists) {
         log(`- Branch ${branchName} already exists, checking out.`);
         await gitExec(['clone', '--branch', branchName, '--depth', '10', repoUrl, '.']);
      } else {
         log(`- Branch name ${branchName} doesn't exist yet - will create.`);
         await gitExec(['clone', '--depth', '1', repoUrl, '.']);
         await gitExec(['checkout', '--orphan', branchName]);
         await gitExec(['rm', '-rfq', '--ignore-unmatch', '.']);
      }

      await gitExec(['config', 'user.email', gitEmail]);
      await gitExec(['config', 'user.name', gitName]);
      await gitExec(['config', 'http.postBuffer', '157286400']);
      await exec(`
           touch .rsync-exclude.txt
           echo ".gitignore" >> .rsync-exclude.txt
           echo ".git" >> .rsync-exclude.txt
       `);

      const ignore = FS.readFileSync('.rsync-exclude.txt')
         .toString()
         .split(/[\r\n]+/)
         .filter(Boolean);
      await syncDirectories(Path.join('..', sourceDirectory), '.', { ignore });
      FS.writeFileSync('.gitlog', gitLog);

      await exec(`
           rm -f .rsync-exclude.txt
       `);
      await gitExec(['add', '-u']);
      await gitExec(['add', '-A', '.']);

      // find new commit messages
      {
         const gitdiff = await gitExec(['diff', '--color=never', '--staged', '.gitlog']);
         const added: string[] = [];
         const removed: string[] = [];
         gitdiff.split(/[\n\r]+/).forEach((line) => {
            const message = line.substring(1).trim();
            if (line.startsWith('+') && !line.startsWith('++')) {
               return added.push(message);
            }
            if (line.startsWith('-') && !line.startsWith('--')) {
               return removed.push(message);
            }
         });
         output.messages = added.filter((message) => !removed.includes(message));
      }

      const gitDiff = await (async () => {
         try {
            return await gitExec(['diff-index', 'HEAD', '--']);
         } catch (error) {
            return true;
         }
      })();

      log(`Git diff: ${gitDiff}`);

      if (gitDiff) {
         const message = getCommitMessage({
            ...output,
            ...hvPublishOutput,
         });
         await gitExec(['commit', '-a', '-m', message]);
         output.commit = (await gitExec(['rev-parse', 'HEAD'])).trim();
         await gitExec(['push', 'origin', branchName || '']);
         log(`✅  Pushed changes to build repository`);

         if (tagValue) {
            if (typeof tagValue === 'boolean' && hvPublishOutput?.deploy?.index) {
               tagValue = `v${hvPublishOutput.deploy.index}`;
            }

            if (typeof tagValue === 'string') {
               await gitExec(['tag', tagValue]);
               await gitExec(['push', 'origin', tagValue]);
               log(`✅  Pushed tag ${tagValue} to build repository`);
            } else {
               output.tag = tagValue;
            }
         }
      } else {
         log(`🆗  No changes to previous build. Nothing to commit.`);
      }

      process.chdir('../');

      if (hvPublishOutput) {
         log('💉  Patching dept.dev', 'magenta');
         const { messages, ...build_repo } = output;
         const data = {
            id: hvPublishOutput.key,
            build_repo,
         };
         const result = await fetch(`https://dept.dev/api/deploy?token=${env('HVIFY_TOKEN')}`, {
            method: 'PATCH',
            headers: {
               'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
         }).then(res => res.json())


         console.log('- sent: ');
         console.dir(data, { colors: true });
         console.log('- receive: ');
         console.dir(result, { colors: true });
         await exec(`rm -rf ${repoDir}`);
      } else {
         console.log('Saving .save2repo.json for potential hv-publish followup');
         FS.writeFileSync('.save2repo.json', JSON.stringify(output));
      }
      FS.writeFileSync('.save2repo.json', JSON.stringify(output));
      // remove repository directory
   }

   await save2repo();
   log('✅  save2repo!');
}

// Call the main function
main().catch((error) => log(`Error: ${error}`, 'red'));