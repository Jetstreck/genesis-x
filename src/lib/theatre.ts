import { getProject, type IProject, type ISheet } from '@theatre/core';

let project: IProject;
let sheet: ISheet;

if (typeof window !== 'undefined') {
  // We initialize the Studio only in development mode to edit animations.
  if (process.env.NODE_ENV === 'development') {
    // Dynamically import studio to avoid production overhead
    import('@theatre/studio').then((studio) => {
      studio.default.initialize();
    }).catch(err => {
      console.warn('Failed to load Theatre.js Studio', err);
    });
  }
}

project = getProject('GENESIS_V3');
sheet = project.sheet('Scene Foundation');

export { project, sheet };
