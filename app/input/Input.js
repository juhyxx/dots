export default class Input {

	select(value) {
		this._handler.call(this, value);
	}

	onSelect(handler) {
		this._handler = handler;
	}

}
