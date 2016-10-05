import { $ } from 'shortcuts.js';

export default class StaffView {

	constructor(selector) {
		this.el = selector;
	}

	get min() {
		return 38;
	}
	get max() {
		return 77;
	}

	get notes() {
		return new Array(this.max - this.min)
			.fill(undefined)
			.map((item, index) => this.min + index)
			.filter((item, index) => ([1, 3, 6, 8, 10].indexOf((item) % 12) < 0))
			.reduce((prev, item, index) => {
				prev[item] = index;
				return prev;
			}, {});
	}
	set el(selector) {
		this._el = $('svg #note');
	}

	get el() {
		return this._el;
	}

	cloneTemplate(time) {
		let container = $('svg #animation-container');
		let node = $('svg #note-template').cloneNode(true);

		if (container) {
			container.remove();
		}
		node.removeAttribute('id');
		node.id = 'animation-container';
		node.setAttribute('style', `animation: dot ${time}s ease-in !important;`);
		$('svg').appendChild(node);
		return $('svg #animation-container');
	}

	showNote(note, time) {
		let noteOffset = -(parseInt(this.notes[note.midi], 10) * 5);
		//let noteOffset = 225 - (55 * 5);
		let container = this.cloneTemplate(time);

		if (isNaN(noteOffset)) {
			debugger
		}

		$('#up1', container).style.visibility = 'hidden';
		$('#up4', container).style.visibility = 'hidden';
		$('#up3', container).style.visibility = 'hidden';
		$('#up2', container).style.visibility = 'hidden';

		$('#down4', container).style.visibility = 'hidden';
		$('#down3', container).style.visibility = 'hidden';
		$('#down2', container).style.visibility = 'hidden';
		$('#down1', container).style.visibility = 'hidden';
		/*if (note.midi > 66) {
			$('#up4', container).style.visibility = 'visible';
		}
		if (note.midi > 64) {
			$('#up3', container).style.visibility = 'visible';
		}
		if (note.midi > 62) {
			$('#up2', container).style.visibility = 'visible';
		}
		if (note.midi > 60) {
			$('#up1', container).style.visibility = 'visible';
		}
		if (note.midi < 50) {
			$('#down1', container).style.visibility = 'visible';
		}
		if (note.midi < 48) {
			$('#down2', container).style.visibility = 'visible';
		}
		if (note.midi < 46) {
			$('#down3', container).style.visibility = 'visible';
		}
		if (note.midi < 44) {
			$('#down4', container).style.visibility = 'visible';
		}*/




		switch (note.midi) {
			case 38:
				$('#down4', container).style.visibility = 'visible';
			case 40:
			case 41:
				$('#down3', container).style.visibility = 'visible';
			case 43:
			case 45:
				$('#down2', container).style.visibility = 'visible';
			case 47:
			case 48:
				$('#down1', container).style.visibility = 'visible';
		}
		switch (note.midi) {
			case 76:
				$('#up3', container).style.visibility = 'visible';
			case 74:
			case 72:
				$('#up2', container).style.visibility = 'visible';
			case 69:
			case 71:
				$('#up1', container).style.visibility = 'visible';

		}

		console.log(note);

		$('#note', container).setAttribute('transform', `translate(0, ${noteOffset})`);
	}

}
