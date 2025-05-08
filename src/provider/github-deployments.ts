/**
 * Minimal Deployments-API wrapper that mimics your old setGithubStatus()
 *
 * 1. createDeployment()  – like pushing a commit status, returns deployment_id
 * 2. setDeploymentStatus() – attaches state + URL and makes the button appear
 */

export interface DeployConfig {
   sha: string;
   repo: string;
   owner: string;
   github_token: string;
}

export async function createDeployment({
   sha,
   repo,
   owner,
   github_token,
   ref = sha,                // usually the same commit you just built
   environment = 'preview',  // or "production"
   description = '',
}: DeployConfig & { ref?: string; environment?: string; description?: string; }) {
   const url = `https://api.github.com/repos/${owner}/${repo}/deployments`;
   const body = {
      ref,
      sha,
      environment,
      description,
      auto_merge: false,      // skip branch-protection checks
      required_contexts: [],  // same ^
      transient_environment: environment !== 'production',
      production_environment: environment === 'production',
   };

   const res = await fetch(url, {
      method: 'POST',
      headers: {
         'Authorization': `Bearer ${github_token}`,
         'Accept': 'application/vnd.github+json',
         'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
   });

   if (!res.ok) throw new Error(`Failed to create deployment: ${await res.text()}`);
   const { id } = await res.json();
   console.log(`🚀 Created deployment #${id} for ${sha}`);
   return id as number;
}

export async function setDeploymentStatus({
   deployment_id,
   state,                     // queued | in_progress | success | failure | …
   environment_url,          // 👈 this becomes the “View deployment” link
   log_url,
   description = '',
   repo,
   owner,
   github_token,
}: {
   deployment_id: number;
   state: 'queued' | 'in_progress' | 'success' | 'failure' | 'error';
   environment_url?: string;
   log_url?: string;
   description?: string;
   repo: string;
   owner: string;
   github_token: string;
}) {
   const url =
      `https://api.github.com/repos/${owner}/${repo}/deployments/${deployment_id}/statuses`;
   const body = {
      state,
      environment_url,
      log_url,
      description,
      auto_inactive: true,
   };

   const res = await fetch(url, {
      method: 'POST',
      headers: {
         'Authorization': `Bearer ${github_token}`,
         'Accept': 'application/vnd.github+json',
         'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
   });

   if (!res.ok) throw new Error(`Failed to set deployment status: ${await res.text()}`);
   console.log(`✅ Deployment #${deployment_id} marked «${state}»`);
}
