/***************************************************************
 * = Input2TAGS = v3.1
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
 * import Input2Tags from '...'
 * 
 * const inputTags = new Input2Tags(document.getElementById('tagsInput'), { 
 *    autocomplete: ['apple', 'banana', 'cherry'],
 *    onAdd: (tag) => console.log('Added:', tag),
 *    onDelete: (tag) => console.log('Deleted:', tag)
 * });
 */

interface Input2TagsOptions {
  /** allow the [x] deletes */
  allowDelete?: boolean;
  /** whether repeat tag names allowed */
  allowDuplicates?: boolean;
  /** whether spaces in tags allowed (else = Enter) */
  allowSpaces?: boolean;
  /** handle special characters with onInput */
  allowCustomKeys?: boolean;
  /** ['apple', 'banana', ...] */
  autocomplete?: string[];
  /** initial tags to show */
  initialTags?: string[];
  /** where to place the list (optional, could be pre-populated UL list) */
  targetEl?: HTMLElement | null;
  onAdd?: (tag: string) => string | void;
  onDelete?: (tag: string) => boolean | void;
  /** onInput can override/adjust values */
  onInput?: (value: string, event?: KeyboardEvent) => string | void;
  onChange?: (tags: string[]) => void;
}

export default class Input2Tags {
  private input: HTMLInputElement;
  private opts: Required<Input2TagsOptions>;
  private tags: string[] = [];
  private abort: AbortController;
  private dragAbort: AbortController | null = null;
  private dragData: { el: HTMLLIElement; startIndex: number } | null = null;
  private dragTarget: HTMLLIElement | null = null;

  // Use definite assignment assertion (we initialize in #init)
  private list!: HTMLUListElement;
  private placeholder!: HTMLLIElement;
  private autocomplete!: HTMLDivElement;

  /**
   * @param inputEl - where the user enters tags
   * @param opts - configuration options
   */
  constructor(inputEl: HTMLInputElement, opts: Partial<Input2TagsOptions> = {}) {
    this.input = inputEl;
    this.opts = {
      allowDelete: true,
      allowDuplicates: false,
      allowSpaces: false,
      allowCustomKeys: false,
      autocomplete: [],
      initialTags: [],
      targetEl: null,
      onAdd: null,
      onDelete: null,
      onInput: null,
      onChange: null,
      ...opts,
    } as Required<Input2TagsOptions>;

    this.abort = new AbortController();
    this.#init();
  }

  #init(): void {
    // If the element is a UL, process it, else create list IN it.
    const targetEl = this.opts.targetEl;
    if (targetEl && targetEl.tagName === 'UL') {
      this.list = targetEl as HTMLUListElement;
      // Clear existing content except for any non-tag items
      Array.from(this.list.children).forEach((child) => {
        if (
            (child instanceof HTMLElement && 'tag' in child.dataset && child.dataset.tag) ||
            child.querySelector('span')
        ) {
            child.remove();
        }
      });
    } else {
      // Create new list if none exists
      this.list = document.createElement('ul');
      this.list.className = 'tagsList';
      this.list.setAttribute('role', 'list');
      if (targetEl) {
        // list container exists put this into it.
        targetEl.appendChild(this.list);
      } else {
        // no list container exists, so insert above input
        this.input.parentNode?.insertBefore(this.list, this.input);
      }
    }

    this.placeholder = document.createElement('li');
    this.placeholder.className = 'tagsDragPlaceholder';

    this.autocomplete = document.createElement('div');
    this.autocomplete.className = 'tagsAutocompleteList';
    this.autocomplete.style.display = 'none';

    // Insert autocomplete after input
    this.input.insertAdjacentElement('afterend', this.autocomplete);

