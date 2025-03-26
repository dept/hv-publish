import { exec } from './exec';

interface CommitAuthor {
   name: string;
   email: string;
}

interface CommitInfo {
   hash: string;
   subject: string;
   date: string;
   author: CommitAuthor;
   branch: string;
}

export async function getCommitInfo(commit: string, branch: string): Promise<CommitInfo> {
   // TODO: JSON is invalid when subject contains double quote – let's save as simple lines and read from there
   const DELIMITER = '--*--';
   const cmd = `git log --pretty=format:'%H${DELIMITER}%s${DELIMITER}%aI${DELIMITER}%aN${DELIMITER}%aE' -n 1 ${commit}`;
   const output = await exec(cmd);
   console.log(output);
   const outputItems = output.split(DELIMITER);

   const result: CommitInfo = {
      hash: outputItems[0],
      subject: outputItems[1],
      date: outputItems[2],
      author: {
         name: outputItems[3],
         email: outputItems[4],
      },
      branch: branch
   };

   return result;
} 