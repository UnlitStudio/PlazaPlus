var path = require('path');
var clone = require('lodash.clone');

module.exports = function(grunt) {
	var webpack = require('./webpack.config.js');
	var wpwatch = clone(webpack);
	wpwatch.watch = true;
	wpwatch.keepalive = true;

	grunt.initConfig({
		clean: {
			dist: ['dist/', '*.zip'],
			dev: ['manifest.json', 'js/']
		},
		compress: {
			dist: {
				files: [
					{src: ['res/**', 'util/**', 'icon.png', 'manifest.json'], dest: '/'},
					{expand: true, cwd: 'dist/', src: '**', dest: 'js/'}
				], options: {archive: 'dist.zip'}
			},
			src: {
				files: [{
					src: [
						'res/**', 'src/**', 'util/**', 'Gruntfile.js', 'icon.png', 'LICENSE', 'manifest.js',
						'package.json', 'README.md', 'tsconfig.json', 'typings.json', 'webpack.config.js'
					], dest: '/'
				}], options: {archive: 'src.zip'}
			}
		},
		uglify: {
			main: {expand: true, cwd: 'js/', src: '*.js', dest: 'dist/'},
			options: {compress: {dead_code: true}, mangle: false}
		},
		watch: {
			manifest: {
				files: ['manifest.yml'],
				tasks: ['manifest'],
				options: {
					atBegin: true, spawn: false
				}
			},
			webpack: {
				files: [],
				tasks: ['webpack:watch'],
				options: {
					atBegin: true, spawn: false
				}
			}
		},
		webpack: {main: webpack, watch: wpwatch}
	});
	
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-compress');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-webpack');
	grunt.registerTask('manifest', 'Creates manifest.json', function() {
		grunt.file.write('manifest.json', JSON.stringify(grunt.file.readYAML('manifest.yml')));
	});
	
	grunt.registerTask('default', ['manifest', 'webpack:main']);
	grunt.registerTask('zip', ['clean', 'default', 'uglify', 'compress']);
};
