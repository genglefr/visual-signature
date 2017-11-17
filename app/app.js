var wrapper = document.getElementById("signature-pad");
var currentPageWrapper = document.getElementById("current-page");
var clearButton = wrapper.querySelector("[data-action=clear]");
var resetButton = wrapper.querySelector("[data-action=reset]");
var savePNGButton = wrapper.querySelector("[data-action=save-png]");
var saveSVGButton = wrapper.querySelector("[data-action=save-svg]");
var savePDFButton = wrapper.querySelector("[data-action=save-pdf]");
var firstPageButton = wrapper.querySelector("[data-action=first-page]");
var prevPageButton = wrapper.querySelector("[data-action=prev-page]");
var nextPageButton = wrapper.querySelector("[data-action=next-page]");
var printButton = wrapper.querySelector("[data-action=print]");
var lastPageButton = wrapper.querySelector("[data-action=last-page]");
var canvas = wrapper.querySelector("canvas");
var progressBarWrapper = wrapper.querySelector("[class=signature-pad--progress]");
var bodyWrapper = wrapper.querySelector("[class=signature-pad--body]");
var pdfNavWrapper = wrapper.querySelector("[class=pdf-nav]");
var dropzoneWrapper = wrapper.querySelector("[class=dropzone-container]");
var bar = progressBarWrapper.querySelector("[class=bar]");
var _pdf;
var history = {};
var scale = 1.8;

Dropzone.options.dropzone = {
    paramName: "file", // The name that will be used to transfer the file
    maxFilesize: 2, // MB
    acceptedFiles: "application/pdf",
    accept: function(file, done) {
        dropzoneWrapper.style.display = "none";
        pdfNavWrapper.style.display = "inline-block";
        var reader = new FileReader();
        reader.addEventListener("loadend", function(event) {
            PDFJS.getDocument(event.target.result).then(function (pdf) {
                console.log(pdf);
                _pdf = pdf;
                _pdf.filename = file.name;
                loadPage(1);
                /*Ugly hack for IE*/
                wrapper.style.display = "block";
                bodyWrapper.style.display = "block";
            });
        });
        reader.readAsDataURL(file);
    }
};

function renderPage(pageNum, _canvas, _signaturePad) {
    return _pdf.getPage(pageNum).then(function (page) {
        var viewport = page.getViewport(scale);
        _canvas.width = viewport.width;
        _canvas.height = viewport.height;
        var renderContext = {
            canvasContext: _canvas.getContext('2d'),
            viewport: viewport
        };
        return page.render(renderContext).then(function() {
            if (history[pageNum]) {
                _signaturePad.fromData(history[pageNum]);
            }
            return Promise.resolve(_signaturePad);
        });
    });
}

function createSignaturePad(_canvas){
    var _signaturePad = new SignaturePad(_canvas);
    _signaturePad.penColor = "#2b2bff";
    return _signaturePad;
}

function loadPage(pageNum){
    if (window.signaturePad) {
        if (!signaturePad.isEmpty()) {
            history[currentPage] = signaturePad.toData();
        }
        signaturePad.clear();
    } else {
        signaturePad = createSignaturePad(canvas);
    }
    renderPage(pageNum, canvas, signaturePad);
    currentPageWrapper.innerHTML = currentPage = pageNum;
    nextPageButton.disabled = lastPageButton.disabled = (pageNum == _pdf.numPages ? "disabled" : "");
    prevPageButton.disabled = firstPageButton.disabled = (pageNum == 1 ? "disabled" : "");
}

function setBarWidth(_bar, _width){
    _bar.style.width = Math.round(_width)+'%';
}

