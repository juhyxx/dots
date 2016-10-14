import { notes, midiNotes } from 'notes.js';

export default class RandomGenerator {

	constructor({min, max}) {
		const repeatAfter = 5;

		this.notes = midiNotes.slice(min, max).filter(item => !item.isHalfTone);
		this.lifo = new Array(repeatAfter).fill(undefined);
	}

	generate() {
		let note = this.randomItem(this.notes);

		while (this.lifo.includes(note)) {
			note = this.randomItem();
		}
		this.lifoPush(note);
		return note;
	}

	randomItem(arr) {
		return this.notes[this.random(0, this.notes.length)];
	}

	random(min, max) {
		return Math.floor(Math.random() * (max - min)) + min;
	}

	lifoPush(item) {
		this.lifo.push(item);
		this.lifo.shift();
	}

}
