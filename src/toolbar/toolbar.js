/**
 * Toolbar
 *
 * @param {Object} parent Reference to instance of Editor instance
 * @param {Element} container Reference to the toolbar container element
 *
 * @example
 *    <div id="toolbar">
 *      <a data-wysihtml5-command="createLink">insert link</a>
 *      <a data-wysihtml5-command="formatBlock" data-wysihtml5-command-value="h1">insert h1</a>
 *    </div>
 *
 *    <script>
 *      var toolbar = new wysihtml5.toolbar.Toolbar(editor, document.getElementById("toolbar"));
 *    </script>
 */
(function(wysihtml5) {

	"use strict";

  var CLASS_NAME_COMMAND_DISABLED   = "disabled",
      CLASS_NAME_COMMANDS_DISABLED  = "wysihtml5-disabled",
      CLASS_NAME_COMMAND_ACTIVE     = "active",
      CLASS_NAME_ACTION_ACTIVE      = "active",
      dom                           = wysihtml5.dom;
  
  wysihtml5.toolbar.Toolbar = Base.extend(
    /** @scope wysihtml5.toolbar.Toolbar.prototype */ {
    constructor: function(editor, container, showOnInit) {
      this.editor     = editor;
      this.container  = typeof(container) === "string" ? document.getElementById(container) : container;
      this.composer   = editor.composer;
      
      this._getLinks("command");
      this._getLinks("action");
      
      this._observe();
      if (showOnInit) { this.show(); }
      
      var speechInputLinks  = this.container.querySelectorAll("[data-wysihtml5-command=insertSpeech]"),
          length            = speechInputLinks.length,
          i                 = 0;
      for (; i<length; i++) {
        new wysihtml5.toolbar.Speech(this, speechInputLinks[i]);
      }
    },

    _getLinks: function(type) {
      var links   = this[type + "Links"] = wysihtml5.lang.array(this.container.querySelectorAll("[data-wysihtml5-" + type + "]")).get(),
          length  = links.length,
          i       = 0,
          mapping = this[type + "Mapping"] = {},
          link,
          group,
          name,
          value,
          activeClass,
          groupClass,
          modal,
          dialog;
      for (; i<length; i++) {
        link        = links[i];
        name        = link.getAttribute("data-wysihtml5-" + type);
        value       = link.getAttribute("data-wysihtml5-" + type + "-value");
        activeClass = link.getAttribute("data-wysihtml5-" + type + "-class");
        groupClass = link.getAttribute("data-wysihtml5-" + type + "-group-class");
        group       = this.container.querySelector("[data-wysihtml5-" + type + "-group='" + name + "']");
        dialog      = this._getDialog(link, name);
        modal       = this._getModal(link, name);
        mapping[name + ":" + value] = {
          link:   link,
          group:  group,
          name:   name,
          value:  value,
          dialog: dialog,
          modal: modal,
          activeClass: activeClass,
          groupClass: groupClass,
          state:  false
        };
      }
    },

    _getDialog: function(link, command) {
      var that          = this,
          dialogElement = this.container.querySelector("[data-wysihtml5-dialog='" + command + "']"),
          dialog,
          caretBookmark;
      
      if (dialogElement) {
        if (wysihtml5.toolbar["Dialog_" + command]) {
          dialog = new wysihtml5.toolbar["Dialog_" + command](link, dialogElement);
        } else {
        	dialog = new wysihtml5.toolbar.Dialog(link, dialogElement);
        }

        dialog.on("show", function() {
          caretBookmark = that.composer.selection.getBookmark();
          that.editor.fire("show:dialog", { command: command, dialogContainer: dialogElement, commandLink: link });
        });

        dialog.on("save", function(attributes) {
          if (caretBookmark) {
            that.composer.selection.setBookmark(caretBookmark);
          }
          that._execCommand(command, attributes);
          that.editor.fire("save:dialog", { command: command, dialogContainer: dialogElement, commandLink: link });
        });

        dialog.on("cancel", function() {
          that.editor.focus(false);
          that.editor.fire("cancel:dialog", { command: command, dialogContainer: dialogElement, commandLink: link });
        });
      }
      return dialog;
    },
    
    _getModal: function(link, command) {
      var that          = this,
          modalElement = this.container.querySelector("[data-wysihtml5-modal='" + command + "']"),
          modal,
          caretBookmark;
      
      if (modalElement) {
        modal = new wysihtml5.toolbar.Modal(link, modalElement);

        modal.on("show", function() {
          caretBookmark = that.composer.selection.getBookmark();
          that.editor.fire("show:modal", { command: command, modalContainer: modalElement, commandLink: link });
        });
        
        modal.on("save", function(attributes) {
          if (caretBookmark) {
            that.composer.selection.setBookmark(caretBookmark);
          }
          that._execCommand(command, attributes);
          that.editor.fire("save:modal", { command: command, modalContainer: modalElement, commandLink: link });
        });
        
        //modal.on("edit", function(attributes) {});

        modal.on("cancel", function() {
          that.editor.focus(false);
          that.editor.fire("cancel:modal", { command: command, modalContainer: modalElement, commandLink: link });
        });
      }
      return modal;
    },

    /**
     * @example
     *    var toolbar = new wysihtml5.Toolbar();
     *    // Insert a <blockquote> element or wrap current selection in <blockquote>
     *    toolbar.execCommand("formatBlock", "blockquote");
     */
    execCommand: function(command, commandValue) {
      if (this.commandsDisabled) {
        return;
      }
      var commandObj = this.commandMapping[command + ":" + commandValue],
          state;
                
      // Show dialog when available
      if (commandObj && commandObj.dialog && !commandObj.state) {
        commandObj.dialog.show();
      } else if (commandObj && commandObj.modal) {
        state = this.composer.commands.state(commandObj.name, commandObj.value);
        if (wysihtml5.lang.object(state).isArray()) {
            // Grab first and only object/element in state array, otherwise convert state into boolean
            // to avoid showing a dialog for multiple selected elements which may have different attributes
            // eg. when two links with different href are selected, the state will be an array consisting of both link elements
            // but the dialog interface can only update one
            state = state.length === 1 ? state[0] : true;
        }
        if (typeof(state) === "object") {
          commandObj.modal.show(state);
        } else {
          commandObj.modal.show();
        }
        
      } else {
        this._execCommand(command, commandValue);
      }
    },

    _execCommand: function(command, commandValue) {
      // Make sure that composer is focussed (false => don't move caret to the end)
      this.editor.focus(false);
      this.composer.commands.exec(command, commandValue);
      this._updateLinkStates();
    },

    execAction: function(action) {
      var editor = this.editor;
      if (action === "change_view") {
        if (editor.textarea) { 
					if (editor.currentView === editor.textarea) {
						editor.fire("change_view", "composer");
					} else {
						editor.fire("change_view", "textarea");
					}
				}
      }
      if (action == "showSource") {
          editor.fire("showSource");
      }
    },

    _observe: function() {
      var that      = this,
          editor    = this.editor,
          container = this.container,
          links     = this.commandLinks.concat(this.actionLinks),
          length    = links.length,
          i         = 0;
      
      for (; i<length; i++) {
        // 'javascript:;' and unselectable=on Needed for IE, but done in all browsers to make sure that all get the same css applied
        // (you know, a:link { ... } doesn't match anchors with missing href attribute)
        if (links[i].nodeName === "A") {
          dom.setAttributes({
            href:         "javascript:;",
            unselectable: "on"
          }).on(links[i]);
        } else {
          dom.setAttributes({ unselectable: "on" }).on(links[i]);
        }
      }

      // Needed for opera and chrome
      dom.delegate(container, "[data-wysihtml5-command], [data-wysihtml5-action]", "mousedown", function(event) { event.preventDefault(); });
      
      dom.delegate(container, "[data-wysihtml5-command]", "click", function(event) {
        var link          = this,
            command       = link.getAttribute("data-wysihtml5-command"),
            commandValue  = link.getAttribute("data-wysihtml5-command-value");
        event.preventDefault();
        that.execCommand(command, commandValue);
      });

      dom.delegate(container, "[data-wysihtml5-action]", "click", function(event) {
        var action = this.getAttribute("data-wysihtml5-action");
        event.preventDefault();
        that.execAction(action);
      });
      
			editor.on("interaction:composer", function() {
					that._updateLinkStates();
			});

      editor.on("focus:composer", function() {
        that.bookmark = null;
        clearInterval(that.interval);
        that.interval = setInterval(function() { that._updateLinkStates(); }, 500);
      });
      
      /* MOVE  to state */
      /*
      if (this.editor.config.handleTables) {
				editor.on("tableselect:composer", function() {
						that.container.querySelectorAll('[data-wysihtml5-hiddentools="table"]')[0].style.display = "";
				});
				editor.on("tableunselect:composer", function() {
						that.container.querySelectorAll('[data-wysihtml5-hiddentools="table"]')[0].style.display = "none";
				});
      }
      */

      editor.on("blur:composer", function() {
        clearInterval(that.interval);
      });

      editor.on("destroy:composer", function() {
        clearInterval(that.interval);
      });

      editor.on("change_view", function(currentView) {
        // Set timeout needed in order to let the blur event fire first
        if (editor.textarea) {
					setTimeout(function() {
						that.commandsDisabled = (currentView !== "composer");
						that._updateLinkStates();
						if (that.commandsDisabled) {
							dom.addClass(container, CLASS_NAME_COMMANDS_DISABLED);
						} else {
							dom.removeClass(container, CLASS_NAME_COMMANDS_DISABLED);
						}
					}, 0);
        }
      });
    },

    _updateLinkStates: function() {
      var commandMapping    = this.commandMapping,
          actionMapping     = this.actionMapping,
          i,
          state,
          action,
          command;
      // every millisecond counts... this is executed quite often
      for (i in commandMapping) {
        command = commandMapping[i];
        var commandActiveClass = (command.activeClass) ? command.activeClass : CLASS_NAME_COMMAND_ACTIVE;
        var groupActiveClass = (command.groupClass) ? command.groupClass : commandActiveClass;
        
        
        if (this.commandsDisabled) {
          state = false;
          dom.removeClass(command.link, commandActiveClass);
          if (command.group) {
            dom.removeClass(command.group, groupActiveClass);
          }
          if (command.dialog) {
            command.dialog.hide();
          }
          if (command.modal) {
            command.modal.hide();
          }
        } else {
          state = this.composer.commands.state(command.name, command.value);
          if (wysihtml5.lang.object(state).isArray()) {
            // Grab first and only object/element in state array, otherwise convert state into boolean
            // to avoid showing a dialog for multiple selected elements which may have different attributes
            // eg. when two links with different href are selected, the state will be an array consisting of both link elements
            // but the dialog interface can only update one
            state = state.length === 1 ? state[0] : true;
          }
          dom.removeClass(command.link, CLASS_NAME_COMMAND_DISABLED);
        }

        if (command.state === state) {
          continue;
        }

        command.state = state;
        
        if (state) {
          dom.addClass(command.link, commandActiveClass);
          
          if (command.group) {
            dom.addClass(command.group, groupActiveClass);
          }
          if (command.dialog) {
            if (typeof(state) === "object") {
              command.dialog.show(state);
            } else {
              command.dialog.hide();
            }
          } 
        } else {
          dom.removeClass(command.link, commandActiveClass);
          if (command.group) {
            dom.removeClass(command.group, groupActiveClass);
            //dom.addClass(command.group, CLASS_NAME_COMMANDS_DISABLED);
          } 
          if (command.dialog) {
            command.dialog.hide();
          }
        }
      }
      
      for (i in actionMapping) {
        action = actionMapping[i];
        var actionActiveClass = (action.activeClass) ? action.activeClass : CLASS_NAME_ACTION_ACTIVE;
        
        if (action.name === "change_view") {
          action.state = this.editor.currentView === this.editor.textarea;
          if (action.state) {
            dom.addClass(action.link, actionActiveClass);
          } else {
            dom.removeClass(action.link, actionActiveClass);
          }
        }
      }
    },

    show: function() {
      this.container.style.display = "";
    },

    hide: function() {
      this.container.style.display = "none";
    }
  });
  
})(wysihtml5);
