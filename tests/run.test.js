// FIX: tests are slow - use unit tests instead of integration tests
// TODO: capture console log from run function
const { mockFs } = require("./helper.js");
const { run } = require("./../index.js");
const snapRun = (fs, options) =>
  run(
    {
      // for Travis CI
      puppeteerArgs: ["--no-sandbox", "--disable-setuid-sandbox"],
      // sometimes web server from previous test have not enough time to shut down
      // as a result you get `Error: listen EADDRINUSE :::45678`
      // to prevent this we use random port
      port: Math.floor(Math.random() * 1000 + 45000),
      ...options
    },
    {
      fs
    }
  );

describe("validates options", () => {
  test("include option should be an non-empty array", () =>
    run({ include: "" })
      .then(() => expect(true).toEqual(false))
      .catch(e => expect(e).toEqual("")));

  test("preloadResources option deprecated. Use preloadImages or cacheAjaxRequests", () =>
    run({ preloadResources: true })
      .then(() => expect(true).toEqual(false))
      .catch(e => expect(e).toEqual("")));

  test("saveAs supported values are html and png", () =>
    run({ saveAs: "json" })
      .then(() => expect(true).toEqual(false))
      .catch(e => expect(e).toEqual("")));
});

describe("one page", () => {
  const source = "tests/examples/one-page";
  const {
    fs,
    createReadStreamMock,
    createWriteStreamMock,
    filesCreated,
    content,
    name
  } = mockFs();
  beforeAll(() => snapRun(fs, { source }));
  test("crawls / and saves as index.html to the same folder", () => {
    expect(filesCreated()).toEqual(1);
    expect(name(0)).toEqual(`/${source}/index.html`);
    expect(content(0)).toEqual(
      '<html lang="en"><head><meta charset="utf-8"></head><body><script>document.body.appendChild(document.createTextNode("test"));</script>test</body></html>'
    );
  });
  test("copies (original) index.html to 200.html", () => {
    expect(createReadStreamMock.mock.calls).toEqual([
      [`/${source}/index.html`]
    ]);
    expect(createWriteStreamMock.mock.calls).toEqual([[`/${source}/200.html`]]);
  });
});

describe("respects destination", () => {
  const source = "tests/examples/one-page";
  const destination = "tests/examples/destination";
  const {
    fs,
    createReadStreamMock,
    createWriteStreamMock,
    filesCreated,
    content,
    name
  } = mockFs();
  beforeAll(() => snapRun(fs, { source, destination }));
  test("crawls / and saves as index.html to destination folder", () => {
    expect(filesCreated()).toEqual(1);
    expect(name(0)).toEqual(`/${destination}/index.html`);
  });
  test("copies (original) index.html to 200.html (to source folder)", () => {
    expect(createReadStreamMock.mock.calls[0]).toEqual([
      `/${source}/index.html`
    ]);
    expect(createWriteStreamMock.mock.calls[0]).toEqual([
      `/${source}/200.html`
    ]);
  });
  test("copies (original) index.html to 200.html (to destination folder)", () => {
    expect(createReadStreamMock.mock.calls[1]).toEqual([
      `/${source}/index.html`
    ]);
    expect(createWriteStreamMock.mock.calls[1]).toEqual([
      `/${destination}/200.html`
    ]);
  });
});

describe("many pages", () => {
  const source = "tests/examples/many-pages";
  const {
    fs,
    writeFileSyncMock,
    createReadStreamMock,
    createWriteStreamMock
  } = mockFs();
  beforeAll(() => snapRun(fs, { source }));
  test("crawls all links and saves as index.html in separate folders", () => {
    expect(writeFileSyncMock.mock.calls.length).toEqual(6);
    expect(writeFileSyncMock.mock.calls.map(x => x[0])).toEqual(
      expect.arrayContaining([
        `/${source}/1/index.html`, // without slash in the end
        `/${source}/2/index.html`, // with slash in the end
        `/${source}/3/index.html`, // ignores hash
        `/${source}/4/index.html` // ignores query
      ])
    );
  });
  test("crawls / and saves as index.html to the same folder", () => {
    expect(writeFileSyncMock.mock.calls[0][0]).toEqual(`/${source}/index.html`);
  });
  test("if there is more than page it crawls 404.html", () => {
    expect(writeFileSyncMock.mock.calls.map(x => x[0])).toEqual(
      expect.arrayContaining([`/${source}/404.html`])
    );
  });
  test("copies (original) index.html to 200.html", () => {
    expect(createReadStreamMock.mock.calls).toEqual([
      [`/${source}/index.html`]
    ]);
    expect(createWriteStreamMock.mock.calls).toEqual([[`/${source}/200.html`]]);
  });
});

