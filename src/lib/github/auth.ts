import * as jwt from 'jsonwebtoken';

// Create a JWT
async function createJWT(appId: string, privateKey: string): Promise<string> {
   const now = Math.floor(Date.now() / 1000);

   const payload = {
      iat: now - 60, // Issued 60 seconds ago (to avoid clock drift)
      exp: now + 600, // Expires in 10 minutes
      iss: appId
   };

   return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
}

// Get installation token using JWT
async function getInstallationToken(
   jwtToken: string,
   installationId: string
): Promise<string> {
   try {
      const response = await fetch(
         `https://api.github.com/app/installations/${installationId}/access_tokens`,
         {
            method: 'POST',
            headers: {
               Authorization: `Bearer ${jwtToken}`,
               Accept: 'application/vnd.github+json',
               'X-GitHub-Api-Version': '2022-11-28'
            }
         }
      );

      if (!response.ok) {
         throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.token;
   } catch (error) {
      console.error('Error getting installation token:', error);
      throw error;
   }
}

// Example usage
export async function generateGitHubAppToken(
   appId: string,
   privateKey: string,
   installationId: string
): Promise<string> {
   try {
      console.log("🔐 Generating GitHub App Token")
      // Step 1: Generate JWT
      const jwtToken = await createJWT(appId, privateKey);
      console.log(`- ✅ got GitHub App JWT token`);

      // Step 2: Get installation access token
      const installationToken = await getInstallationToken(jwtToken, installationId);
      console.log(`- ✅ got GitHub App Installation Token`);

      return installationToken;
   } catch (error) {
      console.error('Error generating token:', error);
      throw error;
   }
}

let token: string | null = null;
export async function retrieveGithubAppToken() {
   if (token) return token;

   const appId = process.env.GH_BUILD_APP_ID;
   const installationId = process.env.GH_BUILD_INSTALL_ID;
   const privateKey = process.env.GH_BUILD_PRIVATE_KEY;

   if (!appId || !installationId || !privateKey) {
      throw new Error('GitHub App credentials missing. Please ensure GH_BUILD_APP_ID, GH_BUILD_INSTALL_ID, and GH_BUILD_PRIVATE_KEY are set.');
   }

   token = await generateGitHubAppToken(appId, privateKey, installationId);
   return token;
}

// Usage example
