var path = require('path');

module.exports = function(grunt) {
	var manifest = eval(grunt.file.read('manifest.js'));
	grunt.initConfig({
		clean: {
			dist: ['dist/', '*.zip'],
			dev: ['manifest.json', 'js/']
		},
		compress: {
			dist: {
				files: [
					{
						src: [
							'res/**', 'util/**', 'icon.png', 'LICENSE', 'manifest.json'
						], dest: '/'
					}, {expand: true, cwd: 'dist/', src: '**', dest: 'js/'}
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
		webpack: {main: require('./webpack.config.js')}
	});
	
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-compress');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-webpack');
	grunt.registerTask('manifest', 'Creates manifest.json', function() {
		grunt.file.write('manifest.json', JSON.stringify(manifest));
	});
	
	grunt.registerTask('default', ['manifest', 'webpack']);
	grunt.registerTask('zip', ['clean', 'default', 'uglify', 'compress']);
};
