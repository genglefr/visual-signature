if (window.require) {
    var BrowserWindow = require('electron');
    var minButton = wrapper.querySelector("[data-action=minimize]");
    minButton.style.display = "inline-block";
    minButton.addEventListener("click", function (e) {
        var window = BrowserWindow.remote.getCurrentWindow();
        window.minimize();
    });

    var maxButton = wrapper.querySelector("[data-action=maximize]");
    var restoreButton = wrapper.querySelector("[data-action=restore]");
    var bounds = null;
    maxButton.style.display = "inline-block";
    maxButton.addEventListener("click", function (e) {
        var window = BrowserWindow.remote.getCurrentWindow();
        bounds = window.getBounds();
        window.maximize();
        window.setResizable(false);
        window.setMovable(false);
        maxButton.style.display = "none";
        restoreButton.style.display = "inline-block";
    });

    restoreButton.addEventListener("click", function (e) {
        var window = BrowserWindow.remote.getCurrentWindow();
        window.setBounds(bounds);
        window.setResizable(true);
        window.setMovable(true);
        restoreButton.style.display = "none";
        maxButton.style.display = "inline-block";
    });

    var closeButton = wrapper.querySelector("[data-action=close]");
    closeButton.style.display = "inline-block";
    closeButton.addEventListener("click", function (e) {
        var window = BrowserWindow.remote.getCurrentWindow();
        window.close();
    });
}