var electronInstaller = require('electron-winstaller');
resultPromise = electronInstaller.createWindowsInstaller({
    appDirectory: './release-builds/visual-sign-win32-ia32',
    loadingGif : './app/assets/spikeseed_white_loading.gif',
    outputDirectory: './release-builds/visual-sign-win32-installer',
    authors: 'Genglefr',
    exe: 'visual-sign.exe',
    setupIcon : './app/assets/spikeseed_vXb_icon.ico'
});

resultPromise.then(() => console.log("Done."), (e) => console.log(`Error: ${e.message}`));