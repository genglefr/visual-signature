importScripts(
    "./forked_components/jspdf/jspdf.js",
    "./forked_components/jspdf/plugins/addimage.js"
);

self.addEventListener('message', function(e) {
    var data = e.data;
    var length = Object.keys(data).length;
    var inc = 100/length;
    var doc = null;
    for (var i = 0; i < length; i++) {
        var page = data[i];
        if (doc){
            doc.addPage(page.format, page.orientation);
        } else {
            doc = new jsPDF(page.orientation, "pt", page.format);
        }
        doc.addImage(page.dataUrl, 'JPEG', 0, 0, doc.internal.pageSize.width, doc.internal.pageSize.height);
        self.postMessage({'status':"progress", 'value':(i+1)*inc});
    }
    self.postMessage({'status':"complete", 'value':doc.output('datauristring')});
}, false);