Ext.define('dots.controller.NoteController', {

    extend: 'Ext.app.Controller',

    requires: ['dots.controller.Timer'],

    init: function() {
        /*this.control({
            'viewport  noteview': {
                render: this.onPanelRendered
            }
        });*/
        Ext.EventManager.on(window, 'keydown', function(e) {
            var character = String.fromCharCode(e.keyCode).toLowerCase(),
                index = -1;

            character = character === 'h' ? 'b' : character;
            index = ['c', 'd', 'e', 'f', 'g', 'a', 'b'].indexOf(character);

            if (index > -1) {
                this.onKeyDown(index);
            }
        }, this);
        //dots.controller.Timer.setInterval(5000)
        dots.controller.Timer.on({
            scope: this,
            tick: function() {
                Ext.ComponentQuery.query('noteview')[0].showNote(this.getNote());
            }
        });
    },

    onKeyDown: function(index) {
        Ext.ComponentQuery.query('noteview')[0].showNote(index);
    },

    getNote: function() {
        return Math.floor((Math.random() * 23) + 2);

    }
});