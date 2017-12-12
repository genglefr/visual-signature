(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
        typeof define === 'function' && define.amd ? define(factory) :
            (global.DigitalSignature = factory());
}(this, (function () {'use strict';

    function DigitalSignature(canvas, file, filename, options) {
        var self = this;
        var opts = options || {};
        this.onProgress = opts.onProgress;
        this.onComplete = opts.onComplete;
        this.onLoadPage = opts.onLoadPage;
        this.penColor = opts.penColor || "#2b2bff";
        this.currentScale = this.initScale = opts.initScale || 1.8;
        this.pdf = null;
        this.canvas = canvas;
        this.signaturePad = this.createSignaturePad(this.canvas);
        this.currentPage = 1;

        this.worker = new Worker('worker.js');
        this.worker.addEventListener('message', function (e) {
            var message = e.data;
            if (message.status === "progress" && self.onProgress) {
                self.onProgress(message.value);
            }
            if (message.status === "complete" && self.onComplete) {
                self.onComplete(message.value, self.pdf.filename);
            }
        }, false);

        return PDFJS.getDocument(file).then(function (_pdf) {
            self.pdf = _pdf;
            self.clearHistory();
            self.pdf.filename = filename;
            self.loadPage(self.currentPage);
            return Promise.resolve(self);
        });
    }

    DigitalSignature.prototype.loadPage = function (pageNum) {
        var self = this;
        if (this.signaturePad) {
            if (!this.signaturePad.isEmpty()) {
                this.history[this.currentPage] = this.signaturePad.toData();
            }
            this.signaturePad.clear();
        } else {
            console.log("should not happen");
        }
        this.currentPage = pageNum;
        this.renderPage(pageNum, this.canvas, this.signaturePad).then(function () {
            if (self.onLoadPage) self.onLoadPage(self);
        });
    };

    DigitalSignature.prototype.renderPage = function (pageNum, _canvas, _signaturePad) {
        var self = this;
        return this.pdf.getPage(pageNum).then(function (page) {
            var viewport = page.getViewport(self.currentScale);
            _canvas.width = viewport.width;
            _canvas.height = viewport.height;
            var renderContext = {
                canvasContext: _canvas.getContext('2d'),
                viewport: viewport
            };
            return page.render(renderContext).then(function () {
                if (self.history[pageNum]) {
                    _signaturePad.fromData(self.history[pageNum]);
                }
                return Promise.resolve(_signaturePad);
            });
        });
    };

    DigitalSignature.prototype.reset = function (pageNum) {
        this.signaturePad.clear();
        if (!pageNum) {
            pageNum = 1;
            this.clearHistory();
        } else {
            delete this.history[pageNum];
        }
        this.loadPage(pageNum);
    };

    DigitalSignature.prototype.clearHistory = function () {
        if (this.history) delete this.history;
        this.history = {};
    };

    DigitalSignature.prototype.scaleHistory = function (ratio) {
        var keys = Object.keys(this.history);
        for (var i = 0; i <= keys.length; i++) {
            var key = keys[i];
            var pointGroups = this.history[key];
            if (pointGroups)
                this.history[key] = this.signaturePad.scalePoints(pointGroups, ratio);
        }
    };

    DigitalSignature.prototype.createSignaturePad = function (_canvas) {
        var _signaturePad = new SignaturePad(_canvas);
        _signaturePad.penColor = this.penColor;
        return _signaturePad;
    };

    DigitalSignature.prototype.scale = function (percent) {
        var prevScale = this.currentScale;
        this.currentScale = this.initScale * (percent / 100);
        var ratio = this.currentScale / prevScale;
        this.signaturePad.scale(ratio);
        this.scaleHistory(ratio);
        this.loadPage(this.currentPage);
    };

    DigitalSignature.prototype.renderPages = function (modalContent) {
        if (!this.signaturePad.isEmpty()) {
            this.history[this.currentPage] = this.signaturePad.toData();
        }
        var promises = new Array();
        for (var i = 1; i <= this.pdf.numPages; i++) {
            var canvas = document.createElement('canvas');
            if (modalContent) modalContent.appendChild(canvas);
            var printSignaturePad = this.createSignaturePad(canvas);
            promises.push(this.renderPage(i, canvas, printSignaturePad));
            printSignaturePad.off();
        }
        return promises;
    };

    DigitalSignature.prototype.renderPdf = function () {
        var self = this;
        var promises = this.renderPages();
        var struct = {};
        Promise.all(promises).then(function (values) {
            var inc = 100 / values.length;
            for (var i = 0; i < values.length; i++) {
                var dataUrl = self._getDataURL(values[i], "image/jpeg");
                if (dataUrl) {
                    var format = [values[i]._canvas.width / self.currentScale, values[i]._canvas.height / self.currentScale];
                    var orientation = format[0] > format[1] ? "l" : "p";
                    var page = {};
                    page.format = format;
                    page.orientation = orientation;
                    page.dataUrl = dataUrl;
                    struct[i] = page;
                }
            }
            self.worker.postMessage(struct);
        });
    };

    DigitalSignature.prototype._getDataURL = function (_signaturePad, format) {
        if (_signaturePad.isEmpty()) {
            if (!format || format.indexOf("svg") === -1) {
                return _signaturePad._canvas.toDataURL(format);
            }
            console.log("Please provide a signature first.");
        } else {
            return _signaturePad.toDataURL(format);
        }
    };

    DigitalSignature.prototype.getCurrentPage = function () {
        return this.currentPage;
    };

    DigitalSignature.prototype.getTotalPages = function () {
        return this.pdf.numPages;
    };

    DigitalSignature.prototype.loadNextPage = function () {
        if (this.currentPage < this.pdf.numPages)
            this.loadPage(this.currentPage + 1);
    };

    DigitalSignature.prototype.loadPreviousPage = function () {
        if (this.currentPage > 1)
            this.loadPage(this.currentPage - 1);
    };

    DigitalSignature.prototype.loadLastPage = function () {
        this.loadPage(this.pdf.numPages);
    };

    DigitalSignature.prototype.extractPageContent = function (pageNum) {
        var fromData = !pageNum || pageNum === this.currentPage ? this.signaturePad.toData() : this.history[pageNum];
        if (fromData) {
            var canvas = document.createElement('canvas');
            canvas.width = this.canvas.width;
            canvas.height = this.canvas.height;
            var tempSignaturePad = new SignaturePad(canvas);
            tempSignaturePad.fromData(fromData);
            tempSignaturePad.scale(1 / this.currentScale);
            if (!tempSignaturePad.isEmpty())
                return tempSignaturePad.removeBlanks();
        }
    }

    DigitalSignature.prototype.extractContent = function () {
        var struct = {};
        for (var i = 1; i <= this.pdf.numPages; i++) {
            struct[i] = this.extractPageContent(i);
        }
        return struct;
    }

    DigitalSignature.prototype.getScale = function () {
        return Math.round(100 * (this.currentScale / this.initScale));
    };

    return DigitalSignature;

})));