var express = require('express');
var bodyParser = require('body-parser');
var socket = require('socket.io');
var fs = require('fs');
const app = express();
const port = 9009;

var clients = {
    python: '',
    angular: '',
    electron: ''
};

//app configuration
app.use(bodyParser.json());

app.use((request, response, next) => {
    response.header("Access-Control-Allow-Origin", "*");
    response.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.use(express.static(__dirname + '/dist'));

app.get('/*', function (req, res) {
    res.send('hello from the server');
    // res.sendFile(path.join(__dirname, '/dist/ea-hybrid-app/index.html'));
});


var server = app.listen(port, () => {
    console.log('Express Server is running to port ' + port);
});

//Socket setup
var io = socket(server);

io.on('connection', function (socket) {

    socket.on('user-connected', function (name) {
        if (name == 'python') {
            clients.python = socket.id;
        }
        if (name == 'electron') {
            clients.electron = socket.id;
        }
        else if (name == 'angular') {
            clients.angular = socket.id;
        }
        console.log(clients);
    });

    socket.on('user-disconnected', function (name) {
        if (name == 'python') {
            clients.python = '';
        }
        if (name == 'electron') {
            clients.electron = '';
        }
        else if (name == 'angular') {
            clients.angular = '';
        }
        console.log(clients);
    });

    socket.on('start-detection', function (data) {
        io.to(clients.python).emit('start-detection', data);
    });

    socket.on('detection-started', function (data) {
        if (data.status == 0) {
            let base64_code = data.image.toString();
            base64_code = "data:image/jpeg;base64," + base64_code;
            data.image = base64_code;
        }
        else if (data.status == 3) {
            let images = []
            for (let i = 0; i < data.images.length; i++) {
                images.push("data:image/jpeg;base64," + data.images[i].toString());
            }
            data.images = images;
        }
        io.to(clients.angular).emit('detection-started', data);
    });

    socket.on('close-app', function (data) {
        io.to(clients.electron).emit('close-app', data);
    });

    socket.on('file-explorer', function (data) {
        io.to(clients.electron).emit('file-explorer', data);
    });

    socket.on('video-command', function (data) {
        // console.log(data);
        io.to(clients.python).emit('video-command', data);
    });

    socket.on('tots', function (tots) {
        io.to(clients.angular).emit('tots', tots);
    });

    socket.on('confidence_person', function (data) {
        io.to(clients.angular).emit('confidence_person', data);
    });

    socket.on('confidence_weapon', function (data) {
        io.to(clients.angular).emit('confidence_weapon', data);
    });

    socket.on('confidence_suspicious', function (data) {
        io.to(clients.angular).emit('confidence_suspicious', data);
    });

    socket.on('progress', function (data) {
        io.to(clients.angular).emit('progress', data);
    });

    socket.on('validate-config', (output_path) => {
        try {
            fs.statSync(output_path);
            output_path = true;
        }
        catch (err) {
            if (err.code === 'ENOENT') output_path = false;
        }
        io.to(clients.angular).emit('validate-config', output_path)
    });

    socket.on('message', (err) => {
        console.log(err);
    })

    socket.on('disconnect', (err) => {
        io.to(clients.python).emit('disconnect', true)
    });

    socket.on('python_client', (data) => {
        if (clients.python == '') io.to(clients.angular).emit('python_client', false);
        else io.to(clients.angular).emit('python_client', true);
    });
});

io.of('/stream').clients((error, clients) => {
    if (error) throw error;
    console.log(clients);
});