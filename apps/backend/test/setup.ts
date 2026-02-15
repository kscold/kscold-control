// Jest setup file for custom matchers and global test configuration
import '@jest/globals';

// Add custom matchers
expect.extend({
  toHaveBeenCalledBefore(received: any, other: any) {
    const receivedCalls = received.mock?.invocationCallOrder || [];
    const otherCalls = other.mock?.invocationCallOrder || [];

    if (receivedCalls.length === 0) {
      return {
        message: () => `expected function to have been called`,
        pass: false,
      };
    }

    if (otherCalls.length === 0) {
      return {
        message: () => `expected other function to have been called`,
        pass: false,
      };
    }

    const pass = receivedCalls[0] < otherCalls[0];

    return {
      message: () =>
        pass
          ? `expected function not to have been called before other function`
          : `expected function to have been called before other function`,
      pass,
    };
  },
});

export {};
