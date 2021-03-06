/**
 * WYSIHTML5 Editor
 *
 * @param {Element} editableElement Reference to the textarea which should be turned into a rich text interface
 * @param {Object} [config] See defaultConfig object below for explanation of each individual config option
 *
 * @events
 *    load
 *    beforeload (for internal use only)
 *    focus
 *    focus:composer
 *    focus:textarea
 *    blur
 *    blur:composer
 *    blur:textarea
 *    change
 *    change:composer
 *    change:textarea
 *    paste
 *    paste:composer
 *    paste:textarea
 *    newword:composer
 *    destroy:composer
 *    undo:composer
 *    redo:composer
 *    beforecommand:composer
 *    aftercommand:composer
 *    enable:composer
 *    disable:composer
 *    change_view
 */
(function(wysihtml5) {
  
  "use strict";
  
  var undef;
  
  var defaultConfig = {
    // Give id of the editor contener 
    editorContainer:             undef,
    // Give the editor a name, the name will also be set as class name on the iframe and on the iframe's body 
    name:                       undef,
    // Whether the editor should look like the textarea (by adopting styles)
    style:                      true,
    // Id of the toolbar element, pass falsey value if you don't want any toolbar logic
    toolbar:                    undef,
    // Whether toolbar is displayed after init by script automatically.
    // Can be set to false if toolobar is set to display only on editable area focus
    showToolbarAfterInit:       true,
    // Whether urls, entered by the user should automatically become clickable-links
    autoLink:                   true,
    // Includes table editing events and cell selection tracking 
    handleTables:               true,
    // Object which includes parser rules to apply when html gets inserted via copy & paste
    // See parser_rules/*.js for examples
    parserRules:                { tags: { br: {}, span: {}, div: {}, p: {} }, classes: {} },
    // Parser method to use when the user inserts content via copy & paste
    parser:                     wysihtml5.dom.parse,
    // Class name which should be set on the contentEditable element in the created sandbox iframe, can be styled via the 'stylesheets' option
    composerClassName:          "wysihtml5-editor",
    // Class name to add to the body when the wysihtml5 editor is supported
    bodyClassName:              "wysihtml5-supported",
    // By default wysihtml5 will insert a <p> for line breaks, set this to true to use <br>
    useLineBreaks:              false,
    // By default wysihtml5 will insert a <br> for line breaks when you press shift Enter, set this to false to use remove this option
    useShiftEnterLineBreaks:    true,
    // Array (or single string) of stylesheet urls to be loaded in the editor's iframe
    stylesheets:                [],
    // Placeholder text to use, defaults to the placeholder attribute on the textarea element
    placeholderText:            undef,
    // Whether the rich text editor should be rendered on touch devices (wysihtml5 >= 0.3.0 comes with basic support for iOS 5)
    supportTouchDevices:        true,
    // Whether senseless <span> elements (empty or without attributes) should be removed/replaced with their content
    cleanUp:                    true,
    // credit display in console.log "Heya! This page is using wysihtml5 for rich text editing. Check out https://github.com/xing/wysihtml5
    credit:                     true,
    // Whether to use div instead of secure iframe
    contentEditableMode: false,
    // enable predictive heading 
    predictive:                 true,
    // customClassRegExp
    customClassRegExp: 					/ap-[-0-9a-z]+/g
  };
  
  wysihtml5.Editor = wysihtml5.lang.Dispatcher.extend(
    /** @scope wysihtml5.Editor.prototype */ {
    constructor: function(editableElement, config) {
      this.editableElement  = typeof(editableElement) === "string" ? document.getElementById(editableElement) : editableElement;
      this.config           = wysihtml5.lang.object({}).merge(defaultConfig).merge(config).get();
      this.currentView      = this.textarea;
      this._isCompatible    = wysihtml5.browser.supported();
      
      if (this.editableElement.nodeName.toLowerCase() != "textarea") {
        this.config.contentEditableMode = true;
        this.config.noTextarea = true;
      }
      if (!this.config.noTextarea) {
        this.textarea         = new wysihtml5.views.Textarea(this, this.editableElement, this.config);
      	this.currentView      = this.textarea;
      	this._isCompatible    = wysihtml5.browser.supported();
      }
      
      // Sort out unsupported/unwanted browsers here
      if (!this._isCompatible || (!this.config.supportTouchDevices && wysihtml5.browser.isTouchDevice())) {
        var that = this;
        setTimeout(function() { that.fire("beforeload").fire("load"); }, 0);
        return;
      }
      
      //  add default class name to textarea element
      wysihtml5.dom.addClass(this.editableElement, 'wysihtml5-textarea');
      
      // Add class name to body, to indicate that the editor is supported
      wysihtml5.dom.addClass(document.body, this.config.bodyClassName);
      
      //  add default class name to body element
      wysihtml5.dom.addClass(document.body, 'wysihtml5-body');
      
      this.composer = new wysihtml5.views.Composer(this, this.editableElement, this.config);
      this.currentView = this.composer;
      
      if (typeof(this.config.parser) === "function") {
        this._initParser();
      }
      
      this.on("beforeload", function() {
        if (!this.config.noTextarea) {
        	this.synchronizer = new wysihtml5.views.Synchronizer(this, this.textarea, this.composer);
        }
        if (this.config.toolbar) {
          this.toolbar = new wysihtml5.toolbar.Toolbar(this, this.config.toolbar, this.config.showToolbarAfterInit);
        }
        
      });
      
      if (this.config.credit == true) { //  default si set to true
          try {
            console.log("Heya! This page is using wysihtml5 for rich text editing. Check out https://github.com/xing/wysihtml5");
          } catch(e) {}
      }
    },
    
    isCompatible: function() {
      return this._isCompatible;
    },

    clear: function() {
      this.currentView.clear();
      return this;
    },

    getValue: function(parse) {
      return this.currentView.getValue(parse);
    },

    setValue: function(html, parse) {
      this.fire("unset_placeholder");
      
      if (!html) {
        return this.clear();
      }
      
      this.currentView.setValue(html, parse);
      return this;
    },
    
    
    prependValue: function(html, parse) {
      this.currentView.prependValue(html, parse);
      return this;
    },

    appendValue: function(html, parse) {
      this.currentView.appendValue(html, parse);
      return this;
    },

    replaceValue: function(a, b) {
      this.currentView.replaceValue(a, b);
      return this;
    },

    cleanUp: function() {
        this.currentView.cleanUp();
    },

    focus: function(setToEnd) {
      this.currentView.focus(setToEnd);
      return this;
    },

    /**
     * Deactivate editor (make it readonly)
     */
    disable: function() {
      this.currentView.disable();
      return this;
    },
    
    /**
     * Activate editor
     */
    enable: function() {
      this.currentView.enable();
      return this;
    },
    
    isEmpty: function() {
      return this.currentView.isEmpty();
    },
    
    hasPlaceholderSet: function() {
      return this.currentView.hasPlaceholderSet();
    },
    
    parse: function(htmlOrElement) {
      var parseContext = (this.config.contentEditableMode) ? document : this.composer.sandbox.getDocument();
      var returnValue = this.config.parser(htmlOrElement, this.config.parserRules, parseContext, this.config.cleanUp);
      if (typeof(htmlOrElement) === "object") {
        wysihtml5.quirks.redraw(htmlOrElement);
      }
      return returnValue;
    },
    
    /**
     * Prepare html parser logic
     *  - Observes for paste and drop
     */
    _initParser: function() {
      this.on("paste:composer", function() {
        var keepScrollPosition  = true,
            that                = this;
        that.composer.selection.executeAndRestore(function() {
          wysihtml5.quirks.cleanPastedHTML(that.composer.element);
          that.parse(that.composer.element);
        }, keepScrollPosition);
      });
    }
  });
})(wysihtml5);
