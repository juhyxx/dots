import { notes, midiNotes, getWithoutHalfTones } from 'notes.js';

export default class RandomGenerator {

	constructor({min, max}) {
		this.notes = getWithoutHalfTones(midiNotes.slice(min, max));
	}

	getNote() {
		let note = this.randomItem(this.notes);

		while (note === this.note) {
			note = this.randomItem(this.notes);
		}
		this.note = note;
		return note;
	}

	randomItem(arr) {
		return arr[this.random(0, arr.length - 1)];
	}

	random(min, max) {
		return Math.floor(Math.random() * (max - min)) + min;
	}

}
