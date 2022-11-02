/* global AFRAME, THREE, ldBar */

/*
  todo:
  // make text easier to read:
    > It may increase readibility with the right colors and contrast, but here it doesn't work for me. Here are some really bad example for me https://developer.mozilla.org/en-US/docs/Web/CSS/text-shadow also some answers here https://ux.stackexchange.com/questions/72629/can-text-shadow-enhance-readability
  // add scripts in dynamically
  // estimated time to completion as optional stats we can render
  // implement loading min time before showing load screen and min display time
  // implement file retries
  // debug('error',"non-fill-effect not yet implemented")
  // add optional direct to VR/AR button, no 2d display
    // this could of course be done manually with existing hooks
  // what to do about timeout, if anything...?
  // gradient background? animated background? how about for logo loader background?
  // full screen logo background with glitch effect option
  // hide logo until loaded?
  // global stats: total loaded loading bar
  // custom event hook that simplifies all data for them

  
  to fix:
  // placeholder for unloaded logo could be improved, though it's pretty good
  // in some cases logo isn't horizontally centered, pretty sure just when image is smaller than stats below
  // a-frame logo with glitch effect shows a weird doubling behind it that I don't like for some logos... haven't been able to fix
  // how should we handle when all the data desired doesn't fit?
    // should I also use findMaxFontSize function for file stat rows?
    // for now, we fade the right side out
  // a kind of overhaul on the filestats grid, so that it just always looks good
  // https://stackoverflow.com/questions/45536537/centering-in-css-grid
    // maybe arrays that specify what you want for each row, in what order?
    // and their container will always just be centered or left justified?
    // https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Grid_Layout/Box_Alignment_in_CSS_Grid_Layout
      // statsRow1: ['DownloadSpeedVisual']
      // statsRow2: [] // statsRow2: ['totals'] // statsRow2: ['downloadTotalsText','downloadSpeedText','timeElapsed']
*/


