/***************************************************************
 * = TAG INPUT = v2.00
 * 
 * Simple tag input engine to allow styling input tags in your code. 
 * Pure javascript, unobtrusive to other code, but DOES require DOM
 * access.
 * 
 * By Filipe Laborde (fil@rezox.com), 29-Dec-2025
 * 
 * Inspired by https://github.com/rk4bir/simple-tags-input - (c) 2022 Raihan Kabir
 * 
 * MIT License: Use as you wish along with the risks of using this.
 * 
 * USAGE:
 * import InputTags from '...'
 * 
 * const inputTags = new InputTags(document.getElementById('tagsInput'), { 
 *    autocomplete: ['apple', 'banana', 'cherry'],
 *    onAdd: (tag) => console.log('Added:', tag),
 *    onDelete: (tag) => console.log('Deleted:', tag)
 * });
 */
export default class InputTags {
    constructor(inputEl, opts = {}) {
        this.input = inputEl;   // where the user enters tags
        this.opts = {
            allowDelete: true,  // allow the [x] deletes
            allowDuplicates: false, // whether repeat tag names allowed
            allowSpaces: false, // whether spaces in tags allowed (else = Enter)
            allowCustomKeys: false,// handle special characters with onInput 
            autocomplete: [],   // ['apple', 'banana', ...]
            initialTags: [],    // initial tags to show
            targetEl: null,     // where to place the list (optional, could be pre-populated UL list)
            onAdd: null,
            onDelete: null,
            onInput: null,
            onChange: null,
            ...opts,
        };

        this.tags = [];
        this.abortController = new AbortController();
        this.dragAbortController = null;
        this.dragTarget = null;

        this.#init();
    }

    #init() {
        // If the element is a UL, process it, else create list IN it.
        const targetEl = this.opts.targetEl
        if( targetEl && targetEl.tagName === 'UL' ) {
            this.list = targetEl;
            // Clear existing content except for any non-tag items
            Array.from(this.list.children).forEach(child => {
                if (child.dataset.tag || child.querySelector('span')) child.remove();
            });
        } else {
            // Create new list if none exists
            this.list = document.createElement('ul');
            this.list.className = 'tagsList';
            this.list.setAttribute('role', 'list');
            if( targetEl )    // list container exists put this into it.
                targetEl.appendChild(this.list)
            else            // no list container exists, so insert above input
                this.input.parentNode.insertBefore(this.list, this.input);
        }

        this.placeholder = document.createElement('li');
        this.placeholder.className = 'tagsDragPlaceholder';

        this.autocomplete = document.createElement('div');
        this.autocomplete.className = 'tagsAutocompleteList';
        this.autocomplete.style.display = 'none';

        // Insert autocomplete after input
        this.input.insertAdjacentElement('afterend', this.autocomplete)
        // this.input.parentNode.insertBefore(this.autocomplete, this.input);

