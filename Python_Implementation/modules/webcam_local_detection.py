from __future__ import division
from modules.darknet.util import *
from modules.darknet.darknet import Darknet
import base64
import time
import cv2
import torch
from torch.autograd import Variable
import os
from datetime import datetime


def start_local_webcam(camera_port, configuration, sio):
    def prep_image(img, inp_dim):
        orig_im = img
        dim = orig_im.shape[1], orig_im.shape[0]
        img = cv2.resize(orig_im, (inp_dim, inp_dim))
        img_ = img[:, :, ::-1].transpose((2, 0, 1)).copy()
        img_ = torch.from_numpy(img_).float().div(255.0).unsqueeze(0)
        return img_, orig_im, dim

    def write(x, img, bbox_list_person, bbox_list_weapon, classes):
        c1 = tuple(x[1:3].int().tolist())
        c2 = tuple(x[3:5].int().tolist())
        cls = int(x[-1])
        confidence = float(x[5])
        label = ''
        try:
            label = classes[cls]
        except:
            pass

        t_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_PLAIN, 1, 1)[0]
        c3 = c1[0] + t_size[0] + 3, c1[1] + t_size[1] + 4

        if label == 'weapon' and confidence > 0 and confidence < 1:
            sio.emit("confidence_weapon", {'confidence': confidence})
            bbox_list_weapon.append({
                'top-left': c1,
                'bottom-right': c2,
                'confidence': confidence
            })
            # cv2.rectangle(img, c1, c2, (255, 0, 0), 2)
            # cv2.rectangle(img, c1, c3, (255, 0, 0), -1)
            # cv2.putText(img, label, (c1[0], c1[1] + t_size[1] + 4), cv2.FONT_HERSHEY_PLAIN, 1, [225, 255, 255], 1)

        elif label == 'person' and confidence > 0:
            sio.emit("confidence_person", {'confidence': confidence})
            bbox_list_person.append({
                'top-left': c1,
                'bottom-right': c2,
                'confidence': confidence
            })
            # cv2.rectangle(img, c1, c2, (0, 255, 0), 2)
            # cv2.rectangle(img, c1, c3, (0, 255, 0), -1)
            # cv2.putText(img, label, (c1[0], c1[1] + t_size[1] + 4), cv2.FONT_HERSHEY_PLAIN, 1, [0, 0, 0], 1)

    def filter(bbox_list_person, bbox_list_weapon, frame_number, IoW_thresh, path):
        IoW = []
        for j in bbox_list_weapon:
            for k in bbox_list_person:
                IoW.append(intersection_over_weapon(j, k, frame_number, IoW_thresh, path))
        return IoW

    def intersection_over_weapon(boxA, boxB, frame_number, IoW_thresh, path):

        Ax1 = boxA['top-left'][0]
        Ay1 = boxA['top-left'][1]
        Ax2 = boxA['bottom-right'][0]
        Ay2 = boxA['bottom-right'][1]
        Aconf = boxA['confidence']

        Bx1 = boxB['top-left'][0]
        By1 = boxB['top-left'][1]
        Bx2 = boxB['bottom-right'][0]
        By2 = boxB['bottom-right'][1]
        Bconf = boxB['confidence']

        # if boxes overlap
        if Ax1 < Bx2 and Ax2 > Bx1 and Ay1 < By2 and Ay2 > By1:

            # determine the (x, y)-coordinates of the intersection rectangle
            xA = max(Ax1, Bx1)
            yA = max(Ay1, By1)
            xB = min(Ax2, Bx2)
            yB = min(Ay2, By2)

            # compute the area of intersection rectangle
            interArea = (xB - xA) * (yB - yA)

            # compute the area of weapon rectangle
            boxAArea = (Ax2 - Ax1) * (Ay2 - Ay1)

            # compute the intersection over union
            # # IoU = interArea / float(boxAArea + boxBArea - interArea)

            if boxAArea == interArea:
                IoW = 1
            else:
                IoW = float(interArea / boxAArea)

            suspicious_confidence = (IoW + Aconf + Bconf) / 3

            if suspicious_confidence > IoW_thresh:
                # weapon box center point
                Acen = {'x': (Ax2 + Ax1) / 2, 'y': (Ay2 + Ay1) / 2}
                # cv2.rectangle(orig_im, (xB, yB), (xA, yA), (0, 0, 255), 2)
                cv2.rectangle(orig_im, (Bx1, By1), (Bx2, By2), (0, 0, 255), 2)
                # crop person
                suspicious_person = orig_im[By1:By2, Bx1:Bx2]

                # save image
                cv2.imwrite(os.path.join(path, 'detections') + "/" + str(frame_number) + ".jpg", suspicious_person)

                sio.emit('confidence_suspicious', {
                    'IoW': suspicious_confidence,
                    'location': Acen
                })
                return True

        return False

    output_path = configuration['output_path']
    confidence = float(configuration['confidence'])
    nms_thresh = float(configuration['NMS'])
    input_resolution = int(configuration['res'])
    IoW_thresh = float(configuration['IoW'])

    if not os.path.exists(os.path.join(output_path, 'detections')):
        os.mkdir(os.path.join(output_path, 'detections'))
    if not os.path.exists(os.path.join(output_path, 'videos')):
        os.mkdir(os.path.join(output_path, 'videos'))
    if not os.path.exists(os.path.join(output_path, 'snapshots')):
        os.mkdir(os.path.join(output_path, 'snapshots'))

    CUDA = torch.cuda.is_available()
    classes = load_classes(str(configuration['classes']))
    num_classes = 2

    model = None
    try:
        model = Darknet(configuration['cfg'])
    except:
        sio.emit('progress', {"valid": False, "message": "Invalid cfg file, select cfg compatible with YOLO"})
        return
    try:
        model.load_weights(configuration['weights'])
        model.eval()
    except:
        sio.emit('progress', {"valid": False, "message": "Invalid weights file, select weights compatible with YOLO"})
        return

    model.net_info["height"] = input_resolution
    inp_dim = int(model.net_info["height"])

    assert inp_dim % 32 == 0
    assert inp_dim > 32

    if CUDA:
        model.cuda()

    cap = cv2.VideoCapture(camera_port)
    assert cap.isOpened(), 'cannot capture'

    frame_width = int(cap.get(3))
    frame_height = int(cap.get(4))
    # Define the codec and create VideoWriter object
    out = cv2.VideoWriter(os.path.join(output_path, 'videos') + '/output.avi',
                          cv2.VideoWriter_fourcc('M', 'J', 'P', 'G'), 15, (frame_width, frame_height))

    sio.emit('tots', {"width": frame_width, "height": frame_height})

    global frames_processed, command, start_time, output, stay, frame_number
    output = static_back = None
    frames_processed = frame_number = 0
    command = 'play'
    time_interval = 1
    stay = False

    start_time = time.time()
    sio.emit('progress', {"valid": True})

    while True:
        try:
            @sio.on('video-command')
            def message(data):
                global command, stay, start_time, frames_processed
                command = str(data)
                if command == 'play' or command == 'record':
                    stay = False
                    frames_processed = 0
                    start_time = time.time()
                print(command)

            frames_processed = frames_processed + 1
            if stay:
                continue

            bbox_list_person = []
            bbox_list_weapon = []
            ret, frame = cap.read()

            if ret:
                img, orig_im, dim = prep_image(frame, inp_dim)
                im_dim = torch.FloatTensor(dim).repeat(1, 2)

                frame_gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                frame_gray = cv2.GaussianBlur(frame_gray, (21, 21), 0)

                if static_back is None:
                    static_back = frame_gray
                    continue

                # Difference between static background
                diff_frame = cv2.absdiff(static_back, frame_gray)
                thresh_frame = cv2.threshold(diff_frame, 30, 255, cv2.THRESH_BINARY)[1]
                thresh_frame = cv2.dilate(thresh_frame, None, iterations=2)

                cnts, hierarchy = cv2.findContours(thresh_frame.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

                is_motion = False
                for contour in cnts:
                    if cv2.contourArea(contour) < 1000:
                        continue
                    is_motion = True

                is_detected = False
                if is_motion and frame_number % 3 == 0:
                    if CUDA:
                        im_dim = im_dim.cuda()
                        img = img.cuda()

                    output = None
                    try:
                        output = model(Variable(img), CUDA)
                        output = write_results(output, confidence, num_classes, nms=True, nms_conf=nms_thresh)
                    except:
                        sio.emit('progress', {"valid": False, 'message': 'CUDA, out of memory error. '
                                                                         'Please reduce input resolution'})
                        return

                    if type(output) != int:

                        output[:, 1:5] = torch.clamp(output[:, 1:5], 0.0, float(inp_dim)) / inp_dim
                        output[:, [1, 3]] *= frame.shape[1]
                        output[:, [2, 4]] *= frame.shape[0]

                        if 0 not in [int(det[-1]) for det in output.tolist()]:
                            sio.emit("confidence_weapon", {'confidence': 0})
                        if 1 not in [int(det[-1]) for det in output.tolist()]:
                            sio.emit("confidence_person", {'confidence': 0})

                        for detection in output:
                            write(detection, orig_im, bbox_list_person, bbox_list_weapon, classes)

                        sio.emit("confidence_suspicious", {'IoW': 0})
                        if len(bbox_list_weapon) > 0:
                            IoW_list = filter(bbox_list_person, bbox_list_weapon, frame_number, IoW_thresh, output_path)
                            if True in IoW_list:
                                time_interval = time_interval + 1
                        else:
                            time_interval = 1

                frame_number += 1
                process_fps = frames_processed / (time.time() - start_time)
                print(process_fps)

                if time_interval % 5 == 0:
                    is_detected = True

                im_encode = cv2.imencode('.jpg', orig_im)[1]
                im_encode = base64.b64encode(im_encode)

                data = {
                    "status": 0,
                    'image': im_encode,
                    'frames_processed': frame_number,
                    'fps': process_fps,
                    'date': str(datetime.now()),
                    'isDetection': is_detected
                }
                sio.emit('detection-started', data)

                if command == 'play':
                    continue
                if command == "stay":
                    stay = True
                if command == 'record':
                    out.write(frame)
                    continue
                if command == 'exit':
                    cap.release()
                    return
                if command == 'snap':
                    cv2.imwrite(os.path.join(output_path, 'snapshots') + "/Snap_" + str(frame_number) + ".jpg", orig_im)
                    command = 'stay'
            else:
                break

        except KeyError:
            sio.emit('progress', {"valid": False, 'message': 'Internal error occured, Please try again'})
    cap.release()
