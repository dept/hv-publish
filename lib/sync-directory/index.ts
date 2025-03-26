import syncLocalFiles from './lib/local-syncfiles';
import isAbsoluteUrl from 'is-absolute';
import fse from 'fs-extra';

interface SyncDirectoryOptions {
   type?: 'hardlink' | 'copy';
   forceSync?: (path: string) => boolean;
   exclude?: string[] | null;
   watch?: boolean;
   deleteOrphaned?: boolean;
   supportSymlink?: boolean;
   cb?: () => void;
   afterSync?: () => void;
   filter?: (path: string) => boolean;
   onError?: (err: Error) => void;
}

export default function syncDirectory(
   srcDir: string,
   targetDir: string,
   {
      type = 'hardlink',
      forceSync = () => false,
      exclude = null,
      watch = false,
      deleteOrphaned = true,
      supportSymlink = false,
      cb = () => { },
      afterSync = () => { },
      filter = () => true,
      onError = (err) => {
         throw err;
      },
   }: SyncDirectoryOptions = {}
): void {
   // check absolute path
   if (!isAbsoluteUrl(srcDir) || !isAbsoluteUrl(targetDir)) {
      console.log('[sync-directory] "srcDir/targetDir" must be absolute path.');
      return;
   }

   fse.ensureDirSync(targetDir);

   syncLocalFiles(srcDir, targetDir, { type, exclude, forceSync, afterSync, deleteOrphaned, supportSymlink, filter, onError });
} 