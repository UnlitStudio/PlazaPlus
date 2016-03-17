/* globals sendpost */

(function() {
	var oldsp = sendpost;
	document.addEventListener('plusSendChat', oldsp);
	sendpost = function() {
		document.getElementById('send').click();
	};
	if (document.getElementById('overrideWarning')) document.body.onload = function() {
		var evt = document.createEvent('Event');
		evt.initEvent('plusStudy', true, false);
		document.dispatchEvent(evt);
	};
})();
