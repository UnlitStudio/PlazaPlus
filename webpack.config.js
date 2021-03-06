var CommonsChunkPlugin = require('webpack/lib/optimize/CommonsChunkPlugin');

module.exports = {
	entry: {
		bg: './src/bg.ts',
		chat: './src/chat.ts',
		chatNav: './src/chatNav.ts',
		options: './src/options.ts',
		vendor: ['jquery', 'lodash', 'linkifyjs', 'tinycolor2']
	},

	output: {
		path: 'js/',
		filename: '[name].js',
		devtoolModuleFilenameTemplate: '/[resource-path]'
	},

	devtool: 'source-map',

	resolve: {
		extensions: ['', '.webpack.js', '.web.js', '.ts', '.tsx', '.js']
	},

	module: {
		loaders: [
			{ test: /\.tsx?$/, loader: 'ts-loader' },
			{ test: /\.less$/, loader: 'style!css!less' },
			{ test: /\.css$/, loader: 'style!css' }
		],

		preLoaders: [
			{ test: /\.js$/, loader: 'source-map-loader' }
		]
	},

	plugins: [
		new CommonsChunkPlugin({
			names: ['common', 'vendor'],
			minChunks: 2
		})
	],

	ts: {silent: true}, failOnError: false
};
