import * as fs from 'fs';
import * as fse from 'fs-extra';
import isDirectoryUtil from './is-directory';
import readdirEnhanced from 'readdir-enhanced';
import * as excludeUtil from './exclude';
import { ignoredSymlinkDirs } from './config';

interface SyncOptions {
   type: 'hardlink' | 'copy';
   exclude: any;
   forceSync: (path: string) => boolean;
   afterSync: (data: { type: string; relativePath: string }) => void;
   deleteOrphaned: boolean;
   supportSymlink: boolean;
   filter: (path: string) => boolean;
   onError: (error: Error) => void;
}

interface Stats {
   path: string;
}

const readdirSync = (dir: string, filter?: any): string[] => {
   return readdirEnhanced.sync(dir, {
      deep: filter || true,
      basePath: dir,
   });
};

const utimeFile = (filePath: string): void => {
   const time = (Date.now() - 10 * 1000) / 1000;
   fs.utimesSync(filePath, time, time);
};

const linkDirFiles = (relativeFilePath: string, srcPath: string, targetPath: string, supportSymlink: boolean): void => {
   try {
      const stats = fs.lstatSync(srcPath);
      const isSymlink = stats.isSymbolicLink();

      if (supportSymlink && isSymlink) {
         fse.ensureSymlinkSync(srcPath, targetPath);
         ignoredSymlinkDirs.push(srcPath);
      } else {
         if (stats.isFile()) {
            if (fs.existsSync(targetPath)) {
               if (stats.ino !== fs.statSync(targetPath).ino) {
                  fse.removeSync(targetPath);
                  fse.ensureLinkSync(srcPath, targetPath);
                  utimeFile(targetPath);
               }
            } else {
               fse.ensureLinkSync(srcPath, targetPath);
               utimeFile(targetPath);
            }
         } else if (stats.isDirectory()) {
            fse.ensureDirSync(targetPath);
         }
      }
   } catch (err) {
      // no log output for safe
   }
};

// ... existing code for copyDirFiles and removeFile ...

const syncFiles = (srcDir: string, targetDir: string, options: SyncOptions): void => {
   try {
      const srcFiles = readdirSync(srcDir, (stats: Stats) => {
         const filePath = stats.path;
         const isDirectory = isDirectoryUtil(filePath);
         const relativePath = `${filePath.replace(srcDir, '')}${isDirectory ? '/' : ''}`;

         if (options.forceSync(relativePath)) {
            return true;
         }

         if (excludeUtil.test(relativePath, options.exclude)) {
            return false;
         }

         return true;
      });
      // ... rest of the syncFiles implementation ...
   } catch (err) {
      options.onError(err as Error);
   }
};

export default (srcDir: string, targetDir: string, options: SyncOptions): void => {
   fse.ensureDirSync(targetDir);
   syncFiles(srcDir, targetDir, options);
}; 