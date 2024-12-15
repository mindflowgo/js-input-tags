/***************************************************************
 * = TAG INPUT = v1.16
 * 
 * Simple tag input engine to allow styling input tags in your code. 
 * Pure javascript, unobtrusive to other code, but DOES require DOM
 * access.
 * 
 * By Filipe Laborde (fil@rezox.com), 7-Dec-2024
 * 
 * Inspired by https://github.com/rk4bir/simple-tags-input - (c) 2022 Raihan Kabir
 * 
 * MIT License: Use as you wish along with the risks of using this.
 * 
 * USAGE:
 * import InputTags from '...'
 * 
 * const inputTags = new InputTags({ 
 *    listId: "tagsList", inputId: "tagsInput", outputId: "saveInput",  // DOM elements to attach to
 *    afterUpdate: mySave                                                  // Pass in function to call with updated tag items
 *    specialKeys: true, delimiter: ';',                                // To record special keys (ex. arrow, etc)
 *    tags: ['first','second'], unique: false, 
 *    autocompleteList: [ "One", "Two", "AutoSelect3", "AutoSelect4"]
 * });
 * 
 * Example reason for changing delimiter from comma: when pressing special keys (Ctrl,Alt), if 
 * multiple pressed
 */
export default class InputTags {
    constructor(props) {
        const { tags, unique, drag, delimiter, maxTags, specialKeys, mouse, afterUpdate, afterEnter, inputId, listId, outputId, autocompleteList }= props;

        const settings = {
            tagCnt: 0,
            tags: [],
            unique: unique || false,
            drag: drag || false,
            dragTag: { fromId: null, toId: null },
            delimiter: delimiter || ',',
            maxTags,
            specialKeys: specialKeys || false,
            mouse: mouse || false,
            afterUpdate,
            afterEnter,
            searchItems: autocompleteList || [],
            inputId,
            listID: listId,
            listEl: null,
            inputEl: null,
            searchListEl: null,
			outputId: outputId || undefined,
        }
        Object.assign(this, settings);

        // initialize plugin
        // try {
            this.inputEl = document.getElementById(inputId);
            this.listEl = document.getElementById(listId);

            if (this.inputEl.tagName != "INPUT" || this.listEl.tagName != "UL") {
                throw new Error("TagsInput: NEED EXISTING input and list element: inputEl, listEl");
            }

            // create autocomplete
            if( this.searchItems.length>0 ){
                this.#createAutoCompleteElement(inputId);
                this.inputEl.addEventListener( "keyup", this.#handleAutoCompleteList.bind(this));
            }

            this.listEl.classList.add("tagsList");
            if (this.drag){
                this.listEl.addEventListener("dragstart", this.#handleTagDrag.bind(this));
                this.listEl.addEventListener("dragover", this.#handleTagDrag.bind(this));
                this.listEl.addEventListener("dragenter", this.#handleTagDrag.bind(this));
                this.listEl.addEventListener("dragend", this.#handleTagDrag.bind(this));
            }
 
            // keyup: allows default behavior (ex. Enter = next item)
            // keydown: intercepts keys, must display/move manually
            this.inputEl.addEventListener( this.specialKeys ? "keydown" : "keyup", this.#handleInput.bind(this));
            if( this.specialKeys && this.mouse ) this.inputEl.addEventListener( "mousedown", this.#handleInput.bind(this));
            document.addEventListener(`__${this.listID}_`, this.#handleTagEvent.bind(this));

            this.listEl.innerHTML = ''; // clear the list initially
            if( tags && tags.length>0 )
                tags.forEach( tag => this.addTag(tag,true) );

            // focus on input
            this.inputEl.focus();
        // } catch (e) {
        //     throw new Error("TagsInput: failed setup, quitting.");
        // }
    }

    // private methods ----------------------------------------------------------------------

    // if adjustment to tag set needed, pass that in.
    #updateOutput(error=''){
        const outputEl = document.getElementById(this.outputId);
        if( error ) this.inputEl.setAttribute('placeholder', error);
        // output to a specified input field (ex. hidden) (if given)
        const outputData = this.tags.filter(_tag => _tag !== '').join(this.delimiter);
        if( outputEl  ) outputEl.value = outputData;
        // calling specified function with tag output (if given)
        if( this.afterUpdate ) this.afterUpdate(outputData,error);
    }

    #encodeHTMLEntities(text) {
        return text.replace(/[\u00A0-\u9999<>\&'"]/g, c => '&#'+c.charCodeAt(0)+';')
    }

    #escapeQuotes(text,slash=false) {
        // we do the \\ as well so it's a sort of double-escape, because it un-escapes one level for suggestion box
        return text.replace(/(['"])/g, c => (slash ? '\\' : '') + '&#'+c.charCodeAt(0)+';')
    }

    #buildTagsFromDOM(update=true){
        // now refresh tags based on actual DOM elements present
        this.tags = [];
        document.querySelectorAll(`#${this.listID} LI`).forEach(el =>{ 
            if( el.dataset.item ) this.tags.push(el.dataset.item); });
        if( update )this.#updateOutput();
    }

    #handleInput(e) {
        // e.preventDefault();
        let key = e.key || ""; // e.code provides Left/Right for Meta,Alt,etc.
            
        if( this.specialKeys ){
            // deal with MOUSE actions first
            if( e.which<6 ){
                // likely clicking in INPUT to get focus, else something present, ignore mouse
                if( !this.mouse || document.activeElement.id != this.inputEl.id || this.inputEl.value.length>0 ) return; 

                // valid focus object, and was empty so lets fill it with mouse action
                e.preventDefault();
                if( e.which==1 )
                    this.addTag('ClickLeft');
                else if( e.which==2 )
                    this.addTag('ClickMiddle');
                else if( e.which==3 )
                    this.addTag('ClickRight');
                return;
            }
            // won't show these special keys if first pressed
            const ignoreSpecialKeys = ['Shift'];
            // we will create tag immediately for any of these special keys pressed
            const firstSpecialKeys = ['Backspace','Enter','←','→','↑','↓','Escape','Tab','CapsLock','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12'];
            // will allow groupings of these 
            const specialKeyList = ['Control','Meta','Alt'];
            // map any special keys we want symbols to appear for, remap here (and then reference them by their new symbol!)
            const symbolMap = { 
                ArrowLeft: "←", 
                ArrowUp: "↑",
                ArrowRight: "→",
                ArrowDown: "↓"
            }

            if( symbolMap[key] )
                key = symbolMap[key];
            
            if( ignoreSpecialKeys.includes(key) ){ //e.target.value.length == 0 && 
                // we don't want showing shift as it's usually to uppercase a letter
                return;

            } else if( e.target.value.length == 0 && firstSpecialKeys.includes(key) ){
                // SPECIAL KEY + First keypress  (arrows,backspace,enter): immediate tag generation 
                // (their behaviour changes beyond first character to help navigation);
                e.preventDefault();
                
                this.addTag(key);
                e.target.value = "";
                return;

            } else if( key == "Enter" ) {
                // always intercept and prevent enter's default
                e.preventDefault();

            } else {
                // clear any empty commas (,,) - build array of comma separated keys in input
                const priorKeys = e.target.value.split(',').filter(_key => _key.trim() !== '');

                // if it's special characters, we only allow some, and ONLY with other special characters; ignore rest
                const allSpecial = priorKeys.every(_key => specialKeyList.includes(_key));
                const keyAlreadyExists = priorKeys.includes(key);

                if( key.length>2 ){
                    // SPECIAL KEYS - add if unique and prior are special too
                    if( allSpecial && !keyAlreadyExists && specialKeyList.includes(key) ) { 
                        // if prior are special, we allow adding new unique ones
                        e.target.value += (e.target.value.length>0 ? ',' : '') + key;
                    }
                    // special key but, already exists, not on list, etc, so ignoring:
                    // BUT letting system default behaviours bubble -> else add: else { preventDefault(); }

                } else if( allSpecial && e.target.value.length>0 ){
                    // NORMAL KEY: are all prior keys special? -> insert comma before key!
                    // preventDefault in case holding special key and pressing normal (don't want system behaviour)
                    e.preventDefault();
                    e.target.value += ',' + key;
                }
                // otherwise handle normally
            }
        } 

        // Normal processing for keys - add to input (and do search-items if available), unless Enter in which we create tag
        if( key == "Enter") {
            // insert new tag
            this.addTag(e.target.value);
            e.target.value = "";
            if( this.tags.length>0 && typeof(this.afterEnter)=='function' ) this.afterEnter(this.tags);
        }
    }

    #handleTagEvent(e) {
        // Handles outside plugin tasks (add/remove tag via event listener)
        const { action, tags, elementID }= e.detail;
        if (action == 'add'){
            this.addTag(tags);
            this.inputEl.value = '';
            this.inputEl.focus();
            if( this.searchListEl ) this.searchListEl.style.display = 'none';

        } else if (action == 'remove'){
            this.removeTag(elementID);
        }
        // prevent any bubbling to other effects
        e.preventDefault();
    }

    #handleTagDrag(e) {
        if( e.type == 'dragover' ){ e.preventDefault(); return; } // prevent return animation
        if( e.target.tagName != 'LI' ){
            this.dragTag.toId = null;
            return; // care about operations on LI
        }
        const el = e.target;

        if( e.type == 'dragstart' ){
            this.dragTag.fromId = el.id;
            e.dataTransfer.effectAllowed = 'move';
            el.classList.add('tagsDragThis');

        } else if( e.type == 'dragenter' ){
            this.dragTag.toId = el.id;
            // remove all and add to new entry
            document.querySelectorAll(`#${this.listID} LI`).forEach(el => el.classList.remove('tagsDragOver'));
            if( el.id != this.dragTag.fromId ) el.classList.add('tagsDragOver');

        } else if( e.type == 'dragend' ){
            e.preventDefault(); // no event bubbling, ex. if they grabbed the close-box
            document.querySelectorAll(`#${this.listID} LI`).forEach(el => el.classList.remove('tagsDragOver'));
            const fromEl = document.getElementById(this.dragTag.fromId);
            fromEl.classList.remove('tagsDragThis');
            if( this.dragTag.toId && this.dragTag.toId != this.dragTag.fromId ) { //drop must be in the basic area of the tags else ignore (&& e.offsetY > -30 && e.offsetY < 90)
                const toRect = document.getElementById(this.dragTag.toId).getClientRects()[0];
                if( Math.abs((e.clientX+window.scrollX)-toRect.left)>100 ){ console.log( ` x DROP IGNORED: too far away tag on X-axis (${toRect.left},${toRect.top}) drop(${e.clientX+window.scrollX},${e.clientY})`); return; }
                const fromNode = fromEl.cloneNode(true); 
                fromEl.remove();
                document.getElementById(this.dragTag.toId).insertAdjacentElement("beforebegin", fromNode);
                // rebuild tag list from new DOM placements
                this.#buildTagsFromDOM();
            }
        }
    }

    // public methods ---------------------------------------------------------------------------------

    // undo all the Input-Tags changes
    destroy() {
        this.inputEl.removeEventListener(this.specialKeys ? "keydown" : "keyup", this.#handleInput);
        document.removeEventListener(`__${this.listID}_`, this.#handleTagEvent);
        if( this.tags.length<1 ) this.listEl.classList.remove("tagsList");
        this.listEl.innerHTML = this.tags.map(tag =>`<li>${this.#encodeHTMLEntities(tag)}</li>`).join(''); // allow the list items to remain
        if (this.searchItems.length > 0) {
            this.inputEl.removeEventListener("keyup", this.#handleAutoCompleteList);
            if (this.searchListEl) this.searchListEl.remove();
        }
        if (this.drag){
            this.listEl.removeEventListener("dragstart", this.#handleTagDrag);
            this.listEl.removeEventListener("dragenter", this.#handleTagDrag);
            this.listEl.removeEventListener("dragover", this.#handleTagDrag);
            this.listEl.removeEventListener("dragend", this.#handleTagDrag);
        }
        this.inputEl = null;
        this.listEl = null;
        this.searchListEl = null;
    }

    // manually adjust output field, perhaps within afterUpdate() hook
    adjustOutput(_tags=[]){
        const outputEl = document.getElementById(this.outputId);
        if( outputEl  ) outputEl.value = _tags.filter(_tag => _tag !== '').join(this.delimiter);            
    }
    
    getTags() {
        return this.tags;
    }

    addTag(tags, initLoad=false) {
        // rebuild tags list firstfrom DOM; in case modified somewhere
        this.#buildTagsFromDOM(false);

        let _html = '', _error = '';
        tags.split(this.delimiter).forEach(tag => {
            if( !initLoad && this.maxTags && this.tags.length >= this.maxTags ){ 
                console.log( ` x maxTags(${this.maxTags}) reached: ignoring tag '${tag}'`); 
                _error = 'MaxTags Reached';

            }  else {
                tag = tag.trim();
                if( tag != '' && (!this.unique || !this.tags.includes(tag)) ){
                    this.tags.push(tag);
                    this.tagCnt++; // each new entry new cnt, so always unique
                    const elementID = this.listID + '_' + this.tagCnt;
                    // htmlEntities on html; and escape ' for data-item in case messages structure
                    _html += `<li id='${elementID}' data-item='${this.#escapeQuotes(tag)}'`
                            +` ${this.drag ? "draggable='true' " : ''}>${this.#encodeHTMLEntities(tag)} `
                            +`<span onclick="_tagAction('remove','${this.listID}','','${elementID}')">X</span></li>`;
                }
            }
        });
        this.listEl.innerHTML += _html;
        if( _html || _error ) this.#updateOutput(_error);
    }

    removeTag(elementID) {
        // as tag-data may not be unique, we use the unique-DOM-id created for entry
        const elementEl = document.getElementById(elementID);
        if( !elementEl ) return;
        elementEl.remove();
        this.#buildTagsFromDOM();
    }
    
    
    // == AUTOCOMPLETE CODE ========================================
    toggleAutoComplete(tags) {
        if( !this.searchListEl ) return;
        if( this.searchListEl.style.display == 'none' )
            this.#handleAutoCompleteList(null,tags)
        else
            this.searchListEl.style.display = 'none';
    }

    #createAutoCompleteElement(inputId) {
        // create search list `ul` element and set to `this.searchListEl`
        const spanEl = document.createElement('span');
        const inputEl = document.getElementById(inputId);
        spanEl.className = 'tagsAutocompleteList';
        inputEl.parentNode.insertBefore(spanEl, inputEl); // Insert the <span> before the input
        spanEl.appendChild(inputEl); // Move the input inside the <span>
        const elName = this.listID + '_autocomplete';
        const html = `<ul id='${elName}' style='display: none'></ul>`;
        spanEl.insertAdjacentHTML('beforeend', html);
        this.searchListEl = document.getElementById(elName);
    }

    #handleAutoCompleteList(e, _q='') {
        // on keyup so after key actions complete
        const q = _q || e.target.value.trim();
        let results = [];
        if( q.length>1 ){
            results = this.searchItems.filter(item => item.toLowerCase().indexOf(q.toLowerCase()) != -1);
            const _html = results.map(tag => `<li onclick="_tagAction('add','${this.listID}','${this.#escapeQuotes(tag,true)}')">${this.#encodeHTMLEntities(tag)}</li>` ).join('');
            this.searchListEl.innerHTML = _html;
        }
        this.searchListEl.style.display =( q.length>1 && results.length>0 ? 'block' : 'none' );
    }

} // END of class: TagsInput


// DOM accessible function (injected into HTML)
function _tagAction(action, listID, tags=[], elementID='') {
    let eventDetails = {
        bubbles: true, 
        cancelable: true, 
        detail: { action, tags, elementID }
    };
    const event = new CustomEvent(`__${listID}_`, eventDetails);
    document.dispatchEvent(event);
}
// Expose function to HTML
window._tagAction = _tagAction;