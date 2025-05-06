import log from './log';

export function exec(cmd: string, options: { cwd?: string } = {}): Promise<string> {
   return new Promise((resolve, reject) => {
      log(addSpaceToBeginning(trimLines(cmd)).replace(' ', '►'), 'gray')
      require('child_process').exec(cmd, options, (error: Error | null, stdout: string, stderr: string) => {
         if (error) {
            log(addSpaceToBeginning(stderr), 'red')
            reject(error)
         } else {
            log(addSpaceToBeginning(stdout), 'green')
            resolve(stdout)
         }
      })
   })
}

function addSpaceToBeginning(str: string): string {
   return str.replace(/^/gm, '   ')
}

function trimLines(str: string): string {
   return str.replace(/^\s+/gm, '')
} 