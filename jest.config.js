module.exports = {
    preset: '@react-native/jest-preset',
    roots: ['<rootDir>/__tests__'],
    transformIgnorePatterns: ['node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-url-polyfill)/)'],
    setupFilesAfterEnv: ['<rootDir>/test/jest.setup.js'],
};
