import * as fs from 'fs';

export default (filePath: string): boolean => {
   let isDirectory = false;
   if (fs.existsSync(filePath)) {
      try {
         isDirectory = fs.statSync(filePath).isDirectory();
      } catch (err) {
         // Ignore error
      }
   }
   return isDirectory;
}; 