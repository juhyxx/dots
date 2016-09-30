export default class StaffView {

	constructor(selector) {
		this.el = selector;
	}

	set el(selector) {
		this._el = document.querySelector('svg #note');
	}

	get el() {
		return this._el;
	}

	showNote(note) {
		let noteOffset = 270 - (note.index * 5);

		document.querySelector('#note-container #up1').style.visibility = 'hidden';
		document.querySelector('#note-container #up4').style.visibility = 'hidden';
		document.querySelector('#note-container #up3').style.visibility = 'hidden';
		document.querySelector('#note-container #up2').style.visibility = 'hidden';

		document.querySelector('#note-container #down4').style.visibility = 'hidden';
		document.querySelector('#note-container #down3').style.visibility = 'hidden';
		document.querySelector('#note-container #down2').style.visibility = 'hidden';
		document.querySelector('#note-container #down1').style.visibility = 'hidden';
		if (note.index > 66) {
			document.querySelector('#note-container #up4').style.visibility = 'visible';
		}
		if (note.index > 64) {
			document.querySelector('#note-container #up3').style.visibility = 'visible';
		}
		if (note.index > 62) {
			document.querySelector('#note-container #up2').style.visibility = 'visible';
		}
		if (note.index > 60) {
			document.querySelector('#note-container #up1').style.visibility = 'visible';
		}
		if (note.index < 50) {
			document.querySelector('#note-container #down1').style.visibility = 'visible';
		}
		if (note.index < 48) {
			document.querySelector('#note-container #down2').style.visibility = 'visible';
		}
		if (note.index < 46) {
			document.querySelector('#note-container #down3').style.visibility = 'visible';
		}
		if (note.index < 44) {
			document.querySelector('#note-container #down4').style.visibility = 'visible';
		}

		console.log(note.index);

		this.el.setAttribute('transform', `translate(0, ${noteOffset})`);
	}

}
