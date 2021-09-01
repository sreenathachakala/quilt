const path = require('path')

const CompressionPlugin = require('compression-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')

module.exports = require('./webpack.base')({
  mode: 'production',

  // In production, we skip all hot-reloading stuff
  entry: {
    desktop: path.join(process.cwd(), 'app/desktop'),
  },

  // Utilize long-term caching by adding content hashes (not compilation hashes) to compiled assets
  output: {
    filename: '[name].[contenthash].js',
    chunkFilename: '[name].[contenthash].chunk.js',
    publicPath: './',
  },

  optimization: {
    minimizer: [new TerserPlugin({ parallel: 3 })],
    runtimeChunk: 'single',
    splitChunks: { chunks: 'all' },
  },

  plugins: [
    new CompressionPlugin({
      algorithm: 'gzip',
      test: /\.js$|\.css$|\.html$/,
      threshold: 10240,
      minRatio: 0.8,
    }),
  ],

  devtool: 'source-map',

  performance: {
    assetFilter: (assetFilename) => !/(\.map$)|(^(main\.|favicon\.))/.test(assetFilename),
  },

  target: 'electron-renderer',
})
