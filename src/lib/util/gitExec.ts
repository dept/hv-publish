import { exec } from './exec';

export async function gitExec(args: string[], options: { cwd?: string } = {}) {
   // Use GITHUB_WORKSPACE if available, otherwise fallback to process.cwd()
   const safeDir = process.env.GITHUB_WORKSPACE || process.cwd();
   // Prepend the safe.directory config
   const gitArgs = ['-c', `safe.directory=${safeDir}`, ...args];
   // Build the command string
   const cmd = `git ${gitArgs.map(a => `'${a.replace(/'/g, `'\\''`)}'`).join(' ')}`;
   return exec(cmd, options);
}
