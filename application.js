Ext.application({
    name: 'dots',

    // All the paths for custom classes
    /*    paths: {
        'Ext.ux': '../../../examples/ux/'
   },*/

    // Define all the controllers that should initialize at boot up of your application
    controllers: [
        'dots.controller.NoteController'
    ],

    autoCreateViewport: true
});