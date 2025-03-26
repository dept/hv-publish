type ExcludePattern = string | RegExp | ((path: string) => boolean);

export const _isArray = (o: any): boolean => {
   return Object.prototype.toString.call(o) === '[object Array]';
};

const _testStringOrRegExp = (relativeFilePath: string, exclude: ExcludePattern): boolean => {
   if (typeof exclude === 'string') {
      return relativeFilePath.indexOf(exclude) !== -1;
   } else if (Object.prototype.toString.call(exclude) === '[object RegExp]') {
      return (exclude as RegExp).test(relativeFilePath);
   } else if (typeof exclude === 'function') {
      return exclude(relativeFilePath);
   }
   return false;
};

export const test = (relativeFilePath: string, exclude: ExcludePattern | ExcludePattern[] | null): boolean => {
   if (!exclude) {
      return false;
   }

   if (_testStringOrRegExp(relativeFilePath, exclude as ExcludePattern)) {
      return true;
   }

   if (Array.isArray(exclude)) {
      for (let i = 0; i < exclude.length; i++) {
         if (_testStringOrRegExp(relativeFilePath, exclude[i])) {
            return true;
         }
      }
   }

   return false;
}; 