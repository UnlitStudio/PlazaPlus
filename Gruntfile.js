var path = require('path');
var _ = require('lodash');
module.exports = function(grunt) {
	var srcfiles = ['bg', 'chat', 'chatNav', 'help', 'options'];
	var manifest = eval(grunt.file.read('manifest.js'));
	grunt.initConfig({
		clean: {
			dist: ['dist/'], build: ['build/'],
			manifest: ['manifest.json'], zip: ['plazaplus.zip']
		},
		compress: {main: {
			files: [{
				expand: true, src: [
					'dist/**/*', 'res/**/*', 'util/**/*', 'icon.png', 'LICENSE', 'manifest.json'
				], dest: '/', filter: function(path) {
					return !grunt.file.isMatch('**/*.less', path);
				}
			}], options: {archive: 'plazaplus.zip'}
		}},
		uglify: _.set(_.fromPairs(_.map(srcfiles, function(v) { return [_.camelCase('file-'+v), {
			files: _.set({}, ['dist/'+v+'.js'], 'build/'+v+'.js'),
		}] })), 'options', {compress: {dead_code: true}}),
		webpack: _.fromPairs(_.map(srcfiles, function(v) { return [_.camelCase('file-'+v), {
				entry: './src/'+v+'.js',
				output: {path: 'build/', filename: v+'.js'},
				module: {loaders: [
					{ test: /\.less$/, loader: 'style!css!less' },
					{ test: /\.css$/, loader: 'style!css' }
				]}, stats: false
		}] }))
	});
	
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-compress');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-webpack');
	grunt.registerTask('manifest', 'Creates manifest.json', function() {
		grunt.file.write('manifest.json', JSON.stringify(manifest));
	});
	grunt.registerTask('js', function(file) {
		var suffix = file ? ':'+_.camelCase('file-'+file) : '';
		grunt.task.run('webpack'+suffix, 'uglify'+suffix);
	});
	//grunt.renameTask('webpack:all', 'webpack');
	
	grunt.registerTask('default', ['manifest', 'js']);
	grunt.registerTask('rebuild', ['clean', 'default']);
	grunt.registerTask('zip', ['rebuild', 'compress']);
};
