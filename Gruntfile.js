module.exports = function(grunt) {
	var less = function(name) {
		return {expand: true, cwd: name, dest: name, ext: '.css', src: '**/*.less'};
	};
	grunt.initConfig({
		less: {content: less('content'), util: less('util')},
		clean: {
			css: ['content/*.css', 'util/*.css'],
			manifest: ['manifest.json'], zip:['plazaplus.zip']
		},
		compress: {main: {
			files: [{
				expand: true, src: [
					'bg/*', 'content/*', 'lib/*', 'sounds/*', 'util/**/*',
					'icon.png', 'LICENSE', 'manifest.json'
				], dest: '/', filter: function(path) {
					return !grunt.file.isMatch('**/*.less', path);
				}
			}], options: {archive: 'plazaplus.zip'}
		}}
	});
	grunt.loadNpmTasks('grunt-contrib-less');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-compress');
	grunt.registerTask('manifest', 'Creates manifest.json', function() {
		var json = new Function(grunt.file.read('manifest.js'))();
		grunt.file.write('manifest.json', JSON.stringify(json));
	});
	grunt.registerTask('default', ['manifest', 'less']);
	grunt.registerTask('zip', ['default', 'compress']);
};
