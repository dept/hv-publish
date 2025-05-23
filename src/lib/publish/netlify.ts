import * as Color from 'ansi-colors';
import { exec } from '../util/exec';
import * as FS from 'fs';

interface DeployArgs {
   /**
    * Netlify API token
    */
   netlify: string;
   /**
    * Netlify site name
    */
   sitename: string;
   /**
    * Netlify site id
    */
   site: string;
   /**
    * Netlify account/team slug
    */
   accountSlug?: string;
   source: string;
   commit: {
      subject: string;
   };
}

async function deployToNetlify(args: DeployArgs): Promise<string> {
   console.log(Color.bold('Deploying to Netlify'));
   const { netlify, sitename, site, accountSlug, source, commit } = args;

   // Set Netlify token as environment variable for CLI
   process.env.NETLIFY_AUTH_TOKEN = netlify;

   // Add headers file for cache control
   FS.writeFileSync(`${source}/_headers`, '/*\n  Cache-Control: public, max-age=31536000\n');

   try {
      // Try to deploy with the provided site parameter first
      let siteId = site;
      let deployCommand = `npx --yes netlify-cli deploy --json --dir ${source}`;

      if (siteId) {
         deployCommand += ` --site=${siteId}`;
      }

      if (commit && commit.subject) {
         deployCommand += ` --message="${commit.subject.replace(/"/g, "'")}"`;
      }

      try {
         // Try deployment
         const result = await exec(deployCommand);
         const deployOutput = JSON.parse(result);
         const deployUrl = deployOutput.deploy_url || deployOutput.url;

         if (!deployUrl) {
            throw new Error('Could not find deployment URL in netlify-cli output');
         }

         console.log(Color.cyan('Deployed to site ID:'), Color.bold(siteId));
         console.log(Color.green.bold(`Successfully deployed to`), Color.magenta.bold(deployUrl));

         return deployUrl;

      } catch (deployError: any) {
         // If deployment failed due to site not found or similar, create a new site
         if (deployError.message.includes('site not found') ||
            deployError.message.includes('Project not found') ||
            (!siteId && !deployError.message.includes('already exists'))) {

            console.log(Color.cyan(`Creating new site '${sitename}'...`));
            try {
               // Create site with account-slug to avoid interactive prompt
               const createResult = await exec(`npx --yes netlify-cli sites:create --name=${sitename} --account-slug=${accountSlug || 'dept-ch'}`);

               // Parse the site ID from the output
               // Remove ANSI color codes before matching
               const cleanResult = createResult.replace(/\x1b\[[0-9;]*m/g, '');
               console.log('Cleaned output:', cleanResult); // Debug log

               const siteIdMatch = cleanResult.match(/Project ID:\s*([a-f0-9-]+)/);
               if (!siteIdMatch) {
                  throw new Error('Could not find Project ID in creation output');
               }
               siteId = siteIdMatch[1];
               console.log(Color.cyan(`Created new site with ID: ${siteId}`));

               // If the project is already linked to another site, unlink it first
               if (cleanResult.includes('Project already linked')) {
                  console.log(Color.cyan('Unlinking existing project...'));
                  await exec('npx --yes netlify-cli unlink');
               }
            } catch (createError: any) {
               if (createError.message.includes('already exists')) {
                  // If site exists but we don't have the ID, we need to get it from the list
                  console.log(Color.cyan('Site exists, fetching site ID...'));
                  const siteInfo = await exec(`npx --yes netlify-cli sites:list --json`);
                  const sites = JSON.parse(siteInfo);
                  const existingSite = sites.find((s: any) => s.name === sitename);
                  if (existingSite) {
                     siteId = existingSite.id;
                     console.log(Color.cyan(`Found existing site with ID: ${siteId}`));
                  } else {
                     throw new Error(`Site name '${sitename}' exists but could not find its ID`);
                  }
               } else {
                  throw createError;
               }
            }

            // Link the project to the new site
            console.log(Color.cyan('Linking project to site...'));
            try {
               await exec(`npx --yes netlify-cli link --id ${siteId}`);
            } catch (linkError: any) {
               if (linkError.message.includes('different site')) {
                  await exec('npx --yes netlify-cli unlink');
                  await exec(`npx --yes netlify-cli link --id ${siteId}`);
               } else if (!linkError.message.includes('already linked')) {
                  throw linkError;
               }
            }

            // Try deployment again with the new site ID
            deployCommand = `npx --yes netlify-cli deploy --json --dir ${source} --site=${siteId}`;
            if (commit && commit.subject) {
               deployCommand += ` --message="${commit.subject.replace(/"/g, "'")}"`;
            }

            const retryResult = await exec(deployCommand);
            const retryOutput = JSON.parse(retryResult);
            const retryUrl = retryOutput.deploy_url || retryOutput.url;

            if (!retryUrl) {
               throw new Error('Could not find deployment URL in netlify-cli output');
            }

            console.log(Color.cyan('Deployed to site ID:'), Color.bold(siteId));
            console.log(Color.green.bold(`Successfully deployed to`), Color.magenta.bold(retryUrl));

            return retryUrl;
         } else {
            throw deployError;
         }
      }
   } catch (error: any) {
      console.log(Color.red('Deployment failed:'), error.message);
      throw error;
   }
}

export default deployToNetlify; 