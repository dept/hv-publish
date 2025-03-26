import * as Color from 'ansi-colors';
import axios from 'axios';
// Note: Netlify package doesn't have TypeScript definitions
const Netlify = require('netlify');
import * as FS from 'fs';

interface DeployArgs {
   sitename: string;
   site: string;
   netlify: string;
   source: string;
   commit: {
      subject: string;
   };
}

// Using more permissive types since Netlify SDK doesn't have proper TS definitions
interface NetlifySite {
   id: string;
   [key: string]: any;  // Allow other properties
}

interface DeployResult {
   deploy: {
      deploy_ssl_url: string;
      [key: string]: any;  // Allow other properties
   };
}

interface NetlifyClient {
   getSite: (args: { site_id: string }) => Promise<NetlifySite>;
   createSite: (args: { body: { name: string; force_ssl: boolean } }) => Promise<NetlifySite>;
   deploy: (site_id: string, build_dir: string, opts: any) => Promise<DeployResult>;
}

// Using any for client since we don't have proper types
async function deployToNetlify(args: DeployArgs): Promise<string> {
   const netlify_name = `${args.sitename}`;
   const netlify_site = `${args.site}`;

   console.log(Color.bold('Deploying to Netlify'));
   const client: NetlifyClient = new Netlify(args.netlify);
   let site: NetlifySite | false = false;

   try {
      console.log(Color.cyan('Checking site'), netlify_site);
      site = await client.getSite({
         site_id: netlify_site,
      });
   } catch (error: unknown) {
      // Creating a site (if not yet)
      console.log(Color.cyan('Site not found. Creating'), netlify_site);

      site = await client.createSite({
         body: {
            name: netlify_name,
            force_ssl: true,
         },
      });

      // Assigning site to HV Team
      // this is unfortunately not part of Netlify's open api
      console.log(Color.cyan('Assigning to HV Team'));

      await axios({
         url: `https://api.netlify.com/api/v1/sites/${site.id}/transfer`,
         data: {
            account_id: '5a573203a6188f7ad3e2362c',
         },
         method: 'POST',
         headers: {
            Authorization: `Bearer ${args.netlify}`,
         },
      });
   }

   console.log(Color.cyan('Site for'), netlify_site);

   // Add headers file
   FS.writeFileSync(`${args.source}/_headers`, '/*\n  Cache-Control: public, max-age=31536000\n');

   // Uploading files, actually deploying
   const functionsDir = `${args.source}/functions`;

   const result: DeployResult = await client.deploy(netlify_site, args.source, {
      fnDir: FS.existsSync(functionsDir) ? functionsDir : null,
      draft: true,
      message: args.commit.subject,
      parallelUpload: 30,
      statusCb: (statusObj: { msg: string }) => {
         console.log(`- ${statusObj.msg}`);
      },
   });

   console.log(Color.cyan('Deployed to'), netlify_site);
   console.log(Color.green.bold(`Successfully deployed to`), Color.magenta.bold(result.deploy.deploy_ssl_url));

   return result.deploy.deploy_ssl_url;
}

export default deployToNetlify; 