Ext.define('dots.view.Viewport', {
    extend: 'Ext.container.Viewport',
    layout: 'border',
	requires: [
		'dots.view.NoteView'
	],
    items: [
		/*{
			region: 'north',
			html: '<h1 class="x-panel-header">Note trainer</h1>',
			border: false,
			margins: '0 0 5 0'
		},*/
		{
			region: 'center',
			margins: '20 20 20 20',
			
			items: {
				xtype: 'noteview'
			}
		}
	]
    
});