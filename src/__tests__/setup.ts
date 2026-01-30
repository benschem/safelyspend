/**
 * Vitest test setup file
 * This runs before each test file
 */
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test case (important for React Testing Library)
afterEach(() => {
  cleanup();
});

// Extend matchers if needed in the future
// import matchers from '@testing-library/jest-dom/matchers';
// expect.extend(matchers);
