const path = require('path');
const terser = require('terser-webpack-plugin');
const zlib = require("zlib");
const CompressionPlugin = require("compression-webpack-plugin");
const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyPlugin = require("copy-webpack-plugin");
const IgnoreEmitPlugin = require('ignore-emit-webpack-plugin');


function compress(argv) {
  return new CompressionPlugin({
    filename: '[path][base].br',
    test: /\.js$|\.css$|\.js\.LICENSE\.txt$|\.js\.map$|\.html$|\.wasm$|\.png$|\.otf$|\.eot$|\.svg$|\.ttf$|\.woff$|\.woff2$/,
    algorithm: 'brotliCompress',
    deleteOriginalAssets: true,
    minRatio: Infinity,
    compressionOptions: {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: (argv.mode === 'production')
        ? zlib.constants.BROTLI_MAX_QUALITY
        : zlib.constants.BROTLI_MIN_QUALITY,
      }
    },
  });
}


module.exports = function(env, argv) {
  return [
    // prototype
    {
      entry: {
        'bundle': './src/vis/entry.ts',
        'style.css': `./src/scss/vis.scss`,
      },
      output: {
        path: path.resolve(__dirname, 'dhimmis/vis/static/'),
      },
      mode: argv.mode || 'development',
      devtool: (argv.mode === 'production') ? false : 'eval-cheap-source-map',
      module: {
        rules: [
          {
            test: /\.worker\.js$/i,
            use: [
              {
                loader: 'worker-loader',
                options: {
                  publicPath: '/vis/',
                }
              },
              {
                loader: 'ts-loader',
              },
            ]
          },
          {
            test: /\.scss$/,
            use: [
              MiniCssExtractPlugin.loader,
              { loader: "css-loader", options: { url: false, importLoaders: 1 } },
              { loader: 'postcss-loader', options: { postcssOptions: { plugins: [autoprefixer(), cssnano()] }}},
              { loader: 'sass-loader', options: { implementation: require('sass')}},
            ],
          },
          {
            test: /\.ts$/,
            loader: 'ts-loader',
            exclude: /node_modules/,
            include: [
              path.resolve(__dirname, "src/vis"),
              path.resolve(__dirname, "src/common"),
            ],
            options: {
              compilerOptions: {
                target: 'es5',
              },
            },
          },
          {
            test: /\.template\.html$/,
            use: [
              {
                loader: 'extract-loader'
              },
              {
                loader: 'html-loader',
                options: {
                  minimize: true,
                },
              },
            ],
          },
        ]
      },
      resolve: {
        extensions: [ '.ts', '.js', '.css', '.scss' ]
      },
      optimization: {
        minimizer: [ new terser() ],
      },
      experiments: {
        asyncWebAssembly: true,
      },
      plugins: [
        new CleanWebpackPlugin(),
        compress(argv),
        new MiniCssExtractPlugin({
          filename: '[name]',
        }),
        new IgnoreEmitPlugin(['style.css.js']),
        new CopyPlugin({
          patterns: [
            {from: 'node_modules/golden-layout/src/css/goldenlayout-base.css', to: '.'},
            {from: 'node_modules/leaflet/dist/leaflet.css', to: '.'},
            {from: 'node_modules/@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css', to: '.'},
            {to: 'images/', from: 'node_modules/leaflet/dist/images/layers-2x.png'},
            {to: 'images/', from: 'node_modules/leaflet/dist/images/layers.png'},
            {to: 'schemas/', from: 'src/assets/schemas/'},
          ]
        }),
      ],
    },

    // GeoDB-Editor
    {
      entry: {
        'bundle': './src/geodb/entry.ts',
        'geodb.css': './src/scss/geodb.scss',
      },
      output: {
        path: path.resolve(__dirname, 'dhimmis/geodb_editor/static'),
      },
      mode: argv.mode || 'development',
      devtool: (argv.mode === 'production') ? false : 'eval-cheap-source-map',
      module: {
        rules: [
          {
            test: /\.ts$/,
            loader: 'ts-loader',
            exclude: /node_modules/,
            include: [
              path.resolve(__dirname, "src/common"),
              path.resolve(__dirname, "src/geodb"),
            ],
          },
          {
            test: /\.scss$/,
            use: [
              MiniCssExtractPlugin.loader,
              { loader: "css-loader", options: { url: false, importLoaders: 1 } },
              { loader: 'postcss-loader', options: { postcssOptions: { plugins: [autoprefixer(), cssnano()] }}},
              { loader: 'sass-loader', options: { implementation: require('sass')}},
            ],
          },
        ]
      },
      resolve: {
        extensions: [ '.ts', '.js', '.css', '.scss' ]
      },
      optimization: {
        minimizer: [ new terser() ],
      },
      plugins: [
        compress(argv),
        new CopyPlugin({
          patterns: [
            {from: 'node_modules/leaflet/dist/leaflet.css', to: '.'},
            {from: 'node_modules/tabulator-tables/dist/css/tabulator.min.css', to: '.'},
            {to: 'images/', from: 'node_modules/leaflet-color-number-markers/dist/img/marker-icon-2x-blue.png'},
            {to: 'images/', from: 'node_modules/leaflet-color-number-markers/dist/img/marker-icon-2x-red.png'},
            {to: 'images/', from: 'node_modules/leaflet-color-number-markers/dist/img/marker-icon-2x-grey.png'},
            {to: 'images/', from: 'node_modules/leaflet-color-number-markers/dist/img/marker-icon-blue.png'},
            {to: 'images/', from: 'node_modules/leaflet-color-number-markers/dist/img/marker-icon-red.png'},
            {to: 'images/', from: 'node_modules/leaflet-color-number-markers/dist/img/marker-icon-grey.png'},
            {to: 'images/', from: 'node_modules/leaflet-color-number-markers/dist/img/marker-shadow.png'},
            {to: 'images/', from: 'node_modules/leaflet/dist/images/layers-2x.png'},
            {to: 'images/', from: 'node_modules/leaflet/dist/images/layers.png'},
          ]
        }),
        new CleanWebpackPlugin(),
        new MiniCssExtractPlugin({
          filename: '[name]',
        }),
        new IgnoreEmitPlugin(['geodb.css.js']),
      ],
    },

    // Annotator
    {
      entry: {
        'bundle': './src/annotator',
        'annotator.css': './src/scss/annotator.scss',
        'document-selection.css': './src/scss/annotator-document-selection.scss',
        'document-creation.css': './src/scss/annotator-document-creation.scss',
      },
      output: {
        path: path.resolve(__dirname, 'dhimmis/annotator/static'),
      },
      mode: argv.mode || 'development',
      devtool: (argv.mode === 'production') ? false : 'eval-cheap-source-map',
      module: {
        rules: [
          {
            test: /\.ts$/,
            loader: 'ts-loader',
            exclude: /node_modules/,
            include: [
              path.resolve(__dirname, "src/annotator"),
              path.resolve(__dirname, "src/common"),
            ],
          },
          {
            test: /\.scss$/,
            use: [
              MiniCssExtractPlugin.loader,
              { loader: "css-loader", options: { url: false, importLoaders: 1 } },
              { loader: 'postcss-loader', options: { postcssOptions: { plugins: [autoprefixer(), cssnano()] }}},
              { loader: 'sass-loader', options: { implementation: require('sass')}},
            ],
          },
          {
            test: /\.js$/,
            loader: 'babel-loader',
            options: {
              plugins: [
                "@babel/plugin-proposal-class-properties"
              ],
            },
          },
        ]
      },
      resolve: {
        mainFields: ['module', 'main'],
        extensions: [ '.ts', '.js', '.css', '.scss' ]
      },
      optimization: {
        minimizer: [ new terser() ],
      },
      experiments: {
        topLevelAwait: true,
      },
      plugins: [
        compress(argv),
        new CleanWebpackPlugin(),
        new MiniCssExtractPlugin({
          filename: '[name]',
        }),
        new CopyPlugin({
          patterns: [
            {from: 'node_modules/dom-tree-annotator/lib/dom-tree-annotator.min.css', to: '.'},
          ],
        }),
        new IgnoreEmitPlugin(['annotator.css.js', 'document-selection.css.js', 'document-creation.css.js']),
      ],
    },

    ...([
      // root
      [
        {
          'public/base.css': './src/scss/base.scss',
          'public/40x.css': './src/scss/40x.scss',
          'public/dsgvo.css': './src/scss/dsgvo.scss',
          'style.css': './src/scss/root.scss',
          'public/flash': './src/flashes',
          'public/cookies': './src/cookies',
        },
        'dhimmis/root/static/',
        [
          {from: 'src/assets/favicons/', to: 'public/'},
          {from: 'node_modules/font-awesome/css/font-awesome.min.css', to: 'public/font-awesome/css'},
          {from: 'node_modules/font-awesome/fonts', to: 'public/font-awesome/fonts'},
          {from: 'src/assets/huberlin-logo-white.svg', to: 'public/'},
        ],
      ],

      // login
      [
        {
          'login.css': './src/scss/login.scss',
        },
        'dhimmis/login/static/',
        []
      ],

      // docs
      [
        {
          'user-log/userlog.css': './src/scss/userlog.scss',
          'changelog/changelog.css': './src/scss/changelog_license.scss',
          'license/license.css': './src/scss/changelog_license.scss',
          'api/api.css': './src/scss/documentation.scss',
          'index/index.css': './src/scss/documentation-root.scss',
          'annotator/style.css': './src/scss/annotator-documentation.scss',
          'vis/style.css': './src/scss/visualization-documentation.scss',
        },
        'dhimmis/docs/static/',
        [
          { from: 'src/assets/annotator-documentation/', to: 'annotator', },
          { from: 'src/assets/visualization-documentation/', to: 'vis', },
        ]
      ],

      // reporting
      [
        {
          'report.css': './src/scss/reporting.scss',
          'report-form.css': './src/scss/reporting-form.scss',
          'report-list.css': './src/scss/reporting-list.scss',
          '422.css': './src/scss/reporting-422.scss',
        },
        'dhimmis/reporting/static/',
        [],
      ],

      // URIs
      [
        {
          'map': './src/uri/map.ts',
          'place-search': './src/uri/search.ts',
          'uri.css': './src/scss/uri.scss',
          'place-search.css': './src/scss/uri-place-search.scss',
        },
        'dhimmis/uri/static/',
        [
          {from: 'node_modules/leaflet/dist/leaflet.css', to: '.'},
          {to: 'images/', from: 'node_modules/leaflet-color-number-markers/dist/img/marker-icon-2x-blue.png'},
          {to: 'images/', from: 'node_modules/leaflet-color-number-markers/dist/img/marker-icon-blue.png'},
          {to: 'images/', from: 'node_modules/leaflet-color-number-markers/dist/img/marker-shadow.png'},
        ],
      ],
    ].map(([entry, out, patterns]) => {
      return {
        entry,
        output: {
          path: path.resolve(__dirname, out),
        },
        mode: argv.mode || 'development',
        devtool: (argv.mode === 'production') ? false : 'eval-cheap-source-map',
        module: {
          rules: [
            {
              test: /\.ts$/,
              loader: 'ts-loader',
              exclude: /node_modules/,
              include: [
                path.resolve(__dirname, "src/uri"),
                path.resolve(__dirname, "src/common"),
                path.resolve(__dirname, "src/flashes"),
                path.resolve(__dirname, "src/cookies"),
              ],
            },
            {
              test: /\.scss$/,
              use: [
                MiniCssExtractPlugin.loader,
                { loader: "css-loader", options: { url: false, importLoaders: 1 } },
                { loader: 'postcss-loader', options: { postcssOptions: { plugins: [autoprefixer(), cssnano()] }}},
                { loader: 'sass-loader', options: { implementation: require('sass')}},
              ],
            },
          ]
        },
        resolve: {
          extensions: [ '.ts', '.js', '.css', '.scss' ]
        },
        optimization: {
          minimizer: [ new terser() ],
        },
        experiments: {
          topLevelAwait: true,
        },
        plugins: [
          compress(argv),
          new CleanWebpackPlugin(),
          new MiniCssExtractPlugin({
            filename: '[name]',
          }),
          ...(patterns.length ? [new CopyPlugin({patterns})] : []),
          new IgnoreEmitPlugin(
            Array.from(Object.keys(entry)).filter(base => /\.css$/.test(base)).map(base => `${base}.js`)
          ),
        ],
      };
    })),
  ];
}
