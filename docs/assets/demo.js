// install locally in a project, ex: npm i cropt2
// import Input2Tag from "input2tag";

// access via CDN like this (for modules note 'esm')
import Input2Tags from 'https://unpkg.com/input2tags@latest?module';
// or if rebuilding it from source (npm run build)
// import Input2Tags from '../../dist/input2tags.esm.min.js'

/* bootstrap tabs + modal -------------------------------------- */
function switchPane( id, nav ){
    const target = document.getElementById(id + '-pane');
    
    if (nav) 
        nav.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));

    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('show','active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('d-none'));
    
    target.classList.add('show','active');
    target.classList.remove('d-none');

    // initialize this demo when tab changed!
    demoSwitch(id)
}

document.getElementById('demo-tabs').addEventListener('click', e => {
    const btn = e.target.closest('.nav-link');
    if (!btn) return;
    e.preventDefault();
    const nav = btn.closest('.nav');
    switchPane(btn.id, nav);
    btn.classList.add('active');
    console.log( `btn:`, btn, btn.classList )
});

function setCode(code) {
    document.getElementById("code-el").innerHTML = hljs.highlight(code, { language: "javascript" }).value;
}

let input2Tags;
let demoId = 'demo1'
function demoSwitch( id ){
    const inputEl = document.getElementById('newTag1');

    if( input2Tags )
        input2Tags.destroy()

    demoId = id;
    if( demoId === 'demo1' ) {
        const demo1Code = `import Input2Tags from "https://unpkg.com/input2tags@latest?module"

const inputEl = document.getElementById('newTag1');
const saveList = document.getElementById('saveList');

const input2Tags = new Input2Tags(inputEl, {
    initialTags: ['hello','world'],
    onChange: (tags) => saveList.value = tags.join(',')
});

// Bind for DOM actions
window.btnAddTag = (tagText)=>input2Tags.addTag(tagText);

// onChange: (tags) => output:
console.log( input2Tags.getTags() );
%TAGS%`;

        input2Tags = new Input2Tags(inputEl, {
            autocomplete: ['apple', 'banana', 'cherry'],
            initialTags: ['hello','world'],
            onChange: (tags) =>{
                document.getElementById('saveList1').value = tags?.join(',') || ''
                setCode(demo1Code.replace('%TAGS%', JSON.stringify(input2Tags?.getTags()))||'');
            }
        });

        // Export for DOM
        window.btnAddTag = (tagText)=>input2Tags.addTag(tagText);

        setCode(demo1Code.replace('%TAGS%', JSON.stringify(input2Tags?.getTags()))||'');

    } else if( demoId === 'demo2' ){
        const demo2Code = `import Input2Tags from "https://unpkg.com/input2tags@latest?module"

// on Hooks:
function onInput(value) {
    // process after key input - ex. replace certain characters
    return value.replace('!','*0*');
}

function onAdd(value) {
    if (value === 'sad') value = 'happy'; // change it!
    if (value === 'secret') value = ''; // disallow adding
    // pass-thru the tag text to add (string)
    return value;
}
function onDelete(value) {
    if (value === 'stuck') return false;
    
    // allow delete to happen (boolean)
    return true;
}

const inputEl = document.getElementById('newTag');
const input2Tags = new Input2Tags(inputEl, {
    targetEl: document.getElementById('myList'),
    autocomplete: ['apple', 'banana', 'cherry', 'pear', 'pineapple'],
    onInput,
    onAdd,
    onDelete,
    onChange: (tags) => document.getElementById('saveList').value = tags?.join(',') || '',
    });
`;

        function onInput(value) {
            // process after key input - ex. replace certain characters
            return value.replace('!','*0*');
        }

        function onAdd(value) {
            if (value === 'sad') value = 'happy'; // change it!
            if (value === 'secret') value = ''; // disallow adding
            // pass-thru the tag text to add (string)
            return value;
        }
        function onDelete(value) {
            if (value === 'stuck') return false;
            
            // allow delete to happen (boolean)
            return true;
        }

        const inputEl = document.getElementById('newTag2');
        const input2Tags = new Input2Tags(inputEl, {
            targetEl: document.getElementById('myList'),
            autocomplete: ['apple', 'banana', 'cherry', 'pear', 'pineapple'],
            onInput,
            onAdd,
            onDelete,
            onChange: (tags) => document.getElementById('saveList2').value = tags?.join(',') || '',
		    });

        // export module functions for DOM
        window.btnAddTag = (tag) => input2Tags.addTag(tag);
        window.showList = () => input2Tags.showAutocomplete('apple');

        setCode(demo2Code.replace('%TAGS%', JSON.stringify(input2Tags?.getTags()))||'');
    } else if( demoId === 'demo3' ) {
        const demo3Code = `import Input2Tags from "https://unpkg.com/input2tags@latest?module"
// import Input2Tags from "../dist/input2tags.esm.min.js" // if using local

// use with allow
let specialKeysPressed = {}
function customKeyHandling(value,e) {
    e.preventDefault();

    let key = e.key;
    // map any special keys we want symbols to appear for, remap here
    const symbolMap = {  ArrowLeft: "←",  ArrowUp: "↑", ArrowRight: "→", ArrowDown: "↓"}
    if( symbolMap[key] ) key = symbolMap[key]
        
    if( !inputEl.value && key === 'Shift' ){
        // we don't want showing shift if first press as it's usually to uppercase a letter
    } else if( key === 'Enter' ){
        // now submit keypresses queued into a tag
        e.preventDefault();
        input2Tags.addTag(value || 'Enter'); //submit the key sequence or if none, just 'Enter'
        inputEl.value = "";
        specialKeysPressed = {}
    } else {
        // track special keys so they are prepended & only allowed once
        if (['Control','Meta','Alt'].includes(key)) {
            if (specialKeysPressed[key]){ console.log( 'repeated '+key', skipping'); return; }
            specialKeysPressed[key] = true
        }

        if (specialKeysPressed[key])
            inputEl.value = key + (inputEl.value.length>0 ? '+' : '') + inputEl.value;
        else
            inputEl.value += (inputEl.value.length>0 ? '+' : '') + key;
    }
    return false;
}

const initialTags = ['Alt+x','Ctrl+Alt+Backspace'];

const inputEl = document.getElementById('newTag3');
const input2Tags = new Input2Tags(inputEl, {
    targetEl: document.getElementById('myList3'),
    autocomplete: ['apple', 'banana', 'cherry', 'pear', 'pineapple'],
    initialTags,
    allowCustomKeys: true,
    onInput: (value,e) => customKeyHandling(value,e),
    onChange: (tags) => document.getElementById('tagsOutput').value = tags?.join(',') || '',
    });

// export module functions for DOM
window.btnAddTag = (tag) => input2Tags.addTag(tag);
window.showList = () => input2Tags.showAutocomplete('apple');`;

        // use with allow
        let specialKeysPressed = {}
        function customKeyHandling(value,e) {
            e.preventDefault();

            let key = e.key;
            // map any special keys we want symbols to appear for, remap here
            const symbolMap = {  ArrowLeft: "←",  ArrowUp: "↑", ArrowRight: "→", ArrowDown: "↓"}
            if( symbolMap[key] ) key = symbolMap[key]
                
            if( !inputEl.value && key === 'Shift' ){
                // we don't want showing shift if first press as it's usually to uppercase a letter
            } else if( key === 'Enter' ){
                // now submit keypresses queued into a tag
                e.preventDefault();
                input2Tags.addTag(value || 'Enter'); //submit the key sequence or if none, just 'Enter'
                inputEl.value = "";
                specialKeysPressed = {}
            } else {
                // track special keys so they are prepended & only allowed once
                if (['Control','Meta','Alt'].includes(key)) {
                    if (specialKeysPressed[key]){ console.log( `repeated ${key}, skipping`); return; }
                    specialKeysPressed[key] = true
                }

                if (specialKeysPressed[key])
                    inputEl.value = key + (inputEl.value.length>0 ? '+' : '') + inputEl.value;
                else
                    inputEl.value += (inputEl.value.length>0 ? '+' : '') + key;
            }
            return false;
        }

        const initialTags = ['Alt+x','Ctrl+Alt+Backspace'];

        const inputEl = document.getElementById('newTag3');
        const input2Tags = new Input2Tags(inputEl, {
            targetEl: document.getElementById('myList3'),
            autocomplete: ['apple', 'banana', 'cherry', 'pear', 'pineapple'],
            initialTags,
            allowCustomKeys: true,
            onInput: (value,e) => customKeyHandling(value,e),
            onChange: (tags) => document.getElementById('saveList3').value = tags?.join(',') || '',
		    });

        // export module functions for DOM
        let listVisible = false
        window.toggleList = () =>{ if(listVisible) input2Tags.showAutocomplete(); else input2Tags.hideAutocomplete(); listVisible = !listVisible; }

        setCode(demo3Code.replace('%TAGS%', JSON.stringify(input2Tags?.getTags()))||'');
    }
}

// highlight usage
const usageEl = document.getElementById("usage-code")
usageEl.innerHTML = hljs.highlight(usageEl.textContent, { language: "javascript" }).value;

// initialize the tab pane!
switchPane(demoId);
