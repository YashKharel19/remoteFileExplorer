define([
	'dojo/_base/declare',
	'dojo/_base/lang',
	'dojo/when',
	'dojo/on',
	'dojo/mouse', // mouse.isLeft
	'dojo/dnd/Source',
	'dojo/dnd/Manager'
],
function(declare, lang, when, on, mouse, DnDSource, DndManager) {

	/**
	 * Class to handle drag and drop of the dgrid.
	 * @class rfe.dnd.GridSource
	 * @extends {dojo.dnd.Source}
	 * @see dgrid/extensions/DnD.js
	 * @property {OnDemandGrid} grid
	 * @property {FileStore}
	 */
	return declare(DnDSource, /** @lends rfe.dnd.GridSource.prototype */ {

		grid: null,

		fileStore: null,

		getObject: function(node) {
			return this.grid.row(node).data;
		},

		/**
		 * Topic event processor for /dnd/drop, called to finish the DnD operation.
		 * @param {object} sourceSource dojo/dnd/Source dgrid or dijit/tree which is providing the items
		 * @param {Array} nodes domNodes
		 * @param {boolean} copy copy or move objects
		 */
		onDrop: function(sourceSource, nodes, copy) {
			// summary:
			//		on drop, determine where to move/copy the objects
			var targetSource = this,
				targetRow = this.targetAnchor, // save for internal use to this._targetAnchor
				grid = this.grid,
				store = grid.store;

			targetRow = targetRow && grid.row(targetRow);

			when(targetRow && store.get(targetRow.id), function(targetObject) {

				// Note: if dropping after the last row, or into an empty grid,
				// target will be undefined.

				// Delegate to onDropInternal or onDropExternal for rest of logic.
				// These are passed the target item as an additional argument.
				if (targetSource !== sourceSource) {
					targetSource.onDropExternal(sourceSource, nodes, copy, targetObject);
				} else {
					targetSource.onDropInternal(nodes, copy, targetObject);
				}
			});
		},

		/**
		 * Handle objects dropped from the grid onto the grid.
		 * @param nodes
		 * @param copy
		 * @param newParentObject
		 */
		onDropInternal: function(nodes, copy, newParentObject) {
			var fileStore = this.fileStore,
				storeMemory = fileStore.storeMemory,
				targetSource = this,
				oldParentObject;

			// Don't bother continuing if not moving onto anything.
			// (Don't need to worry about edge first/last cases since dropping
			// directly on self doesn't fire onDrop, but we do have to worry about
			// dropping last node into empty space beyond rendered rows, if we don't copy)
			// Also don't bother if moving onto a file (no reordering in rfe)
			if (!copy && (!newParentObject || !newParentObject[fileStore.childrenAttr])) {
				return;
			}

			nodes.forEach(function(node) {
				var object = targetSource.getObject(node);

				// all nodes in grid share same parent, only get it once from first node. Since you can only drag an object
				// that's visible (hence loaded an cached) we can directly use the memoryStore
				oldParentObject = oldParentObject || storeMemory.get(object[fileStore.parentAttr]);
				// if dropped on empty space beyond rendered row newParentObject (target) is undefined, use same parent
				newParentObject = newParentObject || oldParentObject;
				fileStore.pasteItem(object, oldParentObject, newParentObject, copy);
			});
		},

		/**
		 * Handle objects dropped from an external source onto the grid.
		 */
		onDropExternal: function(sourceSource, nodes, copy, newParentObject) {
			var fileStore = this.fileStore,
				storeMemory = fileStore.storeMemory,
				row, grid = this.grid,
				oldParentObject;

			if (newParentObject && !newParentObject[fileStore.childrenAttr]) {
				// dropped on a file, so it's parent should become the new parent
				newParentObject = storeMemory.get(newParentObject[fileStore.parentAttr]);
			}
			else if (!newParentObject) {
				// dropping beyond rendered rows, so newParentObject is null. Since all displayed objects
				// in grid share the same parent, just grab the parent of the first/last object in grid
				row = grid.get('firstRow');
				if (row) {
					newParentObject = storeMemory.get(row.data[fileStore.parentAttr]);
				}
				else {	// empty folder get parent from tree (TODO: find solution which uses dnd interface (possible?)
					newParentObject = grid.rfe.currentTreeObject;
				}
			}

			nodes.forEach(function(node) {
				var object = sourceSource.getObject(node);

				// tree.dndController.singular = true so we can get the oldParentObject only once from first node
				// Since you can only drag visible object (hence loaded an cached) we can directly use the memoryStore
				oldParentObject = oldParentObject || storeMemory.get(object[fileStore.parentAttr]);
				fileStore.pasteItem(object, oldParentObject, newParentObject, copy);
			});
		},

		/**
		 * Process mouse move events
		 */
		onMouseMove: function(evt) {
			this.inherited('onMouseMove', arguments);

			var m = DndManager.manager(),
				grid = this.grid;

			// prevent dropping from tree onto own child in grid, e.g. parent folder onto its own child
			if (this.isDragging && m.source.tree && this._isParentChildDrop(m.nodes[0], grid.row(evt))){
				m.canDrop(false);
			}
		},

		/**
		 * Checks whether the dragged node is a parent of the grid row we are currently over.
		 * @param {dojo/dnd/Source} source
		 * @param {dgrid/row} row
		 * @return {Boolean}
		 * @private
		 */
		_isParentChildDrop: function(source, row){
			var store = this.fileStore,
				memoryStore = store.storeMemory,
				sourceId = DndManager.manager().source.getObject(source).id,	// id of dragged node
				// also check when dropping beyond rows
				object = (row && store.storeMemory.get(row.id)) || this.grid.rfe.currentTreeObject; // object must be in cache since it is displayed in the grid

			if (object.id === sourceId) {
				return true;
			}

			while (object[store.parentAttr]) {
				object = memoryStore.get(object[store.parentAttr]);
				if (object.id === sourceId) {
					return true;
				}
			}
			return false;
		}


	});
});
