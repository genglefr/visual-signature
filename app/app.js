var wrapper = document.getElementById("signature-pad");
var currentPageWrapper = wrapper.querySelector("[name=current-page]");
var clearButton = wrapper.querySelector("[data-action=clear]");
var resetButton = wrapper.querySelector("[data-action=reset]");
var savePNGButton = wrapper.querySelector("[data-action=save-png]");
var saveSignatureButton = wrapper.querySelector("[data-action=save-sign]");
var savePDFButton = wrapper.querySelector("[data-action=save-pdf]");
var firstPageButton = wrapper.querySelector("[data-action=first-page]");
var prevPageButton = wrapper.querySelector("[data-action=prev-page]");
var nextPageButton = wrapper.querySelector("[data-action=next-page]");
var printButton = wrapper.querySelector("[data-action=print]");
var changeButton = wrapper.querySelector("[data-action=change]");
var lastPageButton = wrapper.querySelector("[data-action=last-page]");
var canvas = wrapper.querySelector("canvas");
var progressBarWrapper = wrapper.querySelector("[class=signature-pad--progress]");
var bodyWrapper = wrapper.querySelector("[class=signature-pad--body]");
var pdfNavWrapper = wrapper.querySelector("[class=pdf-nav]");
var bar = progressBarWrapper.querySelector("[class=bar]");
var range = wrapper.querySelector("[name=scale]");
var rangeLabel = wrapper.querySelector("[name=range-label]");

function onComplete(content, filename) {
    download(content, filename);
    setTimeout(function(){
        progressBarWrapper.style.display = "none";
    }, 2000);
}

function setBarWidth(_bar, _width){
    _bar.style.width = Math.round(_width)+'%';
}

function onProgress(progress){
    setBarWidth(bar, progress);
}

function onLoadPage(digitalSignature) {
    var pageNum = digitalSignature.getCurrentPage();
    currentPageWrapper.innerHTML = pageNum;
    nextPageButton.disabled = lastPageButton.disabled = (pageNum == digitalSignature.getTotalPages() ? "disabled" : "");
    prevPageButton.disabled = firstPageButton.disabled = (pageNum == 1 ? "disabled" : "");
    rangeLabel.textContent = digitalSignature.getScale()+"%";
};

var digitalSignature;
wrapper.querySelector("[id=file]").onchange = function(ev) {
    var file = ev.target.files[0];
    if (file) {
        var reader = new FileReader();
        reader.onload = function (e) {
            new DigitalSignature(canvas, e.target.result, file.name, {"onComplete":onComplete, "onProgress":onProgress, "onLoadPage":onLoadPage}).then(function(_digitalSignature){
                /*Adapt UI*/
                clearButton.disabled = resetButton.disabled = printButton.disabled = savePDFButton.disabled = false;//savePNGButton.disabled = saveSignatureButton.disabled =
                /*Ugly hack for IE*/
                pdfNavWrapper.style.display = "inline-block";
                bodyWrapper.style.display = "block";
                range.value = 100;
                digitalSignature = _digitalSignature;
            });
        }
        reader.readAsArrayBuffer(file);
    }
}

range.onchange = function(ev) {
    var value = ev.target.value;
    digitalSignature.scale(value);
}

savePDFButton.addEventListener("click", function (event) {
    progressBarWrapper.style.display = "block";
    setBarWidth(bar, 1);
    digitalSignature.renderPdf();
});

printButton.addEventListener("click", function (event) {
    var modal = document.getElementById("signature-print-modal");
    var modalContent = modal.querySelector("[id=signature-print-modal-content]");
    digitalSignature.renderPages(modalContent);
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
    digitalSignature.loadPreviousPage();
});

nextPageButton.addEventListener("click", function (event) {
    digitalSignature.loadNextPage();
});

firstPageButton.addEventListener("click", function (event) {
    digitalSignature.loadPage(1);
});

lastPageButton.addEventListener("click", function (event) {
    digitalSignature.loadLastPage();
});

/*savePNGButton.addEventListener("click", function (event) {
    download(getDataUrl(signaturePad), "signature.png");
});

saveSignatureButton.addEventListener("click", function (event) {
    var result = signaturePad.removeBlanks();
    console.log("x axis: "+result.x);
    console.log("y axis: "+result.y);
    download(result.dataURL, "signature.png");
});*/

clearButton.addEventListener("click", function (event) {
    digitalSignature.reset(digitalSignature.getCurrentPage());
});

resetButton.addEventListener("click", function (event) {
    digitalSignature.reset();
});

changeButton.addEventListener("click", function (event) {
    wrapper.querySelector("[id=file]").click();
});

function download(dataURL, filename) {
    var blob = dataURLToBlob(dataURL);
    if (blob){
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
}

// One could simply use Canvas#toBlob method instead, but it's just to show
// that it can be done using result of SignaturePad#toDataURL.
function dataURLToBlob(dataURL) {
    // Code taken from https://github.com/ebidel/filer.js
    if (dataURL){
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
