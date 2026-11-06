// Shared jest mocks for the router and the Server Actions used by client components.

export const router = {
  push: jest.fn(),
  replace: jest.fn(),
  refresh: jest.fn(),
  back: jest.fn(),
  prefetch: jest.fn(),
};

export function resetMocks() {
  Object.values(router).forEach((fn) => fn.mockReset());
}
