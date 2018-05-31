(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
        typeof define === 'function' && define.amd ? define(factory) :
            (global.DigitalSignature = factory());
}(this, function () {
    'use strict';

    function DigitalSignature(container, options) {
        var self = this;
        if (!container || container.tagName.toLowerCase() != "div") {
            throw new Error("Please provide a <div> container.");
        }
        var opts = options || {};
        if (!opts.onLoadPdf) {
            throw new Error("Please provide handler function for PDF load.");
        }
        this.canvas = document.createElement('canvas');
        this.empty(container);
        container.appendChild(this.canvas);
        this.canvas.getContext('2d').clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.onProgress = opts.onProgress;
        this.onComplete = opts.onComplete;
        this.onLoadPage = opts.onLoadPage;
        this.onLoadPdf = opts.onLoadPdf;
        this.penColor = opts.penColor || "#2b2bff";
        this.openLastPageFirst = opts.openLastPageFirst || false;
        this.enableTouchOnLoad = opts.enableTouchOnLoad || false;
        this.resizeDelay = opts.resizeDelay || 500;
        this.currentScale = this.initScale = 0;
        this.previousWidth = undefined;
        this.pdf = null;
        this.signaturePad = this.createSignaturePad(this.canvas);
        this.signaturePad.off();
        this.currentPage = 1;
        this.filename = opts.filename || "file.pdf";
        this.file = opts.file || new jsPDF().output('arraybuffer');
        this.renderTask = undefined;

        this.parentNodeOpacity = this.canvas.parentNode.style.opacity;
        this.parentNodeTransition = this.canvas.parentNode.style.transition;

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
        PDFJS.getDocument(this.file).then(function (_pdf) {
            self.pdf = _pdf;
            if (self.openLastPageFirst) {
                self.currentPage = self.pdf.numPages;
            }
            self.clearHistory();
            self.pdf.filename = self.filename;
            self.loadPage(self.currentPage);
            if (self.enableTouchOnLoad) {
                self.signaturePad.on();
            }
            self.canvas.parentNode.style.display = "inline-block";
            self.onLoadPdf(self);
        });
    }

    DigitalSignature.build = function (container, options) {
        return new DigitalSignature(container, options);
    }

    DigitalSignature.prototype.empty = function (element) {
        while (element.firstChild) element.removeChild(element.firstChild);
    }

    DigitalSignature.prototype.loadPage = function (pageNum, avoidScroll) {
        var self = this;
        if (this.signaturePad) {
            if (!this.signaturePad.isEmpty()) {
                this.history[this.currentPage].pointGroups = this.signaturePad.toData();
            }
            this.signaturePad.clear();
        } else {
            console.log("should not happen");
        }
        this.currentPage = pageNum;
        if (!avoidScroll) {
            window.scrollTo({
                top: self.canvas.parentNode.scrollTop,
                behavior: "smooth"
            });
        }
        self.canvas.parentNode.style.transition = "unset";
        self.canvas.parentNode.style.opacity = 0;
        this.renderPage(pageNum, this.canvas, this.signaturePad).then(function () {
            if (self.onLoadPage) self.onLoadPage(self);
            self.previousWidth = self.canvas.clientWidth;
            self.canvas.parentNode.style.transition = self.parentNodeTransition;
            self.canvas.parentNode.style.opacity = self.parentNodeOpacity;
        }).catch(function (e) {
            //Rendering task cancelled
        });
    };

    DigitalSignature.prototype.renderPage = function (pageNum, _canvas, _signaturePad) {
        var self = this;
        return this.pdf.getPage(pageNum).then(function (page) {
            var containerWidth = _canvas.clientWidth > 0 ? _canvas.clientWidth : _canvas.width;
            self.currentScale = self.initScale = containerWidth / page.getViewport(1.0).width;
            var viewport = page.getViewport(self.currentScale);
            _canvas.width = viewport.width;
            _canvas.height = viewport.height;
            var renderContext = {
                canvasContext: _canvas.getContext('2d'),
                viewport: viewport
            };
            if (self.renderTask) {
                self.renderTask.cancel();
            }
            self.renderTask = page.render(renderContext);
            return self.renderTask.then(function () {
                if (self.previousWidth && self.previousWidth != containerWidth) {
                    var ratio = containerWidth / self.previousWidth;
                    self.signaturePad.scale(ratio);
                    self.scaleHistory(ratio);
                }
                if (self.history[pageNum].images) {
                    var keys = Object.keys(self.history[pageNum].images);
                    for (var i = 0; i < keys.length; i++) {
                        var key = keys[i];
                        var img = self.history[pageNum].images[key];
                        renderContext.canvasContext.drawImage(img.image, img.offsetX, img.offsetY, img.image.width, img.image.height);
                    }
                }
                if (self.history[pageNum].pointGroups.length > 0) {
                    _signaturePad.fromData(self.history[pageNum].pointGroups);
                }
                return Promise.resolve(_signaturePad);
            }).catch(function (e) {
                return Promise.reject(e);
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
            this.history[pageNum] = {};
            this.history[pageNum].pointGroups = {};
            this.history[pageNum].images = {};
        }
        this.loadPage(pageNum);
    };

    DigitalSignature.prototype.clearHistory = function () {
        if (this.history) delete this.history;
        this.history = {};
        for (var i = 1; i <= this.getTotalPages(); i++) {
            this.history[i] = {};
            this.history[i].pointGroups = {};
            this.history[i].images = {};
        }
    };

    DigitalSignature.prototype.scaleHistory = function (ratio) {
        var keys = Object.keys(this.history);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var pointGroups = this.history[key].pointGroups;
            if (pointGroups)
                this.history[key].pointGroups = this.signaturePad.scalePoints(pointGroups, ratio);
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
            this.history[this.currentPage].pointGroups = this.signaturePad.toData();
        }
        var promises = new Array();
        for (var i = 1; i <= this.getTotalPages(); i++) {
            var canvas = document.createElement('canvas');
            canvas.width = this.canvas.width;
            canvas.height = this.canvas.height;
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
        if (this.currentPage < this.getTotalPages())
            this.loadPage(this.currentPage + 1);
    };

    DigitalSignature.prototype.loadPreviousPage = function () {
        if (this.currentPage > 1)
            this.loadPage(this.currentPage - 1);
    };

    DigitalSignature.prototype.loadLastPage = function () {
        this.loadPage(this.getTotalPages());
    };

    DigitalSignature.prototype.extractPageContent = function (pageNum) {
        var fromData = !pageNum || pageNum === this.currentPage ? this.signaturePad.toData() : this.history[pageNum].pointGroups;
        if (fromData && fromData.length > 0) {
            var initContent = this.scaleAndExtractContent(1 / this.currentScale, fromData);
            var scaledContent = this.scaleAndExtractContent(4 / this.currentScale, fromData);
            initContent.dataURL = scaledContent.dataURL;
            return initContent;
        }
    }

    DigitalSignature.prototype.scaleAndExtractContent = function (ratio, fromData) {
        var canvas = document.createElement('canvas');
        canvas.width = this.canvas.width;
        canvas.height = this.canvas.height;
        var tempSignaturePad = new SignaturePad(canvas, {
            minWidth: this.signaturePad.minWidth * ratio,
            maxWidth: this.signaturePad.maxWidth * ratio
        });
        tempSignaturePad.fromData(fromData);
        if (!tempSignaturePad.isEmpty()) {
            tempSignaturePad.scale(ratio);
            return tempSignaturePad.removeBlanks();
        }
    }

    DigitalSignature.prototype.extractContent = function () {
        var struct = {};
        for (var i = 1; i <= this.getTotalPages(); i++) {
            var pageContent = this.extractPageContent(i);
            if (pageContent)
                struct[i] = pageContent;
        }
        return struct;
    }

    DigitalSignature.prototype.getScale = function () {
        return Math.round(100 * (this.currentScale / this.initScale));
    };

    DigitalSignature.prototype.drawImage = function (imageFile) {
        var self = this;
        var canvas = document.createElement('canvas');
        canvas.cumulativeOffset = function () {
            var top = 0, left = 0;
            var element = this;
            do {
                top += element.offsetTop || 0;
                left += element.offsetLeft || 0;
                element = element.offsetParent;
            } while (element);
            return {
                top: top,
                left: left
            };
        };
        canvas.className = "temp-canvas";
        canvas.width = self.canvas.width;
        canvas.height = self.canvas.height;
        document.querySelector("[class=signature-pad--body]").appendChild(canvas);
        var ctx = canvas.getContext('2d');
        var img = new Image();
        canvas.onmousedown = function (e) {
            //this.canMouseX=parseInt(e.clientX-offsetX);
            //this.canMouseY=parseInt(e.clientY-offsetY);
            // set the drag flag
            this.isDragging = true;
        }
        canvas.onmousemove = function (e) {
            this.canMouseX = parseInt(e.clientX + window.scrollX);
            this.canMouseY = parseInt(e.clientY + window.scrollY);

            // if the drag flag is set, clear the canvas and draw the image
            if (this.isDragging) {
                var cumulativeOffset = canvas.cumulativeOffset();
                this.draw(img, this.canMouseX - (img.width / 2) - cumulativeOffset.left, this.canMouseY - (img.height / 2) - cumulativeOffset.top);
            }
        }
        canvas.onmouseup = function (e) {
            //this.canMouseX=parseInt(e.clientX-offsetX);
            //this.canMouseY=parseInt(e.clientY-offsetY);
            // clear the drag flag
            this.isDragging = false;
        }
        canvas.onmouseout = function (e) {
            //this.canMouseX=parseInt(e.clientX-offsetX);
            //this.canMouseY=parseInt(e.clientY-offsetY);
            // user has left the canvas, so clear the drag flag
            this.isDragging = false;
        }
        canvas.draw = function (image, offsetX, offsetY) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            this.imageOptions = {
                "image": image,
                "offsetX": offsetX,
                "offsetY": offsetY
            }
            ctx.drawImage(image, offsetX, offsetY, img.width, img.height);
        }

        this.tempCanvas = canvas;
        img.onload = function () {
            canvas.draw(this, (canvas.width / 2) - (img.width / 2), (canvas.height / 2) - (img.height / 2));
        };
        img.src = imageFile;
    };

    DigitalSignature.prototype.scaleImage = function (percent) {
        if (this.tempCanvas) {
            if (!this.tempCanvas.imageOptions.image.initWidth && !this.tempCanvas.imageOptions.image.initHeight) {
                this.tempCanvas.imageOptions.image.initWidth = this.tempCanvas.imageOptions.image.width;
                this.tempCanvas.imageOptions.image.initHeight = this.tempCanvas.imageOptions.image.height;
            }
            this.tempCanvas.imageOptions.image.width = this.tempCanvas.imageOptions.image.initWidth * (percent / 100);
            this.tempCanvas.imageOptions.image.height = this.tempCanvas.imageOptions.image.initHeight * (percent / 100);
            this.tempCanvas.draw(this.tempCanvas.imageOptions.image, this.tempCanvas.imageOptions.offsetX, this.tempCanvas.imageOptions.offsetY);
        }
    }

    DigitalSignature.prototype.saveImage = function () {
        if (this.tempCanvas) {
            var length = Object.keys(this.history[this.currentPage].images).length;
            this.history[this.currentPage].images[length] = {
                "image": this.tempCanvas.imageOptions.image,
                "offsetX": this.tempCanvas.imageOptions.offsetX,
                "offsetY": this.tempCanvas.imageOptions.offsetY
            };
            this.tempCanvas.remove();
            this.loadPage(this.currentPage);
        }
    }

    DigitalSignature.prototype.cancelImage = function () {
        if (this.tempCanvas) {
            this.tempCanvas.remove();
            this.loadPage(this.currentPage);
        }
    }

    DigitalSignature.prototype.applyOnAllPages = function () {
        for (var i = 1; i <= this.getTotalPages(); i++) {
            if (this.currentPage != i) {
                var temp = {};
                temp.pointGroups = !this.signaturePad.isEmpty() ? this.signaturePad.toData() : {};
                if (this.history[this.currentPage].images) {
                    var tempImages = {};
                    var keys = Object.keys(this.history[this.currentPage].images);
                    for (var j = 0; j <= keys.length; j++) {
                        var key = keys[j];
                        if (key) {
                            if (this.history[this.currentPage].images[key].image) {
                                var tempImage = new Image();
                                tempImage.src = this.history[this.currentPage].images[key].image.src;
                                tempImage.width = this.history[this.currentPage].images[key].image.width;
                                tempImage.height = this.history[this.currentPage].images[key].image.height;
                                tempImages[key] = {};
                                tempImages[key].image = tempImage;
                                tempImages[key].offsetX = this.history[this.currentPage].images[key].offsetX;
                                tempImages[key].offsetY = this.history[this.currentPage].images[key].offsetY;
                            }
                        }
                    }
                    temp.images = tempImages;
                }
                this.history[i] = temp;
            }
        }
    }

    DigitalSignature.prototype.enableTouch = function (enable) {
        if (enable) {
            this.signaturePad.on();
        } else {
            this.signaturePad.off();
        }
    }

    DigitalSignature.prototype.undo = function () {
        this.signaturePad._data.pop();
        this.loadPage(this.currentPage, true);
    }

    DigitalSignature.prototype.orientationChange = function (eventEmitter) {
        var self = this;
        var afterOrientationChange = function () {
            self.loadPage(self.currentPage);
            eventEmitter.removeEventListener('resize', afterOrientationChange);
        };
        eventEmitter.addEventListener('resize', afterOrientationChange);
    }

    DigitalSignature.prototype.onResize = function () {
        var self = this;
        self.canvas.parentNode.style.transition = "unset";
        self.canvas.parentNode.style.opacity = 0;
        clearTimeout(self.resizeTimer);
        self.resizeTimer = setTimeout(function () {
            self.loadPage(self.currentPage);
        }, self.resizeDelay);
    }

    DigitalSignature.prototype.registerDeviceOrientationEvents = function (eventEmitter) {
        var self = this;
        eventEmitter.addEventListener(("onorientationchange" in eventEmitter) ? "orientationchange" : "resize", function (e) {
            if (e.type == "resize") {
                self.onResize();
            } else {
                self.orientationChange(eventEmitter);
            }
        });
    }

    return DigitalSignature;
}));