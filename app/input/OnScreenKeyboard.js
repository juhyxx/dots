import Input from './Input.js';
import { notes } from 'notes.js';

export default class OnScreenKeyboard extends Input {

	constructor(el) {
		super();
		el.addEventListener('click', (e) => {
			let value = e.target.getAttribute('value');

			if (value) {
				this.select(notes.indexOf(value));
			}
		});
	}
}
