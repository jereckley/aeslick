import * as glob from 'glob';

export const fileList = (pattern: string): string => {
  const filePaths = glob.sync(pattern);

  let data = '// All files in this directory\n\n';

  filePaths.forEach((file) => {
    data += file + '\n';
  });
  return data;
};
