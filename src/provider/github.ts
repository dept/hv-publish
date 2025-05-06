import Color from 'ansi-colors';
import fetch, { type RequestInit } from 'node-fetch';
import log from '../lib/util/log';
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

export async function setGithubStatus({
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

export default provider; 