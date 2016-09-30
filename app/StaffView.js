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
		console.log(note);
		let octaveOffset = 25 + ((4 - note.octave) * 12 * 5),
			noteOffset = (note.index * 5);

		console.log(octaveOffset, noteOffset);

		this.el.setAttribute('transform', `translate(0, ${octaveOffset - noteOffset})`);
	}

}
