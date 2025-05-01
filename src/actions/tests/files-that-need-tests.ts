import * as glob from 'glob';

export const filesNeeded = (pattern: string): string[] => {
  const filePaths = glob.sync(pattern);

  const neededList: string[] = [];

  filePaths.forEach((file) => {
    if (
      file.includes('types.ts') ||
      file.includes('.test.ts') ||
      file.includes('.spec.ts') ||
      file.includes('.fixture.ts') ||
      file.includes('.document.ts') ||
      file.includes('.mock.ts')
    ) {
      return;
    }
    const fileName = file.replace('.ts', '');
    const hasTests = filePaths.includes(fileName + '.test.ts');
    if (!hasTests) {
      neededList.push(file);
    }
  });
  return neededList;
};
