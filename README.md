# this repo is "alpha"
it's an incomplete project that is "good enough to use" (and I do already use it in almost every project I make, and it already gives me many features I've wanted for years), but don't expect every feature to work, and don't expect the apit to stay consistent in future releases

# features
- show loading bars for all your `a-asset-item`s
- show a logo of your choice (default: aframe) that fills up to reflect global loading value
- cool 'glitch' effect applied to your logo
- live download speed meter
- time elapsed
- customize and style everything
- relies on the excellent [loading.io](https://loading.io/progress/) library (uses only MIT licensed code)
- supports a variety of loading.io presets
- includes a customized preset that creates svg iamges of all filenames with text that fills up as file loads
- uses A-Frame font by default
- http -> https auto redirect by default
- will attempt to load the scene when files have a loading error
- will show a red bar on the file (if file stats are shown) and include the error on hover
- gives a hook to specify custom file load error behavior
- everything is customizable
- mobile friendly, biases to show logo image if nothing else, and content is crollable if it overflows on y axis with no scroll bar

# how to:
(1) Add `loading-screen="enabled:false;"` to turn off A-Frame's default loading screen.


```html
<a-scene
  loading-screen="enabled:false;"
></a-scene>
```

(2) Add scripts + CSS dependencies from loader.io to the top of your doc--even before aframe, ideally

```html
    <head>
    <!--  if you're using a logo, I recommend you convert it to a dataimg and store it directly in this file; 
          the default a-frame logo is stored in the library this way-->
    <!--  scripts needed for a-load-screen.js   -->
    <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/gh/loadingio/loading-bar@v0.1.0/dist/loading-bar.min.css"/>
    <script type="text/javascript" src="https://cdn.jsdelivr.net/gh/loadingio/loading-bar@v0.1.0/dist/loading-bar.min.js"></script>
    <script src="https://cdn.jsdelivr.net/gh/kylebakerio/a-load-screen@v0.1.1/a-load-screen.js"></script>
    <script src="https://aframe.io/releases/1.3.0/aframe.min.js"></script>  
```

(3) Add a script _immediately after_ `</a-assets>` closing tag, in the body, with call window.initALoadScreen().
We add it here because we want to show the loading screen as soon as possible, and at that point we have access to everything we need to start listening.
Also, adding here means we safely execute our script and add listeners before any events fire.

THESE OPTIONS ARE ALREADY PARTIALLY OUT OF DATE, REFER TO DEFAULTS FOUND IN a-load-screen.js TO SEE OPTIONS!

```html
  <!--  these are the defaults -->
  </a-assets>
  <script>
    // simple:
    // window.initALoadScreen();
    
  <!--  optionally, you can specify options.  -->
    // with full options specified, with default values shown
    window.initALoadScreen({
      debug: [], // can include 'log','warn','error', etc.
      showLogoLoader: true,
      logoURL: "https://aframe.io/aframe-school/media/img/aframe-logo.png",
      logoSize: "200,200",
      showBarLoaders: true,
      showLoadPercent: true, // not implemented
      showFileNames: true,   // not complete
      showFileSizes: true,   // not implemented
      barLoaderPreset: "rainbow", // one of: line, fan, circle, bubble, rainbow, energy, stripe, text | see https://loading.io/progress/
      customLoaderAttributes: null, // see usage of this object in this script to get a clearer idea, along with docs @ https://loading.io/progress
      backgroundColor: "black",
      backgroundOpacity: .5,
      sceneOpacity: 1,
      onComplete: function() {this.hideLoader()}, 
      // this.hideLoader() will be added and made available to you on the object 
      // (so: don't bind onComplete function to another context if you want access.)
      // you probably always want to call this.hideLoader() eventually, 
      // but it's your app :)
      // you could also just inject a button first if you want for audio, etc.
    })
  </script>
  <!--  rest of your scene... -->
</html>
```

# examples
http://the-big-shell.glitch.me
![image](https://user-images.githubusercontent.com/6391152/196289877-d453dc37-717f-4551-ad4b-62801e0e8a09.png)




# roadmap
   - add scripts in dynamically
   - estimated time to completion as optional stats we can render
   - implement loading min time before showing load screen and min display time
   - add optional direct to VR/AR button, no 2d display (this can be done with hooks, so maybe just an example in readme)
   - maybe gradient background stuff? animated background? how about for logo loader background?
   - full screen logo background with glitch effect as an option
   - css and api overhaul
   - add in image loading api
