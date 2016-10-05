export function $(selector, el) {
	return (el || document).querySelector(selector);
}

export function $$(query) {
	return document.querySelectorAll(query);
}
