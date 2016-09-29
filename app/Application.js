export default class Application {

  static run() {
    return (new this).run();
  }

  run() {
    console.log('its alive');
  }

}
