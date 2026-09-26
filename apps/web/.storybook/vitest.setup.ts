import { configure } from 'storybook/test';

// Storybook's interaction tests run without motion: a dialog, popover or
// sheet is asserted in its final state instead of halfway through its fade,
// which made `toBeVisible()` flaky on slower CI machines.
const style = document.createElement('style');
style.dataset.testNoMotion = '';
style.textContent = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
  }
`;
document.head.append(style);

// A screen story reads its in-memory backend before it renders; under a
// full parallel run that can take longer than testing-library's 1s default.
configure({ asyncUtilTimeout: 5000 });
