jest.mock('react-native-mmkv', () => ({
  createMMKV: jest.fn(() => {
    const values = new Map();
    return {
      getString: key => values.get(key),
      set: (key, value) => values.set(key, value),
      remove: key => values.delete(key),
      clearAll: () => values.clear(),
    };
  }),
}));

jest.mock('react-native-change-icon', () => ({
  changeIcon: jest.fn(() => Promise.resolve()),
  getIcon: jest.fn(() => Promise.resolve('cool')),
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(() => Promise.resolve({isConnected: true, isInternetReachable: true})),
  },
}));

jest.mock('@react-native-clipboard/clipboard', () => ({
  __esModule: true,
  default: {
    getString: jest.fn(() => Promise.resolve('')),
    setString: jest.fn(),
  },
}));