        // special keys means ignore normal input handling, let user manage 
        if (!this.opts.allowCustomKeys) 
            this.input.addEventListener('input', this.#onInput.bind(this), { 
                signal: this.abortController.signal 
            });
        this.input.addEventListener('keydown', this.#onKeydown.bind(this), { 
            signal: this.abortController.signal 
        });
        this.list.addEventListener('pointerdown', this.#onPointerDown.bind(this), { 
            signal: this.abortController.signal 
        });

        // Load existing tags (from data-tags or initial <li>)
        this.#loadInitialTags();
    }

    #loadInitialTags() {
        // initial values can be passed in as: 
        // 1) options: initialTags
        // 2) targetEl UL list with LI tags
        const tags = this.opts.initialTags;
        if (tags && tags.length) {
            tags.forEach(tag => this.addTag(tag.trim()));
            return;
        }

        // From existing <li> children - re-attach as draggable elements
        const existing = this.list.querySelectorAll('li');
        existing.forEach(li => {
            const text = li.textContent.replace('×', '').trim();
            if (text) this.addTag(text,li); // add to existing li
        });
        if( existing && this.opts.onChange ) this.opts.onChange()
    }

    #onInput(e) {
        let value = e.target.value;
        if (this.opts.onInput)
            // onInput can override/adjust values
            e.target.value = this.opts.onInput(value);
        this.showAutocomplete(value.trim());
    }
    

    #onKeydown(e) {
        let value = this.input.value.trim();
        // special inputs allowed, so we re-route them to onInput early (on keypress-down!)
        if (this.opts.onInput && this.opts.allowCustomKeys) {
            this.opts.onInput(value, e)    
            return
        }

        // else normal key handling ...

        // Backspace on empty input -> delete last tag
        if (e.key === 'Backspace' && !value && this.tags.length) {
            e.preventDefault();
            this.deleteTag(this.tags.length - 1);
            return;
        }

        // Enter/Comma -> add tag
        const shouldAdd = 
            e.key === 'Enter' || 
            (!this.opts.allowSpaces && e.key === ',') ||
            (this.opts.allowSpaces && e.key === ' ' && value.includes(','));

        if (shouldAdd && value) {
            e.preventDefault();
            this.addTag(value);
            this.input.value = '';
            this.hideAutocomplete();
        }
    }

    showAutocomplete(value) {
        if (!this.opts.autocomplete.length || !value) {
        this.hideAutocomplete();
        return;
        }

        const matches = this.opts.autocomplete
        .filter(tag => 
            tag.toLowerCase().includes(value.toLowerCase()) &&
            !this.tags.includes(tag)
        )
        .slice(0, 8);

        if (!matches.length) {
            this.hideAutocomplete();
            return;
        }

        const ul = document.createElement('ul');
        matches.forEach(tag => {
        const li = document.createElement('li');
        li.textContent = tag;
        li.addEventListener('click', () => {
                this.addTag(tag);
                this.input.value = '';
                this.hideAutocomplete();
            }, 
            { signal: this.abortController.signal });
            ul.appendChild(li);
        });

        this.autocomplete.innerHTML = '';
        this.autocomplete.appendChild(ul);
        this.autocomplete.style.display = 'block';
    }

    hideAutocomplete() {
        this.autocomplete.style.display = 'none';
    }

    #onPointerDown(e) {
        const li = e.target.closest('li');
        if (!li || !li.dataset.tag) return; // Only drag tag elements

        // Don't start drag if clicking on delete button
        if (e.target.tagName === 'SPAN') return;

        e.preventDefault();

        this.dragData = {
            el: li,
            startIndex: [...this.list.children].indexOf(li),
        };

        li.classList.add('tagsDragThis');

        // insert placeholder where cursor is to allow queuing in placement
        li.before(this.placeholder);

        this.dragAbortController?.abort();
        this.dragAbortController = new AbortController();

        document.addEventListener('pointermove',this.#onPointerMove.bind(this),
            { signal: this.dragAbortController.signal });

        document.addEventListener('pointerup',this.#onPointerUp.bind(this),
            { signal: this.dragAbortController.signal, once: true });

        // sometimes if scrolling on mobile, you won't get pointerup but still touchend
        document.addEventListener('touchend',this.#onPointerUp.bind(this),
            { signal: this.dragAbortController.signal, once: true });
    }

    #onPointerMove(e) {
        if (!this.dragData) return;

        const target = document
            .elementFromPoint(e.clientX, e.clientY)
            ?.closest('li');

        if (
            !target ||
            target === this.dragData.el ||
            target === this.placeholder ||
            !target.dataset.tag // Only target tag elements
        ) return;

        this.#clearDropIndicator();

        const rect = target.getBoundingClientRect();
        const before = e.clientX < rect.left + rect.width / 2;

        this.dragTarget = target;
        target.classList.add('tagsDragOver');

        this.list.insertBefore(
            this.placeholder,
            before ? target : target.nextSibling
        );
    }

    #onPointerUp(e) {
        if (this.dragData) {
            const { el } = this.dragData;
            this.list.insertBefore(el, this.placeholder);
        }

        // clean-up 
        this.#clearDropIndicator();
        this.placeholder.remove();

        // make sure tags matches order of list
        const prevTags = this.tags.join('|')
        this.tags = []
        for (const li of this.list.querySelectorAll('li[data-tag]')) {
            this.tags.push( li.dataset.tag)
            li.classList.remove('tagsDragThis');
        }

        // Trigger callbacks for all tags to notify of reordering
        if (this.opts.onChange && prevTags !== this.tags.join('|')) {
            this.opts.onChange(this.tags)
        }

        this.dragAbortController?.abort();
        this.dragAbortController = null;
        this.dragData = null;
        this.input.focus();
    }

    #clearDropIndicator() {
        if (this.dragTarget) {
            this.dragTarget.classList.remove('tagsDragOver');
            this.dragTarget = null;
        }
    }

    #renderDeleteButton(li) {
        if (!this.opts.allowDelete) return;
        const span = document.createElement('span');
        span.classList.add('tagDelete')
        span.innerHTML = '&times;';
        span.style.cursor = 'pointer';
        span.addEventListener('click', (e) => {
            e.stopPropagation();
            this.#deleteTagEl(li);
            }, 
            { signal: this.abortController.signal });
        li.appendChild(span);
    }

    #deleteTagEl(li) {
        const text = li.dataset.tag;
        // if onDelete we look for return from it to allow delete or not
        const allowDelete = this.opts.onDelete ? this.opts.onDelete(text) : true
        if (!allowDelete) return;

        li.remove();
        const index = this.tags.indexOf(text);
        if (index > -1){
            this.tags.splice(index, 1);
            if( this.opts.onChange ) this.opts.onChange(this.tags);
        }
    }

    // Emergency cleanup for stuck drag states
    #cleanupDragState() {
        // Remove all drag-related classes from all elements
        this.list.querySelectorAll('li').forEach(li => {
            li.classList.remove('tagsDragThis', 'tagsDragOver');
            if (li.dataset.tag) {
                li.style.cursor = 'grab';
            }
        });

        // Remove placeholder if it exists in DOM
        if (this.placeholder.parentNode) {
            this.placeholder.remove();
        }

        // Reset all drag-related variables
        this.dragAbortController?.abort();
        this.dragAbortController = null;
        this.dragData = null;
        this.dragTarget = null;
    }

    // Public API -----------------
    deleteTag(index) {
        const tagElements = this.list.querySelectorAll('li[data-tag]');
        const li = tagElements[index];
        if (li) this.#deleteTagEl(li);
    }

    // adds a tag, or turns an LI element into a tag to use
    addTag(text, _li) {
        if (!text || (!this.opts.allowDuplicates && this.tags.includes(text))) return;
        
        // if onAdd, it may adjust, change, or prevent certain text
        if (this.opts.onAdd && !_li)
            text = this.opts.onAdd(text)
        if (!text) return;

        const li = _li || document.createElement('li');
        li.textContent = text;
        li.dataset.tag = text; // For fast lookup
        li.setAttribute('role', 'listitem');
        li.setAttribute('tabindex', '0');
        li.style.cursor = 'grab'; // Indicate draggable

        if (_li) li.querySelector('span')?.remove(); // Remove old × to re-add cleanly
        this.#renderDeleteButton(li);
        if (!_li) this.list.appendChild(li); // if not passed in LI, we ADD it!
        this.tags.push(text);

        if( this.opts.onChange ) this.opts.onChange(this.tags);
    }

    getTags() { return [...this.tags]; }

    setTags(tags) {
        this.tags = [];
        // Clear only tag elements, keep non-tag elements
        this.list.querySelectorAll('li[data-tag]').forEach(li => li.remove());
        tags.forEach(tag => this.addTag(tag));
    }
    
    // Manual cleanup for stuck drag states
    resetDragState() {
        this.#cleanupDragState();
    }
    
    destroy() {
        this.#cleanupDragState(); // Clean up any drag states first
        this.abortController.abort();
        this.list?.remove();
        this.autocomplete?.remove();
    }
}
