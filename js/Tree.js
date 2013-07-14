define([
	'dojo/_base/lang',
	'dojo/_base/declare',
	'dojo/_base/array',
	'dojo/cookie',
	'dijit/Tree',
	'rfe/dnd/TreeSource'	// set path to load dnd/TreeSource in dojoConfig
], function(lang, declare, array, cookie, Tree, TreeSource) {

	/**
	 * @name rfe.Grid
	 * @extends {dijit.Tree} Tree
	 */
	return declare([Tree], {
		cookieName: 'dijit/tree/SelectedNodes',
		openOnClick: false, //	If true, clicking a folder node's label will open it, rather than calling onClick()
		openOnDblClick: true, // If true, double-clicking a folder node's label will open it, rather than calling onDblClick()
		showRoot: true,
		tabIndex: 21,
		dndController: function(arg, params) {
			return new TreeSource(arg, lang.mixin(params || {}, {
				accept: ['dgrid-row'],
				fileStore: this.store,
				singular: true
			}));
		},

		postCreate: function() {
			this.inherited('postCreate', arguments);
			this.onLoadDeferred.then(lang.hitch(this, function() {
				// start watching for changes on paths only after initial tree load and before setting state, otherwise
				this.watch('paths', lang.hitch(this, function(attr, oldVal, newVal) {
					this.savePaths(newVal);
				}));
			}));
		},

		/**
		 * Returns paths of nodes that were selected previously and saved in a cookie.
		 * @return {Array} paths
		 */
		loadPaths: function() {
			var oreo = cookie(this.cookieName),
				paths = [];

			if (this.persist && oreo) {
				paths = array.map(oreo.split(','), function(path) {
					return path.split("/");
				});

			}
			return paths;
		},

		/**
 		 * Save selected nodes in a cookie.
		 * Converts the path array to a string separated with slahes. If there are multiple nodes selected, they
		 * are separated by a comma.
		 * @param {array} paths
 		 */
		savePaths: function(paths) {
			var arr = [], selects = [],
			model = this.tree.model;

			array.forEach(paths, function(path) {
				arr = array.map(path, function(part) {
					return part[model.idProperty];
				}, this);
			});
			selects.push(arr.join("/"));

			if (this.persist && selects.length > 0) {
				cookie(this.cookieName, selects.join(","), {expires: 365});
			}
		}

	});
});