savePDFButton.addEventListener("click", function (event) {
    progressBarWrapper.style.display = "block";
    setBarWidth(bar, 1);
    var promises = renderPages(true);
    var struct = {};
    Promise.all(promises).then(function(values){
        var inc = 100 / values.length;
        for (var i = 0; i < values.length; i++) {
            var dataUrl = getDataUrl(values[i], "image/jpeg");
            if (dataUrl) {
                var format = [values[i]._canvas.width/scale, values[i]._canvas.height/scale];
                var orientation = format[0] > format[1] ? "l" : "p";
                var page = {};
                page.format = format;
                page.orientation = orientation;
                page.dataUrl = dataUrl;
                struct[i] = page;
            }
        }
        var worker = new Worker('worker.js');
        worker.postMessage(struct);
        worker.addEventListener('message', function(e) {
            var message = e.data;
            if (message.status == "progress") {
                setBarWidth(bar, message.value);
            }
            if (message.status == "complete") {
                download(message.value, _pdf.filename);
                setTimeout(function(){
                    progressBarWrapper.style.display = "none";
                }, 2000);
            }
        }, false);
    });
});

function renderPages(cleanAfterRendering) {
    if (!signaturePad.isEmpty()) {
        history[currentPage] = signaturePad.toData();
    }
    var modal = document.getElementById("signature-print-modal");
    var modalContent = modal.querySelector("[id=signature-print-modal-content]");

    var promises = new Array();
    for (var i = 1; i <= _pdf.numPages; i++) {
        var canvas = document.createElement('canvas');
        modalContent.appendChild(canvas);
        var printSignaturePad = createSignaturePad(canvas);
        promises.push(renderPage(i, canvas, printSignaturePad));
        printSignaturePad.off();
    }
    if (cleanAfterRendering){
        modalContent.innerHTML='';
    }
    return promises;
}

printButton.addEventListener("click", function (event) {
    renderPages();
    var modal = document.getElementById("signature-print-modal");
    var modalContent = modal.querySelector("[id=signature-print-modal-content]");
    var span = modal.querySelector("[class=close]");
    span.addEventListener("click", function (event) {
        modalContent.innerHTML='';
        modal.style.display = "none";
        wrapper.style.display = "block";
    });
    modal.style.display = "block";
    wrapper.style.display = "none";
});

prevPageButton.addEventListener("click", function (event) {
    if(currentPage > 1){
        loadPage(currentPage-1);
    }
});

nextPageButton.addEventListener("click", function (event) {
    if(currentPage+1 <= _pdf.numPages){
        loadPage(currentPage+1);
    }
});

firstPageButton.addEventListener("click", function (event) {
    loadPage(1);
});

lastPageButton.addEventListener("click", function (event) {
    loadPage(_pdf.numPages);
});

savePNGButton.addEventListener("click", function (event) {
    download(getDataUrl(signaturePad), "signature.png");
});

saveSVGButton.addEventListener("click", function (event) {
    download(getDataUrl(signaturePad, 'image/svg+xml'), "signature.svg");
});

clearButton.addEventListener("click", function (event) {
    signaturePad.clear();
    delete history[currentPage];
    loadPage(currentPage);
});

resetButton.addEventListener("click", function (event) {
    signaturePad.clear();
    delete history;
    history = {};
    loadPage(1);
});

function getDataUrl(_signaturePad, format) {
    if (_signaturePad.isEmpty()) {
        if (!format || format.indexOf("svg") == -1){
            return _signaturePad._canvas.toDataURL(format);
        }
        console.log("Please provide a signature first.");
    } else {
        return _signaturePad.toDataURL(format);
    }
}

function download(dataURL, filename) {
    var blob = dataURLToBlob(dataURL);
    if (window.navigator.msSaveOrOpenBlob) {
        window.navigator.msSaveOrOpenBlob(blob, filename);
    } else {
        var url = window.URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.style = "display: none";
        a.href = url;
        a.download = filename;

        document.body.appendChild(a);
        a.click();

        window.URL.revokeObjectURL(url);
    }
}

// One could simply use Canvas#toBlob method instead, but it's just to show
// that it can be done using result of SignaturePad#toDataURL.
function dataURLToBlob(dataURL) {
    // Code taken from https://github.com/ebidel/filer.js
    if(dataURL){
        var parts = dataURL.split(';base64,');
        var contentType = parts[0].split(":")[1];
        var raw = window.atob(parts[1]);
        var rawLength = raw.length;
        var uInt8Array = new Uint8Array(rawLength);
        for (var i = 0; i < rawLength; ++i) {
            uInt8Array[i] = raw.charCodeAt(i);
        }
        return new Blob([uInt8Array], { type: contentType });
    }
}