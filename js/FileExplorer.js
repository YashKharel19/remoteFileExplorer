define([
	'dojo/_base/lang',
	'dojo/_base/declare',
	'dojo/Deferred',
	'dojo/when',
	'dojo/cookie',
	'dojo/keys',
	'dojo/dom',
	'dojo/dom-class',
	'dojo/date/locale',
	'dojo/on',
	'dojo/topic',
	'dojo/query',	// required for dojo/on event delegation
	'dojo/Stateful',
	'dijit/registry',
	'rfe/_Base',
	'rfe/Layout',
	'rfe/History',
	'rfe/Edit',
	'rfe/store/FileStore',
	'rfe/dialogs/dialogs',
	'rfe/dnd/Manager'	// needs to be loaded for dnd
], function(lang, declare, Deferred, when, cookie, keys, dom, domClass, locale, on, topic, query, Stateful,
				registry, _Base, Layout, History, Edit, FileStore, dialogs) {

	/**
	 * A module that creates an application that allows you to manage and browse files and directories on a remote web server.
	 * It consists of tree and a grid. The tree loads file data over REST via php from remote server.
	 * @module FileExplorer rfe/FileExplorer
	 */

	// TODO: use dijit._WidgetBase
	// TODO: multiselect (in tree allow only of files but not of folders)

	/*
	 *	@constructor
	 *	@extends {rfe/Layout}
	 * @mixes {rfe/Edit}
	 * @property {string} version
	 * @property {string} versionDate
	 * @property {dojo/Stateful} currentTreeObject keeps track of currently selected store object in tree. Equals always parent of grid items
	 * @property {dojo/Stateful} context keeps track of widget the context menu was created on (right clicked on)
	 * @config {boolean} isOnGridRow
	 * @config {boolean} isOnTreeRow
	 * @config {boolean} isOnGridContainer
	 * @config {boolean} isOnTreeContainer
	 * @property {object} history
	 * @config {array} steps saves the steps
	 * @config {int} curIdx index of current step we're on
	 * @config {int} numSteps number of steps you can go forward/back
	 * @property {rfe/store/FileStore} store
	 *
	 */
	return declare([_Base, History, Layout, Edit], {
		version: '0.9',
		versionDate: '2013',
		currentTreeObject: null,
		context: null,
		store: null,

		constructor: function() {
			// TODO: should tree connect also on right click as grid? If so, attache event to set currentTreeItem
			this.currentTreeObject = new Stateful();	// allows Toolbar and Edit to keep track of selected object in tree
			this.store = new FileStore();
			this.context = {
				isOnGridRow: false,
				isOnGridContainer: false,
				isOnTreeRow: false,
				isOnTreeContainer: false
			};
			this.domNode = dom.byId(this.id);	// TODO: remove when using dijit._WidgetBase
		},

		startup: function() {
			this.init();
			this.initEvents();
		},

		initEvents: function() {
			var self = this,
				grid = this.grid,
				tree = this.tree,
				store = this.store;

			tree.on('click', function(object) {	// when calling tree.on(click, load) at once object is not passed
				self.displayChildrenInGrid(object);
				self.set('history', object.id);
				self.currentTreeObject.set(object);
			});
			tree.on('load', lang.hitch(this, this.initState));

			grid.on('.dgrid-row:dblclick', function(evt) {
				var obj = grid.row(evt.target).data;
				if (obj.dir){
					self.display(obj);
					self.set('history', obj.id);
				}
			});
			grid.on('dgrid-datachange', function(evt) {
				// catch using editor when renaming
				var obj = evt.cell.row.data;

				obj[store.labelAttr] = evt.value;
				store.put(obj).then(function() {
					grid.save();
				}, function() {
					grid.revert();
				});
			});

			// TODO: Set context on keyboard navigation too
			on(this.panes.domNode, '.rfeTreePane:mousedown, .rfeGridPane:mousedown', function(evt) {
				lang.hitch(self, self.set('context', evt, this));
			});

			//on(this.domNode, '.dgrid-content:keydown, .dijitTreeContainer:keydown', lang.hitch(this, '_onKeyDown'));
		},

		/**
		 * Displays folder content in grid.
		 * @param {Object} object dojo data object
		 * @return {dojo.Deferred}
		 */
		displayChildrenInGrid: function(object) {
			var grid = this.grid,
				store = this.store,
				dfd = new Deferred();

			if (object.dir) {
				dfd = when(store.getChildren(object), function() {
					var sort = grid.get('sort');
					grid.set('query', {parId: object.id}, {sort: sort});
				});
			}
			else {
				dfd.resolve(object);
			}
			return dfd;
		},

		/**
		 * Displays the store object (folder) in the tree and it's children in the grid.
		 * The tree and the grid can either be in sync meaning that they show the same content (e.g. tree folder is expanded)
		 * or the grid is one level down (e.g. tree folder is selected but not expanded).
		 * @param {Object} object store object
		 * @return {dojo/Deferred}
		 */
		display: function(object) {
			var path, dfd = new Deferred();
			if (object.dir) {
				path = this.store.getPath(object);
				dfd = this.tree.set('path', path);
			}
			else {
				dfd.reject(false);
			}
			dfd.then(lang.hitch(this, function() {
				return this.displayChildrenInGrid(object);
			}));
			this.currentTreeObject.set(object);
			return dfd;
		},

		/**
		 * Display parent directory.
		 * @param {Object} [object] dojo.data.object
		 */
		goDirUp: function(object) {
			var def;
			if (!object) {
				object = this.currentTreeObject;
			}
			if (object.parId) {
				def = when(this.store.get(object.parId), lang.hitch(this, function(object) {
					return this.display(object);
				}), function(err) {
					console.debug('Error occurred when going directory up', err);
				});
			}
			else {
				def = new Deferred();
				def.resolve(false);
			}
			return def;
		},

		/**
		 * Reload current folder.
		 */
		reload: function() {
			/*
			var dndController = this.tree.dndController.declaredClass;

			this.store.storeMemory.setData([]);
			this.grid.refresh();

			// reset and rebuild tree
			this.tree.dndController.destroy();	// cleanup dnd connections and such
			this.tree._itemNodesMap = {};
			this.tree.rootNode.destroyRecursive();
			this.tree.rootNode.state = "UNCHECKED";
			this.tree.dndController = dndController; //'rfe.dnd.TreeSource',
			this.tree.postMixInProperties();
			this.tree.postCreate();
			this.initState();
			*/
		},

		/**
		 * Handle key events on grid and tree.
		 * @private
		 */
		_onKeyDown: function(evt) {
			this.set('context', evt, this);

			switch(evt.keyCode){
				case keys.DELETE:
			}


				var rfe = this.rfe;

				on(this.contentNode, 'keydown', function(evt) {
					var fnc, keyCode = evt.keyCode,
						nodeType = evt.target.nodeName.toLowerCase();

					if (nodeType === 'input' || nodeType === 'textarea') {
						// prevent calling delete
						return;
					}
					fnc = {
						46: rfe.del // delete key // TODO: mac is same keyCode?
					}[keyCode];

					if (typeof(fnc) !== 'undefined') {
						fnc.apply(rfe, arguments);
					}
				});

		},



		/**
		 * Returns the current date.
		 * @return {string} formated date
		 */
		getDate: function() {
			return locale.format(new Date(), {
				datePattern: 'dd.MM.yyyy',
				timePattern: 'HH:mm'
			});
		},

		/**
		 * Set object properties describing on which part of the file explorer we are on.
		 * @param {Event} evt
		 * @param {HTMLElement} node
		 */
		_setContext: function(evt, node) {
			var widget = registry.getEnclosingWidget(evt.target),
				isGridRow = typeof this.grid.row(evt) !== 'undefined',
				isTreeRow = widget && widget.baseClass === 'dijitTreeNode';

			this.context = {
				isOnGridRow: isGridRow,
				isOnGridContainer: domClass.contains(node, 'rfeGridPane') && !isGridRow,
				isOnTreeRow: isTreeRow,
				isOnTreeContainer: domClass.contains(node, 'rfeTreePane') && !isTreeRow
			};
		},

		/**
		 * Initializes the default or last state of the tree and the grid.
		 * Expects the tree to be loaded and expanded otherwise it will be set to root, then displays the correct folder in the grid.
		 */
		initState: function() {
			var tree = this.tree, grid = this.grid, store = this.store,
				object, arr, id, paths;

			paths = this.tree.loadPaths();
			tree.set('paths', paths).then(lang.hitch(this, function(){
				if (paths.length > 0) {
					// we only use last object in array to set the folders in the grid (normally there would be one selection only anyway)
					arr = paths.pop();
					id = arr[arr.length - 1];
				}
				else {
					// no cookie available use root
					object = tree.rootNode.item;
					id = object.id;
				}

				when(store.get(id), lang.hitch(this, function(object) {
					when(store.getChildren(object), function() {	// load children first before setting store
						// Setting caching store for grid would not use cache, because cache.query() always uses the
						// master store => use storeMemory.
						grid.set('store', store.storeMemory, { parId: id });
					});
					this.currentTreeObject.set(object);
				}));

				this.context.isOnTreeRow = true;
				this.set('history', id);   // do not set history in display() since history uses display too in goHistory()
			}));
		},

		showFileDetails: function() {
			// Note: A visible file/folder object is always loaded
			var dialog, id, store = this.store,
				i = 0, len,
				widget = this.context.isOnGridRow || this.context.isOnGridContainer ? this.grid : this.tree;

			// TODO: if multiple selected file objects, only use one dialog with multiple values (and sum of all file sizes). Requires preloading folder contents first!
			// grid
			if (widget.selection) {
				for (id in widget.selection) {
					if (widget.selection[id] === true) {
						dialog = dialogs.getByFileObj('fileProperties', store.get(id));
						dialog.show();
					}
				}
			}
			// TODO: extend dijit.tree._dndSelector to work same way as grid.selection ? so we don't need to differentiate here
			// tree
			else if (widget.selectedItems) {
				len = widget.selectedItems.length;
				for (i; i < len; i++) {
					dialog = dialogs.getByFileObj('fileProperties', widget.selectedItems[i]);
					dialog.show();
				}
			}
		}
	});

});