describe("possible to disable crawl option", () => {
  const source = "tests/examples/many-pages";
  const {
    fs,
    writeFileSyncMock,
    createReadStreamMock,
    createWriteStreamMock
  } = mockFs();
  beforeAll(() =>
    snapRun(fs, {
      source,
      crawl: false,
      include: ["/1", "/2/", "/3#test", "/4?test"]
    }));
  test("crawls all links and saves as index.html in separate folders", () => {
    // no / or /404.html
    expect(writeFileSyncMock.mock.calls.length).toEqual(4);
    expect(writeFileSyncMock.mock.calls.map(x => x[0])).toEqual(
      expect.arrayContaining([
        `/${source}/1/index.html`, // without slash in the end
        `/${source}/2/index.html`, // with slash in the end
        `/${source}/3/index.html`, // ignores hash
        `/${source}/4/index.html` // ignores query
      ])
    );
  });
  test("copies (original) index.html to 200.html", () => {
    expect(createReadStreamMock.mock.calls).toEqual([
      [`/${source}/index.html`]
    ]);
    expect(createWriteStreamMock.mock.calls).toEqual([[`/${source}/200.html`]]);
  });
});

describe("inlineCss - small file", () => {
  const source = "tests/examples/other";
  const { fs, filesCreated, content } = mockFs();
  beforeAll(() =>
    snapRun(fs, {
      source,
      inlineCss: true,
      include: ["/with-small-css.html"]
    }));
  // 1. I want to change this behaviour
  // see https://github.com/stereobooster/react-snap/pull/133/files
  // 2. There is a bug with relative url in inlined CSS url(bg.png)
  test("whole CSS got inlined for small", () => {
    expect(filesCreated()).toEqual(1);
    expect(content(0)).toMatch(
      '<style type="text/css">div{background:url(bg.png);height:10px}p{background:#000}</style>'
    );
  });
  test("removes <link>", () => {
    expect(content(0)).not.toMatch(
      '<link rel="stylesheet"  href="/css/small.css" >'
    );
  });
});

describe("inlineCss - big file", () => {
  const source = "tests/examples/other";
  const include = ["/with-big-css.html"];
  const { fs, filesCreated, content } = mockFs();
  beforeAll(() => snapRun(fs, { source, include, inlineCss: true }));
  test("inline style", () => {
    expect(filesCreated()).toEqual(1);
    expect(content(0)).toMatch('<style type="text/css">');
  });
  test("inserts <link> in noscript", () => {
    expect(content(0)).toMatch(
      '<noscript><link href="/css/big.css" rel="stylesheet"></noscript>'
    );
  });
  test('inserts <link rel="preload"> with onload', () => {
    expect(content(0)).toMatch(
      '<link href="/css/big.css" rel="preload" as="style" onload="this.rel=\'stylesheet\'">'
    );
  });
  test("inserts loadCSS polyfill", () => {
    expect(content(0)).toMatch('<script type="text/javascript">/*! loadCSS');
  });
});

describe("removeBlobs", () => {
  const source = "tests/examples/other";
  const include = ["/remove-blobs.html"];
  const { fs, filesCreated, content } = mockFs();
  beforeAll(() => snapRun(fs, { source, include }));
  test("removes blob resources from final html", () => {
    expect(filesCreated()).toEqual(1);
    expect(content(0)).not.toMatch('<link rel="stylesheet" href="blob:');
  });
});

