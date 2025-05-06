import Color from 'ansi-colors';
import base64 from 'base-64';
import fetch, { type RequestInit } from 'node-fetch';
import log from '../lib/util/log';
import { Provider, ProviderOptions, RepositoryInfo } from './types';

const provider: Provider = {
   name: 'bitbucket',

   identify(): boolean {
      return !!env('BITBUCKET_REPO_OWNER');
   },

   getOptions(): ProviderOptions {
      return {
         branch: env('BITBUCKET_BRANCH'),
         path: env('BITBUCKET_REPO_OWNER') && env('BITBUCKET_REPO_SLUG') &&
            `${env('BITBUCKET_REPO_OWNER')}/${env('BITBUCKET_REPO_SLUG')}-build`,
         number: Number(env('BITBUCKET_BUILD_NUMBER')) || 0,
         commit: env('BITBUCKET_COMMIT'),
      };
   },

   async getRepository(options: Pick<ProviderOptions, 'path'>): Promise<string> {
      const repoPath = options.path;
      if (!repoPath) throw new Error('Repository path is required');

      log(`Checking availability of bitbucket build repository: ${Color.magenta(repoPath)}`);
      const repoInfo = await getApi(`repositories/${repoPath}`);

      if (!repoInfo.error) {
         log(`☑️  Found build repository «${repoInfo.name}»`);
      } else {
         log(`➕  Creating new build repository ${repoPath}`);
         const currentProject = await getApi(`repositories/${env('BITBUCKET_REPO_OWNER')}/${env('BITBUCKET_REPO_SLUG')}`);
         const newProjectData: RepositoryInfo = {
            scm: currentProject.scm,
            is_private: currentProject.is_private,
            name: `${currentProject.name} (Build)`,
            project: {
               key: currentProject.project.key,
            },
         };
         const newProjectResult = await getApi(`repositories/${repoPath}`, {
            method: 'POST',
            body: JSON.stringify(newProjectData),
         });
         log(`New destination project:\n${JSON.stringify(newProjectResult, null, 2)}`);
      }
      return `https://${env('BB_AUTH_STRING')}@bitbucket.org/${repoPath}.git`;
   },
};

async function getApi(path: string, options: RequestInit = {}): Promise<any> {
   return await getJSON(`https://api.bitbucket.org/2.0/${path}`, options);
}

async function getJSON(url: string, options: RequestInit = {}): Promise<any> {
   const auth = env('BB_AUTH_STRING') || '';
   const response = await fetch(
      url,
      {
         method: 'GET',
         headers: {
            Authorization: `Basic ${base64.encode(auth)}`,
            'Content-Type': 'application/json',
         },
         ...options
      }
   );
   return await response.json();
}

function env(key: string): string | undefined {
   return process.env[key];
}

export default provider; 