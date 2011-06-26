define("rfe/dnd/Tree", ["dojo", "dijit", "dijit/tree/dndSource", "dijit/tree/_dndSelector"], function(dojo, dijit) {

	// set references to call be able to call overriden methods
	var ref =  dijit.tree._dndSelector.prototype;
	var oldMouseDown = ref.onMouseDown;
	var oldMouseUp = ref.onMouseUp;
	var oldMouseMove = ref.onMouseMove;

	dojo.declare("rfe.dnd.Tree", null, {

		constructor: function() {
			//dijit.tree.dndSource.prototype.accept = ["text", "treeNode"];

			dojo.extend(dijit.tree._dndSelector, {
				_markedNode: null,
				_doMarkNode: false,
				setSelection: this.setSelection,
				onMouseDown: this.onMouseDown,
				onMouseUp: this.onMouseUp,
				onMouseMove: this.onMouseMove
			});
		},

		onMouseDown: function(e) {
			oldMouseDown.apply(this, arguments);
			this._doMarkNode = true;
		},

		onMouseUp: function(e) {
			// Prevent selecting onMouseDown -> move to onMouseUp, but not when dragging
			if (this._doMarkNode) {
				var selection = this.getSelectedTreeNodes();
				var i = 0, len = selection.length;
				if (this._markedNode) {
					this._markedNode.setSelected(false);
				}
				for (; i < len; i++) {
					selection[i].setSelected(true);
				}
				this._markedNode = this.current;
			}
			this._doMarkNode = false;
			oldMouseUp.apply(this, arguments);
		},

		onMouseMove: function(e) {
			oldMouseMove.apply(this, arguments);
			this._doMarkNode = false;
		},

		setSelection: function(/*dijit._treeNode[]*/ newSelection) {
			var oldSelection = this.getSelectedTreeNodes();
			dojo.forEach(this._setDifference(oldSelection, newSelection), dojo.hitch(this, function(node) {
				if (this._markedNode != node) {
					node.setSelected(false);
				}
				if (this.anchor == node) {
					delete this.anchor;
				}
				delete this.selection[node.id];
			}));
			dojo.forEach(this._setDifference(newSelection, oldSelection), dojo.hitch(this, function(node) {
				this.selection[node.id] = node;
			}));
			this._updateSelectionProperties();
		}
	});

	return rfe.dnd.Tree;
});
