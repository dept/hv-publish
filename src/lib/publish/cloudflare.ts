import { exec } from '../util/exec'
import Color from 'ansi-colors'

interface CloudflareDeploymentArgs {
   accountId: string
   apiToken: string
   sitename: string
   /**
    * Directory to upload
    */
   source: string
   branch: string
   commit: {
      hash: string
      subject: string
   }
}

async function deployToCloudflare(args: CloudflareDeploymentArgs): Promise<string> {
   console.log(Color.bold('Deploying to Cloudflare Pages'))
   const { sitename, source, apiToken, branch, commit } = args

   if (!sitename || !apiToken) {
      throw new Error('Missing required Cloudflare configuration')
   }

   // Cloudflare pages doesn't allow uppercase characters in the sitename
   const cfSitename = sitename.toLowerCase()

   // Set CLOUDFLARE_API_TOKEN for wrangler
   process.env.CLOUDFLARE_API_TOKEN = apiToken

   async function performDeploy() {
      console.log(Color.cyan('Deploying files...'))
      let deployCommand = `npx --yes wrangler pages deploy ${source} --project-name ${cfSitename}`

      if (branch !== 'main' && branch !== 'master') {
         deployCommand += ` --branch=${branch}`
      } else {
         deployCommand += ` --branch=main`
      }

      if (commit) {
         deployCommand += ` --commit-message="${commit.subject}" --commit-hash="${commit.hash}"`
      }

      const result = await exec(deployCommand)

      // Extract the deployment URL from wrangler output
      const urlMatch = result.match(/https:\/\/[^\s]+\.pages\.dev/)
      if (!urlMatch) {
         throw new Error('Could not find deployment URL in wrangler output')
      }

      const deployUrl = urlMatch[0]
      console.log(Color.green.bold('Successfully deployed to'), Color.magenta.bold(deployUrl))
      return deployUrl
   }

   try {
      // Try to deploy directly first
      return await performDeploy()

   } catch (error: any) {
      // If deployment failed because project doesn't exist, create it and try again
      console.log(Color.cyan('Project not found. Creating new project...'))
      await exec(`npx --yes wrangler pages project create ${cfSitename} --production-branch=main`)

      // Retry the deployment
      return await performDeploy()
   }
}


export default deployToCloudflare