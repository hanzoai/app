// Jest setup file
// Add any global test setup here

// Set test environment
process.env.NODE_ENV = 'test';

// Mock environment variables for tests
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'test-secret';

// Add custom matchers if needed
expect.extend({
  toBeValidUrl(received) {
    try {
      new URL(received);
      return {
        pass: true,
        message: () => `expected ${received} not to be a valid URL`,
      };
    } catch {
      return {
        pass: false,
        message: () => `expected ${received} to be a valid URL`,
      };
    }
  },
});