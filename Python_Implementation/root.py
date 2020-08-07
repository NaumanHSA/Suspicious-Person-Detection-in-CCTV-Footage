import socketio
from modules.video_detection import start_video
from modules.webcam_local_detection import start_local_webcam
from modules.webcam_remote_detection import start_remote_webcam
from modules.images_detection import start_images

sio = socketio.Client()
SERVER_PATH = 'http://localhost:9009'

@sio.event
def connect():
    sio.emit('user-connected', 'python')
    print('connection established')
 

@sio.event
def connect_error():
    print("The connection failed!")


@sio.event
def disconnect():
    sio.emit('user-disconnected', 'python')
    print("I'm disconnected!")


@sio.on('start-detection')
def message(data):
    if data['status'] == 'video':
        start_video(data['port'], data['configuration'], sio)
    if data['status'] == 'webcame-local':
        start_local_webcam(data['port'], data['configuration'], sio)
    if data['status'] == 'webcame-remote':
        start_remote_webcam(data['port'], data['configuration'], sio)
    if data['status'] == 'images':
        start_images(data['port'], data['configuration'], sio)


if __name__ == '__main__':

    sio.connect(SERVER_PATH)
    sio.wait()
    sio.disconnect()
