function js(v) { return 'dist/'+v+'.js'; }

res = ['res/chatInject.js'];
sounds = [
	'capisci', 'come-to-daddy', 'communication-channel', 'credulous', 'et-voila', 'gets-in-the-way',
	'isnt-it', 'pedantic', 'solemn', 'you-know'
]
res = res.concat(sounds.map(function(n) { return 'res/'+n+'.ogg'; }));

({
	manifest_version: 2,
	name: 'Plaza+',
	version: '4.6',
	version_name: '4.6',
	
	description: 'Adds several new features and commands to the 3DSPlaza chatrooms.',
	icons: {128: 'icon.png'},
	author: 'Fayne Aldan',
	permissions: [
		'storage', 'notifications', 'alarms', 'http://188.166.72.241/',
		'http://3dsplaza.com/', 'http://pc.3dsplaza.com/'
	],
	options_ui: {
		page: 'util/options.html',
		chrome_style: true
	},
	background: {scripts: [js('bg')]},
	content_scripts: [
		{
			matches: ['http://pc.3dsplaza.com/chat3/innerchat.php*'],
			js: [js('chat')], all_frames: true
		}, {
			matches: ['http://pc.3dsplaza.com/chat3/nav.php*'],
			js: [js('chatNav')], all_frames: true
		}
	],
	web_accessible_resources: res
})
