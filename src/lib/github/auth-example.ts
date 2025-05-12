import { loadAndApplySecrets } from "../secrets/infisical";
import { retrieveGithubAppToken } from "./auth";
(async () => {
   // Load secrets from Infisical and apply to process.env
   await loadAndApplySecrets()

   try {
      const token = await retrieveGithubAppToken();

      // Example: Using the token to access a private repository
      const response = await fetch(
         'https://api.github.com/repos/dept/edelweiss-ibe-build',
         {
            headers: {
               Authorization: `token ${token}`,
               Accept: 'application/vnd.github+json',
               'X-GitHub-Api-Version': '2022-11-28'
            }
         }
      );



      if (!response.ok) {
         throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const repoData = await response.json();
      console.dir(repoData, { depth: 0 })


      // lets checkout the repository to the test directory
      const branchName = 'master';
      const repoUrl = 'https://github.com/dept/edelweiss-ibe-build';

      const { exec } = require('child_process');

      exec(`git clone --branch ${branchName} --depth 10 https://x-access-token:${token}@${repoUrl.replace('https://', '')} ./test/cloned`, (error, stdout, stderr) => {
         if (error) {
            console.error(`Error cloning repository: ${error.message}`);
            return;
         }
         if (stderr) {
            console.error(`Git stderr: ${stderr}`);
            return;
         }
         console.log(`Repository cloned successfully: ${stdout}`);
      });

   } catch (error) {
      console.error('Failed to complete the process:', error);
   }
})();