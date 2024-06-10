from flask import Flask, render_template, request, jsonify, send_from_directory, url_for
import wfdb
import os
import glob
import json
from datetime import date, datetime, time
import subprocess
import pandas as pd

app = Flask(__name__)

DATA_FOLDER = './physionet.org/files/mimic-iv-ecg/1.0/files'

IMAGE_BASE_DIR = './physionet.org/files/mimic-cxr-jpg/2.1.0/files/p10'
RESULTS_PATH = './rgrg/results/test_reports_temp.txt'
BBOX_PATH = './rgrg/results/bounding_box'

#Need Absolute path for cxr model inference: NEED TO BE MODIFIED
ABS_IMG_PATH = './physionet.org/files/mimic-cxr-jpg/2.1.0/files/p10'

pharmacy_data = pd.read_csv('./pharmacy.csv')
demographics_data = pd.read_csv('./patients_demographics.csv')


@app.route('/api/demographics/<patient_id>', methods=['GET'])
def get_demographics_data(patient_id):
    filtered_data = demographics_data[demographics_data['subject_id'] == int(patient_id[1:])]
    if not filtered_data.empty:
        return filtered_data.to_json(orient='records')
    else:
        return jsonify({'error': 'No data found for this patient ID'}), 404


@app.route('/api/pharmacy/<patient_id>', methods=['GET'])
def get_pharmacy_data(patient_id):
    filtered_data = pharmacy_data[pharmacy_data['subject_id'] == int(patient_id[1:])]
    return filtered_data.to_json(orient='records')

def list_patients():
    return os.listdir(IMAGE_BASE_DIR)

def default_serializer(obj):
    """JSON serializer for non-serializable objects."""
    if isinstance(obj, (datetime, date, time)):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")

@app.route('/api/data/<patient_id>/<record_name>', methods=['GET'])
def get_data(patient_id, record_name):
    sub_folder = patient_id[:5]
    record_path = os.path.join(DATA_FOLDER, sub_folder, patient_id, record_name, record_name[1:])
    if not os.path.exists(record_path + '.dat') or not os.path.exists(record_path + '.hea'):
        return jsonify({"error": "Record not found"}), 404

    # Read the record
    signals, fields = wfdb.rdsamp(record_path)

    # Serialize the fields
    fields_serializable = json.loads(json.dumps(fields, default=default_serializer))

    return jsonify({
        "signals": signals.tolist(),
        "fields": fields_serializable
    })

@app.route('/api/list', methods=['GET'])
def get_list():
    patient_ids = []
    for sub_folder in glob.glob(os.path.join(DATA_FOLDER, 'p*')):
        for patient_dir in glob.glob(os.path.join(sub_folder, 'p*')):
            patient_id = os.path.basename(patient_dir)
            records = []
            for record_dir in glob.glob(os.path.join(patient_dir, 's*/')):
                record_name = os.path.basename(record_dir.strip('/'))
                records.append(record_name)
            patient_ids.append({'patient_id': patient_id, 'records': records})
            
    patient_ids.sort(key=lambda x: x['patient_id'])

    return jsonify(patient_ids)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory('static', path)

# ----------------------------------------------------------------------------------------------------------

@app.route('/patient/<patient_id>')
def patient(patient_id):
    img_folders = os.listdir(os.path.join(IMAGE_BASE_DIR, patient_id))
    img_folders.pop(0)
    img_folders.sort()
    return jsonify(img_folders)


# @app.route('/images/<path:filename>')
# def serve_image(filename):
#     return send_from_directory(IMAGE_BASE_DIR, filename)

# @app.route('/patient/<patient_id>/<image_folder>')
# def radio_study(patient_id, image_folder):
#     images_path = os.path.join(IMAGE_BASE_DIR, patient_id, image_folder)
#     images = os.listdir(images_path) 
#     images = [f for f in images if f.endswith(('.png', '.jpg', '.jpeg'))]
#     image_urls = [url_for('serve_image', filename=os.path.join(patient_id, image_folder, img)) for img in images]
#     return render_template('radio_study.html', patient_id=patient_id, image_folder=image_folder, images=image_urls)

# @app.route('/annotate-image', methods=['POST'])
# def annotate_image():
#     data = request.json
#     image_path = data.get('image_path')
#     image_path = os.path.join(ABS_IMG_PATH, image_path[8:])
#     subprocess.run(['python', '../rgrg/generate_reports_for_images.py', '--images', image_path])
#     with open(RESULTS_PATH, 'r') as file:
#         report = ''.join(file.readlines()[1])
#     return jsonify({'report': report})


# @app.route('/bounding-boxes', methods=['POST'])
# def get_bounding_boxes():
#     data = request.json
#     patient_id = data.get('patient_id')
#     image_folder = data.get('image_folder')
#     bbox_file_path = os.path.join(BBOX_PATH, patient_id, f"{image_folder}.txt")
#     bounding_boxes = []
#     if os.path.exists(bbox_file_path):
#         with open(bbox_file_path, 'r') as file:
#             for line in file:
#                 bounding_boxes.append([int(coord) for coord in line.strip().split()])

#     return jsonify({'bounding_boxes': bounding_boxes})


# Helper function to get the full image path
def get_image_full_path(patient_id, image_folder):
    return os.path.join(IMAGE_BASE_DIR, patient_id, image_folder)

@app.route('/get-patients')
def get_patients():
    # Replace with logic to get a list of patient IDs
    patients = os.listdir(IMAGE_BASE_DIR)
    return jsonify(patients)

@app.route('/get-records/<patient_id>')
def get_records(patient_id):
    # Replace with logic to get a list of records for a patient
    patient_path = os.path.join(IMAGE_BASE_DIR, patient_id)
    records = [name for name in os.listdir(patient_path) if os.path.isdir(os.path.join(patient_path, name))]
    return jsonify(records)

@app.route('/patient/<patient_id>/<image_folder>')
def radio_study(patient_id, image_folder):
    images_path = get_image_full_path(patient_id, image_folder)
    images = os.listdir(images_path)
    images = [f for f in images if f.endswith(('.png', '.jpg', '.jpeg'))]
    image_urls = [url_for('serve_image', filename=os.path.join(patient_id, image_folder, img)) for img in images]
    return jsonify({'images': image_urls})

@app.route('/images/<path:filename>')
def serve_image(filename):
    return send_from_directory(IMAGE_BASE_DIR, filename)

@app.route('/annotate-image', methods=['POST'])
def annotate_image():
    data = request.json
    image_path = data.get('image_path')
    image_path = os.path.join(ABS_IMG_PATH, image_path[8:])  # Adjust to strip '/images/' prefix
    subprocess.run(['python', './rgrg/generate_reports_for_images.py', '--images', image_path])
    with open(RESULTS_PATH, 'r') as file:
        report = ''.join(file.readlines()[1])
    return jsonify({'report': report})

@app.route('/bounding-boxes', methods=['POST'])
def get_bounding_boxes():
    data = request.json
    patient_id = data.get('patient_id')
    image_folder = data.get('image_folder')
    bbox_file_path = os.path.join(BBOX_PATH, patient_id, f"{image_folder}.txt")
    bounding_boxes = []
    if os.path.exists(bbox_file_path):
        with open(bbox_file_path, 'r') as file:
            for line in file:
                bounding_boxes.append([int(coord) for coord in line.strip().split()])

    return jsonify({'bounding_boxes': bounding_boxes})

if __name__ == '__main__':
    app.run(debug=True)
