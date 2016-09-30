import StaffView from 'StaffView.js';

export default class Application {

	get notes() {
		return ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
	}

	get basicNotes() {
		return ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
	}

	static run() {
		return (new this).run();
	}

	run() {
		this.staffView = new StaffView('svg #note');
		setInterval(this.onInterval.bind(this), 5000);
	}

	onInterval() {
		let noteContainer = document.querySelector('#note-container');

		this.staffView.showNote(this.getRandom(this.basicNotes));
		noteContainer.setAttribute('className', '');
		noteContainer.setAttribute('className', 'animation');
	}

	runTest() {
		console.log('running');
	}

	getRandom(arr) {
		let min = 0,
			max = arr.length,
			index = Math.floor(Math.random() * (max - min)) + min;

		return {
			index,
			name: arr[index],
			octave: Math.floor(Math.random() * (5 - 3)) + 3
		};
	}

}
