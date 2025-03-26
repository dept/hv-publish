import * as path from 'path';
import syncDirectory from './sync-directory';

interface SyncOptions {
   ignore?: string[];
}

const defaultOptions: SyncOptions = {
   ignore: [],
};

function sync(source: string, destination: string, options: SyncOptions = {}): void {
   options = Object.assign({}, defaultOptions, options);
   const sourceResolved = path.resolve(source);
   const destinationResolved = path.resolve(destination);
   console.log(`Syncing directories:
    from: ${sourceResolved}
    to: ${destinationResolved}
    ignoring: ${options.ignore?.join(', ') || 'none'}
`);
   syncDirectory(sourceResolved, destinationResolved, {
      exclude: options.ignore || null,
   });
}

export default sync; 