(function() {
  // schema
  let 
    anchor,
    contrainedImageDimensions,
    start = Date.now(),
    assets,
    maxWidth,
    logo, 
    opts, // copy of options specified at init after combined with defaults
    barCounter = 0,
    firstByteTime,
    globalLoadRegister = {
      bytes: {
        // dynamic
      },
      images: {
        // dynamic, in theory; todo
      }
    }
  ;
  
  function cssOverrides(styleString) {
    // document.head.insertAdjacentHTML(`
    //   <style>
    //       /* custom CSS here */
    //       .ldBar.label-center > .ldBar-label {
    //           display: none;
    //       }
    //   </style>
    // `)
    const style = document.createElement('style');
    style.innerHTML = styleString;
    document.head.appendChild(style);
  }
  
  async function init(
    options={}
  ) {
    // defaults overridden on declaration
    
    // when selecting the 'filenames' option, you can customize the SVG spcecs by modifying this object
    // file name will be auto-injected during execution
    options.filenamesPresetOptions = Object.assign({
      "xmlns":"http://www.w3.org/2000/svg", "width":"350", "height":"20", "viewBox":"0 0 350 20", "x":"175", "y":"10", "text-anchor":"middle", "dominant-baseline":"central", "font-family":"arial"
    }, options?.filenamesPresetOptions || {});
      
    options.debug = options.debug === true ? ['log','warn','error'] : options.debug || ['error'];  // can include 'log','warn','error', etc. | can also be "true" to just catch all

    opts = Object.assign({
      debug: ['error'],
      delayStart: 300, // ms | not hooked up to anything yet | to prevent loading flash on page reloads, skips the load screen entirely if it can render before this time
      delayEnd: 0,     // ms | not hooked up to anything yet | if you never want the load screen to be skipped, set a minimum display time here
      showLogo: true, // not hooked up to anything yet
      useLogoFillEffect: true,
      useLogoGlitchEffect: true,
      logoURL: aframeLogoDataIMG, // "https://aframe.io/aframe-school/media/img/aframe-logo.png",
      logoSize: [300,300],// width, height | always
      font: "400 1.1rem/.1 Fira Sans,Helvetica,Arial,sans-serif",
      showBarLoaders: true,
      showTitle: true,
      titleText: document.title || "",
      showSubtitle: true,
      subtitleOverride: "",
      titleFontStyle: `text-align:center;font-weight:900;`, // don't specify font-size here, do that separate so that you can take advantage of max client-sizing 
      showTextSpeedometer: true,
      useFilename: false, // by default we will use the ID, but you can also choose to use the filename
      fadeLoaderRows: true,
      autoReloadToHTTPS: true,
      horizontalRulePercent: 60,
      showGlobalStats: true, // not implemented
      showFileStats: true, // not implemented
      centeredLoadingBars: true,
      titleFontSizeMax: 100, // titleFontSizeMax: see init for dynamic value setting;
      showVisualSpeedometer: true,
      showTimeElapsed:true,
      smoothLogoLoadFactor: 10,  // megabyte; make value as big or small as you like, bigger is less jitter, low is more responsive load values; only matters for first file load, real value is cached in localstorage on first load
        // number exists as placeholder assumed size for files before we have received that info from server if it isn't supplied in html; higher the value, lower the chance and intensity of jitter--higher the value, the more artificially held back your image load is; used to prevent flickering of load logo in beginning as new objects start loading on first load when sice not manually specified in html directly
      showFilenames: true,
      showFileSizes: true,
      showDownloadTotals: true,
      barLoaderPreset: "rainbow", /// one of: "", null, line, rainbow, energy, stripe, text, filenames, | would require customization to work: fan, circle, bubble, | see https://loading.io/progress/ | also: https://github.com/loadingio/loading-bar/blob/af5271ef7c675783fe870b5a60d6057f32f73e47/src/presets.ls
      customLogoLoaderAttributes: null, // see usage of this object in this script to get a clearer idea, along with docs @ https://loading.io/progress
      customBarLoaderAttributes: null, // see usage of this object in this script to get a clearer idea, along with docs @ https://loading.io/progress
      backgroundColor: "black",
      backgroundImage: "",
      containerCSS: "", // specify e.g. background image props
      logoFillColor: "black",
      backgroundOpacity: .9,
      styleOverrides: `
        /* this removes e.g. "100%" labels that by default get overlaid on top of loading elements by library */
        .ldBar.label-center > .ldBar-label {
           display: none;
        }
        .hide-loader {
          opacity: 0 !important;
          z-index: 0;
          transition: all 1.5s;
        }
        .a-load-screen-content-container::-webkit-scrollbar {
            display: none;
        }
      `,
      onAframeRenderStart: function(evt) {
        // https://aframe.io/docs/1.3.0/core/scene.html
        // this fires last last
        this.updateSubtitle("ready");
        document.querySelector('.a-load-screen-main-container').classList.add('hide-loader'); // note: this is a 1.5s animation in CSS
        setTimeout(() => this.hideLoader(),1500);
      },
      onAframeLoaded: function(evt) {
        // oh, this will run also on every file load too
        // this fires before renderstart
        // need to see if this is tied to file loaded or to meshes loaded, but I think it's meshes
        // document.querySelector('#a-loader-title').innerHTML = "rendering...";
        // alert("loaded?")
        this.updateSubtitle("rendering...");
      },
      onFilesLoaded: function(evt) {
        // note: this isn't currently guaranteed to run, seems it's possible for a loading event 
        // to not fire because it has disk cached or downloaded too quickly?
        // this usually fires before aframeloaded
        // alert("file load complete")
        
        // can have this here, but I want to change this to update the title to "rendering..."
        // document.querySelector('.a-load-screen-main-container').classList.add('hide-loader');
        // setTimeout(() => this.hideLoader(),1500);
        
        // alt option to flash away:
        // this.hideLoader()
        this.updateSubtitle("file load complete");
      },
      skipLoadErrors: true, // if you have some error with some file, at least the show will _try_ to go on so you don't make users stuck at loading screen.
      fileRetryOnError: 0, // this is not working yet, should leave on 0 until implemented. In the meantime, you can implement yourself with custom onFileLoadError
      onFileLoadError: function(filename, url, evt) {
        // you could:
        // - warn users there was a problem and it will try to run without the file
        // - implement manual reloading
        // - track page reload attempts in local storage; e.g. if you tried twice and file still won't load, then let them just try anyways
        // - could have different behavior based on how important the files are
        // - force a page reload with location.reload()
        // - silently report to server for stats collectiong
        debug("error","error loading file:",filename,url,evt);
      },
    }, options || {});
    
    const scene = document.querySelector('a-scene');
    debug('log',scene, scene.renderStarted)
    if (scene.renderStarted) {
      debug('error','scene is already rendering, skipping load screen altogether');
      debug('warn','will run all hooks sequentially right away!');
      await opts.onFilesLoaded();
      await opts.onAframeLoaded();
      await opts.onAframeRenderStart();
      debug('warn','completed loading hooks')
      // note: they may be depending on the hooks running, we should probably default to executing those
      return;
    }
    if (opts.onAframeLoaded) {
      scene.addEventListener('loaded', evt => {
        if (evt.target !== document.querySelector('a-scene')) return;
        opts.onAframeLoaded(evt);
      });
    }
    if (opts.onAframeRenderStart) {
      scene.addEventListener('renderstart', (function onAframeRenderStart() {
         let haveRun = false;
         return () => {
           if (haveRun) return;
           haveRun = true;
           opts.onAframeRenderStart.bind(opts)();
         }
      })());
    }
      
    if (!location.protocol.includes("https") && opts.autoReloadToHTTPS) location = location.href.replace('http','https');
    if (opts.barLoaderPreset === "filenames") opts.showFilenames = false; // avoid likely accidental conflict to prevent duplicate filename display when using names as bars themselves
    opts.smoothLogoLoadFactor *= (10**6); // cnovert mb input to the bytes form we use here;
      // subtract 9 to leave space for image loader lib to add 9
    contrainedImageDimensions = [
      Math.min(window.screen.width - 9, opts.logoSize[0]),
      Math.min(window.screen.width - 9, opts.logoSize[1]),
    ]; //opts.logoSize.split(",")[0] < window.screen.width ? opts.logoSize : `${window.screen.width-9},${window.screen.width-9}`;
    maxWidth = contrainedImageDimensions[0] + 9; //Number(contrainedImageDimensions.split(',')[0]) - 9; // 9 is added for the fill outline of the logo
    // todo:: need to handle when we don't use the logo
      
    opts.hideLoader = hideLoader; // make function accessible to onFilesLoaded; todo: add fade default
    opts.updateSubtitle = updateSubtitle;
    
    // has to be included in scene html itself, won't be used in time
    // setAttribute('a-scene','loading-screen',{enabled:false})
    
    setupHTML();
    cssOverrides(glitchEffectCSS(opts.titleText, opts.logoURL, contrainedImageDimensions[0], contrainedImageDimensions[1]));
    cssOverrides(opts.styleOverrides);
    anchor = document.querySelector('.a-load-screen-content-container');
    debug('log',"anchor:",anchor)
    
    if (opts.titleText) {
      opts.titleFontSizeMax = Math.min(opts.titleFontSizeMax, findMaxFontSize(opts.titleText,anchor,anchor.offsetWidth,{style:opts.titleFontStyle})); //  Math.floor(maxWidth/opts.titleText.length)
      const margin = opts.titleFontSizeMax / 2;
      opts.titleFontStyle = `margin-top:${margin}px;margin-bottom:${margin}px;font-size:${opts.titleFontSizeMax}px;` + opts.titleFontStyle;  
    }

    
    addLogo();

    assets = document.body.querySelector('a-assets').children;
    debug('log',"assets found",assets);
    
    addStats();
      
    debug('log','opts',opts)

    for (const child of assets) {
      // debug('log',"asset",child);
      addBar(child, opts.showBarLoaders);
      // debug('log','loader?',child.fileLoader); // THREE fileLoader instance under the hood, though it isn't added at this point
    }

    // also see: THREE.cache
    // Docs:
    // https://aframe.io/docs/1.3.0/core/asset-management-system.html
    // https://threejs.org/docs/#api/en/loaders/FileLoader
  };
  
  // currently unused; can try these later if desired to remove need to add dependencies manually? 
  function fetchStyle(url) {
    // https://stackoverflow.com/a/40933978/4526479
    return new Promise((resolve, reject) => {
      let link = document.createElement('link');
      link.type = 'text/css';
      link.rel = 'stylesheet';
      link.onload = function() { resolve(); debug('log','style has loaded'); };
      link.href = url;

      let headScript = document.querySelector('script');
      headScript.parentNode.insertBefore(link, headScript);
    });
  };
  
  const loadScript = src =>
    // https://stackoverflow.com/a/59612206/4526479
    new Promise((resolve, reject) => {
      if (document.querySelector(`head > script[src="${src}"]`) !== null) return resolve()
      const script = document.createElement("script")
      script.src = src
      script.async = true
      document.head.appendChild(script)
      script.onload = resolve
      script.onerror = reject
    });
  // end loadScript
  
  function findMaxFontSize(string="a string", parent=document.body, maxWidth=parent.width, attributes = {id:'font-size-finder',class:'some-class-with-font'}) {
    // by using parent, we can infer the same font inheritance;
    // you can also manually specify fonts or relevant classes/id with attributes if preferred/needed
    attributes.style = 'position:absolute; left:-10000; font-size:1px;' + (attributes.style || "");
    let testFontEl = createEl('p', attributes, string);
    parent.appendChild(testFontEl);
    let currentWidth = testFontEl.offsetWidth;
    let workingFontSize = 1;
    let i = 0;
    while (currentWidth < maxWidth && i < 1000) {
      testFontEl.style.fontSize = Number(testFontEl.style.fontSize.split("px")[0]) + 1 + "px";
      currentWidth = testFontEl.offsetWidth;
      if (currentWidth < maxWidth) {
        workingFontSize = testFontEl.style.fontSize;
      }
      i++; // safety to prevent infinite loops
    }
    debug('log',"determined maximum font size:",workingFontSize,'one larger would produce',currentWidth,'max width allowed is',maxWidth,'parent is',parent);
    parent.removeChild(testFontEl);
    return workingFontSize.split("px")[0];
  }
  
  function createEl(tag, attrs, children) {
    let el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(attr => {
        el.setAttribute(attr, attrs[attr])
      })
    }
    if (children) {
      children = Array.isArray(children) ? children : [children];
      for (let child of children) {
        if (typeof child === "number") child = ""+child;
        if (typeof child === "string") {
          el.insertAdjacentText("afterbegin", child);
        }
        else {
          try {
            el.appendChild(child)
          } catch (e) {
            debugger
          }
        }
      }
    }
    return el;
  };
  
  function setAttribute(selector,attr,value) {
    document.querySelector(selector).setAttribute(attr,value);
  }
  
  function setCSS(selector, style) {
    for (const property in style)
        document.querySelector(selector).style[property] = style[property];
  }
  
  function hideLoader() {
    setAttribute('.a-load-screen-main-container','style','display:none;')
  }
  
  function setupHTML() {    
    // note: these are required in the HTML itself, in the head (while this script should be added after the body)
  //     <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/gh/loadingio/loading-bar@v0.1.0/dist/loading-bar.min.css"/>
  //     <script type="text/javascript" src="https://cdn.jsdelivr.net/gh/loadingio/loading-bar@v0.1.0/dist/loading-bar.min.js"></script>
    
    setAttribute('body','style',`overflow:hidden;color:white;background-color:${opts.backgroundColor};`);
    document.body.prepend(
      createEl('div', {class: 'a-load-screen-main-container', style: `
                                            font:${opts.font};
                                            font-size: 10pt;
                                            text-shadow: 0 0 3px #fff;
                                            z-index:1000;
                                            height:100%;
                                            position:relative;
                                            overflow:hidden;
                                            opacity:${opts.backgroundOpacity};
                                            background-color:${opts.backgroundColor};
                                            background-image:url(${opts.backgroundImage});
                                            ${opts.containerCSS || ""}
                      `}, // background image is experimental and untested
               
      [
        createEl('div', {/*class: 'center',*/   style: `
                                              position:absolute;
                                              top:50%;
                                              left:50%;
                                              transform:translate(-50%,-50%);
                                              min-width:${contrainedImageDimensions[0]+9}px;
                                              max-width:${contrainedImageDimensions[0]+9}px;
                                              white-space:nowrap;
                                              `},
        [
          createEl('div', {class: 'a-load-screen-content-container', style: `
                                                       position: relative;
                                                       height: unset;
                                                       display:grid;
                                                       overflow-y:scroll;
                                                       overflow-x:visible;
                                                       /* note that we have a class style that makes the scroll bars invisible here */
                                                       max-height:100vh;
                                                       `},
          )
        ])
      ])
    );
  };
  
  function cacheFileSize(el, size) {
    debug('log',"WILL CACHE",el,size)
    const url = el.getAttribute('src');
    const cachedSizes = localStorage.cachedSizes ? JSON.parse(localStorage.cachedSizes) : {};
    cachedSizes[url] = size;
    localStorage.cachedSizes = JSON.stringify(cachedSizes);
  }

  
  function addEventListeners(el, bar, name) {
    debug('log',el,bar,el.id, getFilename(el))
    let firstByte = true;
    let filename = getFilename(el);
    el.addEventListener("error", evt => {
      // note: this can be missed, sometimes the error happens before we've added the listeners it seems.
      
      // Fetch error. Event detail contains xhr with XMLHttpRequest instance.
      // used for a-asset-item, can be used for any file type
      // also used for HTMLMediaElement (audio, video)
      // https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement
      
      // this would normally cause a forever-hand, I think I want to patch that behavior though
      debug('warn',"error loading file!", name, evt);
      fileLoadError(name, evt, el);
      // bar.set(n)
      // bar.setAttribute('value',n)
      // update to be red, different preset?
    });
    el.addEventListener("progress", evt => {
      // used for a-asset-item, can be used for any file type
      // also used for HTMLMediaElement (audio, video)
      // https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement
      
      // debug('log',"progress", evt);
      // xhr with XMLHttpRequest instance, loadedBytes, and totalBytes.
      let loadedPercentage;
      try {
        loadedPercentage = (evt.detail.loadedBytes / evt.detail.totalBytes) * 100;
        globalLoadRegister.bytes[filename][0] = evt.detail.loadedBytes;
        globalLoadRegister.bytes[filename][1] = evt.detail.totalBytes;
        updateBytes(name, bytesToMegabytes(evt.detail.loadedBytes, true), bytesToMegabytes(evt.detail.totalBytes, true));
        updateGlobalLoader();
        if (firstByte) {
          firstByte = false;
          cacheFileSize(el, globalLoadRegister.bytes[filename][1])
        }
      } catch (e) {
        debug('warn','progress error, assuming this is a video and using experimental video load attempt',e)
        if (el.buffered.length !== 0) {
          debug("log","progress, likely video/audio?, buffered length is greater than 0", el.id, el)
          try {
            loadedPercentage = ((el.buffered.end(0)*100) / el.duration);
          } catch (e) {
            debug("error","problem using buffered.end(0)",e, el.buffered?.end)
            debugger
          }
          debug('log', el.id, loadedPercentage);
        } else {
          debug("warn","progress, likely video (or audio?) but buffered length is 0", el.id, el)
        }
      }
      if (loadedPercentage) bar.set(loadedPercentage, false);
    });
    el.addEventListener("loaded", evt => {
      // emitted by a-asset-item
      // however: this may be emitted when there is a timeout--makes sense with how aframe treats timeout...
      // not sure, we should probably try to ignore that? todo...
      bar.set(100,false);
      globalLoadRegister.bytes[filename][0] = globalLoadRegister.bytes[filename][1];
      updateBytes(name, Math.round(globalLoadRegister.bytes[filename][0] / 10000) / 100, Math.round(globalLoadRegister.bytes[filename][1] / 10000) / 100);
      updateGlobalLoader();
      // globalLoadRegister.bytes[name][1] = evt.detail.totalBytes;
      if (firstByte) {
        firstByte = false;
        cacheFileSize(el, globalLoadRegister.bytes[filename][1])
      }      
    });

    el.addEventListener("timeout", evt => {
      debug('warn',"timeout loading file?", evt);
      // bar.set(n)
      // bar.setAttribute('value',n)
      // update to be red, different preset?
    });
    
    
    el.addEventListener("load", function(evt) {
      // used for images
      debug('log',"load event; IMG?", evt, this);
      bar.set(100, false);
      // bar.set(100, false) // maybe change color to green? do something else?
    });
    
    el.addEventListener("loadeddata", evt => {
      // used for HTMLMediaElement (audio, video)
      // https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement
      debug('log',"loadeddata; HTMLMediaElement (video/audio)?", evt);
      bar.set(100, false);
      // bar.set(n)
      // bar.setAttribute('value',n)
    });
    
  };
  
  function addLogo() {
    if (opts.useLogoFillEffect && opts.useLogoGlitchEffect) {
      let glitchAttributes = {
        class:'glitch__item',
        'style':`
          min-width:${contrainedImageDimensions[0]}px; /* - 9 is because of the loading border*/
          min-height:${contrainedImageDimensions[1]}px; /* this constains to a square when maxed out, not sure if this is the right compromise, but anyone is free to override this by passing in custom attributes instead! */
        `
      };
//       let glitchLoaderAttributes =
//             opts.customLogoLoaderAttributes || 
//             {
//              'data-value':'0', 
//              'data-fill-background':opts.logoFillColor,
//              'data-type':'fill',
//              'data-img':opts.logoURL,
//              'data-img-size': `${contrainedImageDimensions[0]},${contrainedImageDimensions[1]}`, //opts.logoSize,

//              'class': 'ldBar label-center auto a-loader-logo glitch__item', 
//              'style':`
//                min-width:${contrainedImageDimensions[0]}px; /* - 9 is because of the loading border*/
//                min-height:${contrainedImageDimensions[1]}px; /* this constains to a square when maxed out, not sure if this is the right compromise, but anyone is free to override this by passing in custom attributes instead! */
//              `
//                // position:relative;
//             };
      let glitchLoaderAttributes =
            Object.assign({
             'data-value':'0', 
             'data-fill-background':opts.logoFillColor,
             'data-type':'fill',
             'data-img':opts.logoURL,
             'data-img-size': `${contrainedImageDimensions[0]},${contrainedImageDimensions[1]}`, // contrainedImageDimensions, //opts.logoSize,

             // 'class': 'ldBar label-center auto a-loader-logo', 
             'class': 'ldBar label-center auto a-loader-logo glitch__item', 
             'style':`
               max-width:${contrainedImageDimensions[0] - 9}px; /* - 9 is because of the loading border*/
               max-height:${contrainedImageDimensions[1] - 9}px; /* this constains to a square when maxed out, not sure if this is the right compromise, but anyone is free to override this by passing in custom attributes instead! */
               position:relative;
             `
            }, opts.customLogoLoaderAttributes || {});
      debug('log',"glitch loader attributes", glitchLoaderAttributes)
      let glitchChildren = [0,1,2,3,4].map(n => {
          let attrs = [0].includes(n) ? glitchLoaderAttributes : glitchAttributes;
          return createEl('div', attrs);
        });
        
      if (opts.showTitle) {
        glitchChildren = glitchChildren.concat([
          createEl('p',{class:'glitch__title',style:`text-align:center;font-size:${opts.titleSize || '35px'};`})
        ])
      }

      anchor.appendChild(
        createEl('div',{class:'glitch',
                                     'style':`
               max-width:${contrainedImageDimensions[0] + 9}px;
               min-height:${contrainedImageDimensions[1] + 9}px;
             `
                       }, glitchChildren)
      )
      logo = new ldBar('.a-loader-logo',{});

      // see: https://codepen.io/AlainBarrios/pen/OEOKgm
      // <div class="glitch">
      //   <div class="glitch__item"></div>
      //   <div class="glitch__item"></div>
      //   <div class="glitch__item"></div>
      //   <div class="glitch__item"></div>
      //   <div class="glitch__item"></div>
      //   <h1 class="glitch__title">A-FRAME</h1>
      // </div>
    }
    else {
      if (opts.useLogoFillEffect) {
        let attributes = Object.assign({
             'data-value':'0', 
             'data-fill-background':opts.logoFillColor,
             'data-type':'fill',
             'data-img':opts.logoURL,
             'data-img-size': `${contrainedImageDimensions[0]},${contrainedImageDimensions[1]}`, // contrainedImageDimensions, //opts.logoSize,

             'class': 'ldBar label-center auto a-loader-logo', 
             'style':`
               max-width:${contrainedImageDimensions[0] - 9}px; /* - 9 is because of the loading border*/
               max-height:${contrainedImageDimensions[1] - 9}px; /* this constains to a square when maxed out, not sure if this is the right compromise, but anyone is free to override this by passing in custom attributes instead! */
               position:relative;
             `
        }, opts.customLogoLoaderAttributes || {});
        anchor.appendChild(createEl('div', attributes));
        debug('log','using logo fill effect without glitch...')
        logo = new ldBar('.a-loader-logo',{});
      }
      else {
        debug('error',"non-fill-effect not yet implemented")
      }
    } 
    if (opts.showTitle) {
      debug('warn','if glitch title works, you may want to conditionally move this...')
      anchor.appendChild(createEl('p', {id:'a-loader-title',style:opts.titleFontStyle}, opts.titleText))
      
    }
    if (opts.showSubtitle) {
      anchor.appendChild(
        createEl('span', {style:'display:inline!important;text-align:center;'}, opts.subtitleOverride ? 
          createEl('p', {id:'a-loader-subtitle-2',style:''}, opts.subtitleOverride) :
          [
            createEl('p', {id:'a-loader-subtitle-1',style:`display:inline!important;font:${opts.font};font-size:10px`}, "built with " ),
            createEl('img',{src:aframeLogoDataIMG, id:'a-loader-subtitle-logo',style:"display:inline!important;width:10px"}),
            createEl('p', {id:'a-loader-subtitle-2',style:`display:inline!important;font:${opts.font};font-size:10px`}, "-Frame" ),
          ]
        )
      )
    }
  };
  
  function updateSubtitle(text) {
    try {
      document.querySelector('#a-loader-subtitle-2').innerText = text;
      document.querySelector('#a-loader-subtitle-1').style.display = "none";
      // document.querySelector('#a-loader-subtitle-logo').style.display = "none";
    } catch (e) {
      debug('warn','cannot update subtitle',e)
    }
  };
  
  // {"xmlns":"http://www.w3.org/2000/svg", "width":"350", "height":"20", "viewBox":"0 0 350 20", "x":"175", "y":"10", "text-anchor":"middle", "dominant-baseline":"central", "font-family":"arial"}
  function generateFilenameAttributes(filename) {
    return Object.assign(opts.customBarLoaderAttributes || {},{
          "data-type": 'fill',
          "data-fill-background":"white",
          "data-img": `data:image/svg+xml,<svg xmlns="${opts.filenamesPresetOptions.xmlns}" width="${opts.filenamesPresetOptions.width}" height="${opts.filenamesPresetOptions.height}" viewBox="${opts.filenamesPresetOptions.viewbox}"><text x="${opts.filenamesPresetOptions.x}" y="${opts.filenamesPresetOptions.y}" text-anchor="${opts.filenamesPresetOptions['text-anchor']}" dominant-baseline="${opts.filenamesPresetOptions['dominant-baseline']}" font-family="${opts.filenamesPresetOptions['font-family']}">${filename}</text></svg>`,
          "data-fill-background-extrude": 1.3,
          "data-pattern-size": 100,
          "data-fill-dir": "ltr",
          "data-img-size": "350,20",

          // we require:
          'class': 'ldBar label-center auto a-loader-logo', 
          'style':`
             position:relative;
             height:unset;
          `
    });    
  };
  
  let speedometer;
  function addStats() {
    let stats = [];
    let gridTemplateColumns = "";

    if (opts.showVisualSpeedometer) {
      anchor.appendChild(
        createEl('div',{class:`visual-speedometer-container`, style:`max-width:${maxWidth}px;display:${!opts.showGlobalStats?"none":"grid"};grid-template-columns:${calculateStatsBuffer()}px ${opts.showDownloadTotals || opts.showFileSizes ? 40 + 15 + 40 + 30 +"px" : "0px"} 100px;`}, [
          createEl('div'), // buffer for image centering
          createEl('div'), // buffer that corresponds to file size stats
          createEl('div',{class:`ldBar label-center auto visual-speedometer`,'data-preset':'fan','data-value':10,'data-stroke':'data:ldbar/res,gradient(0,1,#a551df,#fd51ad,#ff7f82,#ffb874,#ffeb90)'})
        ])
      )
      if (opts.showVisualSpeedometer) speedometer = new ldBar('.visual-speedometer',{});
    }
    if (opts.showDownloadTotals) {
      gridTemplateColumns += `40px 10px 40px 29px ${calculateStatsBuffer()}px `;
      let totals = localStorage.cachedSizes ? JSON.parse(localStorage.cachedSizes) : null;
      let total;
      if (totals) {
        total = Object.keys(totals).reduce((memo, key) => memo + totals[key], 0)
      }
      stats.push(
        // createEl('div',{class:`text-totals`, style:"margin-top:10px;"},`--.-- / ${total ? Math.round(total/(10**4))/100 :'--.--'} MB`),
            
            createEl('p',{style:'text-align:left;',class:`total-bytes-down`},`${0}`),
            createEl('p',{style:'text-align:center;',class:`total-bytes-slash`},`/`),
            createEl('p',{style:'text-align:right;',class:`total-bytes-total`},`${total ? roundToDecimal(total/(10**6),2) :'--.--'}`), // roundToDecimal
            createEl('p',{style:'text-align:center;',class:`total-bytes-label`},`MB`),
            createEl('div',{}),
      )
      
    }
    else {
      // this isn't great, but we normally do this logic there and put the buffer after the download totals; if those aren't being shown, then we add it here
      stats.unshift(createEl('div',{}));
      gridTemplateColumns = calculateStatsBuffer()+"px ";
    }
    
    if (opts.showTextSpeedometer) {
      gridTemplateColumns += "55px 35px ";
      stats.push(
        createEl('p',{class:`text-speedometer`,style:"text-align:left;padding-left:5px;"},"000.00"),
        createEl('p',{class:`text-speedometer-unit`,style:"text-align:right;"}," MB/s"),
        //  
      )
    }
    if (opts.showTimeElapsed) {
      gridTemplateColumns += "150px ";
      stats.push(
        createEl('p',{class:`text-elapsed`, style:"text-align:center;"},"-- s")
      )
    }
    
    if (stats.length) {
      anchor.appendChild(
        createEl('div',{class:'stats-container',style:`display:${!opts.showGlobalStats?"none":"grid"};max-width:${maxWidth}px;white-space:nowrap;text-overflow:clip;grid-template-columns:${gridTemplateColumns}`},stats)
      );
      anchor.appendChild(createEl('hr',{style:`width:${opts.horizontalRulePercent}%`}))
    }
  };
  
  function calculateBarBuffer() {
    // todo: remove this 89 and make it response, just the value I see the bar being when I checked but that should be adjustable...
    if (opts.showBarLoaders && !opts.centeredLoadingBars) {
      return 0; // really?
    }
    let ldBarWidth = opts.showBarLoaders ? 89 : 0,
        leftOfBarContentWidth = opts.showFileSizes ? 40 + 15 + 40 + 30 : 0;
    debug('log',"bar buffer", maxWidth, ldBarWidth, leftOfBarContentWidth, Math.floor((maxWidth / 2) - (ldBarWidth / 2) - leftOfBarContentWidth));
    return Math.max(0,Math.floor((maxWidth / 2) - (ldBarWidth / 2) - leftOfBarContentWidth));
  };
  
  function calculateStatsBuffer() {
    let ldBarWidth = opts.showVisualSpeedometer ? 89 : 0,
        leftOfBarContentWidth = opts.showDownloadTotals ? 40 + 15 + 40 + 30 : 0;
    debug('log',"stats buffer", maxWidth, ldBarWidth, leftOfBarContentWidth, Math.floor((maxWidth / 2) - (ldBarWidth / 2) - leftOfBarContentWidth));
    return Math.max(0,Math.floor((maxWidth / 2) - (ldBarWidth / 2) - leftOfBarContentWidth));    
  };

  function calculateFilenameWidth() {
    if (!opts.showFilenames) return 0;
    let ldBarWidth = opts.showBarLoaders ? 89 : 0;
    return Math.floor((maxWidth/2) - (ldBarWidth / 2));
  }

  let fileRetryCounters = {};
  function addBar(el, showBar) {
    let name = `a-loader-${barCounter}`;
    fileRetryCounters[name] = 0;
    if (opts.barLoaderPreset === "filenames") {
      opts.customBarLoaderAttributes = Object.assign(generateFilenameAttributes(getFilename(el)), opts.customBarLoaderAttributes || {} );
    }
    let attributes = Object.assign({
     'class': `ldBar label-center auto`, 
     'data-preset': opts.barLoaderPreset, 
     // 'data-value':'0', 
     // 'data-fill-background':'red',
     // 'data-stroke':'green',
     'style':`
       position: relative;
       height: unset;
       padding-left: 5px;
       padding-right: 5px;
     `
    }, opts.customBarLoaderAttributes);
    
    if (!opts.showBarLoaders) attributes.style = "display:none;" + attributes.style;
    
    let barEl = createEl('div', attributes)
    barEl.classList.add(name);

    let loadIsTrackable = addToGlobalLoadRegister(el, name);
    if (loadIsTrackable > 0) {
      let gridTemplateColumns = "";
      let fileBarEls = [];
      let filenameWidth = calculateFilenameWidth(maxWidth, 89);
      let buffer = calculateBarBuffer(); // todo: make this not hardcoded, just an experimental amount for now
      if (opts.showFileSizes && loadIsTrackable === 1) {
        gridTemplateColumns = `${opts.showFileSizes ? `40px 10px 40px 29px ${buffer}px ` : ""} `
        fileBarEls.push(createEl('p',{class:`${name}-bytes-down`},`${0}`)); // ...
        fileBarEls.push(createEl('p',{class:`${name}-bytes-slash`},`/`)); // ...
        fileBarEls.push(createEl('p',{class:`${name}-bytes-total`, style:'text-align:right;'},`${bytesToMegabytes(getFileSize(el),true)}`)); // ...
        fileBarEls.push(createEl('p',{class:`${name}-bytes-label`, style:'text-align:center;'},`MB`)); // ...
        fileBarEls.push(createEl('div',{style:`min-width:${buffer}px;`})) // add spacer to align loading bars with center of screen
      }
      else {
        gridTemplateColumns = `${buffer}px `;
        fileBarEls.push(createEl('div',{style:`min-width:${buffer}px;`})) // add spacer to align loading bars with center of screen
      }
      // this one always has to go in in current implementation, instead we do display:none if it should hide; todo: improve that
      // if (opts.showBarLoaders) {
        fileBarEls.push(barEl);
      // }
      if (opts.showFilenames) {
        // note: width:filenameWidth was broken before, so... now that it's fixed, make sure it doesn't break anything. also, text-overflow:ellipses was mispelled, make sure you like it now.
        fileBarEls.push( createEl('p',{style:`width:${filenameWidth}px;white-space:nowrap;text-overflow:ellipses;`}, opts.useFilename ? getFilename(el) : el.id) );
      }
      if (fileBarEls.length) {
        
        gridTemplateColumns += ` ${opts.showBarLoaders ? "89px" : ""} ${filenameWidth ? filenameWidth + "px" : ""}`  /* TODO: filenames preset changes this equation, need to handle not having bar there generally*/
        // let gridTemplateColumns = `${opts.showFileSizes ? `${buffer}px 40px 15px 40px 30px ` : ""}${opts.showBarLoaders ? `${opts.barLoaderPreset === "filenames" ? 350 : 100}px ` : ""}${opts.showFilenames ? "250px " : ""}`
        
        // NOTE: if you want to contrain text / clip overflow, you need to explicitly set width property.
        debug('log','bar columns:',gridTemplateColumns)
        anchor.appendChild(
          createEl(
            'div',
            {
              class:'bar-container',
              style:`
              display:${!opts.showFileStats?"none":"grid"};
              ${opts.fadeLoaderRows ? '-webkit-mask-image: linear-gradient(90deg, #000 90%, transparent);' : ''}
              max-width:${maxWidth}px;
              overflow:hidden;white-space:nowrap;text-overflow:clip;
              grid-template-columns:${gridTemplateColumns}`
            },
            fileBarEls
          )
        );
      }
      let bar = new ldBar(`.${name}`, {});
      addEventListeners(el, bar, name);
      barCounter++;
    }
  };

  function updateBytes(name, downloaded, outOf) {
    if (!opts.showFileSizes) return;
    document.querySelector(`.${name}-bytes-down`).innerHTML = `${downloaded}`;
    document.querySelector(`.${name}-bytes-total`).innerHTML = `${outOf}`;
  }
  
  function fileLoadError(name, evt, el) {
    let errorBar = document.querySelector(`.${name}`).parentElement;
    errorBar.style.backgroundColor = "red";
    errorBar.setAttribute('title',evt.detail.xhr.message);
    // debug("log",{AFRAME, 'THREE.Cache':THREE.Cache})
    if (fileRetryCounters[name] < opts.fileRetryOnError) {
      debug('error','file load retry not yet implemented; for now, forcing a page refresh is recommended');
      // how to do this: a-frame probably isn't set up to expect dynamically added elements to a-assets
      // but if we want fully compatible use when doing a reload, we'll need to allow the same access-via-ID system...
      // need to look into this.
    } 
    else if (opts.skipLoadErrors) {
      // this fools aframe into allowing it to continue with scene load
      debug('warn','will ignore file error and tell aframe to continue anyways')
      evt.target.emit('loaded',{});
    }
    
    if (opts.onFileLoadError) {
      let url = evt.detail.xhr.message.split('"')[1];
      opts.onFileLoadError(getFilename(el), url, evt)
    }
  }

  function getClaimedFileSize(el) {
    // <a-asset-item filesize="1.21"></a-asset-item> 
    // -> 1210000 bytes 
    let claimedSize = el.getAttribute('filesize');
    return claimedSize ? Number(claimedSize) : -1; // (mb = 1000 kb = 1000 b)
  }

  function getFileSize(el) {
    // tries to get claimed size directly on el
    // if not available, will use cached size if available
    // if not available, with fall back to smoothLogoLoadFactor, which is an imaginary presumed value in bytes to use
    let claimed = getClaimedFileSize(el);
    const url = el.getAttribute('src');
    // debug("log","cached",el,el.getAttribute('src'),getFilename(el))
    let cached = localStorage.cachedSizes ? JSON.parse(localStorage.cachedSizes)[url] : -1;
    return claimed !== -1 ? 
            claimed :
           cached !== -1 ?
            cached :
           opts.smoothLogoLoadFactor
  }

  function addToGlobalLoadRegister(el, name) {
    if (el.tagName === "A-ASSET-ITEM") {
      globalLoadRegister.bytes[getFilename(el)] = [0, getFileSize(el)];
      // first class citizen, we can track
      return 1; // thing we're primarily handling right now
    }
    else if (el.tagName === "TEMPLATE" || el.tagName === "A-MIXIN") {
      debug('log',"skipping template")
      return 0; // these aren't truly loaded in the same way
    }
    else if (el.tagName === "IMG" || el.tagName === "VIDEO" || el.tagName === "AUDIO") {
      debug('warn',`EXPERIMENTAL: ${el.tagName}`)
      // todo: look into it more, but at least an image loaded counter maybe?
      // second class citizen, we seem to only get binary states for this, will use 2 for this
      return 2; // I think it only supports 0 & 100, but we'll see how it goes
    }
    else {
      debug('error',`UNTRACKED UNKNOWN LOAD ASSET (TODO?): ${el.tagName}`, name, el, el)
      return 0;
    }
  };

  function debug(f="log", ...args) {
    if (opts.debug.includes(f)) {
      console[f]('a-load-screen|',...args);
    }
  }

  function getFilename(el) {
    let filename;
    try {
      let urlChunks = el.attributes.src?.value.split("/");
      let lastChunk = urlChunks[urlChunks.length-1];
      filename = lastChunk.split("?")[0];
    } catch (e) {
      return "unknown file";
    }
    return filename;
  };

  function getTotalBytes(n) {
    // if n = 0, bytes loaded
    // if n = 1, bytes to load
    
    // todo: add non-bytes stuff, e.g. images; see
    // https://aframe.io/docs/1.3.0/core/asset-management-system.html
    return Object.values(globalLoadRegister.bytes)
                 .reduce((memo, val) => memo + val[n], 0);
  }

  function roundToDecimal(val, decimalPoints) {
    return Math.round(val * (10**decimalPoints))/(10**decimalPoints);
  }
  
  let firstLoad = true;
  function updateGlobalLoader() {
    if (firstLoad) {
      firstLoad = false;
      firstByteTime = Date.now();
    }
    let loaded = getTotalBytes(0);
    let toLoad = getTotalBytes(1);
    if (opts.useLogoFillEffect) logo.set((loaded / toLoad)*100);
    updateStats(loaded, toLoad)
    if (loaded === toLoad) {
      opts.onFilesLoaded();
      logAssetsWithFileSizes();
    }
  }
  
  function bytesToMegabytes(n, clean) { return !clean ? n / 10**6 : roundToDecimal(n / 10**6, 2) }
  
  function logAssetsWithFileSizes() {
    let assetsHTMLstring = document.querySelector('a-assets').outerHTML;
    if (assetsHTMLstring.includes('filesize=')) {
      debug('warn','will not print asset html with filesize attributes because filesize is already present; remove filesize attributes from any a-asset-item to have a new one generated')
      return
    }
    let cachedFileSizes = JSON.parse(localStorage.cachedSizes);
    Object.keys(cachedFileSizes).forEach(cachedFilename => {
      assetsHTMLstring = assetsHTMLstring.replace(cachedFilename, `${cachedFilename}" filesize="${cachedFileSizes[cachedFilename]}`)
    })

    debug('log','swap your existing a-assets HTML with the below HTML to ensure correct file sizes instantly on first load for users before first byte has arrived for each file: \n\n\n',assetsHTMLstring)
  }
  
  let speedText;
  let totalText;
  let totalText2
  let timeText;
  let subtractTime = 0;
  let subtractData = 0;
  let lastSpeedometerUpdate = 0;
  function updateStats(loaded, toLoad) {
    let now = Date.now();
    let adjustedDataLoaded = loaded - subtractData;
    let msLoading = now - firstByteTime;
    let adjustedMsLoading = msLoading - subtractTime;
    let adjustedMBSLoaded = bytesToMegabytes(adjustedDataLoaded, false);
    let adjustedSecondsLoading = adjustedMsLoading / 1000;
    let fullSpeed = 100; // MB/s; could make 1000, but then everyone would look bad. :(
    let speed = adjustedMBSLoaded / adjustedSecondsLoading;
    // if we stop here, we get average download speed across the entire download
    // but in reality, the speed goes up as server file connections initiate
    // it's more satisfying to see live speeds that aren't held down by the
    // average in the beginning, so let's cut out old data from the average
    // as we go on
    if (adjustedMsLoading > 300) {
      // if more than a second has passed since we last removed old data/time count
      // then remove half of old data for the next iteration to start clean for the next second
      subtractTime = now - firstByteTime;
      subtractData = loaded;
    }
    
    
    if (now - lastSpeedometerUpdate > 100) {
      lastSpeedometerUpdate = now;
      if (opts.showVisualSpeedometer) speedometer.set((speed / fullSpeed) * 100, false);
      if (opts.showTextSpeedometer) {
        speedText = speedText || document.querySelector('.text-speedometer');
        speedText.innerHTML = `${roundToDecimal(speed,1)}`;
      }
    }
    if (opts.showDownloadTotals) {
      totalText = totalText || document.querySelector('.total-bytes-down');
      totalText.innerHTML = `${roundToDecimal(bytesToMegabytes(loaded, true),2)}`;
      totalText2 = totalText2 || document.querySelector('.total-bytes-total');
      totalText2.innerHTML = `${roundToDecimal(bytesToMegabytes(toLoad, true),2)}`;
      // `--.-- / ${total ? Math.round(total/(10**4))/100 :'--.--'} mb`
    }// text-totals
    if (opts.showTimeElapsed) {
      timeText = timeText || document.querySelector('.text-elapsed');
      timeText.innerHTML = `${Math.round(msLoading / 1000)} s`;
    }// text-elapsed
  };
  
  // https://codepen.io/AlainBarrios/pen/OEOKgm
  let glitchEffectCSS = (title, logoURL, width, height) => `
:root {
  --color-text: #fff;
  --color-bg: #000;
  --color-link: #f9d77e;
  --color-link-hover: #fff;
  --color-info: #efc453;
  /*
  --glitch-width: 100vw;
  --glitch-height: 100vh;
  */
  --glitch-width: ${width};
  --glitch-height: ${height};
  
  --gap-horizontal: 10px;
  --gap-vertical: 5px;
  --time-anim: 4s;
  --delay-anim: 2s;
  --blend-mode-1: none;
  --blend-mode-2: none;
  --blend-mode-3: none;
  --blend-mode-4: none;
  --blend-mode-5: overlay;
  --blend-color-1: transparent;
  --blend-color-2: transparent;
  --blend-color-3: transparent;
  --blend-color-4: transparent;
  --blend-color-5: #af4949;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  /*background-color: #1D1E22;*/
  margin: 0;
  padding: 0;
  animation-name: glitch-anim-flash;
}

.glitch {
/*
  instead, we define this inline from user preferences
  width: 100vw;
  height: 100vh;
  */
  max-width: 100%;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
}
.glitch .glitch__item {
  background: url("${logoURL}") no-repeat 50% 50%/cover;
  /*
  height: 100%;
  width: 100%;
  */
  top: 0;
  left: 0;
  position: absolute;
}
.glitch .glitch__item:nth-child(n+2) {
  opacity: 0;
  animation-duration: var(--time-anim);
  animation-delay: var(--delay-anim);
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}
.glitch .glitch__item:nth-child(2) {
  background-color: var(--blend-color-2);
  background-blend-mode: var(--blend-mode-2);
  animation-name: glitch-anim-2;
}
.glitch .glitch__item:nth-child(2) {
  background-color: var(--blend-color-3);
  background-blend-mode: var(--blend-mode-3);
  animation-name: glitch-anim-3;
}
.glitch .glitch__item:nth-child(4) {
  background-color: var(--blend-color-4);
  background-blend-mode: var(--blend-mode-4);
  animation-name: glitch-anim-4;
}
.glitch .glitch__item:nth-child(5) {
  background-color: var(--blend-color-5);
  background-blend-mode: var(--blend-mode-5);
  /*animation-name: glitch-anim-flash;*/
}
@keyframes glitch-anim-flash {
  0%, 5% {
    opacity: 0.2;
    transform: translate3d(var(--glitch-horizontal), var(--glitch-height), 0);
  }
  5.5%, 100% {
    opacity: 0;
    transform: translate3d(0, 0, 0);
  }
}
.glitch .glitch__title {
  /*font-family: "Bungee", cursive;*/
  /*font-size: 100px;*/
  /*color: #ffffff;*/
  position: relative;
  /*text-transform: uppercase;*/
}
.glitch .glitch__title:before, .glitch .glitch__title:after {
  content: "GLITCH TITLE"; /*"${title}";*/
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.glitch .glitch__title:before {
  left: 2px;
  text-shadow: -1px 0 #00ffea;
  clip: rect(24px, 550px, 90px, 0);
  animation: glitch-anim 2s linear infinite alternate-reverse;
}
.glitch .glitch__title:after {
  left: -2px;
  text-shadow: -1px 0 #fe3a7f;
  clip: rect(85px, 550px, 140px, 0);
  animation: glitch-anim 2s 1s linear infinite alternate-reverse;
}
@keyframes glitch-anim {
  0% {
    clip: rect(4px, 9999px, 127px, 0);
  }
  5% {
    clip: rect(75px, 9999px, 44px, 0);
  }
  10% {
    clip: rect(22px, 9999px, 60px, 0);
  }
  15% {
    clip: rect(67px, 9999px, 17px, 0);
  }
  20% {
    clip: rect(28px, 9999px, 143px, 0);
  }
  25% {
    clip: rect(62px, 9999px, 36px, 0);
  }
  30% {
    clip: rect(66px, 9999px, 56px, 0);
  }
  35% {
    clip: rect(129px, 9999px, 88px, 0);
  }
  40% {
    clip: rect(47px, 9999px, 135px, 0);
  }
  45% {
    clip: rect(133px, 9999px, 111px, 0);
  }
  50% {
    clip: rect(159px, 9999px, 156px, 0);
  }
  55% {
    clip: rect(22px, 9999px, 27px, 0);
  }
  60% {
    clip: rect(76px, 9999px, 84px, 0);
  }
  65% {
    clip: rect(126px, 9999px, 124px, 0);
  }
  70% {
    clip: rect(49px, 9999px, 24px, 0);
  }
  75% {
    clip: rect(15px, 9999px, 35px, 0);
  }
  80% {
    clip: rect(17px, 9999px, 64px, 0);
  }
  85% {
    clip: rect(79px, 9999px, 24px, 0);
  }
  90% {
    clip: rect(74px, 9999px, 77px, 0);
  }
  95% {
    clip: rect(94px, 9999px, 127px, 0);
  }
  100% {
    clip: rect(125px, 9999px, 127px, 0);
  }
}

@keyframes glitch-anim-2 {
  0% {
    opacity: 1;
    transform: translate3d(var(--gap-horizontal), 0, 0);
    -webkit-clip-path: polygon(0 2%, 100% 2%, 100% 5%, 0 5%);
    clip-path: polygon(0 2%, 100% 2%, 100% 5%, 0 5%);
  }
  2% {
    -webkit-clip-path: polygon(0 15%, 100% 15%, 100% 15%, 0 15%);
    clip-path: polygon(0 15%, 100% 15%, 100% 15%, 0 15%);
  }
  4% {
    -webkit-clip-path: polygon(0 10%, 100% 10%, 100% 20%, 0 20%);
    clip-path: polygon(0 10%, 100% 10%, 100% 20%, 0 20%);
  }
  6% {
    -webkit-clip-path: polygon(0 1%, 100% 1%, 100% 2%, 0 2%);
    clip-path: polygon(0 1%, 100% 1%, 100% 2%, 0 2%);
  }
  8% {
    -webkit-clip-path: polygon(0 33%, 100% 33%, 100% 33%, 0 33%);
    clip-path: polygon(0 33%, 100% 33%, 100% 33%, 0 33%);
  }
  10% {
    -webkit-clip-path: polygon(0 44%, 100% 44%, 100% 44%, 0 44%);
    clip-path: polygon(0 44%, 100% 44%, 100% 44%, 0 44%);
  }
  12% {
    -webkit-clip-path: polygon(0 50%, 100% 50%, 100% 20%, 0 20%);
    clip-path: polygon(0 50%, 100% 50%, 100% 20%, 0 20%);
  }
  14% {
    -webkit-clip-path: polygon(0 70%, 100% 70%, 100% 70%, 0 70%);
    clip-path: polygon(0 70%, 100% 70%, 100% 70%, 0 70%);
  }
  16% {
    -webkit-clip-path: polygon(0 80%, 100% 80%, 100% 80%, 0 80%);
    clip-path: polygon(0 80%, 100% 80%, 100% 80%, 0 80%);
  }
  18% {
    -webkit-clip-path: polygon(0 50%, 100% 50%, 100% 55%, 0 55%);
    clip-path: polygon(0 50%, 100% 50%, 100% 55%, 0 55%);
  }
  20% {
    -webkit-clip-path: polygon(0 70%, 100% 70%, 100% 80%, 0 80%);
    clip-path: polygon(0 70%, 100% 70%, 100% 80%, 0 80%);
  }
  21.9% {
    opacity: 1;
    transform: translate3d(var(--gap-horizontal), 0, 0);
  }
  22%, 100% {
    opacity: 0;
    transform: translate3d(0, 0, 0);
    -webkit-clip-path: polygon(0 0, 0 0, 0 0, 0 0);
    clip-path: polygon(0 0, 0 0, 0 0, 0 0);
  }
}
@keyframes glitch-anim-3 {
  0% {
    opacity: 1;
    transform: translate3d(calc(-1 * var(--gap-horizontal)), 0, 0);
    -webkit-clip-path: polygon(0 25%, 100% 25%, 100% 30%, 0 30%);
    clip-path: polygon(0 25%, 100% 25%, 100% 30%, 0 30%);
  }
  3% {
    -webkit-clip-path: polygon(0 3%, 100% 3%, 100% 3%, 0 3%);
    clip-path: polygon(0 3%, 100% 3%, 100% 3%, 0 3%);
  }
  5% {
    -webkit-clip-path: polygon(0 5%, 100% 5%, 100% 20%, 0 20%);
    clip-path: polygon(0 5%, 100% 5%, 100% 20%, 0 20%);
  }
  7% {
    -webkit-clip-path: polygon(0 20%, 100% 20%, 100% 20%, 0 20%);
    clip-path: polygon(0 20%, 100% 20%, 100% 20%, 0 20%);
  }
  9% {
    -webkit-clip-path: polygon(0 40%, 100% 40%, 100% 40%, 0 40%);
    clip-path: polygon(0 40%, 100% 40%, 100% 40%, 0 40%);
  }
  11% {
    -webkit-clip-path: polygon(0 52%, 100% 52%, 100% 59%, 0 59%);
    clip-path: polygon(0 52%, 100% 52%, 100% 59%, 0 59%);
  }
  13% {
    -webkit-clip-path: polygon(0 60%, 100% 60%, 100% 60%, 0 60%);
    clip-path: polygon(0 60%, 100% 60%, 100% 60%, 0 60%);
  }
  15% {
    -webkit-clip-path: polygon(0 75%, 100% 75%, 100% 75%, 0 75%);
    clip-path: polygon(0 75%, 100% 75%, 100% 75%, 0 75%);
  }
  17% {
    -webkit-clip-path: polygon(0 65%, 100% 65%, 100% 40%, 0 40%);
    clip-path: polygon(0 65%, 100% 65%, 100% 40%, 0 40%);
  }
  19% {
    -webkit-clip-path: polygon(0 45%, 100% 45%, 100% 50%, 0 50%);
    clip-path: polygon(0 45%, 100% 45%, 100% 50%, 0 50%);
  }
  20% {
    -webkit-clip-path: polygon(0 14%, 100% 14%, 100% 33%, 0 33%);
    clip-path: polygon(0 14%, 100% 14%, 100% 33%, 0 33%);
  }
  21.9% {
    opacity: 1;
    transform: translate3d(calc(-1 * var(--gap-horizontal)), 0, 0);
  }
  22%, 100% {
    opacity: 0;
    transform: translate3d(0, 0, 0);
    -webkit-clip-path: polygon(0 0, 0 0, 0 0, 0 0);
    clip-path: polygon(0 0, 0 0, 0 0, 0 0);
  }
}
@keyframes glitch-anim-4 {
  0% {
    opacity: 1;
    transform: translate3d(0, calc(-1 * var(--gap-vertical)), 0) scale3d(-1, -1, 1);
    -webkit-clip-path: polygon(0 1%, 100% 1%, 100% 3%, 0 3%);
    clip-path: polygon(0 1%, 100% 1%, 100% 3%, 0 3%);
  }
  1.5% {
    -webkit-clip-path: polygon(0 10%, 100% 10%, 100% 9%, 0 9%);
    clip-path: polygon(0 10%, 100% 10%, 100% 9%, 0 9%);
  }
  2% {
    -webkit-clip-path: polygon(0 5%, 100% 5%, 100% 6%, 0 6%);
    clip-path: polygon(0 5%, 100% 5%, 100% 6%, 0 6%);
  }
  2.5% {
    -webkit-clip-path: polygon(0 20%, 100% 20%, 100% 20%, 0 20%);
    clip-path: polygon(0 20%, 100% 20%, 100% 20%, 0 20%);
  }
  3% {
    -webkit-clip-path: polygon(0 10%, 100% 10%, 100% 10%, 0 10%);
    clip-path: polygon(0 10%, 100% 10%, 100% 10%, 0 10%);
  }
  5% {
    -webkit-clip-path: polygon(0 30%, 100% 30%, 100% 25%, 0 25%);
    clip-path: polygon(0 30%, 100% 30%, 100% 25%, 0 25%);
  }
  5.5% {
    -webkit-clip-path: polygon(0 15%, 100% 15%, 100% 16%, 0 16%);
    clip-path: polygon(0 15%, 100% 15%, 100% 16%, 0 16%);
  }
  7% {
    -webkit-clip-path: polygon(0 40%, 100% 40%, 100% 39%, 0 39%);
    clip-path: polygon(0 40%, 100% 40%, 100% 39%, 0 39%);
  }
  8% {
    -webkit-clip-path: polygon(0 20%, 100% 20%, 100% 21%, 0 21%);
    clip-path: polygon(0 20%, 100% 20%, 100% 21%, 0 21%);
  }
  9% {
    -webkit-clip-path: polygon(0 60%, 100% 60%, 100% 55%, 0 55%);
    clip-path: polygon(0 60%, 100% 60%, 100% 55%, 0 55%);
  }
  10.5% {
    -webkit-clip-path: polygon(0 30%, 100% 30%, 100% 31%, 0 31%);
    clip-path: polygon(0 30%, 100% 30%, 100% 31%, 0 31%);
  }
  11% {
    -webkit-clip-path: polygon(0 70%, 100% 70%, 100% 69%, 0 69%);
    clip-path: polygon(0 70%, 100% 70%, 100% 69%, 0 69%);
  }
  13% {
    -webkit-clip-path: polygon(0 40%, 100% 40%, 100% 41%, 0 41%);
    clip-path: polygon(0 40%, 100% 40%, 100% 41%, 0 41%);
  }
  14% {
    -webkit-clip-path: polygon(0 80%, 100% 80%, 100% 75%, 0 75%);
    clip-path: polygon(0 80%, 100% 80%, 100% 75%, 0 75%);
  }
  14.5% {
    -webkit-clip-path: polygon(0 50%, 100% 50%, 100% 51%, 0 51%);
    clip-path: polygon(0 50%, 100% 50%, 100% 51%, 0 51%);
  }
  15% {
    -webkit-clip-path: polygon(0 90%, 100% 90%, 100% 90%, 0 90%);
    clip-path: polygon(0 90%, 100% 90%, 100% 90%, 0 90%);
  }
  16% {
    -webkit-clip-path: polygon(0 60%, 100% 60%, 100% 60%, 0 60%);
    clip-path: polygon(0 60%, 100% 60%, 100% 60%, 0 60%);
  }
  18% {
    -webkit-clip-path: polygon(0 100%, 100% 100%, 100% 99%, 0 99%);
    clip-path: polygon(0 100%, 100% 100%, 100% 99%, 0 99%);
  }
  20% {
    -webkit-clip-path: polygon(0 70%, 100% 70%, 100% 71%, 0 71%);
    clip-path: polygon(0 70%, 100% 70%, 100% 71%, 0 71%);
  }
  21.9% {
    opacity: 1;
    transform: translate3d(0, calc(-1 * var(--gap-vertical)), 0) scale3d(-1, -1, 1);
  }
  22%, 100% {
    opacity: 0;
    transform: translate3d(0, 0, 0);
    -webkit-clip-path: polygon(0 0, 0 0, 0 0, 0 0);
    clip-path: polygon(0 0, 0 0, 0 0, 0 0);
  }
}  
`
  
  const aframeLogoDataIMG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAgAAAAHKCAYAAAB14/O1AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAC4jAAAuIwF4pT92AAAAB3RJTUUH4AwVATkYZI2EVQAAIABJREFUeNrs3WdgHMXdBvBndq/o1LtkS+69YYNtQjfNEDAQaqghEFoghQABQhISAgQSEhIgkBBM72BMc8U2YJviCpZ7kW3JqlYv17fN+wGcvA53aCVLtrT3/L4k+PZ0d/+dnfnP7OyMABGRA0gpveUvvznHCupFSUMy7ik6/exZjApRfIIhIKK+TA83uDb9+tH+bSXleyK7myFUBZZuIOuU4Rh06fceMa3IvcVnnN3CSBExASCiPs6/eyfShg5HtKXmryuv+NUPo6UtudKQ/zMk8FUN585KRdoxRRXDb/r+97LGfKekZf0XImviZMkoEhMAIqI+Rko5Zusf/7Gl6qXFkFELUL69KpOGBeERyDhyFFxu7dFJd//s167ho0KMJDEBICLqxVrWf4GsiZMRaiyfsPNvL99Q8+ZnPxGG0mHD//8HA9xuFf0z0lFkpiCib0/OWfBiWC0awOASEwAiot5Ga2mGJysbrbWNQtbt0db+4F6XFTQ7/XdyM9Mw1EyBNCVgSaS/8yu4Ro1k/UcJzcUQEFFvVPrUTHiyslG7fPFdm2/47QP+9RUQqmL7/aZloSAvA8VBLzyaCgn5n25P5P3FDDBxBIAhIKLepG75UlFwwomybsXHf6h4at4vGj/cmK6obtu1lWVJZGQmY1BKBlJaJKxYOUOqgqwVT40SQuxgxIkjAEREvYAeDQwr/eczpV+c9wDUZC8Ul9vW+6SU8LhdGJSVhZyACqstTuMPAC06IrNnTQLABIASlsIQENGhVvrUTADAjqdnlm+65p+lu//6DtRkr/0/IIHRQwoxyZ2LrKAKq6PRApeKyBMfmvq2rQw+MQEgIjrY6pYvFQCgJHnXLD/5arn7vncGCZf9askwLRTlZWJyTiHS62D/pqYAPGcf/ZZ79BieBEpYnANARIfMpocfuja0qX5m47z1Uk312q6PLEsiNzsVg7xpcLdJyC50ZZSBacic/wjrQGICQETU06rmzUHxjLNRu/DDw+uWfvpl7UsroHjtT0WSEvC6VEwY2A9qrd6lhv8/fysQkekL7pzvHnPYWTwzlIg4CZCIDpriGWfji5/fFdn4s8e80jQ72fhLTCgqhK8VQN2BNf4AILweEXl5XpBnhZgAEBH1ECnlyV/edtedbSvLT2t4dz06c59fmhLDB+YjJ+KCbLG6b9zSrcDaHjqJZ4eYABAR9YAt9//jjk9Ov+bPoa17IdyK7cZfSolcTzKG52fDajIgFavbb1rKcDCPZ4gSFecAEFG32bdLX6Cy1NewfM3xe56Z80FkVzuE2rmqJiXJg/FZebBajZ6tpaRE1qZnvEIIjWePOAJARNQF+9bt1wIti1ZffsfRoW11qVK3OtX4u6XAuH6F8AQkrDaj57sohoXQCy83AMjgGSSOABARdUGgaWvxxuufeKZ9XdlpsGB/pz4p4fK6MFikItftg2XKg1czSUDk+7TMj/5RKIRo4VkkjgAQEXVg33B/++4tx9XO+eSPn0+7/QQZBCCErSXGJACXS0W/9FQMRAr0iAnLkge3WyIABAxPdM57aQCYABATACKijqQNHY6WjRvkyjN+Balb/21Qbcr2JGG4NxOISOgwD9nvkJoBbeEGN88oJRouBUxEtlXNmwMAqJw7+08ffefiplVn3vnfxt8Gy5LIykvFpOQ8jHBlAKY89D/KkHCfcNhOnl3iCAAR0f/w794p0oYOl56cjD+X/OK+Ozb/9GkIRYVwq7Yb/rQ0HwYlpSEtrMKChOwtP04A2ruf8SQTRwCIiPbZt0vfnnmz8nc987JcM+Oe2+veXwWh2Gv4pQTcHhdG5OdivJmBlLDy1X3+XsZYWSuNql238IwTRwCIKOHtW7d/5zPPRHb96R0PTMCVkWz7Lr+UEkOHFiC3TgAhwOrF3Q3hdYvIS+9FeNaJIwBElPAiDY0rPznlGrnzD7O9MO1P7zNME/3zMzE5oxB5e/vIk8ZuBcLM/B3POjEBIKKEU/rUTAEAO2b++9Y1194hd9zx6pGhsjrbS/daUiIrIwVTBw5AcbsXqgHIPrTSiFlRUchSQImECwEREQBgzY2/zHanpTfVvvJ5p7fo9agKRuTmItUv+lSjvx/DQtbWZ31CCN4KoITAOQBECU5K6f3i1l81NM/ZmiZNq3ONP4AJQwrhq5dAAH238QcA00LoxZfmATiFpYISAW8BECWg0qdmCimla9N9D29ZevzlkcbZG9OkZX+3PcuSGJSXjSPz+sNXJ50RFI8L2pOfRqNLl7GAUELgLQCixOvxi0/OvvJcaK63g1tqpeJxdWpmf05yMoZ6MqBosm/3+GNQx/RDxqz7WS9SQuAtACKH27dLn6EF0hqWr/jJJ+dc9WB4UzOgCHSm8U9K8mBSQT7Meh3Qndf4A4BV1QgpZZoQws+SQ0wAiKhP82RlQ0o5YcV5P90Q2FIJaVj2d+oDoAqBcRl5SDIUmA26o8cNZXME2rKlLawbKRFwDgCRA9UtXwoACNSVnrTstMtnLx5zzgZ/SflXjb+dhlBKqKqCEVnZmJpcgCRNAJZ0fuBUBdE3PjRZgigR8F4XkYPsG+7XAo2nVb256OVdj76RZ7Wbtq/0fT3+vLRUDPWkwwgaiVdLCAUZS+85Qs0pWscSRU7GYS4iB9i3bK8nKxs1ixff/dGYK+4Vblen0/ys1GSMtNIgDcAwjMTsIgiJ0OOvGPq2rXCPHsPCRRwBIKLeqW75UlFwwomyYc0nczfe/Pix+t5AZmcubQmJ9BQfhnky4IkCkiFFyt+uqveednwBI0EcASCiXmffcL8nN/PB9bc+cOfa8/8IxeUChL3G37IkUlK8KLJ8yIEPVlSy8f+avuKLfEaBOAJARL3KvuH+sjdfGRcqa3i37IF3hrlz0uw/yw/A7VYxMD8b+U0qTIXN/jf4BLJWz0wTQgQYDOIIABEdcnXLl6LghBOx561ZcvtdL0KaEu6cNNvvl1KiX04mBkSTgBaw8Y8XpxYdkbdn3wLgPkaDnIqPARL1IcHqyk+Wn3S13HrLs5Cm/cbbNC3075eFw1PyMTCcxBv9HRBeF8L3zgtqa9dylJScW84ZAqLeq2reHFE842y585lnf9OyYtv9DXPWSTXFa/u6tSyJzPRkDM7MQlKjCcmU3zb32ZOQ9uDPWEcSEwAiOvg+Pu+S7OzR45tqnv9EKj53J9bsB9wuBSOyc5HmF2z4u1I5FviQ9eHjIrp0GbwnTmNAiAkAEfU8Kc2JJXf9fnnD7A3p0rA6daVKS2LC6AHwVekM5IGcg7CGtNk/X+6ZNJWtPzkSJwES9TIld9y7bNkJV50QqWiCUBXbjb9pWRiSl4N8mQRRqTO9P9DekduFyGsLkxgJ4ggAEfVgj1/mrPrxL87RylufDW6qk4q3E1v0WhK5GSkY6s2ECPA+f3dShxUi5a8/cLlGjOb+AMQRACLq1oZf9e/Y8dbyM35wbnhbC4Qi0JnG3wsVhw0tAuqigMnGv7tZLW1ovfBn0qyuhFo0gAEhjgAQUbc0/knLp/+wKlrekiM7udOeogiMz8+H1w8+0teTTAsZS+6rVYuK+zMY5DTsLxAdJP7dOwEAwb27r19xxU8/XXLYueHIrqbONf6WxND8HEzN7gdvGxv/nu8iCURmz+/HQBBHAIjoAHr8Vk7Ne4sbN935GBAFoHTi8hMC2aoXI9OyYUZMXrkHU4qCrJVPcVlgchzOASDqIfuW7a1e8L7bv7Pil4vGnvMAol/n3Z0Ye8tI82FMchZMvwkzysb/oAuYiC6YOxnAMgaDOAJARN/Kv3unSBs6XDatW71x062Pj4xUNHs6M1wvpUSS4sKozFwk6QKdnSNA3Uui7Yi0539V4pkyhSeCHINzAIi60Za/PQIAaNlRcsbGO/8iV53xm/GRcvuNvyUlklK9GJGShUm+PHijYOPfC/h+dsGXbPyJIwBE9A37hvsr57w9tXn11oU1LyzPVlzuTvQwAbdLRVFWBvppXpi6xaD2pp7SyExkvv0w60tyFM4BIDpA/t07kTZ0OPbMmiW33PzsVw1Gpxp/icL0dAzUk4EgYIKNf29jfrkXRvn2v7sGj7qF0SDHJLYMAVHXbPnbIwIAqhbOe3v5SVfLLbc806khYsuyUFichSPSCjBIT+Z4XC8mvB6EZ85mfUlMAIgSWd3ypQIAVK/7F6uuvFWWP7DgvPCeBigeeyv4mZaFtJQkHJZfiIFNHrhMAcnGv3dzK7C2hY9kIMhRiS1DQGSflFKsuuGmfknZhdU1z30m1RRPp64ht1vFsMI8ZNRLWCrj2ad6S+PykfnGg6wziSMARIlky98eEVJKX8mv77Hal1ZX1725Bp1p/C3LwvBB+ZjoyUVaExv/vsja0gAAiMybz2AQEwAixzf8b80CAIS2VsxeeszlobpX1kAa9ifpmaaFAfmZmJrdH9n1AoIPkvVdUUOGXnipNmnGmYwFOQKHs4g68OXMp+S6B1+TWUqSSBIqXAY6vGdvSYmc1BQMy82BUqdxlz4nkIAyJL0hY87f+gshDAaE+jo+Bkj0bXW+tIb+q/hEKRQh6mQIUgCZAzOQVmPArSgxe/SqEDi8oB9c7RbQwMbfSd0l6Tfzoh8sSAbQzoAQEwAih2resU08dfixLqF6BORXDYAA0FbRhjYBKKZAak4yctoVKBIQisD4AYXwNlmA3+L4mhMTwrYwkr57Zru+batwjx7DGzrUp7FvQhRH9sjRcuIPLt0ecxlf+dUwf1tDALui7ahyR3BMTjG89Ra4jo+DaSYiHyyRbPyJCQCRk3t7Uuu34en3vvUYIQQUIRAIRNEQCbLX73RCIPrWUsaBmAAQOdmSO37zU70lautYFQIVqRqD5vgEADCXVsJoqLqAwSAmAEQOZbaLXytuew/sK4rA3poWBi0RuFSEn3yNN3qICQCRE0lpXF++eFWn3uP3mrwDkAhUAUXNvY6BICYARA605M7f3mSGzE69JxyIwpScG5YIrMa6MxgFYgJA5DB1G9Z6GlZVTLQ7/P/fi0lgXbqfowAJQF9UyiAQEwAiJyl59mlRcNgUzV+1t9PvFUJgT30zg5gAZFiXobdnv8lIEBMAIoeY9KNr5ScPPCDNiN6l9xu6iajC+WFOJ7wuEf3XR8HIvPkc8CEmAERO4K8p/+76v8+FULp2aUgpEbFMBtLxNaeAWlRwVdKMMznpg5gAEPV1NWtWiHd/+POA6nUf0N/ZI4JQOBPA8cxdtV/9b3Ulg0FMAIj6sv5Tj5bFR0755EDb7jJPCKpkAuB0Vm0QeskXQbVoAINBTACI+rKwv2rc1hcW2az944/8tu8NoM2lM6AOJ9wuhJ+dE2QkiAkAUR+3+JY/3iJNez1384ghgB77Xr8LAk1eJgCOpwqYa5vyjMrdxQwGMQEg6sOMFvMaxWXjkjAtlP70N3Anx57tLxSBhmauB5AIZDSKyGtzOBGQmAAQ9VWWFrx/7+ot9i6aLDdaCofBOuGouMfUpOmcB5AIoiY8xx7zOANBTACI+qi5N912BQwbDbZlIXjzT4FIGLsnnRL3sJZ6P0zBjqHzhwAAbenn5zIQxASAqI8JNTZg+5x3s5rWVA8Sdob/fR5sGnM8FGlBH1oEGPHmASjYksb5YY4nAO2V9YwDMQEg6muSc/NQMP7wP0aa22319vTCPFhuLwCgvXgklGg09oWlCFTXtzLAiUA3Eflg/vUMBDEBIOpjVj/+xI2wsYufiGoI/Pjq//x3xFKA849BvPcGpcHgJgK3ivD97/qjS5dx0gcxASDqK1rLt/9g23PLJETHdbeSn4LN40/973+bOurO/EHcBCAiDVjcHjgBalEBz5lTX/WeOI0nm5gAEPUFuxd/gPevvD3iTvba6rm1HXUSXJHQf0cEpERFdhEQZ+lgaVjY7QnyccAEoK/YzCAQEwCivmLo9NORM3LIm3Z6/whH4T/rFAjs38mTXh+kLyXmW4QUKHUFIJgCOJ65uQl66cY/MxLEBICoD6he+/HJexZ8YetY98A07Bk29Rv/bigq9OH5sZcGFkBbrR8atwd2POFyIfzP2WO5MRAxASDqA77416zbYdnrnTdedSNkOByjly8Ruf7HgK7FbhiEQFDh9sCO51aAdt9Z3BiImAAQ9QGRmsB3bT37LyWqR02AImP35DcXTYKarMZ9e1M4yNsACcCqqWMQiAkAUW/XumfHSw3rd9lo/AEMSIc/J/5+L1I3IEeNiPv6ziwNKueHOz8BqGiBUVn+JiNBTACIerHFN98zQwi14wNNA8133QNpxn+mXzV1NAwbC8Rp5PdWNHNZ4ERgAtqCj89mIIgJAFEvFGpswNb3Zg9q3dKYJZSOh+VFTjpK80ZAdPA8v3nMJECLPQ/AJQSqUzUG3+lUBdGXV/JeDzEBIOqNknPzkD1w1F+McLTjgy2J0KghsPOYYO2EaVCjkTjtgoK9Te0MvtMJQLZLb/TjxWMZDGICQNQLrfjbYxfZqs/DETRfd6OtvxkwBcT0I+K+3ujWuD1wIjBNtJx0W4u2di1PNjEBIOpNKlctu7VibomtG/LKqH4oKxxj70LSNdQfOyPu6816hM8BJAIJZLz1QI1nyhRO+iAmAES9ybK7HjVdyUm22uK9x52539K/33ohSQv1AwfFXhAIgBU2UeYN8QQkAG3e5wwCMQEg6m1S8nMesTP5D6EIwt89qVO9dr1oCGCacS+0MhHkCUgAxvJK6KUbr2EkiAkAUS/RsLXk5YqFJbaO9RxWjIqcoZ36+353MpSJxTF3BxRCoKXBD44LO59wuRB5bWEeI0FMAIh6iSW3PjjaneKzdWzFNbfAFQl3ruI3DAR/eF3c2wCaS0JyPQDncyswVzYOYSCICQBRL2G0G5NtDf8rCuqLh3xj578O3yYtbBp4OIQ79meYuoVGg5MBE2IUINd9PaNATACIeoHKzz9Z6i+zsVa7lLAm9EcoJbNrH6SqkNnZsRsFCezIj0LwcUDnJ5urKiBl+ElGgpgAEB1CUkrf5w/+81goHRd3YRqo/OUDcSfzdcQSCiIFObGXBRbAntJ6WLwN4HymQGTW+4czEMQEgOgQad6xDV889cTQlg21LmFjRT/0z0WtL+eAhunlOScDuh57gEARaPdye2CnEx4V0TdW+YzqPQwGMQEgOhSyR45G7rDxm6Rlo9dtSbSPHwMRZ9tfu0qOuxiqHnvtfyEEWgNcD8D5NasAwuoEfeU63u8hJgBEh8rKv8+0dzEEgmi6/ucH/HmWbgKThsd9vTwlwmWBE4BsaIfvgnOlvm0rTzYxASA62HZ/tODB+s9Lbd10FyeMR5Uv/8AvKkND65j4+wLUhAJQBNsExycA7VFoq1ZJ9+gxnPRBTACIDrbldzyhulN8Hbe2UmLniefCrYUP/KKSEu3jRwB67Hv9pl9HjSfCk+N0qoLI64sYB2ICQHQwhRobAADenNTb7czoE+EIIkcf232ff8TxEPG2B4ZArQzzJDm+dhUwFpXBqNo1hcEgJgBEB0lybh7Kli1Z2Li2zF5n7dTD0JyU0W2fX+fNhDq+f+xkQxFobA9wQaBEIAQib8zzMBDEBIDoIGmrKBWf3/fkSDXJa+v47VfeAVWLdt+FpUURPPeSuK+3egxOBEwUjeqJDAIxASA6CLa8NQufPPioEm0IDbG19K8vCe2Z2d3aI1ctE6WDxsZ9PeLX0IQoT1YCkCL8R0aBmAAQHQRjL7wIw047eVukwd/xwaYF86Tx0FxJ3f9FCgoRL6tQJFCaywQgEegLdzAIxASA6KD0uKTMXPvwS8OFjaV/FWFgx9V3AQe4+E8sQV86kJMcc1lgoQhUVzTxZCVCeWwNy8jihU8wEsQEgKgHNe/YhlWPPDzOX94EO2P61oihaFV8PfJdpGVBXnwWYMVOLnRpQVf4iLjTiSS30N5YmctIEBMAoh6UPXI0sgeP+dTWuv+mheaph0OxemZtfmFZWH3SlRBx/r5hWjBNiyfN8bWsgEhO+T4DQUwAiHrYqkeetlf4/X7UXnpDz34ZKYHCONsDA9iYHoDCpwEcz9hW8VXOWV3JYBATAKLuFmpsEOuem/mvlo219pb+vfBUtMief0Q7kt8v7mvlrS3gqsDOZ5W2SGP75jq1aACDQUwAiLpbcm6ebCypusSd7O24SbUktp5wFtx6z8/Ejx5/WNxlgXW/jnah8+Q5nPC6RWjm262MBDEBIOpmzTu2AQBqVq/LtLX0r6YhNP6Ig/LdWqdfBBFnkSEFAi0KEwDHcymwNrWPNCrLkhkMYgJA1I2yR47GlrffrGkvbeh4+F9KiEtPQUi4D8p3q/DlQR0aexK4EMDeSAAKFwZ2POkPIfrOAp5oYgJA1J30cJN79Z9ecruSPMJOqS+54GaoxsHpeSvRCMJHTYv7elVSFC5OBHR+AtAShuuwST9kJIgJAFE3KXn2acy97pdevS2Sa6cjLbOyoHkO3v4sqmWidsgwwIo9OBFoCqFF0XgiE4CxcTMXBCImAETdZdKPrsWgE46u0YM2JvQZJoxzT4Ap1IP6Hc3JU4Bo7O+nSoHKDCYAzq9tBaLPrmYciAkAUXeRUk5c9/jsNDuL/yhuC5u/dyNirs/bg/ZmDYCaE3tnQkUR2FvLCeIJIWwgvGDuuQwEMQEgOkA1a1aID3/7m6JoY8jW8dqUKQgbB3/5XanpwLnfjft6q9sAVwVOAKqCyN/nBqNLl3HSBzEBIDoQ/aceLbOLhs0Tqo2irJtoPOGoHlv691vrfVPHF0dfEPf1UCACrgiUAATgPfeERd4TpzHdIyYARAeq5Km3bB3nElFUnHjBoav7M1IAlxrnQhRYn9LOhwETgLZ4DYNATACIDkSosUGsfOzvbwarWm31psKXXQhDP3Sb72jJGZBJsZ8+EEKgrJ3zABKBubZOGnt2vMlIEBMAoi5Kzs2TdZ+WzXD5bDz7LyVKj5oO1Tx0q+6ZEDDPmArE2QEwGtSggbsDOp3weUT42Xf83BiImAAQHYDGrdttLa0qLAuRwSMP7ZeVFhrPuQbCNGK+bEFCE0wAHM+jQoTTf8SNgYgJAFEXrXnyn22R+oCNrrcF65dXIXqIV9sTAMpSCyBy0+IkCEClDHJZ4ARg7ixjEIgJAFFX7N2wJmXDv953KW5Xxw1vkoqSoy88JLP/v/FdTAPagCFxX9+dEuHjgImQAGxvgOlvvI6RICYARJ3UtHXPaMOvJdvpLBv9+0PvJY/YCSkRGDkAMGO38s1VbQgqJk+w0+kS2pwl9zEQxASAqJPCjfVrLc3o+EBNR+TiMyB70bC6ds75QDQS8zUVAk0+gyfY6dwqIs8v51gPMQEg6gwprVPXPvyGrYVz1DQVm6dd2qu+/66C0XBlxt6KWFEEGlv8nAXgdAKAXxRGFn9QyGAQEwAiG3Yv/kDMvf4nhVbY3mz50KmnwwxHetVvsKIa5PFHx329JkWDyu2BnZ/IhjU0T7/cr61dy5NNTACIOjJ0+ukyo9/gl4TLRtHVdDQc+x0osnc9WucyNGwfd0Lc1xsa2iEUtgmOp5vIWTQr4JkyhbcCiAkAkR073lpir6HNVFA14cTeeeGNGgjose/1qxAoTQ/zRDudEIi8vohxICYARB1p3rENy+6/d3GkIWirx9Ry7Y2QmtYrf0tT8SioauzZ/qpQUN7YzBOeAMxPamDUlh7FSBATAKJvkT1yNJrW1pyqJrk7Hh8XAmXjjuwVz/7HolsC8ozvALFSGQH4e2niQt1MVRB+7r0hZnUl7/kQEwCieKSU7obNO+wd61IRye/fey88U0f9mVcidgYAhLkWQGJwKXAPHPuqWjSA8wCICQBRPMvvvTdkBGxs5mMYMP5wGyyz966rL6TEnqz+gCf2SoZm1MQeNcjHAROAtmodg0BMAIjiqdu8Nm/bi0uFYmP2v5Luw5rRJ0LI3t2pkkk+SK8vdoIAgdLkEARTAMczlu+ElPIyRoKYABDFULNy65FSl2rHrSoQHj4Cqtn7V9MzFBXmxAGA9c1ERQigqbIVBncHdDwZMBGd+96ljAQxASCKoXVP+Vxpp0cfjSJ0+Xl94jcJKRH+wbWAHue2hhAIupgAOJ3wuhF+lI8DEhMAom8It1RfvuXpBbaOVQtTsG38qX3mt23ufxjUlPg7GraEQrwJkAC1sJKXdxYDQUwAiP6fLW/NEvNuvCtX2Bj9B4Dmsy4CwsE+8/ss3YA1amTc13dlRbkscAKwqhoAANratQwGMQEgCjU2YOyFF8nUrP6P2Fr6N6qj+ZjvQJF954kq1TJQVzQs3tOAqKxo4lWaAOTeoNRWr5KeKVMYDGICQJScmwcp5V07Zy+zdbwr343aAeP73O8UpxwJRGMv/OMSAjXJXBTI8VyqiLyxKMhAEBMAoq/Nu+En5wjFxvC/lKi/7W6IaLTP/cby8dPgUmJPBFSFgrr2AAuC06kCxpLKJLOxoj+DQUwAKOGVf/yhCOxsP0px20gA3C7sGTym1+38Z4dmSMjjJsYZHgDqrTBUTgV0PiHV0FNvpTIQxASAEp60rP6t5dU2DgSsomxEUzL75kWoR9F07Iy4rzcJDQoXinU+w4LcrRUwEMQEgBLerg+WVFnRjtfEF7qGxt/eA2H1zfXzFSlRN2hQzAWBAMAIaKh0c3vghKiQR6QvZxSICQAltL0lq6aUvrESQrGx8V9xHnbmDuvTvzdaPBQizoJAihQo8zIBSATarC8gpTyVkSAmAJSwalZuOgN2budLoG3sBKiG3qd/b8DlgzJ5YMzHAYUi0FjbBt4FcD7ZaiA67/2JjAQxAaCE1bhj1712jhPhMEI/6PvLqAvDQPDKG4A4kxgjbgkpmAI4nfCoiL7xeRIjQUwAKCEFGyvu2P7ih7aOVcf3x6780X3/QpQWNhdNgHDHviRNzUSbEeWzAI6vkQXU4UPuZyCICQAlnJJnnxbvXnxzmurxdnywBKrPvgxKxBn3xy2XCzIjI+61O35AAAAgAElEQVRv3Z6ngYMAzmes2sYgEBMASiyhxgZM+tG1MiW34LdCtdHX1XS0TpoM4ZC745biQjgrK/Y8AAHs2rn3q/9DjmZubpD6rm2bGAliAkAJ46ulf62HKz8qsVd4x+SiKbvYQRGQwKVnxt0eWFUE2j0GC4rDiSSPiLwyp03ftpXBICYAlDje+cG1M1S320Z32UL5bQ9A0Zy1Tv6m75wLVcRez0AIgfZwlIXE6dwKrA3tk92jxzAWxASAEsO2995K9W9pGiVUG8UyJRn12YWOGf7fRzcBjBkS9/Vyd4jbAycAq6XNyygQEwBKGIHq5jGhxlYbtaOEPmkwDLfz6khhaGgfNSnu69VWEArnATierA1A37yRQwDEBIASQ8PWLaul1XGPXolGsefW+yCk86bEK1Ki/fBRgB77Xr/WGkWTFWFhcXwGIKGv3biZgSAmAOR41Ws/PW3XG6sh7PRuJwxHnSvdsbFoP2IalEjsRl6VAlXJnAfgeKqC6JPLGAdiAkAJkAAs33ih6rEz+U+i/rDJcBmaY2PR4E6HOjH20w1CEWho9nNBoEQYBAgYIrL0w2MYCWICQI5WuXLNdXZaNREJI/j97zv7otSiCJ5zcdzXW3wmFE4ETIAMAIjOnK9F5s1nLIgJADlT+bIlj9V8vMXWsa4TJ6DK5+wt01XLxM4B8Zc3DrVH0C41FpwE4J42eU3SjDMZCGICQM60fdbio1W3x1aPaOeZV0DVnL81rlXYD/GecBQWUJrLBCAR6MtKGARiAkDO07zjqzXPW0urp9ha+lfX0T5yTELc//anZAIZsR9zVBSByupGFqAEYCyrlGZT9WOMBDEBIEfJHjkareU7W+vXltro/UvI0yYg4MtMiNgI04R19QWAGXt74KhlwlC4M5Djy0GyV4SfnR3kssDEBIAcZ/4Nd4XUpI4X9BGQ2PCj30Ex9MSo+C0L6465CEqc7f8Mw4I0mQA4nkcFAkm3c1lgYgJAjrLxtRcLQ3v8/YTS8aC+lZ2NaFJKQsXHUFyQuZlxEiJgk88PhQ8EOp5ZVqkyCsQEgByldUf1MXrQxoQ+00Lk6HGQIvGKazQv/hMPZVo7m/9ESAA21EBKOZKRICYA5Bj120pn29nLR9EiqLz+VwkZo+hJh8ddFjjSHEFA6ixIThc0EHnt9XcYCGICQI6wff57P6pZshW2Fv85bjIapCch49R46sVQotG4F2+b22BhcjqPC5FHl5oMBDEBIEeoW7X1ApfXRqNuWqg46jhHL/37baq9WVBG94udGAmBvaEg5wE4nQBEZtqE6LKlPgaDmABQr9LU1NTp99R+selMO+2WokfgP/mMxL1AtSjCR8RfDr46XYfKhwEcz2psR8O0U7XoUm4QREwA6BA3+E1NTdMaGxsfaGpquiQnJ6dT79/94cLZ9StKbR0rzjsRTWpqwsZatUzsHTIUiPPIX8vedgTA2wCOF9KRt2Sx7j1xGmNBTADo0MnJyYFpmvfrun6XaZq/a2pqSuvM+9f/890JLp/X1rFbTrsMLj2xt781jjwKQosdA5cU2JYaYqF0fE0tEJ2zjPd6iAkA9QqaEAIAogBsDULvW/rXX1M3AsJGXeYSCBcPSvhAV2cWQ013xXxNKALtTQGWRqcTAsbCPbBkcwGDQUwA6JBpamqCqqq/drlcv1JV9Z6cnBxbLVD2yNFo3LJRtu3c23HCYFkwLzoJEcWb0LGWEPBpAahXxd8RrkHROBEwEagCoQeenWhWVzIW1D15JUNA3ZEQ2J0H8NJJ5wUCpU0pHY0AKIqF1a/PgSkSN0c1pIpT01bjzJybEdyjYeFFsTt/JiSuzBwFQ1osjA6X8qcr4T1rGutt4ggA9Q52Gv9QY4NYeMtPi0PlbSl2hv+1ooEJ2/iHLB8O923B74suxrm5l0NFOzyZEiLOgrBCAutcLczmE4C+8gsGgZgAUN+SnJsnh508Y7Wl21jPRDcRPu2oBOzxuzDAU4Pf9f85ri44E9nuTTC/XgApKUuHKyXeRSxQqrWzkCUA7cOtkFKOYCSICQD1KWsef6afnW6qakRReuFNCRUbr9Bwd/97cGv/k9HPuwC6TN+/lw8ThWd7IGPlTwKw/Bp08BaA08n6KKJz37+DkSAmANRnrH/5udubvqy2dax1zmkIhxPj0b+glYprcp/A/QOORa7nDVhxljyWlsCoS0Ow4jzyb0JCE1wRyOmE14Xw4wuj+ratvONDTACob6hbWXqxraV/DRPlxxwPl+ncxW0kBEzpwVmZ7+KpIYdjfMrjUEQUHc3Jze1fCW++Gu+PosrissDOr7EFXCOH/cQ9egyzPWICQH1D/cZtk20t/SsMtB5+nHMbf6lirPcL/H3QmTg54y5YaIMFt733mgIpxfHr/Y0+PxQ2C45nbCgDAGhr1zIYxASAeq/mHduw+Y2XV7RsrrV1vPmjCxG0VEfGIl3146+DT8a1hT+EELshbTb8/00eBHIPj8aeBwAgvDcIXXAegNNZ1X7omzfUeqZMYTCICQD1XtkjR2P7a8uPcCXZGP5XBDYeex5U0zl73FtQkC3CuL3frbh3wPFQsBcHsvxG8fkKrGjsbr5LClR6oyx0DidcKiKzFnJ7YGICQL1XzZoVAIDWsiqPnTZPJrmhZec54rcbUkWyMHBR1l/wh8FTUOhZBFNaONC1twaOK4dIiT1yIBSBgD/MWQBO51Kgv7crw9izjdsDExMA6p36Tz0aZR8ukuG6Nhstpgn9xktg9PHmS0LAKwycnfEe/jpkAo5JfwGapXbbpWaEBPqfEf8WSZk3DFUyBXD8KIBbpEbe/jCFkSAmANRrfXTLX6XidnVcEFNUfHncpRCy785iM6WKI7yb8MeBx+LUrF8jbLq7/zN0FQO/szfu9kvNLQGoCi9rp5MhHaFb3tWjS5cxGMQEgHqXUGODmPezn0zQWqK2uqORoWMAs2/e1oxIL47w7cC9xWfgh/0ugEC4Rz8vdbQKS4+dAahSYIuXuwM6PwOQSPnHxa3eE6cxFsQEgHqX5Nw8WXT4MZ/YOjiqI3DBKX2u9x+VXozy7sbd/W7G1YWnId1V+Z+le3tS3ig/4I596apCoCLYxgLodEJAe301pJQDGQxiAkC9rIMiUfLvVzLsHOtOATYfd2Hf+W0Q8CpR3F5wD37c77so9C6EZqUj7rh8t1+0GgpnJMX+OAEEw3wSICGusQYN2seLjmckiAkA9SqfPfzQnwJlrbaObbv4CqjBUJ/4XaZ04eeFf8MfBxyFQb5XYcmkg/4dLF1gxAXxh/kDigHBZwGcz6Ug/Pj7ES4LTF0uQgwB9YSWDdUXqx4bk+AME7WTp0C1evf9f81KxoXZL+L49H9DFdWQcAGHqJGVUiBvSC2EZwBkjLkAUrOwJyWIQTIZXBjQyd03AfdxR77lHj2GCQBxBIB6BynlwKbNuwbbWvrXJ9Ay/LDe+TsgYEkXxiWvxWNDjsJJGb+BIuq+bvwPceaeDKgeGeeiFljva+coQALQP9vIIBATAOo9Nrz47KJAZYudTAHaHTdD13tn77/YVYOHB12CH+VdBYFGWPD2mu+mqiayJiuQsVb+FUC4NgCT/X/HM9fWSKN2zzxGgrrUkWAIqDuF6mu8737/lyNVr43hf48LG0cdA6UXDf9bUOCTJm4pugz57m2QMHplniwlMOxaBXWLLQhvrNELwK8aSDd5iTuZ8HpE+Kk3OeuTOAJAh9buxR+I5Pz+0eDeho7HniVg5mdAT07tHT0pKEgTOq7NexB/HToBee5NkDCBXjyMPuyIHRC++JdwMKrxJoDTeVRYX7ZyVyBiAkCH1tDpp8tNr74q9fZIxwdrOoI3XQt5iJettaAgSRiYnjoHDw2ZiHHJL0GzlF7d8P8naYkKZIyNfwlvSg1wWeAEIKENYBSoKzg+SN1XEUl52MzRp0CoHeeVSn4yNo0/Fap26EYvJQSOTV6N7+dfAUt6EOpjw+WWqSB3TDvaNybHzFf27m2ByCr86n4BOZa1q5lBII4A0KHTvGObePOii1ONgGHr+PaxU6Fo2iH5rlHpwZG+Lbi3+Cxc/HXj31flnuj5lu2BFVS6IyycTqebCL30apiBICYAdEhkjxwth504/TOh2BhyDkUR+v4ZEAd5lnpEejHMU4Xf9rsGlxeci1R1z0FZurcnDT2hAVKJvTugIgQaoyEWTqdzqYi+8DknAhITADo0pJRpXz7xmq1jPQNTsH3UwVvB1IKCbFcrbiu4H7/ofxwKvZ/BOAQr+PXIBSzDyD4hThIjgPpoCCqnAjqbANBmZERXfDKcwaBO5Y4MAXWHD39919/05igUT8dFqvqKn8IVOkg71kmBG/P/iRHJ/4aACU2mOyrupiYw6KQQNqyMncvvVSNQIbgmgNMT8KiB4O+ei5rVlVCLOCeQmADQQdS6uf4CO40/TBNN48ZC6cGJaRICEcuHH+Y+jiNSnoNHaeoVq/f1yG+1FORPaIE0cyBi3QkIGqjKCSPf9LKQOpkpkfzzSyrUogEc7iHbeAuADrwRknJSS2lllp1jRY4PbfmDe+y7WNKNY1I+w7+GnIaj0x6CW2lzbOO/T9pgE5Ye+zUVAls8fhZSpxOANu8TxoGYANDB9dlf//KB1mJjspllwf/7e2Dp3T/7X0IgX63FgwPOwkW510JiNyx4EiL+SclBZEzxxNkeWCBYH2QhTQD6/F3SCjbezkgQEwA6KFp2b8ne+dpn+Yq74162SPNha7/R3Tr8LyGQpkRw34ArcWfxd5Gk7nJ8j/8beZUhMPxaEfdx/6BqwmJRdf4ggM8rQv98hU8DEBMA6nlb3polsoaObY22tNtoqSWiQ4tgqe5u+WwTKlxSxfV5d+OPA49BivIFkKAT3aQlMGzyDghX7Nu/pm4iZGkssE7nViD09J8wEMQEgHrc2Asvkqv/8bhp2tjNT0SiaLnppwfe24UCnzBwdvrLeHToUIxOfhu6NBK+KAuXAk9GnNekwBfpASh8HNDxrNrakYwC2cWnAKjrPU8pj38872i4fB3PMBfD8rGz/2FwaV1fsEyFhSN963Fl4aWIWi5ELB9Pwr5M3mUhZYAJrVn5xrLAQgC1Da2AL4eBcjj9w50MAnEEgHpW845t4rWzLshRPTYm2kmg7qiTu9z4R6UHk5O24J7i03BJ/hWIWsxbY8V40FVeWFqc2yBRC20unXFyejGIGojMeY+PAxATAOo52SNHy/4TJ78j1I6HlUUojOB3p3f6MzTpwZikCvy631X4YeHZSFbrITmMHdfIkyoBNfaywEIAEd1gkBxOeF0IP7Y4El26jMGgDrErRV3racjQwJmjz7JXyMYWoqr/GLjD9h5HM6QLRe69uDTnSQz1vQBdJkOXKQx6B1QRRupoF0I7Y0/422m2o9Dl46qAju7SCSjpGad6T5zGWBBHAKhnLP7l3Y/qrfZmlldedQtcYXub0kgIXJ/3BO4sOg4Dkt6ELn0AGyxbTF2gcGL8JzJ2u7gvQCKwapsAABwFICYA1CP8O9vOVTyqjdpIomnYsA53/jOkG1fkvIm/DDwW41Meg0yQRXy6lRTIOQpx5wHIVg2tfBzQ+cWgOQrt88/XchSAmABQt9P8Lbc1bLAx21hKKOP7oT0tL+4hISsVx6V+gD8POBuTU38HVbRDQmWQu6jfMREY4di9fLcUKPVxVUDn1+oCkdkfTmIgiAkAdbulf/jT76yojWf/LRPldz0EYcSafS4wwFOBJ4ecjAtybkaSujNhlu7tSWkZzcg6yhu3YfC3hHgTIAESAOODParVVjeVwSAmANRtWnZvGVIxpyRdqDaKTn42apOyvtHg+KDhD8U/wi/6nQ2Jcjb83ciMChSdGf92y16vBlUyBXA8AYRfmG0yEMQEgLpFybNPi/uHjm0xIjaWG7ckAhP+uyiZCQXJMPDjgjvx4OCpSFVXgZP7up9lKhg8uTJuaKMBDSHwcUDHkxLuiVNeYSCICQB1i0k/ulaedfc9LdLquOFWtAiab7gZJhR4IXF+5nP465CjMCJpHkwpWfR6UFJ/BTLO7j+qBNalBxikBKAtWzGaUaBvw3UAyLZAXcXtT484X3ozUjocQ5ZHjEB1cj5OdC3CRfm3QJcGwpZgw38QpGQG4S0shFZvxlgWWKC+oQ1IymCgnJ4AzN8EKaUQQnCojTgCQF1Xs2aFmHPtbX5Pqq/jG8imRObZo/GXwnE4N+9n0KUJcOrZQWMZwNAbvXFHAaKGAYNtguPJhii0jxffy0gQEwA6IP2nHi0ziwb/y9bkP1Ug/NSH2PZKDtwpEmBjc3ArfktgzPQyQImddBmWxekXCUB4XQj9bnZQW7uW2TcxAaCu89fvmlI2d6Xt4yMtEhsf9mHWqSNRvSYHws1n+w8mlycKT3acy1sC29HG7YEdX7sLuKcd9qBnyhSme8QEgLruwzv//Hd08qEixQ1otTo+vSEN868YhnAghXcCDlbvT0ikFMR+WkMA2KC281QkAKOkFACgrV3LYBATAOqa4K6244Sra8VFqIB/UxRzp+dh+W8GwRRecAy65xWe6Yalx1kWuCmKsOTjgE5nbmuCUbZjvmfKFAaDmABQ54Xqah5rL6s9wC4pIE2J2gXA2ycUY8NzxVB9fAilJw3/nh9mJHY/X4VAo1tnkBxOuFwIPTO7iJEgJgDUJYvv+sNN8WaUd2U0QIYNbH3chdenDkL9+lRAYTHsCRk59Ugd446bkDWHQhC8EeBsbgXGvPJ0fecmnmhiAkCd6Pk3NmDn4vmTa5dsV4XSvfWHUAEZMbD02hy8c+YQRMKZDHg3M6MCuZPj32rZnhyCi8sCO38UIMMzODrvE5dZXdmnvndt2ze3ti5tbOQJZQLQ++1paLz+zQ0bSj7Yvq1ESjm0L/6G5Nw8qDLlNilt3q+XXbivLwC9zsD70zLx0c8GAqoKrlvSPSxTQdGUZsg4kzfDzSFEuCyw48mGIHwXnFWiFg3oM995fU01+mWkw9SM5+dv21ry7ubNJbVtbVtG5OZiUekOZq3dlRwyBN3j5ZIScfnEiflPrlr58y0B/6/XtjRBQEBKiUyXC6PSM9b9YuIRzwzOy32itLFRjMjN7dWt3Ortm8WRo8bJ9274uayZv77jNxgmQmcei6TKKqjryyA97i7UVIAlFYz5cRTjrm+DSwYA9lAPSFtzDuYdnwJXjMUbLUtiYnF/jA2mMFCOzgQlkm6ZhuTrfthnLqZtdXUPzq0o/9V75WUwICEgYFgWphUUYmJm1u+umHT4fTyxTAAOufuXL8VvTzgR/167alhNOLpz8d4aeGLc05YApGXh91O+g3mvva7+7dd3Wb3y97z9Kn57/mX41avPDC1MTd7lu+oxaaV4OiwnrmgIny38GKZ0Y+Ti55H94rtQWgOA2oVBJguQqoqTnmlB/vjWrxYS4qBAl3hSTbwyeRRkOPaEv2JfGo71FDBQjh4CAERxEjIXPu4VQmi98SvWtrWjX0Y6NlRXjV5YXn7/qxXl52d6Ytc7IdOU5/QvElPzC6efPnLkkkWlO3DaiJE8z0wADq53t2zGuWPH4c+fLi+ft7d2kCLshdMjhHnTyLHPnzt+3LWflZfj2MGDe8Xvmbl4Lq6bfhbue/tVObd8OyZsqsLkD0rjrii330V5ypEo+el9UI2v6hdLUTH+vSeQ9sJcQHS9mHlyBE6YGUR2cQMLXBeoLgsrZo5D+b9CMV/3JntwvnsQLGZYzmZaSHnu6lO9R53wYW/9itWtbfLaj5fIsGXaqjAEgEuGDMUNR0wR62uqMbE/H3boLM4BOAD9UtNWX7FgnuxM4w8AmpTqI9s3XXPDkkWyOD19ZW/5PY3h4KdnP/mQfL9sG3RVwbjttbYaf5gWao+d/p/GHwAUy8Tm7/0Em55+GuHTpkIJhLv0nbRGiSXnp2DJTYMR0bKgqBYLXmfqfUPBiOMr4idukShUwX6A82t6BYHrH2vTt23tVSf7/uVLRTAYvPnyOe9uumjxfNht/L8e2MBLu3fKS+bNketqapZIKZNeLilhYWYC0LPqWluuu/PjD3fd+PknU6pCQShdqkAFtre14vxFC468duH8N5ftKD0dAD4rLz94F9/brwopZf/bX3n6jsufflS+sX3jMfVf/57caBSpu9vt9TItDS0TJn/zF1omgpmF+PInD2L7U48gMmE0hKZ3NkwAJJrXSLx7dCa+fGIANM0HoTARsCspz4CIc6ULE9gq2hgkpxNA6MfnrHGNGj1+5uK5vaaR3OL3X/P9xQsfqdK0cR6l88uFu4Qi9kbCeKps1yl3Lvs4LGHdBHw1iZBsVq9ks7BWV6c+vmnD5PXtbUvd3fzsuiIl7ph4BEZmZQ8amptTcTB+z3lPPpSRnZTSur6p7hu9wOkrt6H401pIVXSYhoe/Pw0ll90Fxfj2xt1yeTC0ZC7yHn0OSnN7l5//l0LBkY9ZGHxkFYRicn5ARxe5KvDWcQNhhmOfP2+OD+eZRQyjwzUNceH2C8ZhY/munF33PNp8KL7DvqH6rfUNv3nsizX3bw76u9iBii1smvLC4oEiWYiBNx11dM0r69ebV0yaxJPPBKDrXi4pwffHjnv/mkULpldGI0k9+VluRcEPBgy64copU5/qsRGMur05t895fVepvzXDivHonpASlz2zAm6/jflCikDJU88jmpFtv9BJC8Ur56Pogccgk7xdT5o8Eie/HkbuoDpYJgez4sZbkfj80dGoeD4CocbqRQmcmz4UKqsDR/NpFi7/8QDUCgWF3qT2351yzqWHjxo7/2B9/lNrVuP6qUfiL59/Glmwt9ZryZ5JOSUAr6LgwgGDcf2UKWJR6Q5x2oiRzG9j1aEMQXw3vPmGkFJmvb1p/Ztnzn3v7IoebvwBQLcsPLOn7N/XfrAgsKmm5k0A2NzQcMA18yPzZkNK+atbX3t6ww/efKZxa1tzzMZfAigMReFpj9r6u5bLAz0to9M9+IrjzkXJrFlou/B0qEakS7/J0gQWnZWCRTcMgb89l/MD4sXbEhh7aTOsOI/8GwLQFdaPTqcrAhObIrCkRHUknH7TvDfm/fz1Z+rLqiqeBYCKhroeyQC31+4VAGBFtXlXLZwn36up6rHGf1+vVrMsvFC2U16xYK4sbWp6jWefIwCddvv77563q7Xl7XqvBy6X+6B/fsgwcMP4w1CcnHzO6UOGznll6xZcPmZs5xsAKT0zHn/wnJBlzgoa+rcOuZmqgsvfXY2k0kDHpcMwEbj2LGw66ycQXbygLdWN7PrtGPjkP5GyaiMsr6dLf8cIAeNukRh9cR18GWGOCPxvpq9aeOuU4TBaY68KdFRaIQYrqbwN4HBLR6TgT8dn/efSlgA0w8Dt074LX1t73vmnzei2pfY+2LgRp0+YgEcXLpzcrIq1c3eVyrS8/IPe5kQtCxOzcjC1X79Hrhk3/pbPqirFscUDWNSZAMT2zCfLC9bW7937RUOddAlFKIoKV3bWQQ+XEAIZGRmwXC5ckl9YedmYsQPrAgEUpKZ+6/sqGuowMK8AZdUV6eurKu7+16qlv2wxdFvfPk3TceE/PoW0MftfhYHlc5fDFQ4e8G+1FBdy6rZh+F2/hdIW6HKsLVNg4u8lRs2o5IjAfmVJYsEPh6B9S+x6z9svBRcG+8PgKoyO1tzPjQtnFMJrffM8K1Li6sOOXDUsr+CMUyZNbflowxc4+bDJXfqcS158Hq9feRXeW7dOPrjqs686HULAk5V9SPb+SPJ6kJqZJSelponfTDxcEVxulAnA//r74kWixt9+2JctTSUhw9g/OEJATUmB6kvu2pK3neuxIyUlFSmpKRBf99allHj8iKnbC1JSRtv5G42tLVXXvflswd6A32X3GW8JYPieZhz/9gZbxwcPG4eNv38IwrK6rTiqlo6CTZ9hyD33wVB9XQwg4MkWmPqIiUETy2Bo3HUQAEqe7I/tT7khYoTDEBJXpI/gCIDDeU2J028cBN2w4lw6EllJyfjZkSe0nzXlmIx9K4J25bMueuG5aFU46BH/M+KoeDxwpWcclN/rcrmQlZkF8fWCZBJApqJUzjzm+IEsDZwDsJ9fnDr9e5tqqksaqmsQbm3dv6GXEqbfD725CZamHdDiNt/W8Hu9HuTl5SEtPQ37XThC4Oktm0bFe+/7qz8DACxZs+Kcc/7557kn//uhoupAu6szC7xobhe+8+VOewfrJgLTjuzGxv+ry9NUXKiedDJWvjUfNZdfCtXUOj/LXwBai8SyixQsvG4kGnblQnWbCV+++5+jwIzGDqZqAlXeKCsBhzMlcG5D8FsuHYHWSBi/+Whu2vUv/1turCh7tCufc/d775RtqSh3h5qaYWnafnWZpWnQmhpgBAM9Uo9+VV0KZGRmICc39z+N/74er6UoA5aUlWWzNDAB2M+Pn336tB0VFdDCYURa29C8pwJGOLxfIyxNE0ZbK7SWZkjT7JYCLKWEqqrIyspCZlY2FFVFrA149Bj/tm/izoi8gun/+nB+6O7lC96ri4Rm+NyeTg/vDGn3I3mbvWf/XYqOsunf75mL1zJhKh5UnHcF1s2ahcjUsVBE5x/3cyUDzWtMLDk/BZ8+NA5hvy+hbwsMGFMOV2bsuSxCEQgGIqwEnJ4AqALHbwx0eFySyy3W19fgsXUrfnbzKzPlgnWrfwsAry5fYqtamb/uy8FmKCyigQBaqqoRbGqG/P+dBQlY4TC0hnpY0e5LPIUQ8CX7kF9QAK83KWY9GjFNfFa/l4NdTAD2t7a2Gq7/uT/VXleP1spKWKa5XyIAw4De0gyjrfWAbwlkpKUhJy8PHq8X8Xbe08Ph/T5n5uK5AICBeQXyk60b5OWzn1/0/PpVPusAEpLizbUwPPaGy5sumAFp9OwdJCEthNV0lPzqIZQ8/TxQkNalv6N6gcrXwnj32DxsnD0cibpwgBESKDg9/vkt93B7YKeTAiiq1uG2WevvSwoAACAASURBVGcluVxYWVeFuz+ae99trz8rLzvhVGlnd1DNMv9fcqkg0t6OlopKGMFvLklt+NuhNTV+1aE6AB63C3n5+UhLS49bj5qmgUgggCyPl4WBCYA9lmmhtbIK/ro6/O/9LEvToDU3wQz4OzUaIKVEss+HvLw8JKWkxEwihBCIRCJorK9Hc1sbMtSvKu/3V38mrpt+Fl5ftnjp6Y8/0P6LebPg7sIqWvslGKqCEaUN9kqEJbH36FOhmPpBib+QEuH0Aqz+5yvY+eB9cKd0bXMgNUlg070m3psxFLs/Hwp3UmJthWvqKgZMrosbu7r2wDcSYHIen26hswtpqkJgeXU5pj16n/z5i09ussLh73Rw1cb81/aGBrRWVsHQovvXl1JCb2mG3tIMyzTQmelpiqogJzcXmdk58etby0JLUxOaGptgaBrGZWWxIDAB6GQjGY6gqawc4ba2/RMBKWFGItAa62GFw99adqWU8HjcyMnJQVpGBkSMClcIAV3X0NzUhLbWVux7ZjZL/aqR96rq/bfOekE+tGbZtFYtmtYdlfYwfwC+PQF7lUGSRPuwsQc5+hJSCjSOOBwrXpyDvVdfBlU1AKtzmYBwAdEGC6t+bGDeVaNRvzkDLm/izA9IHytg6fHmAUjsdAV5oTu90teBU9o0dLbUK0IgYhpY0Vg77rSnHl758Afv7bJ0/Y7Od6hMtFXXIlBXD2kY+yUC0jRhNDfD8Ld9fctAfOv3SUtLQ35ePlRVjdvwB/x+1NfXQzeM/yQzxT4fCwITgK4Jt7SiuXwPTE373zYKRjAAvaERlv7NVfQURUFGRgaysnPgcrtjDlNZloW2lhY0NzVD1/X9Eo2wpuGv896Styx+967PKncfcK///5u8ZCsMj42/JyXaLp0BQ/EcktgLKWFaAntmXIZP3/0IoWMOh3CLTo8IqEkCrV/qWHJxJj769RiEWnxQVOffGigY0wYpYp9nFQp26+28wB1OAjh/RzsMpWu3e1Qh4Dd1vL7pi6FTH/nDn3/0/ONnrFz/ZWanrmMhoIVCaK6oRLS1bf+6UAhY0Sj0pkaYoUDM0dEkXxLyCgrgS05GzEWFpEQkHEJ9QwNCodB+9aiA6Nblh5kAJOJFJCXaamrRWlX9jQIqIWG0tf3nvpYEkJqagty8PCT5fDEbfgEg4PejsaEBkWj0G7caFCHw2uYvMWvbBqR5vN1ael2mhdTqkK1RN+FWsG361VBM45BXY0okio233Yd1z74MZVhml+ZiuJKBvfOimHt6Pr54epjznxawDPQ7N86ClgIIBiJ8NtjpBDB4YwQ5Bzh3SRECLlXF5uaG+b9ZOq/po5K1czv9VRQFwZYWtFRUQg8G/zdLgBkKQWtqhBn5ajK2++v7/OnpGfHnS+k66uvr0d7uZ1lmAtDT9amB5j0VCNTXf6PRhiVh+P1QTQOpaelxM+FIKISGrzPVb2/yur+HKgUwpNkPV9hew6elZsLyJPWqcxBNSsfnf30NW//0ZyhFaYDetUZ8xz9MvHXScGx+ewBcPmc+LWDpAqMubI47YtLmMiBYbTqeCaA41H1zeAKmodz54fsz/o+98w6Tqjz7/+c5Z/rsbG+0haUqINIRVBQEC/aKooldY0w3iUl+6clrejTRGN9g3mhMsDfEEkFQFEUUUOkdlrp9d/rMKc/vjwWisqvbd3bm+V6X1+XlrDPnPOW+v3e/7pG/ys27tr2aMNv43VISqqqmcd9+rOSxBpAdDmMn4gQCgWPl7BGyYJnU19VRV1erNlgRgO5FMhqjdtdu4qEQSInQdXSfD93rwTRN6quqjlH8pmFQV1NDYzCIbfeMwpGaxuTlm2lN8rdImgS/OAeZgu4zYZkEh45ixV+fouor16LnOMFq25oKBxgNNut+rvH8pcdTtT4Hpze9PAJSCvLLahGu5vdQxi2qhCoHTHvDRRcMqTQ61aTQhGBT9SGuePL/Zjv1djTfEgLLNGnYf5BQVRX24fwA3e1Bz26qAKo+cOAYeiptm3BjIzXVNU1hU0VgFQHoKURr6wgdqkTzeBCO/8ZaY5Hw0YQ/KSUNDfXU1tZimGbzjLabUByK4NrZusQvzQObzr45tQ90IsmuWVfy5iMvET37JHBobQ4NaC6IbI3z2rwcXr7tOOKNzrTqmen0g+6WLQgEwSp/oxIMGYCzK2MktM4/2D6ni46YM0IIkpEo9Xv3IQHhch71WAkgEgod9RrEYzGqqquIxmI9KkcVAVA4CiORoHrDxmN0RlOcP0h1VRWJeKLHD6wtBAN31iEdrTsG9VNPxhGL9gY7Fz0RZ92tP+a9fz6BnDa0zdUC0JQoWPdWkhfO6cc7fxiOcKVHS2HdYVJ8qo5szrkhIHIghJqikP4Y+0GEhDN1laYQgvpdu4nW1BzjJbAMg+rqaoLBoLL4FQFIQRUkJZHKyqOHVprW4Th/LGWeMenUGfXBntZdxqRJ48xTEbbVmzYB2+lm5Xf/wtbf/go5ohQRb3vcU5qSin8lePr0MjYsKOn1+QFSwsCrQbaQx2kjiWiqdXLaGypScFYw9ds/J+rq/+s9tSzi8Rg1tbVIqZr5KQKQwuw1HgojLQsrHMZKxLGs1BKqx9fU49zXOkKiu2z2T5rVOw+5aVA/5ARW/PEx9n//q9AnF9q4F8IBZoPFut95eOq84zj0UQG6u5daHhIGn7gVPaC3+HnMMNQlTnMkHYKTNqV+3wfLNJFSYiUSWJEIlmUpd78iAL1AzpomVjSKtO2UdFINfHcvlqt1vQSqvnB5ixZjb4EzGmLvtHNZ+ZcFhK87B9qReKk5IbknwRvXZbFw7jCsuOiV+QFWUiMwouUHX+8Lo6u2wOktnzQ4/lASK8W32TIMrHAYmUyqTVMEoBd5AVK4raqpawzYV9865SXh0OQzuq31bxdvClo0yIu5GouuOoFkDrRnMrhwQGRTgmdmDGTZHYMQblevWgbb0ig8LoxsgQPtq6lH1xQBSHf0CZmYyppWBEAhszCqug5Xdevif1pAJ9xnUK9X/MQaqVr9OJuW/Jp4pJoav4dHL5/IW7MGYrkloq2JggKkJal6XfLktAGs/2cfXAGr13gESs5yYrcwHliz4ICuygHTHf56i2kxAxVNVwRAIWNcE3Dia1uwWpP9b9nUXHcFtuilGfBCAzNJaNsbbF76e+oq18PhFsoCwJZsH1jIv784me0nFmJ5RJs9AkIDO2Ky4R4XCyYN59CabND1lF+a8qkHkVpLbYGhylYEIN1haoILdoVQ0R5FABQyBJ6EifdQvHWtf70626Zf1buy/49CEt+7ls2v3sX+ba8dVvwtNMCxbN6aNIgnrhxL5fH+9nENB9hhk+W35LHw0sGYhie1l8dKUnhaC2NRhaA2EkFTJVZpDVuDE96L4VQuAEUAFDLgwgvByP21CLN1Nz5W2LdNY45Tw+h3YFRuZteyu9n90TNtcsknNY2XTj6eFy8fSbiPC81qT4IAxHcleebUUpZ9qwxbuhAi9SSsmdAZeubBFj/f54rjUKZh2sMpJT5LdX5QBEAh/aFrjF6+vXV6LGHQ+MXzeo/i152YDQfY/858tr33CIl4sF3kRUhJTcDLE+efyFtzBpHI09tOBARgS6qWC54+rT8fPDQA6fSmFhGQkD3Cbr4hEGAHDar1hLoz6U4ATMmgiKXyABQBUEh39K9rxFHV+uS/badd1RtMfux4mJrVj7P1rb8QrNuDpjs7zpVMm239Cnnk8glsmFqM5dLalR8g4xab79V5YmwpB9cUpJRHJWew2WIlgI7gI29IXZo0hwQurIphqGoARQAU0he2EAzaUoPdyta/NWeciSOa2q1/hdAIbniJrct+T/XBjzpF8R9rIVmsGl3GY/PGsmdCPu0xlYQGQtgsvzXA8+eX01hfmBLr5/FGKDzF1ew7CU0Qrgyri5MBOHVNEEtX66AIgELaIu52MOKjva1TWEmThumnpGzyn9CdRHe/y7bFv2L/7re75TdNTbB03GCevWoUNcP86Mn2xU0TBy1eOSuLpV8uw7J9CK3n4q+2KRg0T7Y4LymiK9dwJkCvl4yKm2ohFAFQSFectPsAoqZ13bT0XCeVo05KQcXvIlG1nT1L/8juDYswjRhCdN8xFlIS9Hl4dsYoXr9kKJEid7vyAwSSmvcET4wv4cP5fTGlt0eIgLQF5eO2o7UwFMZImiRspRjSHaZDMPCQyvdQBEAhbTFw5X5sZ+v8fAe+eBXSTC3bz4oH2f/Gn9nx3kNEo7VoWs/5LF2mxc7iPB6/cAxrz+yL4RQI2XYioLtsNj/g5umTStm9qhwptW5vJCScOo5AS4RHsDYQUoIizSEFnFKdJKnSABQBUEg/WJog/1CodcpFCA6Nn4lmpYblp9k21e8/yvbX7yYYOoSmpU5TIt22+WBgXx69ZjybTu7T9m6CRzwC0ubdL8Pz55RRtzu3W6sFNIdFVrnVfB6AgIr6BjVyNQMwfl+UpK5UgiIACmnG7gVT9xxEC7dCoUugwEOsoLRnH1oIhOakbuMrbFl8FzVVm1N6/KcU8PbI/jx39Wj2jsnHkWhf7kSyTvLqJbks/Xo5DXXFaI5uyMGQUHaNBzvZwvpGLYKaCgOkO/L3mZxgqDHQigBkGCqqKwGwpTTSdZNHvLodqX++FScsi8obv4DssQYwTa706L6P2P7yT6jc/TaWbfaK8Z+6LWnwevjPlCG8fPXxNBZ72tVISNMl1SskL53qZc3fhpCIetH0rs0PGDl7F7Kl9sUCYlIRgHRHUheceiiiFkIRgMxCWVEJ2w7tr+2TnfW1dHR0BiIx9FArBXjAxa4pFyNkz2Sm28FKdi+7mz0fPoVhm92a4NdZcFo2B7IDPH3BaFZeWI7hbcc7CHD4YesDkudnlLBlyVBsqwvXwk4SOK7l0EpFIqTaAqc5TIdg/JpYRryrOsmKAADw7voPzpj9p1/sv2bB3/IPRtOv5tnSBOO2H2p17XpowDBEd8f+hYaMR9nz+r1sXXE/sUSwV1j8rfEIbCou4PG5Y/loRl9Esp3rKiVrv2vx/FkDqNzWF70LwgJWUqNkVH2Ln2/2RHAosZn26JcwsdN8m03bYkhRsepwlYkEoKK6UgDs2b/3j3c88dD+b7767JJGy+ybrrTQJWDw23tap4fjCeqvu7BbFb9IRKha+xRbl/6aWKw2Lc+cpQneH9KXp24az+4xBWh2O7wrAowgvHaRk8VfHkL9oaJOJwKFpzpazAOwaxOE0zNCpvAx5DaYFKT5WID6eIzL599t/Ok/z78PMH/xooxlthlHAHZuWJ/17Np35YX/fuCbb+7b1dcivd1BAw/VIUKtUxR6gYfd487pBsUvwDIJ71jB5td+S93BD5EivY+ibkvCDidLJ5fzwjWjqe3jRWvHABaHH2pWSl6Z7WPV/cNJRNydlh/QZ1oU22x+HxwItnqjKKQ3pA0X1URIZw4ggL3hRh5a9974q//+J/nM5g9PlTIzp16lPQFYtWUDAG9v/ND95Iply7+/+o3gr5e9hNuR/g5NSwiGratsdevfg+dejLPLW/9KjMqtbF38K/Zt+Q9SCDIpIqfbkhqPl4VzRvHKVSMx3O17d90LOx40eWZKKRueLUd2gt82K1BP7gRX80JTE4TroioIkAEyY87bjUgt/Xfapelie2MdtUbyjfPuu8t+a8OH39i2d7cT/psYnu5wpPPLVVRXirKiEvn2hg8rfrfitQH7gw1pEVtuLZJuB/03HqI19r8wTBpOntplrX+F7sCu28/utY+RiNb1uhHDnc68peRAlp8n5o1jyIE6pizbiUi0vQmQ7oOPfg5b/3cQY39kM/T0HRjx9l1rOynoN8dmy6bmPz/gSaBLgSlUc+B0No99dTZ5pk1QE5nyytQYSe589dm7B+Xk/yoYDm3OzgqMO6I/lAegl2HB8iUArNm84Qvff26BvGXRY/0PhBozSvkDnLZ5DzLaOmeeVuKjZtAJnX+5NB07VMXBlQ+z+c0/k4jVZ7zy/7jgMYVgU/9Cnpg3ni0TikDa7Zo4mKi2eftmePG6EVRvy0V3tZ3I2ZZG2fh9LSaMRkNxkqi58WlPTgF/PH37ATSJn2NlkCkl2xpqPaf85a6xf1y8UO7YtePEj+sTRQBSHEfc/Tk+37h7XnlO/nzl0oeX7tyC3+lqlcbRhJbSg0+sNiYslC3bi+1szRZLKm68EWF2onAXGtKI07DhJbYs/zMNNdsQXTCpL128AXFN5+1xA3n2hnFUDfJBO6xs3QsNa0xeuyyH138yimiDD01v2/d4+2ktjweWgg8Dajpg2kPCzLokpujYd6Qq7KTxmaTc63Tx2LrV3Ln85bX3vbrwQJ/s3Ikf1y/pZoSkFf7+2kvyrx+sRG+HlSmEi/pDDYhOcn053G6y+5Qe/m6Bs7AI2tnNzgyHMOsPIu3WZWILKbn2L8vBaMXvOXTWPvgwSX9Opyn/8Lbl7N36aq+s408FZCUMznt+He5w+yWptGDY151MvGELttm6uQmaS/LsnMEk9tvNSoeAz8McZ3+1QWmO6mFOLj+9FK/VvvMXDUmMeLxz+IhtUzh0CPJw9YwjKwvN422n8k9gBhuxItVtUpI/Oe0czplwkthYsYuRZeXKA5AqWLB8iQB4aOnLqy/839/L+9e+0y7lDyBlAm92VgrRM4Edj5OsrUEmk61W/rYQTN+yB5FohUUvwS7NJpmV2/HDpDmJVbzPziW/Vcq/gwi7nTw+dzxvzBmC5QfRnspBHbbdY/DsOcPYtnggDs/nC3NpQvmNnha9ALGEga1yANIeA9cnKO1A622319F1rbvb8bXStjEa6jFDYexYXZt/7v8tWyQvnv9HuXLrptchfUoHe72E3lVf86Xb/v03ec/qt8YdioRwaB15JYHLY6M7e9hVLQTSspoObCQCVhwzeKDV/7tT2gx6vaJVmbwiabD/9ts65LITmoNkXQUVb97HrnXPkUyGlfLvDDknYVdpLo9eOYGPppVge9pOBIQDEpUWq78tWXTNcVRvzsbhsT5DUApGnrkDWjg7hrSQSv+nPZK6YGRj+8cDO5wWnoCPVDgsVjSCUVuDNBLYsVpkOxKdnZouDoQa+fPaFad9/dG/y4Z47JsAC1et6NVEoNc9/PzFi7hp1rn+f77x6ti1+/a89frBCunW9U5/j2jIwognO/Qd7QoBSIkVj2KFIwgNrEhNm5l0UWOEc//+Xqt2V+R5WPGPhehGOy67ENixINUfPkdt9WY0FePvOjIAuIHT39xK6Y5QuzwCAFZMUnK+h2nf3YM3P9GspS9twXPnlGPUW80+x6RAMUO1bBQPSG+8OCabP0/M7pCVaBgOYo3hDnkDjgkB+LPQvJ8fApCmidHYAFIirAhmLNxpCcgJy5IzBwwWH+zb3ee1O352qLcmmPeqMsAFy5cwb/osdj/9SHhZxU4sadMVyh/AF9AhO0CwNobspta4lpHECgabEuiSDVhm2zuvmZrGuC0HW03t6oecgG60nehoQqd69aPUVG1CSqmUfzcw9STw6qnDyZ2YYOZbW8muSNLW9iW6V1CzJMELy0rpd7mb03+0kWTE8SmPjsSbF8eodzb7HKvdjQw3crAUBUhrjA0lSGoCj93+fXY6TZyFHpJxjVgw3C0VQFJKzIZ6pGWBncSKNTZR1078bbeuixUH9qDp2sFb/3FfuOLgvlvL+vRfoDwAXbepgS88ePdD1cnEJbXxqNRFNxWpCoGZlEQa4212Z7XWAyBtCzMUQhoG0owhkxFkO4fxOByC6/6wFLMVjWFENM7Ov/6GqrLxrT4umhDUbVlCzZ53MYyYcvX3EGxNUFod5IzXt+Ops7DbwYOlCa5CjRE3RBlz/SHM2H+/48Mny9n0PxZaMwU0tpRcnjMEh9r7tIYbyWm3DkQ3OqE6SIC0NMIhAyuRaFNJdqs9AALMcBg7FgcN7Ggt0jS6nHTYUhJwujipbHDsrovm+RQB6FzFP/t/l778lVe2rLtgXyzS7gS/jkLTnUQaEySiiVafp9YQADMawY5GmxhqvAHLSnZoW0btPsTkJzchHZ//HXqphzf+7xWckc+fi6FpDiIH1nNo/QvEkyGl+FOFCDh0xm/cx+jVB3FE7HZ1cLMN8A7zcNIPq+g/pQYjphOJ5/H8pBwc3mZIr4TTCwdQYrrVBqQxnIbkD/OKeTnQefssBCTjEI8Y2K30rH4+ARBN2f2hIEJKbCuKHWvypHbrXZRS5jpdosDr+8E95859qrRvv21LP1rNzDETFAFoK/bu2a1/edGj+UlJVV0ihpYqMRbhIFQTwW7FQJfPIgC2YWA2NgASaUSwE5EOM1VLE1zy3Afk7ahv1d8fvOla9px9xeeO/rVjQfa+M59ovFEp/hT2CJyxahsD1jXS3iR9aUhyJ7mYec9OvAUmz5wznPi+5sNQY72FHOfKVUGANIawYc1oDz84qbDzv1toxMI2iejnjx/+LAIgpY0ZDCINAzSJFapOibVzAT8+4/zNfbNzTh1VPqymorqSsqKSlNvjlMoBWLVlA5NHjGLrnp133rpwwbfrzWShLWXqKH8AaRIo8CClg2BNiNamz0vbblL+UmI01CMtGw0TI1rf9N874R0th07xjlqM1qTtmBYNEya1rPyFQEvG2PveI4SDB5BSKuWfwtBsydJJw8g6Iclpq3dRsiHY5rCAcAoa1xo8N7uMvudpFJ5osW9f83+72R9ldDIPQ5UEpi2kBgP3mwg6v6+PlDYeP7h9XqJBGzMRb7UMtG0LTQisUBArHkdoAitaAzJ1ulQmgR++9sJxuR5f9brdO6NlRSX+VGwtnFIegGAo+I9fLXnhmjd3b3MkpUz9+ITQSMZsosFYs2f34x6Aw6f+8JIb2IkI0kx0anxKCsHIimqmvbQBKyI/c3f1vlm89ddn0JKJYxS/LqFy/SLq9q3Gluk+LzE9vQH9aoNMfXcPuXtiWM62EzdpNUl90YKJkNQlX/APVW2d0xyWWzDn6n5dWi8uhMA0BZFgosmS/9SZ+rQH4IgsFQ4HVrwRmQh3u7u/LYgaSTmrfLg4pbTs/106/Yy7FixfIuZNn5USRKBHb+9Ri3/njuPve2fpNa/u2fb9bI+314kUTXcRro+RTCQ/saAOt4vsPn2OKlakBWYEKx7tMsEpAReS2S+up3RLDXZzvyMle35+JwdHnfZfD4AQYCaJHNjIvo+exhYi42YnpBsSTgfjdhzgxJUHcAfNTp3wZtuSif36MSzqUwudxtBtyR+uKOHlbFeXN40RAmIRm2TMwLbto7L0GAIgQNpJ7EjvmiuStCyuOO5EynLyzrp6+qxXj+i/jCMAR+Ihmyp2uSLx2KGvL3o8z0yDy+KROvUNcQzTbFLEXi/ZxUX4NEEw3oA0k936PEMbQ5zyz9Xw6cX1OHn/7wuwXJ6jtMGqrWDX6gWYVgKFNIMQTNtSwdC3qjrvwksYmJXDSY4itb7pfHQkbJjs5etjCnF0U1MfqWnkNSTZmzCwAU3XyS8bgLBtHHacaCzYqz1PSdvi6uPH8e1zLxVNodWee5ce++W127fs/dmyF/vvDzakVoy/A8ipq+e4dRswfH5wOPB73BS4HMjCPJ7KzcfZzV2xJOC0bWav3E7p2/uRugAJ5oh+rL7rARA6MljFntULiEdqlDs3jSGFwJM0mPZRBeXv17YrLPBpBDxuznOXYatUwHTnj1xwQ3+S3bTNpsPBaa8sJpkdwHC4cbsc5Lld9HXrPNe/jDqt9+ci2VKS7XJzSmnZ1p9eds3tDy558bWbZ5/X7RdJ764fWrVlg5h/3/28vf6Dn+hTT3zs/lXL+8RMQ6STm9kTj1NQVYNumXgsG4+08Oo6VnYWmz3ebu+7LGiaC7BlUBGRgVkM2FWL3hhj52//h4iEqnUL2bvuOSwroZR/ugtxwNI1tg0ooGpYDnnROFm18Q6FBaJYjHcVKgKQAV6ApSP9BB3dI8FsTWPgjt2AxGWZeKWNF/B63GzJziGWBrJKCEHSttjcUFOwZOOHX6yLhsXq5156vbufo8t3tKK6EoCaYHDUw2+9Jm976Ymfflh9qNTtdCqN010sz7LZ3reQf35lBlVzhrIzVMOm1++mvnKjGtGbYXBaNocCfp6dfTzLLx5Cwq8j2tnpTTMku4QaD5zukAL61RiK5nUBHJpGRaiB1dWHfnTpA7+T333ioctlPF7YXb/fpQRg/uJFlBWV8PDrr8ofvfHSuvtXLcfjUAqnxy6yYbJo/FD2H1iBrhR/xhOBHYX5LLhyHOtn9cPW2yM8BB/qjapGJANwQV2MpKZ2uguJgNgXDfPGvl1PXPx/f6pav2vbmx83oHsVAVi1ZYMAyPL6Prz4b3+Q965+s4NT+hQ6FUJgZ2ch/T7F6jMcmpSsKu/L0/PGsG1SEXq8Dem4AhK1MTUTIAMwZXWYLhq7ovApHIhHxU3P/uuUGxf8Te7asaNPryMASzd+9KWvPPqg/NXbS044EA6ip3sDmcMxqRZ7okjZJCJT7f44dMgJIN2qpWumk4Co08nyEwfxzI1jOVSejWa3rqmKoUkMTRGAtEccJoW7uEJICBAg5Gf0MBGkfb7SkcZL6w/t5/tv/+fArY88sGLN5o3XACz9aHWnvnynaOaFq1Y0Wf7bNt/2nUf/Tz6+fcP97x3ci9eRxnF+KRGWhYjG0BqCiIYgRJpva2kaJqIhiAhHEYZJyg1U97ggJwAOBwqZC4dt0+B28/LM4bx61fFEA47Pzw+wJXVGXIUB0hymQzByb7xL5Ci2RCQSEAwj6oPQ8Bllfo3hpr9LJMG2SXfnkwV8UH1w2s0vLHjkiZVvSE0yADovNNApEv+CySfzvScftr+x6HFhSRuXrqfvjtgSLRL9RFcq+TH22iJpBTAtMGNN/y4EeDxIV2ooXQng9zZdyFCkiYUrZKxHYL8/iycvP5Eh1fWc8sL2z7QVVmeHGBD2kfvooAAAIABJREFUY6q2wOkr9jQYuz/Jw8PA0UnbLKIxMM2jSvyoXPwsC18IhG1DPIGIN3kkpNMBfl/qGVadSc51nT+8vRRd0/YseGupLCsq6RTjvUNfIqUc/7V/PvDymffdJZdUbBdWCvVi7nwqZqOFo4hg6JMtKTvCfGMxRCiMSBqp49YSArKzmsiASvrJeGwvzufx68YTzXG1+DeNlUFsdVTSHsfVJIh3MA9AACIWRzSGwDA7xYIXhz2sRONpvweWbfO7d5aKuQ/eIx9e+srrAAuWL2n3prSbACxau2r7RQ/8bvXb1QfObkwm0jrOL5IGIhxBWlbnK2pbQjSGiERT6p2lw4EMBJrCA6pHQMZCSElc0zlY5ke0wHt1Ew66VAfJdEdWtcWUuNX+s2TZyGAYkkbXnFXDQATDTaGBNIZL19kdrOePq9+c/tVHH5TrDu27pFsIQLSxwXPPK89NOv/+X8ufLl005FAsgp7uCRlJA2JdzCyFaGLDoUiKvb1Eut3InABC5QdkNA4Oy0ez7BaOryAci6tFSnMYOsw+0L6+D8KyIRTu+tCilIhQpClMkObw6A6x6uBe/lOx46lbHvqLfGzFskkymfR0KgE42sinvvaJ6x/7e+XjGz9YVRWPpb3iB5qYajcKNmHbiEgs9SxuKbH9XmR2FuiqnDMTsaW4AOlsWXjv0aPoUnmK0hmWLhj/XrRdCZ8iHOleuRaKpHVOwMfh1DQ+rKvi3lXLV93y6IOV8Xj88fmLF7Xq//1cs25AbnHgt688Fzz3//6EFCJzsn1FU6yq22GaCMNApqLFLQQyyw+mhRaNIVWiYObAlFQPzqFgZ/MW4P5oGKdfw5KWWqs0Rk7CxmnLNjUFEpFojyTri1gC6feQKW0qTGnzQc2h7FkP/OaKHIczKMPR74gsX0ObPAAbK3YBUF1VOe23Lz397Ml//knwqY1rm7IvM+igi7jRcz+eNFJ7cRw6dk4APG6VH5Ah0G2bfUWBlgVJ0qZCRNVCpTk8cZs8Q7ZNp5o9RAqTSbAza380ITBsm+pk4qZZf/99/W9efPrZ6qrKaQCrtmz4fA/AgfqgWLtzq33Rv/+KKWXGKf6jMJI99tPSPJxsmMoWtpRItwvcrqYkRsNEIY0JMVDdL4BmHcBuJhPcIQXbXRGK46qpVDpDSriiOsrdA7JaVw5o96AME6KpzNDpyMj7GrYsntny0UUvbF130ZsbPmTS8JEan/KHaPDfRj4vvP3Gt//+/uv2zc880qT8FdoEy+VEsz7JdoWUVAqtTdmWWm9be9+R/ABdHYI0RmVeACyrJdODcHVYNQRKdwIgYM6yBoxWlgMKu+3Wv5ASw+c9xgDSgTanSSs9hiEl33zlKS588I/2X1989tvQNKfnCFGgLhT0PrlyefS+NSvwOV3qlAOEowjLauPlEPgNg+yGBgqTSWIeL/EsL/tcnrYJRiGQOYHed3iFAMOAWCIjsnA7xZzqRSEUU9e4ZNkG8ra34Or36FzlHqzGA6c5dEty7Q39ONiahGApm0rz2mHBFtfXE0gkcGkakSw/FT5/20+Wz9vUKEgBgIRlctGQkdx0yhm+/sWlMQdAfiA7Bojfv/jUB6/t2X5iTSyKlumxXZcTolab+vcLKYk6HEQLCzkgxFFLvs0r6XD0TuYqZdOzZzshnoBEUjHw5gSiy43m8aE7XZiJGDIRRxrJlCcDmi3ZXl7EpO17mv3cipkE3QZZKIGbzrA1QXGjwcH8VoR7jnT2a6MckEBlXh6HDktQ0R5SKaVS/kfXU5Lj8jC+uPzDn15y9difHlE1R/5g6UermTlmwliAnz/9b/nC7i2ZTQLcriYl1k4F1hE3vnT38lG9H88PiMWbeikoIITAOWgEWnbef3nmYSFp11aS3LcDUtiJrknJ7uIcJmo02xRIA94JNHBmqFD5ANJZmQiYfTDBewUeXK2Qc0LXkWb7coTEUTrQDng9arMOK/+J+aX88tKrZ+cHcpYsWL6EedNnHb2zAMwcMwGAXz6zgB9ferU4d8DQMbMGDSNumpl5l6WEZuJQXQ6PO71i6V4PMpDVlIiTod4AaZk4S/rhHjXxE8r/42dNKyjBM3IiroLilO5kZjh17BZcv0IIGg8GlfLPAEw8ECXZSjFl+73QzePgBTQZIRmMhGXJSaX9GZNfPOb+674s8gM5S4Cjyv8TBOAIfnjJPACmHzdq/f9cco24dczkvw7LKSBpZV59r3Toh4dMdNMPOh3peWg1gfT7IMvfRG4yRUNIG92XhWfURPTSgaDpn004HU60AUPxHDcWzR9ISSKQ1HUaC5wtjr62bUlMU70A0h39tiYZaLX+Iku/r9tCXEII7OxAxu6NYVuUB3K4deyUF+6bd7OYOfi49Z/tYfkM/PKZBfzwknnc+/JzO5/bsbE8mIhnXGhAmBZEY11qwQqXC9ubASVUAkTC6FB4pXe8p4a730BEQR9oz5AsTYOGWhL7diLNJKkSGpDAmMoaJi7c3Ww5IMBZgTJyNZVMnM5wGJJ7LytkYYG3bdciFOlSYis1DZGdlZFNymwpCbjczBowZNcPLrpycGs9JZ+LjRW7GFlWDsAfFj0lH9vyUUbmB2jRONIwOv3A0gMuspTQkfEkJNJviIwzJx994PDOOyO1lcT37kCkyBmxdcEN81chWyhuHVCUx6mJQiw1HjitsXqwlx+cXtDmiXLCNBGRWKc7AqXfB47MLEW2pOSKESfw3fMuF9DU9GfyiFGfr9Na8+VHlP/8xYvEHeddJi4fPPKMWQOHETGSGXXDbZ8HGfCD53BZn2xfZqqQEulyIrN8EPBnpPIHkB5X03o6nb3fGyAlQtdxDx2NPmhE5xKlwlK8oyfhLChJjbCADZGClhOsdjU2oKtR0mmPQRETqx2GoHQ4mjqJ+ryHQ4Ky3XcOXUf6vE1l0xmo/KOmIU/uO5BLBg07+zvnXqbNX7xIAK1S/q32ADTjERAjy8rlYyuWPrFo64bLN9dVpfU44OZXTiAsC5k0m/oFSLvlrldCNCl5XQOHo6k0RZXHfXJ9TLNp9oLVC/sHSImzsBS9bGjLjXI6ZZ00iIUw9u3GCjf2KHGcuXw7A7Y1NitBLGlzbn45ObZTne00hkODc24YgNmRbn9CNJFaw2wKtR6Ro7Y89mwdKSnUtSbF73SCJjJSlpq2zfEFRZxaNuTJW88494pVWzaIySNGtXkh2iVBRpaVS4BQNDr3X9d/VVw17IS1Lt2RWXEXKZvc9x4X0u9FZvmR2VnInGb+Cfib/sbjbkosVMq/eSaf5W8q3elN4SWHE9fICej9Bnet8ocm4ejx4xx2Aq6ho3p0RPOhYTloLSSB6QgOaQl1rtMdhuSq6g4O+jnSDMvlRPo8SL+vSV7mtiBHs3xIrwfpch5O9c8sWSqROHWdeSNOqH7kuq+6NVvOPWzxt2shOmRC3Dz7PPnLZxZwxwVXjJ+WX+q7adzUjKwW+NQOHfuPQuuXz+VsaivscaX22tk2WsnApn8czu7daGmjZeXgPn4C+WMmYSW7X9lu71t4TNvrj1tqdcEwmmoMnNawNMFpa4J0yRRoJUePQdK2uHLkeI735/juOP+KYiFE8ubZ53VoZTrsQzxSNnjWiePjt8w8R3x74qk3TyjqGwtnWH6AQifff7cbmXOkf0BqMTwRyEfrPwz0plCOFQl3e5K+lBKfz4e/uA+DzrkMV25Bt/5+WHfQONjf4ud7vAkcUhGAtL6jAgoPmfhsJeq7ElHDkNP6lPHdyafd/q2zLxLnj5nYaXPqO/2GHikbfG7lm0ue2PzBGVtqqnBkaJKbQicdUsuCVMgPkBJHXjHSn3NsuEsIHIFsNJerix9B4nQ6CQQCON3uT7hA9762CGl3jwfOFoKT1+5l+JrKZj83bJu5uUNxCnX305oE6DB3Xl9CTrXPnQ3TthmaV8i5Q45/7YunnzmrK36j03ftiEcg2+ebteC6r4rbx06NOoRQk2EUOiBkDucH+H09+yCeLOobI9RVVJAMho4hB2awkWRtDbILM/Xz8vLILyzE6XIdE//savLxid+Skt1l2bR0sx0I3g8E1eFNc2gmnN2QxFLOns41eoTg9rFTo4/f+HWR6/PP6rL966ovnjlmAvMXL+KGWXP8WfXh3JvHT0OFBRQ6RAQcelN+gNfTA8k/kkTSwkokkZZNuK6Ohr37MGOxTyYtSolRV4vZ2IDdSURASkmWP4ui4mJcn7L6exKhgBfRwrMITRCqCqlDm+53UsCMijCmUAygMxA1DTlv1HguGjis7w2z5vjnL17EBZNP7jqi0R0vdaRscNlHq3/0/MYPfv7Wvt3oKiyg0DF9jIjHmyYOdofwkZKEI4tYLHGMcnb7fPgK8tGa6WegeTw4/FntekYpJV6PB38ggMPRfJWNEIJkMkE0HCG0bhV2It5tW2A4NL7w2Pu4g82TAIdL51JvuTqraQ5f3Oasr5QRV37ediNmGvKMsiHi9PIRP75wyim/aG9ZX8p4AD6OI2WD2ysP/uKeK28U1x8/7hf9snMx1cx4hQ5QV+n1ILMDCL3nyKQQgmQsRn3FXmL19ce4/+14nGRNNVa89a2km6oidQoK8snJy0PX9WaVv21bNNbXUVdbRyKZ7PYmQbol2TGxT4tJmknDwpTqjqc7Ek7BiFBSLUQ7YNo2pVnZ/L9pZ6y5+8obRVWw4RfQ/rK+lPQAtIQXV78jf/nGKygRodBhWDYiHOl2D0BzCBQW4gz4m1WMenY2uuuzZz5kZwfweH2feWlDoRDRaPSTz7dpDdLs3tHL7oTJlQs+bPZdpZQM61vMxGiOquJKczw0NY9Hj/ej/LptU77fnHI6c0+eIQAqqispKyrp1mfosf1a+tFqzp0wVXx70mmTpvcZ+GZjIq5khEIHzFGtqR2o19NiXLq7EKqupnHfAcx4/BjXvxUMYtTVYSc/GbqQUuL1eikqLm5R+QshiEbCVFVVfVL59yTvcmpYzpbHA+8MN6h+ABmAqY1xkqr9c6sQTCbkvFHjuW3UxJFzT54hFq5aAdDtyr/HPQAfx3tbNvz5yQ1rv/razi2qbFChY4dayqZpg8lOtIbb4AH4uFL3ZGXhy89r6tr3cWIiJcLtQvf58fr8+AMBnE5ni3H+RDxOKBjEtCxEc/kEPeQBALj4+Y/IrjGalyYSLswbjEeqO53OcOuSGTcNRBjKn9sSDNvitLKhnDd81L1njJ30tYrqSlFWVNKj1krK3MpQIv71315yjbhz8mmv+HVHo6XyAxTaq6uFQHo9kO1vatfcU0RECBKRCHV7KojX139SuQuBNEzsRAJNCBwtKH/btqmrraW+vh7LtptX/j2MAycUoLU4BwMiwlSHMt3vXBxOb4yrhWgGlrTJ8/j4/uTTX7z7iutEJJn8+mGLv8e93o5UWaSZYybI+YsXccX0WecALPlotbzz1eeUN0ChA0RAa5q2aFlN40d7KDQgNI1oQyOxxiD+gnxcWVlobg+aq2lYTrixAYfDgTcr6xP/X7ChnngieZRMpCq2DihilNwPND+N7WAsRJG7EFtlAqSvdasLJu6I8MYJLrUYH4Np2/z0tHM4f9I08QpwuKwvZS5CSmnXm2efBzSVDc4aM0HMv+CqC84pH1GphucodIgI6Dp2dhZ43T37HFISrq4hVFWN5nZ9wlMQj0X/SxaiEWqqq48q/1RHtcdDtKjltd2QFVVtgdP9jmlw3B5DJXQfRtxIyjnlI6r+OPuiC86fNE2s2rJBfFzHKQLwGThSNrh6z84XfnrxvNLbRk06ZWrZYDVoSKFjQsrlQuYEEM4edHwJgRGN0rBt+6cSBAVGMklNVRWhYKjTmgh1ixCxJfXZLVctGFVRYqgwQDpDSCiJmWQ6zzMsi0n9ynjwoi88+pOL55VsrTr4AnRfWV+b9603LOqRRkIrN63b8/8WP98nbBpq0LhCB9kATWWDrVW07UgC/Myvs21Kx41F2nZTaMKW6L4OtDruwSRAgNE7DjJx6X6kLpp5V8mEvv0YFvOpc5em1v+uYW6+d2oxoQwdDCSlJNvlMu485cyDs8dNHthdjXw6CkdvWNyRZeVy6UerOen4EwY+t+L13DUH9n7p6R0b7spyuZVfUaHd1FcG/E1jfUORHolO24kk0jSwTbNb+/h3BQ71y0O392E2QwCEJmisCyO8PpUFkE5XyIZEgcatc0qodOvIDFX+ESMpf3/WJeLssZNcS/ghC1etoDco/17jAWgOuw7su3nhhrV/+/eHqxAqUVChoxfBMCAa7z4PgJRkFxfi9Dcl/mkuF47snF7rAUi4HNz4yLvoLfRi8mS5uVQrwxSKAqSD4pe5gntPyufFgT6wZEZ2epDS5tLjxzJnxOhbThgyYn4qlPW1Fb1Wc+6qqZz/9dnni5+ecubX8pyuDxKWijEqdOAyO53InADS2X3RJd2RPhnTumlzYFh+i5+H4nEsZf/3bsUvQThh2QQ/58/tz4v9vYgMVP5Jy2RS3zJ+PHXWl+6cc6nYVVszH1KjrC9jPACfxoY9O+2vPr+AiGmosIBCx5lxOIK07C71AOT17Xu0GqC3ewAASiqDnP3itmY/s6VkTL8+jIpkqcPVGwmygMp+Tm47qw/xDJ7v4Hc45a/PvIjJx43WeqPFnzYegI9jY8UuRg0crN13/pVD5o4Y85TKEFToKOwsPzLgR6oxp61GPMeNaCEOrCHYGwqqReptCsKGZKHGty8v4aazSjJW+ZuGIeeOGPP0XWdcMGTycaO1VVs20NuVP/SSJMDPw8iyppGjI8uH7gIuX/Puu4E3wzXBR9auRNNUJ3KF9ko/DbKzIGkgYqrL2ech6HVj+gV6rJkPBcSiCews1MCYXgBhg/QLHpqWy+PlWVi2JNPSNyRN1TqXj57AFWMn/3BQad+7jnw2ecSo9BBx6bhxnj7F4a+fca545NJr/17q8R20VVthhY4IAtfh/ADlDfhMWAj2jyloUVEksJEqDyDltZ6mwftjvVx2TX/+PdCPbWdenN+2bfp4fQfvnXP537979kWiqrH+V2lJ9DJhM9fv2SVvfuZhbNVRUKEDkjEZ14iFOmcKXzrmAEigbyjCWU9sapYsSeBUfx/6O/yKBqQognk6t1/Yh5oMdtNoQjD/kmsZPbA87fVj2m9zRXUloweWi39ddv1JN4+busUlhBI+CgpdZE1UZvkwPXqLn6/0q/HAKbdvNugB+NnFxVx5aV+qM1D5S8AlBDePm7rlX5ddf9LogeWioroy7d/bke4veGTG8pABA98FjluxetVx79Yd2vTIB+/i1B1KFCkodKYgFYK4U8efaD7sljwUxci10VQ4JSUUv3DBE5Nz+N9R2eiWRGSYu18ChmXyhbFTmJJfevzJEyZv/rTuUAQgjTCgbOCWkydMFlsrdr37g1eeGb0/HPSpDAEFhc4TqFXDAwx+vxapHatKNCGodRkUGWpqXI9Ch03He/jZyYXU2+CwMs8vqgH9srKjd519yfrhZeVTKqorM46VZhwBKCsqkau2bGB4WfmUt9d/6Np4cO9V/1z3/kMJFRhQUOgU7BhazNBVNVjNEAAEhCJxil0udeN6yOoPlercObuEnW4NbDLSC+pG8MUTJl43ss+AR4eXlSfTpaxPEYBW4EgJx7TRJyaBh+uDjfUvrV/z1N/eXe6MSVuFBRQUOoBdedkYWRpaC5WTm3wRRhg5GKotcPcpfglkC/40vYDFpV4MmXmZ/RLwCME3pp9lzBg28rK87JyFn9YJmQZVkgtsO7hv4dXTZrj+esG8ueX+7NdsSzUtVVBoL3RL0lDScse/umA448fGdqfi14FlY7OYc2V/XizxYMrMi/O7NI2B/sCSx666Ze4lE6a6DjbULVSnA2XsNodD9bU1tz7xj9yqSFi3FRVQOCxGVBlg6zF640EmvnOgWUVv25KpffszKOZVx6qLpfvB/k6+dVYp9XZmDuwRQL9ALk/f/E2l65QH4PNRUV1JaV5B4Z/Om1t8x9SZf8lxOBUFUFBoI+r7Z6GZzafXakJQHYmoRepCq98OCG6bW8qNs0tosDPT3Z+jO/jpjDl/efDy6wrUqWgeDrUEn8SR0o9B/QbUAV+RUn7z2TUrk79/4xUMKVX5koJCK7A/Pxt0u3kbQ0C9EUdzC5SHrRMVvw1kCR6akstjQ7OQGTipz5YSt6aT7XR+8cXbv/+UECKmTobyALQbe2uqjEsmTBVPX/2lX4wtKNni0jQlshQUPgemLThwYsuGV42dQFcRyE6z+IUD3hrr45J5/fh3uR+sDIzzC43xhaVbXr35jp9P6zvoEaX8W3F21BK0Da+9v7LvX1e/tX9vJKQWI6OgcgDa9DhCMHxvLdNe3dXs55aUzM4eQJHmUUergxK8psjBD+aUUKGJjBXoJR5v9BuTTx82c+JJB9ShaD1UCKCNOGPiSQdisdiwN7duePjeN5dMq0xGEYpHKSh8yiqVVOb7W/xcR7DG08jZSY/yqLXT6nd6JN8+v4R12S6MDLTmJJJil5fvz75g5ckjRk1Vaf2KAHQLvF7vduDk+urqQV9+9p/X7QuHfhKXqr2pgsLHEfW6sFvKmxEQrY5g50hFoNum9dDc8Pi4XB4ZEyBhSbQMU/6WlLLA7RF5TvfPHr3u9oeE27NbHQxFALodeUVFu4GfxuKxE7/51D+nb6ypzI/blhJnCq2T5Wk+nTKpa9Qen0Xxpkiz5YCGLjGExKWaArQKmgYbB7v52Ywi6izQDiv/DOI+eDSd8X0GJO6Ze70X4LFb71AHQxGAHvYIeLwXAyz9cPVZ961Y8vL+eFRJNIXPhACMZALd407fd5SSXYOLKN4Yhma8ALYlCZlJCnUVBvg8xPwat1/alwMOEFZmZm/39/jkD2adf87E4SP/o05E58khhU7Gyu2b63/+yrO5VYkYugoLpI390ZlJgEiJryAfT3Z2k3XXwSRAadskNq+FFEkCPPpcQnDtP99HtPBYuX1ymBMpxlJtgZshUKD74ddnFLK82ENSZp7AtqRkgD8byzZHLfzy9zaqU9G5UGWAnYyK6kpOGnpc3tNf/PKMU0r6L8hxurCkEm5pwZVFCs6NFAI7mcCsrwPLSkkvQMzf8uS/mtpGZYY0p/gFPHdSNmde3Z/FRR4MmXFxfnKcLqaXDljwzK13nD65tGyTOhnKA9Arccfj/5ArD1RgqEFDvfuyaA4aqsLQGYSuMzwAto0ZCmEbSUSwGiscTMl1m7l4K2UVoebbAkvJ2QWDyLOc6oAdNsm2D3bzu+mF7MnA9EgJuDWdIdm52x664WvD1YFQHoBejfmLF/Gz86/w/Pm8K354XCBPxTp7s3CyTbILUqB/vRCY0QjJulqkZSIP7kpZ5Q+wf1whmtVyW+BGI6EO12Fr7FtX9uWr04uoyFDlPyIrlwcvu+5HD93wteHzFy9Sh0J5ANLogEupz/vbH2fEbWtxRTSEQyj+1Tv3USMWsUhGYghNtPdL2u4BEAI7kcAMh0BK7EQjItQI8QQylXNNHIIbHliJpTWfc9w3O5vTRQkZOYNTguaHB04tYNEAH8kM7Ntv2LYcnpsvNNue/e+bv7VMCGEpKaM8AOnHtoSwZg4e8dozX/rObXMGjXgn3+XBVvkBvXAfbXwByC7KxuF0dk5I4HN4urRtjMYGzFAQYSawwpVII47tcWNnB8Chp+x6mVJQXxZo8fO9VgRHpqk9CU5b8tYYPxfP689T/bwYGab8bSnJd7m54vgTNzx20zfFjPIRrynlrzwAmeQR8N74j3t3bm6sLzVVfkCvRTwmSERibSMCbfAAWPEYVigEAux4PdIym7/Mlg2RaDcQkjaecyGY/MFeRq6ubIEg2JybO4hcXBlCIKGyxMEd5/WhypYZZ4VJwKXpHJebf2j+tbcPVj37FQHIaGw/dOD5X7741AUbGmpUN8Fee5M04mFIRJqveW8PAbBMA7sxiASEGcaMh1v3KKYJ4WjrnqObUFbbyBnPbMPWj30maUvK+xYxJZab9ppP+OHb55WwKctJJpq6tpSc0reMhzescdX98n5DCY6ehQoBpACGlva98B83fLXo9NKyWwZm5ZC0LRUX6HXC3caTJcnK96Ppjg51+ZO2jRFsxKpvwDZj2NHqVit/AOlwIHOywe1OGW9AVX4AYVotcCdBqCqUttaIONy+d8FpeZw7bwAfZaDyT1qWLM/OZUafslv+eOWNhT+eeoaphIbyACg0g7tfea725e0b8+sTceUR6I2XSkAiLoiH40jbbpUHQOg6jkA2lpHEDkeatIYRwkrEOmbJ2xItFkeaPStvDV1j7qvrCOyJN79mXp2rXIPTKxFQguaA1cd5+eOUfCoR6Bl2F2wpKfVncWJRn1d+eekXzlHSQXkAFD4H3zz7ooKHrrh+/LSivhGhCEDvk/sSXG5JTqEHp691426lZWE01GNHwmBFsSJVWMl4x934msD2e5HZgR4NCei2ZM+gghY/N6MmsXSyiwWEcnVuu7of35tSQE0GKn9NCKYV9Y0svPU74ws9vjlKMigPgEIbccn9vynqk51b9c6hfTg1xdd6JyGQxEKQjMc4QuiklOSUluDwHu4rIDSEFcWMh7rUbS9MCxGJ9oidHYgmuPjx9TTX9VdKSemAAmaE8nu9D8DtkPzwgmLey3WTzEAhm7QseUbZELG7vrr4qS99t1pJAOUBUGgnzhk2qua+q28Zc+XwE/4wJJCLofIDeh/LFgJvrs4oK0qRywkeD5bbjdPvp4+VIDcebIrzxxq7PGYvHTp2TgDpcdPdmjbhdiBb6JsghKC2qrEXszxwCslzE3OYc10Zb+a6MTJM+SctSw4J5PKVCSff//u514tLRo6vUbdfeQAUOhHfe+Khd9ZUHzypPh5T+QG9CLamMXbTZnwHDuLUNNwOB163m5zsLN4aNIjdru4vgRNSIqOxFpPzOn8NBJc/vpaskNUiCbieQXAhAAAVJ0lEQVQwpxy37F12iS5gyyAXP59VzCGLjHP1W1JS7PMzubT/yp9efPVUdduVB0ChizAkr3Dq49feftPMfuXKE9AL6batOzB0B0ndgel0Ymk9py6kEOD3QXZWt+QHCFuyc1oftBacWFJKknbvygMwnYJbr+7HV2YUU52Byh/gsqGjeOm2O8XwghKl/BUBUOhK3Dz7PPKysv/+myuv104t6nfClNL+xC1TkQGFDhEBmZ0Ffm+XRgUE8FG/YtBa/pUtzjBaqjsmJTg8cO+5hVz6xX7sdGVe3/64acrpA8o5ubDvCd+7cK6458WnmTd9lrpMigAodBemjxi14c/zbhZ3TDl92eDsPEzbVoui0H695nBATgDhdnWZQjOERizX3eLn26wgeqqqUwlOKVk2McDl8/qzsNRDMsPG9Bq2xcj8Ym45cfLdv7v8OnHllFM2AHzj3EvVBVIEQKE7ccHkkyXAF6fPPuPRm74hZvcfvMnndKn5Agodgu1xY+d0zXwBTUrqclsujbTrEzSIZEoKyn39ndx6Y39+NTaHBsCRQdfMlpKA283lQ0dv+sd1twvDNL8NMHnEKCVsejFUFlka4mfPLpCLdm5WSYKpJEA1jbGbN+M5VI2mabgcDvxeD7l+H+8MHMBuZ4r2wZcSLRTpUGfDT2PM3komvLwX2yGa0zRMKOnH0KQvZZbAYUm+c3VfPvDpmXl2peSq48fyrTmXKIGiPAAKqYz5ixeJH190lf+CgUPPG1/Ul7ip8gO6n1YLhGEiojFEKIIIhhENQWzDbO5PkeFo09+EI4h4AiFl6vTxFwI7Owvp93WauVDRJw/NaiHZTxM0NoTp8ai6BI8meWh2PufdMoA1Gaj8o4YhT+03iFvHTD7/W3MuEQuWL1EEQHkAFHoTfvviUw+tPbT/2q0NNTiE4ntdbCqBYaDFE03l/B+7XbYQnLC3Al9t/Sc8AHlZPlbkF1Dx8WoAKcHhALcT6XSm1jvGE4hEx1z0CafOF55bi7ey+VkwItfFNfYgkqIHclokuCzJm2P8/GlqHjUy8zr4mbbN6KJSZgwa+vB1p511nbrYygOg0EuR5/Jcv+CGr5VdOHDYAZeuI1EOgS5h0okEIhhCxBNNK9wRai0EWBZE49AYQlgpVBrncSNzsxEOR7u/wmHZHCrJafHzZF2ceA+MhRcCaoscfPnGfvxoaj71Gab8bSnxOpzcNHrinoevvV24hH69utnKA6CQLpjQV//lT+42n9m6Tjo1Xe19Z12iYPhzO/i1yQPQnGHqdEIr5wp0q8cjEkW0o/qk7GA9M1/aiWzmFEpbMqx/CRMi2d1nCXngR+cVszrblZFjeuOmKb866RRx08+/42DZeuueF59Wmf3KA6CQTlj41yftH14wV9w59YwfTCjqo/IDOgopW6X8O4VkGAZaNJZi0kNAwA9+L20dWtVQ4EfYza+b0AT1taFu2D/QHfDCtBwundefdzJQ+UeMpJw1cCh3zTj3hptmnCNWPfC4DaqsL1PgUEuQOThSNjj35Bm/Bn5978vPLVy+f/f5OxtqcahBQ21VyYhItFuU/1F9ZZhgmOBMrWsrHQ5kTgBi8VbnB9T6vSS94Gjhz0O20aXP7DIk64Z7+e2MfCqEhkNmVhc/w7IYWdyHS4ePXnTx1NMumL94EaDK+pQHQCFjMLCg6MInb/qGuHnMZKmrBMG2qf9EoilO390XNhpLzbidlE35ATkBhP75qlSzbPaOL27x87hpdtmjRn0aX7mhH1+dWcgBtIyq55eAS9Plj6afZf/r2ttFv/zCC6Gpw6iCIgAKGeYRmL94EV8683xtan5R6UXDRhEzDWUBtMqEMnvkZyUgE0ZKL42d1TRfQOotixfdlqwpL22ZYNmSdZ5Qp5Idty6594JCrrqyLxudGnqGnfRQMiFvHT+Nc4r6FV485VR94aoVyuLPcKgQQIbjCPOfe9JpVZNHjBL/fnPJd97bv+e3y/buxKOr49GylmtHiZps/j+1VckJy0LiTOnlkUJAIAuZNBCxeLOhkoRLx3ZqaMaxaymEYGuygRPJ7ljligQXkmcn5PDQuOyjHfwyqn2vZXHe8FGcUT7iztPGjP9dRXWl+EGTAaDusfIAKCj8N/YXjcd/f8+VN4rbT5zyVqk/oOYLtEGZf6bSBuqzA4BASIlAIqTE1DSCbc2/6C2tnqUE5+H8AI/7mOZGpq6T8LT87mZdgngH0vJ0JLsGurjl+n78aVw2YZlZ7XsN22JATh4/PGnm//78wqtEYzz2e4CyohJl9SsclUsKCsdg1ZYNTB4xiodef1U+sGaF6h7w6YvTzux/KQRljY1kJRPUBwIcdHvafgldTqTX0zvXLRoHwzjKoU7ZUsGwN6uQWvOrcGbeQPJsZzvWGb59VR/We/SMtHKEEPzs9DmcNW6yqKiupKyoRF1aBUUAFFqPhatWcMHkk/n3sv+Mqwg3rvnXxrUyy+lSZwbQIjFkOxPVZEcuoJSQ5Uc6enHOui0RsRiYFsXxGOf9cz2Wo3k1PcVbTLkru9UE1OGS/N+MAp7v5yOSgQKuIR6TN42ZtHNK2ZArp48Z//4RIq+goAiAQrtwxIJ4duXy37y+Z8d3l1fswKXrmX1xbBuC4W7v2S90HTvg7z1hgM+QPMIwMQyD6x5ehSPW/Ps4CjxcaZRhfFZb4CPte0dm8ZdTcjkgBM4Mc1klLZM5w0Zx0fFjfztpxMg7ldRSaJUho5ZA4fNwxH2oa/r3/jT3evHdSdNX5nm8WDJz8wOkpkEPuOFtn6f3K//DSls6HGg+H9tmDsFy601DkD6FaHXkM2cCaMChPk6+clM/fnhqHtVklvI3bZtclzt6z5mXvPs/F80TEvk9JbEUlAdAoUvw/9u78+iarj0O4L99pwz35ma8IpGbSQSZNCIkhiRuYg5SY4Waw2vQqsZrrWVq5fW952kXr1SVeouuBtXG0JinUm0ISpFUSIWEEhFTxjucs98fQfve81olwx2+n7Ws5Q/L8HPO2b/9PXvvs3pfzuOdA1lHD/Ilxw6R3IYPEWJ6A1Gdvmn+MCdlfeNhpXr+eJX89xT/R38jipxivH0ooNbhf369wshpQWpLOuokt8lrzyAI9F6/oaQLi2REv7yyA0ADAI0qrzCfdW4byvecOtb/ROmVnKwLZ8hJYWeT1xMzmoiqaxrtdQCTSutn/lbeaImMkWtdHXU8d42C9lwmo2P9wB5s70KRdh6PkwM7Cad/6dzpC39Hqua2FWMyqt/WNzEyRowPCB4Y1jp4Z0l5GcPKfkADAM2WCOw6mbt6+6X8ybnXisnOFs8P4JwktXX1x/U2yO9H9Wft2ymI29tZR+z/lIwSCXnrayl25wXSFFWQvZMjpUi1JDWJlBvuSCtjXOmKRGJzh5jUmYyUFNSe+nj7p/SO6bENM35AAwBmlQjsPJl7a0nuAfdKg0EiYTZ4eTFGVF1LzGR6tkGb1W/h4vb2xBUysuX9lyJj5FNbS11zztAoFkALB3nQ9wqpzS3wIyJys3MQ3+2dUhHZpl0LzPgBDQCYnV/PSDblfs0XHdnDlba8bZBzYoJIZDIRN5qIPeHbAVwiIZJKiMnk9QP+oyYCHpNwTlJiZLTBsjzQ1/GZUd1XhXv7zuka1uEetvUBGgAwa49mKLkFZ8ceuVK0blP+9yS38W2D9Xca+7+NAsDjy4GIGOc0Maob9W8fMU7r6bUeVYFGaa5RAmhoj+LJ8qrK9W/2H8IWxibOC9F4kV4w2e5Ixx8O9E/6AfCQIAjcX6UuXDFg5KKpCX3YjXt3MPgDEgCw/ETg8LnTfP6hnEb91CuApVLKFbRq6Dhq4+2D5zIgAQDrSQTyCvMpPjySZSYkB45pH5l3r64WU1+weZyI7JmEZnZJOP5xyujANt4+rKS8DIUBJABgvc5evvT6rovn39947iQp8NlhsMGB3yiY6NVYHYU5qr2jO0bfQFUACQDYhDqjYembfV9ky/sN39rCwfGOwZbXB4BNkRKjdi4ed7JHTd06oXsi89T63kRVAAkA2KzjFwv4jJxNuCDBqjnL5DSxQ5cBL8X32olqABoAsHmPvjZYUFwUfbzk8r4VeUecZVIpIRIAa8CJSCWR0cweSffjgkN7uTipT6AqYA7wCgCa3aOvDRaVl52YEN/bZXFc39gB7SKo1mhEccCiB34uCNRG7fLZR4NH6wZFxbpc/LkUgz8gAQD4jUSA+Wo8eX5x0fm5e7cFX6+6L2c4HQ8siJQxCnBxN34wdOxFN7VzGCoCSAAAni4R4HmF+RQaEBT2eqxOOT0ydmGN0YDCgEVwkytofly/BQsSk5VuaucwbOsDJAAAz+HG7Vt9D10q2LXs2wNW/1lcsDwi52QvkdLCPimkax8hYYxhCQsgAQBoCKUV5btTYxPY6sGj070dlceqDQY8YKHZceLkIJFSjKdPbvaYV9ITQzqw0tu3cG0CEgCAxnK17Ma99C2fOt+uqUYxoNkenu3dNLR22CQVUzngQgSLgyPYwOI83DboUlR6xfXY5UvrPzz5TbKARYLQZLN+Ih97JWXo+uWEawPHMiUGf0ACANAsvjt62OmKQvrgH1/vIoUMPS00DoFzcpJKyVvplLZm+MRtDi4u5agKoAEAaN5EgPlqPPn1G9eXZ+zYPKj4wV0tXsJCQ874VVIZdfTSlv4tJXW7TKGYjqoAGgAAM7T58L5OK87mnajF1kF43gckY6R1UD5YnDwyMcDH9yQqAmgAAMzc/coHgaeuFB2ct3ernwnrA+APEjmn1mpXulZ51/3orHfuoCJgjbANEKxS4c+ll3XhHf1XJY96wcdRtaTGoMe3BeB3mbjIPezsKbFVwJINk2d26Ovf7i6qAkgAACxYdU31/hlfrIspuF2mRCMA/40TJ6VMQa3VLt+sGT89DhUBJAAAVkLpqExaOzZdNa9b76mOEomAisCvhandhazUKVP91W4Y/AEJAIA1+67oAp+9bQMZGW4CW2UURR7upmE1Bn3I51MzLuD4XkACAGDlSsrLqGtQO7Zn0swhoa4eXymYBOsDbIjAObW0d6QxoVGH1k18lfVu3R6DPyABALBV4z9dyS+U30QjYMU456SUKyjY2fXcqnHTIlARQAMAAHS/qlJx9daNFbO2b5xcKWKJgNUN/kQU6+lDy0an4ZkH8BBeAQAQkbPKyRARGJy2b9xrTho7+/5Sql8ZDpbNIAi8ras7JbTU9l+aOlmVmZ2FBgAACQDAb8wYOZ8ze/O61OPXr4TpOceNYmEEzkmrUlOIm2bNX4aPS0NFAJAAADxdZ8zYX5eMGB++PmVsoIfCrhQNgIU0bkSkkEop3lNbmj3ljQAHqXwKqgKABADgmRXfuvn9tE2fRN42GnDTmCmTKPJEbSBbPHKC5GEvAABIAACeT0CLlh13vPJWQJirxywXuYIEzjHAmAm9IPBQVw+aFNF5zuKRE9jqfTkoCgASAIDGsfCrzysP/vSjqk4UcRM1E4GLpFU5U6Snd/b8lNShqAgAEgCAxm8ABo5w2jz6TyledvaVEnxtsMnJmIQG+rcTt0zNYF5K9TBUBAANAECT8dR4bts2bY5ar6/T+KjUJOKtQKOrE0y8b2Bb8pHINQuGjpZmZmdRWq9kFB4ADQBA0xsbHl3xRdqsHgMC2q55uD4ARWlgekGgTp6tKP2F2Flvp6SyN/oOriAimjskFcUBeEbILgEa2Jg1Sw9eq6nqWWMy4gZ7TiZR5K2cnFmct9+hjIHDdUt3fMlmDhiKDgsACQCA+enkpdXlTH49s41SjTOFn2d2whhNDI9m26dmsLjgEB0REQZ/ACQAAGaPc64Y9fF7IUwqO114r4LLJRLcb0+h2mjgQ4PDmbejMnJqn8Fnso7sp9S4JBQGAA0AgOV4NHitOrT7xLb8053K9bWEXQNPZhQFivX2o26+gZmp3RPnlZSXka/GE4UBQAMAYPGJgMu4T5Z9XVJT1aHGaCCGRoCI6vfzezgoaUjrkNwpfQZ1zTqyn6XGJSHqB0ADAGB9Xstaw3Nvltr8DShwkaZH96Dxcb0ZEdHSHV/SzAE40wegKWARIEATW7rjS7Z01CSP/r5BIwOcnMkgCjY3260yGnhvvyB6s0vPPuPjerO8wnxGRBj8AZAAANiOjI1rP/zp/p1XSqsekNTKXwsYBIFifPxJ5xe0cnjXhHTM+AGQAADYLB8n52nZU96IjXFveU0hkVrlZ+xEzkkll4tvxfS8tXLUZObnrpmGGT8AEgAA+FVTPmvjWuHwtWIus5Jtg7UmI8+I1bGxPZIY0S87IwAADQAAPPRoBfyGbw/9fUfBD38uuH+b5BKpRf5bjKJAL7YJo/jWbVPjwiI3lJSXMV+NJ1b3A6ABAIDfk7Hxk00X790Z8XP1Ay5llpEI6AUTj2ypZTov33kvJ/XPxLY+ADQAAPAHrd6Xw9J6JfO5m9fzQ9eKycRFs/772stktCChP+kiohhm/ADmDYsAAcxYWq9knpmdRYuGvSyNULu1ivXSkkEwv22DD/R1fFib0FOzu/T000VEsbzCfMLgD4AEAAAawMGzp0gXEUXvbt0w/dLdig9+qCgjuaR5e3iDYKLU8GiKDwie0bltyHL8LwEgAQCABqaLiCIiIlHkK9aOnyYd6Bt0wN3BkQQuNvlMWy+YeEsH5d3lfYdvmd03hRHxFfgfAkACAABNmAhkbt3Acy5faNLzA5YNGEExbUPx/ABAAwAAzWH1vhxK65VMH+3NiSuqKDu8t/Qyd5DJGvy+ZkRkEgSa0Tm+qpPWPy40sM1pfK0PAA0AAJiJpbu3zD9bduPtM+U3Gmx9QI3RQCMjoinGVRObFNPj2Pa8b2lQ524oNoCFwxoAACuilMoXrR2Xzl4KCjvvbGdPAn/2FwOcc/JRORs3Dp94fm6/ISy4dfBxIsLgD4AEAADMUWZ2Fs0dkkpERO/vyuafFZwmGftjvX6tyUizo+MWad007yR0iDLlFeZT57ahKC4AGgAAMHcHz55iuogovmrv9sTCivL9+0t/4g4y+W/e81wUaVb3JIpr3S7JW+N5AFUEsF54BQBgpXQRUZyIqLyq6sD7oyax9A4xy0M0LZ94kFCVQc/9VOpjawaNTn8pJp5du3Mbgz8AEgAAsKZE4KM92+98XnjWtdJoIAlj1EKpouUpY+76eXq5oUoAAABWaPW+nPqfvNhT/s/dW3n2sW92Xrxa7ExEVFJehgIBAABYs4KSYhQBwMb9G3qjEAbJT75FAAAAAElFTkSuQmCC"
  
  window.initALoadScreen = init;
})()
