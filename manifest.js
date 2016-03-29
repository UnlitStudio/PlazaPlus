function bg(n) { return 'bg/'+n+'.js'; }
function lib(n) { return 'lib/'+n+'.js'; }
function content(n) { return 'content/'+n+'.js'; }
function enums() { return lib('Enums'); }
function jquery() { return lib('jquery'); }
function lodash() { return lib('lodash'); }
function color() { return lib('tinycolor'); }

res = [content('chatInject')];
sounds = 'capisci come-to-daddy communication-channel credulous et-voila gets-in-the-way isnt-it';
sounds += ' pedantic solemn you-know';
res = res.concat(sounds.split(' ').map(function(n) { return 'sounds/'+n+'.ogg'; }));
util = 'options';
res = res.concat(util.split(' ').map(function(n) { return 'util/'+n+'.html'; }));

({
	manifest_version: 2,
	name: 'Plaza+',
	version: '4.5.1',
	version_name: '4.5.1',
	
	description: 'Adds several new features and commands to the 3DSPlaza chatrooms.',
	icons: {128: 'icon.png'},
	author: 'Fayne Aldan',
	permissions: [
		'storage', 'notifications', 'alarms',
		'http://3dsplaza.com/', 'http://pc.3dsplaza.com/'
	],
	optional_permissions: ['http://188.166.72.241/'],
	options_ui: {
		page: 'util/options.html',
		chrome_style: true
	},
	background: {
		scripts: [enums(), jquery(), lodash(), bg('chat'), bg('icons')]
	},
	content_scripts: [
		{
			matches: ['http://pc.3dsplaza.com/chat3/innerchat.php*'],
			js: [enums(), jquery(), lodash(), color(), lib('Autolinker'), content('chat')],
			css: ['content/chat.css'],
			all_frames: true
		}, {
			matches: ['http://pc.3dsplaza.com/chat3/nav.php*'],
			js: [jquery(), content('chatNav')],
			css: ['content/chatNav.css'],
			all_frames: true
		}
	],
	web_accessible_resources: res
})
