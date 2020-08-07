from __future__ import division
from modules.darknet.util import *
from modules.darknet.darknet import Darknet
from modules.darknet.preprocess import prep_image
from collections import defaultdict
import base64
import time
import os
import torch
from torch.autograd import Variable
import cv2


def start_images(images_directory, configuration, sio):
    sio.emit('progress', {"valid": True, 'message': "loading variables..."})
    output_path = str(configuration['output_path'])
    confidence = float(configuration['confidence'])
    nms_thresh = float(configuration['NMS'])
    input_resolution = int(configuration['res'])
    batch_size = int(configuration['batch_size'])

    print(input_resolution)

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
        sio.emit('progress', {"valid": True, 'message': "loading network..."})
        model = Darknet(configuration['cfg'])
    except:
        sio.emit('progress', {"valid": False, 'message': 'failed to load cfg file'})
        return
    try:
        model.load_weights(configuration['weights'])
        model.eval()
        sio.emit('progress', {"valid": True, 'message': "network loaded successfully"})
    except:
        sio.emit('progress', {"valid": False, 'message': 'failed to load weights'})
        return

    model.net_info["height"] = input_resolution
    inp_dim = int(model.net_info["height"])

    assert inp_dim % 32 == 0
    assert inp_dim > 32

    if CUDA:
        model.cuda()

    global start_time, suspicious_persons
    suspicious_persons = []
    start_time = time.time()

    imlist = []
    try:
        imlist = [os.path.join(os.path.realpath('.'),
                               images_directory, img) for img in os.listdir(images_directory) if
                  os.path.splitext(img)[1] == '.png' or
                  os.path.splitext(img)[1] == '.jpeg' or
                  os.path.splitext(img)[1] == '.jpg']

    except NotADirectoryError:
        sio.emit('progress', {"valid": False, 'message': 'Directory does not exists, select another directory'})

    if len(imlist) == 0:
        sio.emit('progress', {"valid": False, 'message': 'Directory contains no images, select another directory'})

    sio.emit('progress', {"valid": True, 'message': 'preparing images...'})
    load_batch = time.time()
    batches = list(map(prep_image, imlist, [inp_dim for x in range(len(imlist))]))
    im_batches = [x[0] for x in batches]
    orig_ims = [x[1] for x in batches]
    im_dim_list = [x[2] for x in batches]
    image_names = [x[3] for x in batches]
    im_dim_list = torch.FloatTensor(im_dim_list).repeat(1, 2)

    if CUDA:
        im_dim_list = im_dim_list.cuda()

    leftover = 0

    if (len(im_dim_list) % batch_size):
        leftover = 1

    if batch_size != 1:
        num_batches = len(imlist) // batch_size + leftover
        im_batches = [torch.cat((im_batches[i * batch_size: min((i + 1) * batch_size,
                                                                len(im_batches))])) for i in range(num_batches)]
    i = 0

    write = False
    start_det_loop = time.time()
    objs = {}

    sio.emit('progress', {"valid": True, 'message': 'performing detections...'})
    for batch in im_batches:
        # load the image
        start = time.time()
        if CUDA:
            batch = batch.cuda()

        with torch.no_grad():
            prediction = model(Variable(batch), CUDA)

        prediction = write_results(prediction, confidence, num_classes, nms=True, nms_conf=nms_thresh)
        if type(prediction) == int:
            i += 1
            continue
        end = time.time()
        prediction[:, 0] += i * batch_size

        if not write:
            output = prediction
            write = 1
        else:
            output = torch.cat((output, prediction))

        for im_num, image in enumerate(imlist[i * batch_size: min((i + 1) * batch_size, len(imlist))]):
            im_id = i * batch_size + im_num
            objs = [classes[int(x[-1])] for x in output if int(x[0]) == im_id]
        i += 1

        if CUDA:
            torch.cuda.synchronize()

    try:
        output
    except NameError:
        sio.emit('progress', {"valid": False, 'message': "No detections were made"})
        exit()

    im_dim_list = torch.index_select(im_dim_list, 0, output[:, 0].long())
    scaling_factor = torch.min(inp_dim / im_dim_list, 1)[0].view(-1, 1)

    output[:, [1, 3]] -= (inp_dim - scaling_factor * im_dim_list[:, 0].view(-1, 1)) / 2
    output[:, [2, 4]] -= (inp_dim - scaling_factor * im_dim_list[:, 1].view(-1, 1)) / 2

    output[:, 1:5] /= scaling_factor

    for i in range(output.shape[0]):
        output[i, [1, 3]] = torch.clamp(output[i, [1, 3]], 0.0, im_dim_list[i, 0])
        output[i, [2, 4]] = torch.clamp(output[i, [2, 4]], 0.0, im_dim_list[i, 1])

    output_recast = time.time()
    class_load = time.time()

    def filter(bbox_list_person, bbox_list_weapon):
        for i in bbox_list_weapon:
            for j in bbox_list_weapon[i]:
                for k in bbox_list_person[i]:
                    intersection_over_weapon(j, k, i)

        if len(suspicious_persons) > 0:
            max_IoW = max([item["suspicious_confidence"] for item in suspicious_persons])
            suspicious_person_max_IoW = [item for item in suspicious_persons if item["suspicious_confidence"] == max_IoW]
            for person in suspicious_person_max_IoW:
                cv2.rectangle(orig_ims[person["frame_number"]], (person["overlap_box"][0], person["overlap_box"][1]), (person["overlap_box"][2], person["overlap_box"][3]), (0, 0, 255), 2)
                cv2.rectangle(orig_ims[person["frame_number"]], (person["person_box"][0], person["person_box"][1]), (person["person_box"][2], person["person_box"][3]), (0, 0, 255), 2)

    def intersection_over_weapon(boxA, boxB, i):

        # extract parameters
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

        boxAArea = (Ax2 - Ax1) * (Ay2 - Ay1)
        boxBArea = (Bx2 - Bx1) * (By2 - By1)
        WoP = boxAArea / boxBArea

        # if boxes overlap
        if Ax1 < Bx2 and Ax2 > Bx1 and Ay1 < By2 and Ay2 > By1:
            if WoP > 0.02 and WoP < 0.4:
                # determine the (x, y)-coordinates of the intersection rectangle
                xA = max(Ax1, Bx1)
                yA = max(Ay1, By1)
                xB = min(Ax2, Bx2)
                yB = min(Ay2, By2)

                # compute the area of intersection rectangle
                interArea = (xB - xA) * (yB - yA)

                # compute the area of weapon rectangle
                boxAArea = (Ax2 - Ax1) * (Ay2 - Ay1)
                # boxBArea = (boxB[1][0] - Bx1) * (boxB[1][1] - boxB[0][1])

                # compute the intersection over union
                # # IoU = interArea / float(boxAArea + boxBArea - interArea)

                if boxAArea == interArea:
                    IoW = 1
                else:
                    IoW = float(interArea / boxAArea)

                suspicious_confidence = (IoW + Aconf + Bconf) / 3

                if suspicious_confidence > 0.3:
                    suspicious_person = {
                        "suspicious_confidence": suspicious_confidence,
                        "frame_number": i,
                        "person_box": [Bx1, By1, Bx2, By2],
                        "overlap_box": [xB, yB, xA, yA]
                    }
                    suspicious_persons.append(suspicious_person)
                    # cv2.rectangle(orig_ims[i], (xB, yB), (xA, yA), (0, 0, 255), 2)
                    # cv2.rectangle(orig_ims[i], (Bx1, By1), (Bx2, By2), (0, 0, 255), 2)

                    return True

        return False

    def write(x, results, bbox_list_person, bbox_list_weapon):
        c1 = (int(x[1]), int(x[2]))
        c2 = (int(x[3]), int(x[4]))
        # name = names[int(x[0])]
        img = results[int(x[0])]
        cls = int(x[-1])
        label = "{0}".format(classes[cls])
        t_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_PLAIN, 1, 1)[0]
        c3 = c1[0] + t_size[0] + 3, c1[1] + t_size[1] + 4

        if label == 'person':
            bbox_list_person[int(x[0])].append({
                'top-left': c1,
                'bottom-right': c2,
                'confidence': confidence
            })
            cv2.rectangle(img, c1, c2, (0, 255, 0), 3)
            cv2.rectangle(img, c1, c3, (0, 255, 0), -1)
            cv2.putText(img, label, (c1[0], c1[1] + t_size[1] + 4), cv2.FONT_HERSHEY_PLAIN, 1, [0, 0, 0], 1)

        elif label == 'weapon':
            bbox_list_weapon[int(x[0])].append({
                'top-left': c1,
                'bottom-right': c2,
                'confidence': confidence
            })
            cv2.rectangle(img, c1, c2, (255, 0, 0), 3)
            cv2.rectangle(img, c1, c3, (255, 0, 0), -1)
            cv2.putText(img, label, (c1[0], c1[1] + t_size[1] + 4), cv2.FONT_HERSHEY_PLAIN, 1, [225, 255, 255], 1)

    bbox_list_person = defaultdict(list)
    bbox_list_weapon = defaultdict(list)

    sio.emit('progress', {"valid": True, 'message': 'drawing bounding-boxes...'})
    drawing_bboxes_time = time.time()

    for detection in output:
        write(detection, orig_ims, bbox_list_person, bbox_list_weapon)

    filter(bbox_list_person, bbox_list_weapon)

    saving_photos_time = time.time()
    sio.emit('progress', {"valid": True, 'message': 'saving photos...'})
    list(map(lambda i: cv2.imwrite(os.path.join(os.path.join(output_path, 'snapshots'), image_names[i]), orig_ims[i]),
             range(len(orig_ims))))

    images = []
    results_time = time.time()
    sio.emit('progress', {"valid": True, 'message': 'fetching results...'})
    for image in orig_ims:
        im_encode = cv2.imencode('.jpg', image)[1]
        im_encode = base64.b64encode(im_encode)
        images.append(im_encode)

    end_time = time.time()
    data = {
        'status': 3,
        'images': images,
        'loading_batch': start_det_loop - load_batch,
        'detection': output_recast - start_det_loop,
        'drawing_boxes': end_time - drawing_bboxes_time,
        'average_per_image': (end_time - load_batch) / len(imlist),
        'saving_photos': results_time - saving_photos_time,
        'results': end_time - results_time,
        'end_time': end_time - start_time
    }

    sio.emit('progress', {"valid": True, 'message': 'fetching results done'})
    sio.emit('detection-started', data)
    torch.cuda.empty_cache()