    // special keys means ignore normal input handling, let user manage
    if (!this.opts.allowCustomKeys) {
      this.input.addEventListener('input', (e: Event) => this.#onInput(e), {
        signal: this.abort.signal,
      });
    }
    this.input.addEventListener('keydown', (e: KeyboardEvent) => this.#onKeydown(e), {
      signal: this.abort.signal,
    });
    this.list.addEventListener('pointerdown', (e: Event) => this.#onPointerDown(e), {
      signal: this.abort.signal,
    });

    // Load existing tags (from data-tags or initial <li>)
    this.#loadInitialTags();
  }

  #loadInitialTags(): void {
    // initial values can be passed in as:
    // 1) options: initialTags
    // 2) targetEl UL list with LI tags
    const tags = this.opts.initialTags;
    if (tags && tags.length) {
      tags.forEach((tag) => this.addTag(tag.trim()));
      return;
    }

    // From existing <li> children - re-attach as draggable elements
    const existing = this.list.querySelectorAll('li');
    existing.forEach((li) => {
      const text = li.textContent?.replace('×', '').trim();
      if (text) this.addTag(text, li as HTMLLIElement); // safe cast after init
    });
    if (existing.length && this.opts.onChange) {
      this.opts.onChange(this.tags); // pass current tags
    }
  }

  #onInput(e: Event): void {
    const target = e.target as HTMLInputElement;
    let value = target.value;
    if (this.opts.onInput) {
      // onInput can override/adjust values
      const result = this.opts.onInput(value);
      if (typeof result === 'string') {
        target.value = result;
      }
    }
    this.showAutocomplete(value.trim());
  }

  #onKeydown(e: KeyboardEvent): void {
    let value = this.input.value.trim();
    // special inputs allowed, so we re-route them to onInput early (on keypress-down!)
    if (this.opts.onInput && this.opts.allowCustomKeys) {
      this.opts.onInput(value, e);
      return;
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

  /**
   * Show autocomplete dropdown based on current input
   */
  showAutocomplete(value: string): void {
    if (!this.opts.autocomplete.length || !value) {
      this.hideAutocomplete();
      return;
    }

    const matches = this.opts.autocomplete
      .filter(
        (tag) =>
          tag.toLowerCase().includes(value.toLowerCase()) &&
          !this.tags.includes(tag)
      )
      .slice(0, 8);

    if (!matches.length) {
      this.hideAutocomplete();
      return;
    }

    const ul = document.createElement('ul');
    matches.forEach((tag) => {
      const li = document.createElement('li');
      li.textContent = tag;
      li.addEventListener(
        'click',
        () => {
          this.addTag(tag);
          this.input.value = '';
          this.hideAutocomplete();
        },
        { signal: this.abort.signal }
      );
      ul.appendChild(li);
    });

    this.autocomplete.innerHTML = '';
    this.autocomplete.appendChild(ul);
    this.autocomplete.style.display = 'block';
  }

  hideAutocomplete(): void {
    this.autocomplete.style.display = 'none';
  }

#onPointerDown(e: Event): void {
  // Ensure we're dealing with a valid LI tag
  const li = (e.target as HTMLElement).closest('li') as HTMLLIElement | null;
  if (!li || !('tag' in li.dataset)) return;

  // Don't start drag if clicking on delete button
  if ((e.target as HTMLElement).tagName === 'SPAN') return;

  e.preventDefault();

  this.dragData = {
    el: li,
    startIndex: Array.from(this.list.children).indexOf(li),
  };

  li.classList.add('tagsDragThis');
  li.before(this.placeholder);

  this.dragAbort?.abort();
  this.dragAbort = new AbortController();

  // Unified handler for both pointer and touch
  const handleMove = (e: Event) => {
    e.preventDefault(); // Prevent scrolling during drag
    const clientX = 'clientX' in e ? e.clientX : 
                'touches' in e ? (e as any).touches[0].clientX : 0;
    const clientY = 'clientY' in e ? e.clientY : 
                'touches' in e ? (e as any).touches[0].clientY : 0;

    const target = document.elementFromPoint(clientX, clientY)?.closest('li') as HTMLLIElement | null;

    if (
      !target ||
      target === this.dragData?.el ||
      target === this.placeholder ||
      !('tag' in target.dataset)
    ) return;

    this.#clearDropIndicator();
    const rect = target.getBoundingClientRect();
    const before = clientX < rect.left + rect.width / 2;

    this.dragTarget = target;
    target.classList.add('tagsDragOver');
    this.list.insertBefore(this.placeholder, before ? target : target.nextSibling);
  };

  const handleUp = (e: Event) => {
    e.preventDefault();
    this.#onPointerUp();
  };

  // Add listeners for both pointer and touch
  document.addEventListener('pointermove', handleMove, { signal: this.dragAbort.signal });
  document.addEventListener('pointerup', handleUp, { signal: this.dragAbort.signal, once: true });

  // Touch fallback (for iOS Safari and older Android)
  document.addEventListener('touchmove', handleMove, { 
    signal: this.dragAbort.signal, 
    passive: false // required to call preventDefault()
  });
  document.addEventListener('touchend', handleUp, { 
    signal: this.dragAbort.signal, 
    once: true 
  });
}

