function vendor() { return js('vendor'); }
function js(v) { return 'js/'+v+'.js'; }
function cjs(v) { return [vendor(), js(v)]; }

({
	manifest_version: 2,
	name: 'Plaza+',
	version: '4.7.2',
	version_name: '4.7.2',
	
	description: 'Adds several new features and commands to the 3DSPlaza chatrooms.',
	icons: {128: 'icon.png'},
	author: 'Fayne Aldan',
	permissions: [
		'storage', 'notifications', 'alarms', 'http://188.166.72.241/',
		'http://3dsplaza.com/', 'http://pc.3dsplaza.com/'
	],
	options_ui: {
		page: 'util/options.html'
	},
	background: {scripts: cjs('bg')},
	content_scripts: [
		{
			matches: ['http://pc.3dsplaza.com/chat3/innerchat.php*'],
			js: cjs('chat'), all_frames: true
		}, {
			matches: ['http://pc.3dsplaza.com/chat3/nav.php*'],
			js: cjs('chatNav'), all_frames: true
		}
	],
	web_accessible_resources: ['res/chatInject.js', 'res/*.ogg'],
	applications: {gecko: {id: '@plaza-plus'}}
})
