// Extends app.json. EXPO_BASE_URL lets the browser demo be served from a
// sub-path, e.g. GitHub Pages at https://ou1051.github.io/SnapSort/.
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
  },
});
