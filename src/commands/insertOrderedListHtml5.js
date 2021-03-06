(function(wysihtml5) {
	"use strict";
	wysihtml5.commands.insertOrderedList = {
		exec: function(composer, command, type) {
			var doc           = composer.doc,
					selectedNode  = composer.selection.getSelectedNode(),
					list          = wysihtml5.dom.getParentElement(selectedNode, { nodeName: "OL" }),
					otherList     = wysihtml5.dom.getParentElement(selectedNode, { nodeName: "UL" }),
					tempClassName =  "_wysihtml5-temp-" + new Date().getTime(),
					isEmpty,
					tempElement;
		
			if (!otherList && composer.commands.support(command)) {
				doc.execCommand(command, false, null);
			
				var selectedNode = composer.selection.getSelectedNode();
				composer.selection.executeAndRestore(function() {
					if (type) wysihtml5.dom.addClass(selectedNode, "wysiwyg-ol-" + type);
				});
			
				return;
			}
		
			if (list) {
				// Unwrap list
				// <ol><li>foo</li><li>bar</li></ol>
				// becomes:
				// foo<br>bar<br>
				composer.selection.executeAndRestore(function() {
					wysihtml5.dom.resolveList(list, composer.config.useLineBreaks);
				});
			} else if (otherList) {
				// Turn an unordered list into an ordered list
				// <ul><li>foo</li><li>bar</li></ul>
				// becomes:
				// <ol><li>foo</li><li>bar</li></ol>
				composer.selection.executeAndRestore(function() {
					list = wysihtml5.dom.renameElement(otherList, "ol");
					wysihtml5.dom.removeClassByPrefix(list, "wysiwyg-ul-");
					if (type) wysihtml5.dom.addClass(list, "wysiwyg-ol-" + type);
				});
			} else {
				// Create list
				composer.commands.exec("formatBlock", "div", tempClassName, /wysiwyg-text-align-[0-9a-z]+/g);
				tempElement = doc.querySelector("." + tempClassName);
				if(tempElement){
					isEmpty = tempElement.innerHTML === "" || tempElement.innerHTML === wysihtml5.INVISIBLE_SPACE || tempElement.innerHTML === "<br>";
					composer.selection.executeAndRestore(function() {
						list = wysihtml5.dom.convertToList(tempElement, "ol");
						if (type) wysihtml5.dom.addClass(list, "wysiwyg-ol-" + type);
					});
					if (isEmpty) {
						composer.selection.selectNode(list.querySelector("li"), true);
					}
				}
			}
		},
	
		state: function(composer, command, type) {
			var selectedNode = composer.selection.getSelectedNode();
			if (!type)
					return wysihtml5.dom.getParentElement(selectedNode, { nodeName: "OL" });
			return wysihtml5.dom.getParentElement(selectedNode, { nodeName: "OL", className: "wysiwyg-ol-" + type });
		}
	};
})(wysihtml5);

