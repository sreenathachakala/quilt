const path = require('path')

const CircularDependencyPlugin = require('circular-dependency-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const webpack = require('webpack')

module.exports = require('./webpack.base')({
  mode: 'development',

  devServer: {
    compress: true,
    headers: { 'Access-Control-Allow-Origin': '*' },
    historyApiFallback: {
      disableDotRule: false,
      verbose: true,
    },
    index: 'desktop.html',
    hot: true,
    lazy: false,
    noInfo: true,
    port: process.env.PORT || 3000,
    publicPath: '/',
    stats: 'normal',
    watchOptions: {
      aggregateTimeout: 300,
      ignored: /node_modules/,
      poll: 100,
    },
  },

  // Add hot reloading in development
  entry: {
    desktop: path.join(process.cwd(), 'app/desktop'),
  },

  optimization: {
    emitOnErrors: false,
    splitChunks: { chunks: 'all' },
  },

  // Add development plugins
  plugins: [
    new CopyWebpackPlugin({ patterns: [{ from: 'static-dev' }] }),

    new webpack.HotModuleReplacementPlugin(), // Tell webpack we want hot reloading

    new CircularDependencyPlugin({
      exclude: /a\.js|node_modules/, // exclude node_modules
      failOnError: false, // show a warning when there is a circular dependency
    }),
  ],

  // Emit a source map for easier debugging
  // See https://webpack.js.org/configuration/devtool/#devtool
  devtool: 'eval-source-map',

  performance: {
    hints: false,
  },

  target: 'electron-renderer',
})
