import axios from 'axios'
import FormData from 'form-data'
import fs from 'fs'
import path from 'path'
import Color from 'ansi-colors'

interface CloudflareDeploymentArgs {
   accountId: string
   projectName: string
   source: string
   apiToken: string
   branch: string
   commit: {
      hash: string
      subject: string
   }
}

interface CloudflareDeploymentResult {
   id: string
   url: string
   upload_url: string
   stage: 'pending' | 'success' | 'failed'
}

interface CloudflareManifest {
   version: number
   include: string[]
   exclude: string[]
}

interface CloudflareMetadata {
   branch: string
   commit_hash: string
   commit_message: string
   commit_dirty: boolean
}

async function deployToCloudflare(args: CloudflareDeploymentArgs): Promise<string> {
   console.log(Color.bold('Deploying to Cloudflare Pages'))

   const {
      accountId,
      projectName,
      source,
      apiToken,
      branch,
      commit
   } = args

   if (!accountId || !projectName || !apiToken) {
      throw new Error('Missing required Cloudflare configuration (accountId, projectName, or apiToken)')
   }

   // First, check if the project exists
   try {
      console.log(Color.cyan('Checking if project exists...'))
      await axios({
         method: 'GET',
         url: `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}`,
         headers: {
            'Authorization': `Bearer ${apiToken}`
         }
      })
   } catch (error: any) {
      if (error.response?.status === 404) {
         console.log(Color.cyan('Project not found. Creating new project...'))
         // Create the project
         await axios({
            method: 'POST',
            url: `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects`,
            headers: {
               'Authorization': `Bearer ${apiToken}`,
               'Content-Type': 'application/json'
            },
            data: {
               name: projectName,
               production_branch: branch
            }
         })
      } else {
         throw new Error(`Failed to check project: ${error.message}`)
      }
   }

   // Create deployment
   console.log(Color.cyan('Creating deployment...'))
   const formData = new FormData()

   // Add manifest file
   const manifest: CloudflareManifest = {
      version: 1,
      include: ['./**/*'],
      exclude: []
   }

   formData.append('manifest', JSON.stringify(manifest))

   // Add metadata
   const metadata: CloudflareMetadata = {
      branch,
      commit_hash: commit.hash,
      commit_message: commit.subject,
      commit_dirty: false
   }

   formData.append('metadata', JSON.stringify(metadata))

   // Create deployment
   const deploymentResponse = await axios<{ result: CloudflareDeploymentResult }>({
      method: 'POST',
      url: `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/deployments`,
      headers: {
         'Authorization': `Bearer ${apiToken}`,
         ...formData.getHeaders()
      },
      data: formData
   })

   const deploymentId = deploymentResponse.data.result.id
   const uploadUrl = deploymentResponse.data.result.upload_url

   // Upload files
   console.log(Color.cyan('Uploading files...'))
   const files = getAllFiles(source)
   const uploadFormData = new FormData()

   files.forEach(file => {
      const relativePath = path.relative(source, file)
      uploadFormData.append('files', fs.createReadStream(file), relativePath)
   })

   await axios({
      method: 'POST',
      url: uploadUrl,
      headers: {
         ...uploadFormData.getHeaders()
      },
      data: uploadFormData,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
   })

   // Wait for deployment to complete
   console.log(Color.cyan('Waiting for deployment to complete...'))
   let deployment: CloudflareDeploymentResult
   do {
      const status = await axios<{ result: CloudflareDeploymentResult }>({
         method: 'GET',
         url: `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/deployments/${deploymentId}`,
         headers: {
            'Authorization': `Bearer ${apiToken}`
         }
      })
      deployment = status.data.result
      if (deployment.stage === 'failed') {
         throw new Error('Deployment failed')
      }
      if (deployment.stage !== 'success') {
         await new Promise(resolve => setTimeout(resolve, 2000))
      }
   } while (deployment.stage !== 'success')

   console.log(Color.green.bold('Successfully deployed to'), Color.magenta.bold(deployment.url))
   return deployment.url
}

function getAllFiles(dir: string): string[] {
   const files: string[] = []
   const items = fs.readdirSync(dir)

   items.forEach(item => {
      const fullPath = path.join(dir, item)
      if (fs.statSync(fullPath).isDirectory()) {
         files.push(...getAllFiles(fullPath))
      } else {
         files.push(fullPath)
      }
   })

   return files
}

export default deployToCloudflare 