/* globals sendpost */

document.addEventListener('plusSendChat', sendpost);
if (document.getElementById('overrideWarning')) document.body.onload = function() {
	var evt = document.createEvent('Event');
	evt.initEvent('plusStudy', true, false);
	document.dispatchEvent(evt);
};