// Simplified #onPointerUp (no event needed)
#onPointerUp(): void {
  if (this.dragData) {
    this.list.insertBefore(this.dragData.el, this.placeholder);
  }

  this.#clearDropIndicator();
  this.placeholder.remove();

  const prevTags = this.tags.join('|');
  this.tags = [];
  for (const li of this.list.querySelectorAll('li')) {
    if ('tag' in li.dataset) {
      this.tags.push(li.dataset.tag!);
      li.classList.remove('tagsDragThis');
    }
  }

  if (this.opts.onChange && prevTags !== this.tags.join('|')) {
    this.opts.onChange(this.tags);
  }

  this.dragAbort?.abort();
  this.dragAbort = null;
  this.dragData = null;
  this.input.focus();
}

  #clearDropIndicator(): void {
    if (this.dragTarget) {
      this.dragTarget.classList.remove('tagsDragOver');
      this.dragTarget = null;
    }
  }

  #renderDeleteButton(li: HTMLLIElement): void {
    if (!this.opts.allowDelete) return;
    const span = document.createElement('span');
    span.classList.add('tagDelete');
    span.innerHTML = '&times;';
    span.style.cursor = 'pointer';
    span.addEventListener(
      'click',
      (e: Event) => {
        e.stopPropagation();
        this.#deleteTagEl(li);
      },
      { signal: this.abort.signal }
    );
    li.appendChild(span);
  }

  #deleteTagEl(li: HTMLLIElement): void {
    const text = li.dataset.tag;
    if (!text) return;

    // if onDelete we look for return from it to allow delete or not
    const allowDelete = this.opts.onDelete ? this.opts.onDelete(text) : true;
    if (!allowDelete) return;

    li.remove();
    const index = this.tags.indexOf(text);
    if (index > -1) {
      this.tags.splice(index, 1);
      if (this.opts.onChange) this.opts.onChange(this.tags);
    }
  }

  // Emergency cleanup for stuck drag states
  #cleanupDragState(): void {
    // Remove all drag-related classes from all elements
    this.list.querySelectorAll('li').forEach((li) => {
      li.classList.remove('tagsDragThis', 'tagsDragOver');
      if ('tag' in li.dataset) {
        li.style.cursor = 'grab';
      }
    });

    // Remove placeholder if it exists in DOM
    if (this.placeholder.parentNode) {
      this.placeholder.remove();
    }

    // Reset all drag-related variables
    this.dragAbort?.abort();
    this.dragAbort = null;
    this.dragData = null;
    this.dragTarget = null;
  }

  // Public API -----------------
  /**
   * Delete tag at given index
   */
  deleteTag(index: number): void {
    const tagElements = this.list.querySelectorAll('li');
    const li = Array.from(tagElements).find(li => 'tag' in li.dataset);
    if (li && this.tags[index]) {
      // Find li by dataset.tag match
      const targetLi = Array.from(tagElements).find(el => el.dataset.tag === this.tags[index]);
      if (targetLi) this.#deleteTagEl(targetLi as HTMLLIElement);
    }
  }

  /**
   * adds a tag, or turns an LI element into a tag to use
   */
  addTag(text: string, _li?: HTMLLIElement): void {
    if (!text || (!this.opts.allowDuplicates && this.tags.includes(text))) return;

    // if onAdd, it may adjust, change, or prevent certain text
    let finalText = text;
    if (this.opts.onAdd && !_li) {
      const result = this.opts.onAdd(text);
      if (result === undefined || result === null) return;
      finalText = typeof result === 'string' ? result : text;
    }
    if (!finalText) return;

    const li = _li || document.createElement('li');
    li.textContent = finalText;
    li.dataset.tag = finalText; // For fast lookup
    li.setAttribute('role', 'listitem');
    li.setAttribute('tabindex', '0');
    li.style.cursor = 'grab'; // Indicate draggable

    if (_li && _li.querySelector('span')) {
      _li.querySelector('span')?.remove(); // Remove old × to re-add cleanly
    }
    this.#renderDeleteButton(li);
    if (!_li) this.list.appendChild(li); // if not passed in LI, we ADD it!
    this.tags.push(finalText);

    if (this.opts.onChange) this.opts.onChange(this.tags);
  }

  getTags(): string[] {
    return [...this.tags];
  }

  setTags(tags: string[]): void {
    this.tags = [];
    // Clear only tag elements, keep non-tag elements
    this.list.querySelectorAll('li').forEach((li) => {
      if ('tag' in li.dataset) li.remove();
    });
    tags.forEach((tag) => this.addTag(tag));
  }

  /**
   * Manual cleanup for stuck drag states
   */
  resetDragState(): void {
    this.#cleanupDragState();
  }

  destroy(): void {
    this.#cleanupDragState(); // Clean up any drag states first
    this.abort.abort();
    if (this.list.parentNode) this.list.remove();
    if (this.autocomplete.parentNode) this.autocomplete.remove();
    this.tags = [];
  }
}