describe("http2PushManifest", () => {
  const source = "tests/examples/other";
  const include = ["/with-big-css.html"];
  const { fs, filesCreated, content } = mockFs();
  beforeAll(() => snapRun(fs, { source, include, http2PushManifest: true }));
  test("writes http2 manifest file", () => {
    expect(filesCreated()).toEqual(2);
    expect(content(1)).toEqual(
      '[{"source":"/with-big-css.html","headers":[{"key":"Link","value":"</css/big.css>;rel=preload;as=style"}]}]'
    );
  });
});

describe("ignoreForPreload", () => {
  const source = "tests/examples/other";
  const include = ["/with-big-css.html"];
  const { fs, filesCreated, content } = mockFs();
  beforeAll(() =>
    snapRun(fs, {
      source,
      include,
      http2PushManifest: true,
      ignoreForPreload: ["big.css"]
    }));
  test("writes http2 manifest file", () => {
    expect(filesCreated()).toEqual(2);
    expect(content(1)).toEqual("[]");
  });
});

describe("preconnectThirdParty", () => {
  const source = "tests/examples/other";
  const include = ["/third-party-resource.html"];
  const { fs, filesCreated, content } = mockFs();
  beforeAll(() => snapRun(fs, { source, include }));
  test("adds <link rel=preconnect>", () => {
    expect(filesCreated()).toEqual(1);
    expect(content(0)).toMatch(
      '<link href="https://fonts.googleapis.com" rel="preconnect">'
    );
  });
});

describe("fixInsertRule", () => {
  const source = "tests/examples/other";
  const include = ["/fix-insert-rule.html"];
  const { fs, filesCreated, content } = mockFs();
  beforeAll(() => snapRun(fs, { source, include }));
  test("fixes <style> populated with insertRule", () => {
    expect(filesCreated()).toEqual(1);
    expect(content(0)).toMatch('<style id="css-in-js">p{color:red}</style>');
  });
});

describe("removeStyleTags", () => {
  const source = "tests/examples/other";
  const include = ["/fix-insert-rule.html"];
  const { fs, filesCreated, content } = mockFs();
  beforeAll(() =>
    snapRun(fs, {
      source,
      include,
      removeStyleTags: true
    }));
  test("removes all <style>", () => {
    expect(filesCreated()).toEqual(1);
    expect(content(0)).not.toMatch("<style");
  });
});

describe("removeScriptTags", () => {
  const source = "tests/examples/other";
  const include = ["/with-script.html"];
  const { fs, filesCreated, content } = mockFs();
  beforeAll(() => snapRun(fs, { source, include, removeScriptTags: true }));
  test("removes all <script>", () => {
    expect(filesCreated()).toEqual(1);
    expect(content(0)).not.toMatch("<script");
  });
});

describe("asyncScriptTags", () => {
  const source = "tests/examples/other";
  const include = ["/with-script.html"];
  const { fs, filesCreated, content } = mockFs();
  beforeAll(() => snapRun(fs, { source, include, asyncScriptTags: true }));
  test("adds async to all external", () => {
    expect(filesCreated()).toEqual(1);
    expect(content(0)).toMatch('<script async src="js/main.js"></script>');
  });
});

describe("preloadImages", () => {
  const source = "tests/examples/other";
  const include = ["/with-image.html"];
  const { fs, filesCreated, content } = mockFs();
  beforeAll(() => snapRun(fs, { source, include, preloadImages: true }));
  test("adds <link rel=preconnect>", () => {
    expect(filesCreated()).toEqual(1);
    expect(content(0)).toMatch(
      '<link as="image" href="/css/bg.png" rel="preload">'
    );
  });
});

describe("handles JS errors", () => {
  const source = "tests/examples/other";
  const include = ["/with-script-error.html"];
  const { fs, filesCreated, content } = mockFs();
  test("returns rejected promise", () =>
    snapRun(fs, { source, include })
      .then(() => expect(true).toEqual(false))
      .catch(e => expect(e).toEqual("")));
});

describe("You can not run react-snap twice", () => {
  const source = "tests/examples/processed";
  const { fs, filesCreated, content } = mockFs();
  test("returns rejected promise", () =>
    snapRun(fs, { source })
      .then(() => expect(true).toEqual(false))
      .catch(e => expect(e).toEqual("")));
});

