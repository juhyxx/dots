Ext.define('dots.controller.Timer', {

    extend: 'Ext.Base',

    singleton: true,

    id: 'timer',

    interval: 1000,

    mixins: {
        observable: 'Ext.util.Observable'
    },

    constructor: function(config) {
        this.mixins.observable.constructor.call(this, config);

        this.addEvents('tick');

        this._task = (new Ext.util.TaskRunner()).newTask({
            scope: this,
            run: function() {
                this.fireEvent('tick');
            },
            interval: this.interval
        });
        this._task.start();
    },

    setInterval: function(interval) {
        this.interval = interval;
        this._task.restart(this.interval);
    }
});