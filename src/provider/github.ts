import Color from 'ansi-colors';
import fetch, { type RequestInit } from 'node-fetch';
import log from '../lib/log';
import { Provider, ProviderOptions } from './types';

const provider: Provider = {
   name: 'github',

   identify(): boolean {
      return !!env('GITHUB_REPOSITORY');
   },

   getOptions(): ProviderOptions {
      const [owner, repo] = (env('GITHUB_REPOSITORY') || '').split('/');
      return {
         branch: env('GITHUB_REF_NAME'),
         path: owner && repo && `${owner}/${repo}-build`,
         number: Number(env('GITHUB_RUN_NUMBER')) || 0,
         commit: env('GITHUB_SHA'),
      };
   },

   async getRepository(options: Pick<ProviderOptions, 'path'>): Promise<string> {
      const repoPath = options.path;
      if (!repoPath) throw new Error('Repository path is required');

      log(`Checking availability of GitHub build repository: ${Color.magenta(repoPath)}`);
      const repoInfo = await getApi(`repos/${repoPath}`);

      if (repoInfo.message !== 'Not Found') {
         log(`☑️  Found build repository «${repoInfo.name}»`);
      } else {
         log(`➕  Creating new build repository ${repoPath}`);
         const [owner, repoName] = repoPath.split('/');
         const newProjectData = {
            name: repoName,
            private: true,
            description: `Build repository for ${env('GITHUB_REPOSITORY')}`,
         };

         const newProjectResult = await getApi(`user/repos`, {
            method: 'POST',
            body: JSON.stringify(newProjectData),
         });
         log(`New destination project:\n${JSON.stringify(newProjectResult, null, 2)}`);
      }
      return `https://x-access-token:${env('GITHUB_ACCESS_TOKEN') || env('GITHUB_TOKEN')}@github.com/${repoPath}.git`;
   },
};

async function getApi(path: string, options: RequestInit = {}): Promise<any> {
   return await getJSON(`https://api.github.com/${path}`, options);
}

async function getJSON(url: string, options: RequestInit = {}): Promise<any> {
   const token = env('GITHUB_ACCESS_TOKEN') || env('GITHUB_TOKEN');
   const response = await fetch(
      url,
      {
         method: 'GET',
         headers: {
            Authorization: `token ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'node-fetch'
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