describe("fixWebpackChunksIssue", () => {
  const source = "tests/examples/cra";
  const { fs, filesCreated, content } = mockFs();
  beforeAll(() => snapRun(fs, { source }));
  test("creates preload links", () => {
    expect(filesCreated()).toEqual(1);
    expect(content(0)).toMatch(
      '<link as="script" href="/static/js/main.42105999.js" rel="preload"><link as="script" href="/static/js/0.35040230.chunk.js" rel="preload">'
    );
  });
  test("leaves root script", () => {
    expect(content(0)).toMatch(
      '<script src="/static/js/main.42105999.js"></script>'
    );
  });
  test("removes chunk scripts", () => {
    expect(content(0)).not.toMatch(
      '<script src="/static/js/0.35040230.chunk.js"></script>'
    );
  });
});

describe("link to file", () => {
  const source = "tests/examples/other";
  const include = ["/link-to-file.html"];
  const { fs, writeFileSyncMock } = mockFs();
  beforeAll(() => snapRun(fs, { source, include }));
  test("link to non-html file", () => {
    expect(writeFileSyncMock.mock.calls.map(x => x[0])).not.toEqual(
      expect.arrayContaining([`/${source}/css/bg.png`])
    );
  });
  test("link to html file", () => {
    expect(writeFileSyncMock.mock.calls.map(x => x[0])).toEqual(
      expect.arrayContaining([`/${source}/index.html`])
    );
  });
});

describe("snapSaveState", () => {
  const source = "tests/examples/other";
  const include = ["/snap-save-state.html"];
  const { fs, filesCreated, content } = mockFs();
  beforeAll(() => snapRun(fs, { source, include }));
  test("JSON compatible values", () => {
    expect(filesCreated()).toEqual(1);
    expect(content(0)).toMatch('window["json"]=["",1,true,null,{}];');
  });
  // need to set UTC timezone for this test to work
  test.skip("non-JSON compatible values", () => {
    // those don't work
    expect(content(0)).toMatch(
      'window["non-json"]=[null,"2000-01-01T00:00:00.000Z",null,{}];'
    );
  });
  // this test doesn't work
  test.skip("protects from XSS attack", () => {
    expect(content(0)).toMatch('window["xss"]="\\u003C\\u002Fscript\\u003E');
  });
});

describe("saves state of form elements changed via JS", () => {
  const source = "tests/examples/other";
  const include = ["/form-elements.html"];
  const { fs, filesCreated, content } = mockFs();
  beforeAll(() => snapRun(fs, { source, include }));
  test("radio button", () => {
    expect(filesCreated()).toEqual(1);
    expect(content(0)).toMatch(
      '<input checked name="radio" type="radio" value="radio1">'
    );
  });
  test("checkbox", () => {
    expect(content(0)).toMatch(
      '<input checked name="checkbox" type="checkbox" value="checkbox1">'
    );
  });
  test("select", () => {
    expect(content(0)).toMatch('<option selected value="option1">');
  });
});

describe("cacheAjaxRequests", () => {
  const source = "tests/examples/other";
  const include = ["/ajax-request.html"];
  const { fs, filesCreated, content } = mockFs();
  beforeAll(() => snapRun(fs, { source, include, cacheAjaxRequests: true }));
  test("saves ajax response", () => {
    expect(filesCreated()).toEqual(1);
    expect(content(0)).toMatch(
      'window.snapStore={"\\u002Fjs\\u002Ftest.json":{"test":1}};'
    );
  });
});

describe("svgLinks", () => {
  const source = "tests/examples/other";
  const include = ["/svg.html"];
  const {
    fs,
    filesCreated,
  } = mockFs();
  beforeAll(() => snapRun(fs, { source , include}));
  test("Find SVG Links", () => {
    expect(filesCreated()).toEqual(3);
  });
});

describe.skip("publicPath", () => {});

describe.skip("skipThirdPartyRequests", () => {});

describe.skip("waitFor", () => {});

describe.skip("externalServer", () => {});


