// Modules to control application life and create native browser window
const { app, BrowserWindow, shell } = require('electron');
const io = require('socket.io-client');
const url = require("url");
const path = require("path");

var socket = io.connect("http://localhost:9009/");
socket.emit('user-connected', 'electron');

// Enable live reload for Electron too
require('electron-reload')(__dirname, {
  // Note that the path to electron may vary according to the main file
  electron: require(`${__dirname}/node_modules/electron`)
});

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    frame: false,
    fullscreen: true,
    webPreferences: {
      // devTools: false
    }
  });
  // and load the url of the app
  mainWindow.loadURL('http://localhost:4200/');
}

app.on('ready', () => {
  createWindow();

});

socket.on('close-app', (command) => {
  if (command == 'close') {
    app.quit();
  }
  if (command == 'minimize') {
    BrowserWindow.getFocusedWindow().minimize();
  }
});

socket.on('file-explorer', (data) => {
  if(data.command == 'output'){
    shell.openItem(data.path)
  }
});

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  socket.emit('disconnect', true);
  if (process.platform !== 'darwin') app.quit()
});
