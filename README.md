폴더설명
- physionet.org : mimic-cxr/mimic-ecg data folder, jpg 파일은 용량때매 깃헙백업엔 빠져있음 
- rgrg : annotation 생성해주는 repo, 생성시키는 ann와 (같이 생성된다고 가정한) bounding box -> 'rgrg/results' 폴더 안에 있음
  Interaction code 추가: Reports에 마우스 올리면 해당 bounding box가 굵어짐, 해당하는 박스가 없는 sentence들도 존재
- web : 웹 구현 파트 - flask, html, d3.js

구동하려면
- Model ckpt https://github.com/ttanida/rgrg 에서 다운받아서 rgrg/src/full_model에 넣기 
- rgrg/environment.yml 으로 가상환경 생성
- rgrg/generate_reports_for_images.py 에서 main() path 수정 (ckpt/output path)
- web/app.py 에서 path 수정 (ABS_IMG_PATH 만)
