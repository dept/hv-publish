import Color from 'ansi-colors';

export async function loadSecrets(token: string | undefined = process.env.INFISICAL_TOKEN) {
   if (!token) {
      return {}
   }
   console.log("Loading secrets from infisical ...")


   const { secrets }: { secrets: { secretKey: string, secretValue: string }[] } = await fetch("https://eu.infisical.com/api/v3/secrets/raw", {
      headers: {
         'Authorization': `Bearer ${token}`,
         'Content-Type': 'application/json',
      },
   }).then(res => res.json())

   const variables: Record<string, string> = {}
   for (const secret of secrets) {
      if (typeof secret.secretValue === 'string') {
         variables[secret.secretKey] = secret.secretValue
      }
   }
   console.log("- ✅ Loaded secrets from infisical:\n", Object.keys(variables).map(key => `- ${key}`).join("\n"))
   return variables
}

/**
 * Load secrets from Infisical and apply them to process.env without overwriting existing values
 */
export async function loadAndApplySecrets(token?: string | undefined) {
   const finalToken = token || process.env.INFISICAL_TOKEN || process.env.HVPUBLISH_SECRETS || process.env.DACH_HVPUBLISH_SECRETS
   if (!finalToken) {
      console.log(Color.gray("Not using infisical secrets ... (no token provided, e.g. INFISICAL_TOKEN)"))
   }
   const secrets = await loadSecrets(finalToken)

   // Apply secrets to process.env without overwriting existing values
   for (const [key, value] of Object.entries(secrets)) {
      if (process.env[key] === undefined) {
         process.env[key] = value
      }
   }

   return secrets
}


