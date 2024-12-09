# js-input-tags
**Check the CodePen.io [basic example](https://codepen.io/mindflowgo/pen/PwYNQVe); [autocomplete example](https://codepen.io/mindflowgo/pen/MYgyVgg).**

*Project objective: simple but powerful vanilla ES6 javascript (code: 250 lines) input tag generator for any input fields; with auto-completion lists.*

Based off the inspiration work of [github.com/rk4bir/simple-tags-input](https://github.com/rk4bir/simple-tags-input); using his idea and CSS but then rewritten for ES6 and more features. Can record special keys (Meta, Alt, Tab, etc) as key presses.

## Demo
*(Go to my github repo to see the demos, this readme does't show them on other locations)*
![demonstration](./example/media/autocomplete.gif)

![special-keys](./example/media/special-keys.gif)

## Options
*Only required tags are inputId and listId*
- **tags**: can pre-populate tags (*Array*)
- **inputId**: element-id of INPUT element to use (*String*, required)
- **listId**: element-id of UL list element to use (*String*, required)
- **outputId**: element-id of where to store the generated tag list (ex. hidden input) (*String*)
- **afterUpdate**: function to call after change to tags (*Function*)
- **unique**: require tags to be unique (*Boolean*)
- **delimiter**: normally comma to separate items but alternative possible (*Char*)
- **specialKeys**: enable tracking special keys (*Boolean*)
- **autocompleteList**: autocomplete list suggestions (*Array*)

## Methods
*With a valid InputTags() instance you have these methods:*
- **getTags()**: get the list of tags created (these will be reflected in outputId element if linked)
- **addTag(tag)**: add a new tag to input tags instance
- **removeTag(itemID)**: remove a tag, using it's unique id
- **destroy**: remove the instance
There are a few other methods but they a better only used internally.

## Usage
There are 3 steps to using it
1. Include the CSS & JS files (importing it into a script type=module)
2. Have an empty list (UL) and an input box (INPUT)
3. Run the function: const inputTags = new InputTags({ inputId: "tagsInput", listId: "tagsList" });

That's it!

### BASIC Example
> Check the [CodePen.io example](https://codepen.io/mindflowgo/pen/PwYNQVe).

#### Step 1 - Include Files (change path to match where they are)
```html
    <head>
        <link rel="stylesheet" href="https://unpkg.com/js-input-tags@latest/style.css">
    </head>

    <script type="module">
    import InputTags from "https://unpkg.com/js-input-tags@latest"
    </script>
```

#### Step 2 - Insert needed HTML into your code
```html
<div>
    <ul id="tagsList"></ul>
    
    <input type="text" id="tagsInput" spellcheck="false" placeholder="Enter a tag" />
</div>
```

#### Step 3 - Run Javascript (to initialize INPUT field)
```javascript
    const inputTags = new InputTags({ inputId: "tagsInput", listId: "tagsList" });
```

**Quick example html**
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- Bootstrap 5 not used by Input Tags -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">
    
    <!-- Only CSS used by InputTags -->
    <link rel="stylesheet" href="https://unpkg.com/js-input-tags@latest/style.css">
</head>

<body>
    <div class="container mt-5">
        <h1 class="text-center mb-4">Tags Input</h1>
            
        <div class="mb-3">
            <p class="mb-2">Tag List:</p>
            <!-- specify the ul LIST element to show the tags -->
            <ul id="tagsList"><li><strong>List:</strong></li></ul>
            <!-- include the input box to input the tags -->
             <p><i>Type something and press Enter</i></p>
            <input type="text" id="tagsInput" class="form-control mt-2" spellcheck="false" placeholder="Enter a tag" />
        </div>
            
        <div class="mb-3">
            <p class="mb-2">List results: <strong><span id="tagsData"></span></strong></p>
            <div class="mt-5 d-grid gap-2 d-md-flex justify-content-md-start">
                <button class="btn btn-secondary ms-md-2" onClick="btnAddTag('hello')">Add Tag 'hello'</button>
            </div>
        </div>
    </div>

     <!--Simple tags input implementation-->
     <script type="module">
        import InputTags from "https://unpkg.com/js-input-tags@latest"

        function displayTags( _tags ){
            console.log( `[displayTags] called, with tags: ${_tags}` );
            document.querySelector('#tagsData').innerHTML = _tags;
        }

        function btnAddTag( _tag ){
            inputTags.addTag(_tag);
        }

        const inputTags = new InputTags({ 
			inputId: "tagsInput", listId: "tagsList",
			unique: true, updateFn: displayTags,
		});

        // export module functions for DOM
        window.btnAddTag = btnAddTag;
     </script>
</body>
</html>        
```

### AutoComplete Example
> Check the [CodePen.io example](https://codepen.io/mindflowgo/pen/MYgyVgg).

#### Step 1 - Include Files (change path to match where they are)
```html
    <head>
        <link rel="stylesheet" href="https://unpkg.com/js-input-tags@latest/style.css">
    </head>

    <script type="module">
    import InputTags from "https://unpkg.com/js-input-tags@latest"
    </script>
```

#### Step 2 - Insert needed HTML into your code
```html
<div>
    <ul id="tagsList"></ul>
    
    <input type="text" id="tagsInput" spellcheck="false" placeholder="Enter a tag" />

    <button onClick="btnAddTag('hello')">Add Tag 'hello'</button>
</div>
```

#### Step 3 - Run Javascript (to initialize INPUT field)
```javascript
    const inputTags = new InputTags({ 
        inputId: "tagsInput", listId: "tagsList",
        tags: ['default','tags'], specialKeys: true, delimiter: ';', afterUpdate: displayTags,
        autocompleteList: [ "Canada", "India", "Sri Lanka", "United States", "United 'UK' Kingdom", "Vietnam", "Zimbabwe"]
    });

    function displayTags( _tags ){
            console.log( `[displayTags] called, with tags: ${_tags}` );
    }

    function btnAddTag( _tag ){
        inputTags.addTag(_tag);
    }

    // export module functions for DOM
    window.btnAddTag = btnAddTag;
```

