폴더설명
- physionet.org : mimic-cxr data folder, jpg 파일은 용량때매 깃헙백업엔 빠져있음 
- rgrg : annotation 생성해주는 repo, 생성시키는 ann와 (같이 생성된다고 가정한) bounding box -> 'rgrg/results' 폴더 안에 있음
  
  Bounding Box는 정면 view를 기준으로 생성: 몇개만 rgrg/results/bounding_box 안에 생성, 해당 파일만 [Show Bounding Box] 버튼 작동
  
  Interaction code 추가: Reports에 마우스 올리면 해당 bounding box가 굵어짐, 해당하는 박스가 없는 sentence들도 있음 (전체적으로 abnormality가 없다 이런 내용은 박스 안만듦)
- web : 웹 구현 파트 - flask, html 

구동하려면
- Model ckpt https://github.com/ttanida/rgrg 에서 다운받아서 rgrg/src/full_model에 넣기 
- rgrg/environment.yml 으로 가상환경 생성
- rgrg/generate_reports_for_images.py 에서 main() path 수정 (ckpt/output path)
- web/app.py 에서 path 수정 (아마 ABS_IMG_PATH 만)
