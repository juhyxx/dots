import StaffView from 'StaffView.js';
import { $ } from 'shortcuts.js';
import RandomGenerator from 'RandomGenerator.js';
import { notes, midiNotes, getWithoutHalfTones } from 'notes.js';

export default class Application {

	get time() {
		return this._time || 3;
	}

	set time(time) {
		this._time = time;
	}

	static run() {
		return (new this);
	}

	get note() {
		return this._note;
	}

	set note(note) {
		this._note = note;
		this.staffView.showNote(this._note, this.time);
	}

	constructor() {
		this.randomGenerator = new RandomGenerator({min: 43,max: 77});
		this.staffView = new StaffView('svg #note');
		this._results = {};
		this.registerHandlers();
		this.updateStats();
	}

	registerHandlers() {
		$('nav button').addEventListener('click', () => {
			if (this._interval) {
				$('nav button').innerHTML = '<i class="fa fa-play"></i>';
				clearTimeout(this._interval);
				this._interval = undefined;
				$('body').className = '';
			} else {
				$('body').className = 'play';
				this._results = {};
				this.updateStats();
				this.updateProgress();
				$('nav button').innerHTML = '<i class="fa fa-stop"></i>';
				this.runTest();
			}
		});
		$('#piano').addEventListener('click', (e) => {
			let value = e.target.getAttribute('value');

			if (value) {
				this.checkResult(notes.indexOf(value));
			}
		});
		$('#range').addEventListener('change', (e) => {
			this.time = 11 - parseInt(e.target.value, 10);
		});
	}

	checkResult(index) {
		this._results[this.note.midi] = this._results[this.note.midi] || {
			ok: 0,
			fail: 0
		};
		if (index === this.note.midi % 12) {
			this._results[this.note.midi].ok = this._results[this.note.midi].ok + 1;
			this.runTest();
		} else {
			this._results[this.note.midi].fail = this._results[this.note.midi].fail + 1;
		}
		this.updateProgress();
		this.updateStats();
	}

	onTimeout() {
		this.checkResult();
		this.runTest();
	}

	runTest() {
		this.counter = this.counter || 0;
		this.counter++;
		clearTimeout(this._interval);
		this.note = this.randomGenerator.getNote();
		this._interval = setTimeout(this.onTimeout.bind(this), (this.time * 1000) + 100);
	}

	updateProgress() {
		let fail = 0,
			ok = 0;

		Object.keys(this._results).forEach(key => {
			let item = this._results[key];
			fail = fail + item.fail;
			ok = ok + item.ok;
		});
		$('#progress .ok').style['flex-grow'] = ok || 1;
		$('#progress .fail').style['flex-grow'] = fail || 1;
		$('#progress .ok').innerHTML = ok;
		$('#progress .fail').innerHTML = fail;
	}

	updateStats() {
		$('#stats').innerHTML = '';

		midiNotes.forEach((item, index) => {
			if (index >= 43 && index < 77) {
				let el = document.createElement('div');
				if (item.name.match('♯')) {
					let halftone = document.createElement('div');
					halftone.className = 'halftone';
					$('#stats div:not(.halftone):last-child').appendChild(halftone);
				} else {
					if (this._results[index]) {
						el.innerHTML = `${this._results[index].ok}`;
						if (this._results[index].fail > 0) {
							el.innerHTML = `${this._results[index].fail}`;
							el.className = 'fail level' + Math.min(this._results[index].fail, 10);
						}
					} else {
						el.className = 'empty';
					}
					el.title = item.name + item.octave;
					$('#stats').appendChild(el);
				}
			}
		});
	}
}
