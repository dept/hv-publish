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
   source: string;
   commit: {
      subject: string;
   };
}

async function deployToNetlify(args: DeployArgs): Promise<string> {
   console.log(Color.bold('Deploying to Netlify'));
   const { netlify, sitename, site, source, commit } = args;

   // Set Netlify token as environment variable for CLI
   process.env.NETLIFY_AUTH_TOKEN = netlify;

   // Add headers file for cache control
   FS.writeFileSync(`${source}/_headers`, '/*\n  Cache-Control: public, max-age=31536000\n');

   try {
      console.log(Color.cyan('Deploying files...'));

      // Build the deploy command
      let deployCommand = `npx --yes netlify-cli deploy --json --dir ${source}`;

      // Add site ID if provided
      if (site) {
         deployCommand += ` --site=${site}`;
      }

      // Add message
      if (commit && commit.subject) {
         deployCommand += ` --message="${commit.subject.replace(/"/g, "'")}"`;
      }


      // Execute deployment
      const result = await exec(deployCommand);

      // Parse the JSON output to get the deploy URL
      const deployOutput = JSON.parse(result);
      const deployUrl = deployOutput.deploy_url || deployOutput.url;

      if (!deployUrl) {
         throw new Error('Could not find deployment URL in netlify-cli output');
      }

      console.log(Color.cyan('Deployed to'), site || sitename);
      console.log(Color.green.bold(`Successfully deployed to`), Color.magenta.bold(deployUrl));

      return deployUrl;

   } catch (error: any) {
      console.log(Color.yellow('Deployment issue:'), error.message);

      // If site doesn't exist, create it first
      if (error.message.includes('site not found') || (!site && !error.message.includes('already exists'))) {
         console.log(Color.cyan('Site not found. Creating new site...'));

         // Create site with name
         await exec(`npx --yes netlify-cli sites:create --name=${sitename} --json`);

         // Retry deployment
         return deployToNetlify(args);
      }

      throw error;
   }
}

export default deployToNetlify; 