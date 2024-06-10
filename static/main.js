document.addEventListener("DOMContentLoaded", function() {
    const patientSelect = document.getElementById('patient-select');
    const recordSelect = document.getElementById('record-select');
    const loadDataButton = document.getElementById('load-data');
    const loadCxrButton = document.getElementById('load-cxr-data');
    const zoomInButton = document.getElementById('zoom-in');
    const zoomOutButton = document.getElementById('zoom-out');
    const resetZoomButton = document.getElementById('reset-zoom');
    const cxrSelect = document.getElementById('cxr-select');
    const loadPharmacyButton = document.getElementById('load-pharmacy-data');
    const demographicsContent = document.getElementById('demographics-content');


    let signals = [];
    let fs = 1;
    let fields = {};
    let zoomTransform = d3.zoomIdentity; // Initial zoom state
    let brush, zoom;

    // Fetch the list of patient IDs and records
    fetch(`/api/list`)
        .then(response => response.json())
        .then(data => populatePatientSelect(data))
        .catch(error => console.error('Error fetching list:', error));

    function populatePatientSelect(data) {
        data.sort((a, b) => a.patient_id.localeCompare(b.patient_id));

        data.forEach(item => {
            const option = document.createElement('option');
            option.value = item.patient_id;
            option.textContent = item.patient_id;
            patientSelect.appendChild(option);
        });

        patientSelect.addEventListener('change', function() {
            const selectedPatient = this.value;
            populateRecordSelect(data, selectedPatient);

            fetch(`/patient/${selectedPatient}`)
                .then(response => response.json())
                .then(data => {
                    cxrSelect.innerHTML = '<option value="">--Select Record--</option>';
                        data.forEach(record => {
                            const option = document.createElement('option');
                            option.value = record;
                            option.textContent = record;
                            cxrSelect.appendChild(option);
                        });
                    });

            loadDemographicsData(selectedPatient);

        });
    }

    function loadDemographicsData(patientId) {
        fetch(`/api/demographics/${patientId}`)
            .then(response => response.json())
            .then(data => {
                data = data[0];
                displayDemographicsData(data);
            })
            .catch(error => console.error('Error fetching demographics data:', error));
    }

    function displayDemographicsData(data) {
        demographicsContent.innerHTML = `
            <p><strong>Subject ID:</strong> ${data.subject_id}</p>
            <p><strong>Gender:</strong> ${data.gender}</p>
            <p><strong>Date of Death:</strong> ${data.dod ? data.dod : 'N/A'}</p>
            <p><strong>Admission Year:</strong> ${data.admission_year}</p>
            <p><strong>Set Age:</strong> ${data.set_age}</p>
            <p><strong>Admission Count:</strong> ${data.admission_cnt}</p>
            <p><strong>Language:</strong> ${data.language ? data.language : 'N/A'}</p>
            <p><strong>Marital Status:</strong> ${data.marital_status ? data.marital_status : 'N/A'}</p>
            <p><strong>Race:</strong> ${data.race ? data.race : 'N/A'}</p>
        `;
    }

    function populateRecordSelect(data, selectedPatient) {
        recordSelect.innerHTML = '<option value="">--Select Record--</option>';
        const patient = data.find(p => p.patient_id === selectedPatient);
        if (patient) {
            patient.records.forEach(record => {
                const option = document.createElement('option');
                option.value = record;
                option.textContent = record;
                recordSelect.appendChild(option);
            });
        }
    }

    loadDataButton.addEventListener('click', function() {
        const patientId = patientSelect.value;
        const recordName = recordSelect.value;
        if (patientId && recordName) {
            loadData(patientId, recordName);
        } else {
            alert("Please select both a patient ID and a record name.");
        }
    });


    loadPharmacyButton.addEventListener('click', function() {
        const patientId = patientSelect.value;
        if (patientId) {
            loadPharmacyData(patientId);
        } else {
            alert("Please select a patient ID.");
        }
    });

    function loadPharmacyData(patientId) {
        fetch(`/api/pharmacy/${patientId}`)
            .then(response => response.json())
            .then(data => {
                populatePharmacyTable(data);
            })
            .catch(error => console.error('Error fetching pharmacy data:', error));
    }

    function populatePharmacyTable(data) {
        const tableBody = document.querySelector('#pharmacy-table tbody');
        tableBody.innerHTML = ''; // Clear previous data

        data.forEach(row => {
            const tableRow = document.createElement('tr');
            Object.values(row).forEach(value => {
                const cell = document.createElement('td');
                cell.textContent = value;
                tableRow.appendChild(cell);
            });
            tableBody.appendChild(tableRow);
        });
    }


    function loadData(patientId, recordName) {
        fetch(`/api/data/${patientId}/${recordName}`)
            .then(response => response.json())
            .then(data => {
                signals = data.signals;
                fs = data.fields.fs;
                fields = data.fields;
                populateLeadToggle(); // Populate lead toggles first
                visualize();
            })
            .catch(error => console.error('Error fetching data:', error));
    }

    function transposeSignals(signals) {
        const numLeads = signals[0].length;
        const transposed = Array.from({ length: numLeads }, () => []);

        signals.forEach((timeStep) => {
            timeStep.forEach((leadValue, leadIndex) => {
                transposed[leadIndex].push(leadValue);
            });
        });

        return transposed;
    }

    function normalizeSignals(transposedSignals) {
        return transposedSignals.map(lead => {
            const maxVal = d3.max(lead);
            const minVal = d3.min(lead);
            const range = maxVal - minVal;
            return lead.map(value => ((value - minVal) / range)); // Normalize to 0 to 1 range
        });
    }

    function visualize() {
        const timeScale = signals.length / fs; // Total duration in seconds

        // Transpose and normalize signals
        const transposedSignals = transposeSignals(signals);
        const normalizedSignals = normalizeSignals(transposedSignals);

        // Clear the previous chart
        d3.select("#chart").html("");

        // Set up SVG canvas dimensions
        const margin = { top: 20, right: 20, bottom: 110, left: 50 };
        const width = 960 - margin.left - margin.right;
        const height = 500 - margin.top - margin.bottom;
        const gap = 20;
        const colors = d3.schemeCategory10; // D3 color scheme

        const svg = d3.select("#chart").append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scaleLinear()
            .domain([0, timeScale])
            .range([0, width]);

        const numLeads = normalizedSignals.length;
        const y = d3.scaleLinear()
            .domain([0, 1])
            .range([height / numLeads - gap, 0]);

        // Draw vertical grid lines
        svg.append("g")
            .attr("class", "grid")
            .selectAll("line")
            .data(x.ticks(10))
            .enter().append("line")
            .attr("x1", d => x(d))
            .attr("x2", d => x(d))
            .attr("y1", 0)
            .attr("y2", height)
            .attr("stroke", "#ccc")
            .attr("stroke-dasharray", "2,2");

        const xAxis = svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x));

        const drawLeads = () => {
            svg.selectAll(".line").remove();
            svg.selectAll(".lead-label").remove();

            normalizedSignals.forEach((leadSignals, leadIndex) => {
                const checkbox = document.getElementById(`lead-${leadIndex}`);
                if (checkbox && checkbox.checked) {
                    const leadGroup = svg.append("g")
                        .attr("class", `lead-${leadIndex}`)
                        .attr("transform", `translate(0, ${leadIndex * height / numLeads + gap / 2})`);
                        
                    leadGroup.append("path")
                        .data([leadSignals])
                        .attr("class", "line")
                        .attr("d", d3.line()
                            .x((d, i) => x(i / fs))
                            .y((d) => y(d)))
                        .attr("stroke", colors[leadIndex % colors.length])
                        .attr("clip-path", "url(#clip)");

                    leadGroup.append("text")
                        .attr("x", -margin.left + 30)
                        .attr("y", height / numLeads / 2 - gap / 2)
                        .attr("dy", "0.35em")
                        .attr("text-anchor", "end")
                        .text(fields.sig_name[leadIndex])
                        .attr("class", "lead-label");
                }
            });
        };

        drawLeads();
        // Zoom functionality
        zoom = d3.zoom()
            .scaleExtent([1, 10])
            .translateExtent([[0, 0], [width, height]])
            .extent([[0, 0], [width, height]])
            .on("zoom", (event) => {
                zoomTransform = event.transform;
                applyZoom();
            });

       var zoomrect = svg.append("rect")
            .attr("width", width)
            .attr("height", height)
            .style("fill", "none")
            .style("pointer-events", "all")
            .attr("transform", `translate(0,0)`)
            .call(zoom);

        var clip = svg.append("defs").append("svg:clipPath")
            .attr("id", "clip")
            .append("svg:rect")
            .attr("width", width )
            .attr("height", height )
            .attr("x", 0)
            .attr("y", 0);         

                    // Zoom control buttons
        zoomInButton.addEventListener('click', function() {
            zoomrect.transition().duration(350).call(zoom.scaleBy, 1.5);
        });
    
        zoomOutButton.addEventListener('click', function() {
            zoomrect.transition().duration(350).call(zoom.scaleBy, 0.5);
        });
    
        resetZoomButton.addEventListener('click', function() {
            zoomTransform = d3.zoomIdentity;
            zoomrect.transition().duration(350).call(zoom.transform, zoomTransform);
        });
    
        function applyZoom() {
            const newX = zoomTransform.rescaleX(x);
            svg.selectAll(".line")
                .attr("d", d3.line()
                    .x((d, i) => newX(i / fs))
                    .y((d) => y(d)));
            xAxis.call(d3.axisBottom(newX));
        }
        
    }

    function populateLeadToggle() {
        const leadToggleDiv = document.getElementById('lead-toggle');
        leadToggleDiv.innerHTML = '';
    
        fields.sig_name.forEach((lead, index) => {
            const label = document.createElement('label');
            label.textContent = lead;
            label.setAttribute('style', 'margin-right: 10px;');  // Adjust margin for spacing
    
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `lead-${index}`;
            checkbox.checked = true;
            checkbox.dataset.leadIndex = index; // Store the index in a data attribute
    
            checkbox.addEventListener('change', function() {
                toggleLeadVisibility(index, checkbox.checked);
            });
    
            label.appendChild(checkbox);
            leadToggleDiv.appendChild(label);

            label.style.backgroundColor = checkbox.checked ? 'green' : 'lightgray';

        });
    }
    
    function toggleLeadVisibility(index, isVisible) {
        const leadElement = document.querySelector(`.lead-${index}`);
        const leadLabel = document.querySelector(`#lead-toggle label:nth-child(${index + 1})`);

        if (leadElement) {
            leadElement.style.display = isVisible ? 'block' : 'none';
        }
        if (leadLabel) {
            leadLabel.style.backgroundColor = isVisible ? 'green' : 'lightgray'; // Change fill color based on visibility
        }

    }
    
    
    let images = [];
    let currentIndex = 0;

    // Load patient options dynamically
    function loadPatientOptions() {
        fetch('/get-patients')
            .then(response => response.json())
            .then(data => {
                const patientSelect = document.getElementById('patient-select');
                data.forEach(patient => {
                    const option = document.createElement('option');
                    option.value = patient;
                    option.text = patient;
                    patientSelect.appendChild(option);
                });
            })
            .catch(error => console.error('Error fetching patients:', error));
    }

    // Load records based on selected patient
    document.getElementById('patient-select').addEventListener('change', function() {
        const patientID = this.value;
        if (patientID) {
            fetch(`/get-records/${patientID}`)
                .then(response => response.json())
                .then(data => {
                    const cxrSelect = document.getElementById('cxr-select');
                    cxrSelect.innerHTML = '<option value="">--Select Record--</option>';
                    data.forEach(record => {
                        const option = document.createElement('option');
                        option.value = record;
                        option.text = record;
                        cxrSelect.appendChild(option);
                    });
                })
                .catch(error => console.error('Error fetching records:', error));
        }
    });

    // Event listener for loading CXR data
    document.getElementById('load-cxr-data').addEventListener('click', function() {
        const patientID = document.getElementById('patient-select').value;
        const recordName = document.getElementById('cxr-select').value;
        if (patientID && recordName) {
            loadCXRData(patientID, recordName);
        } else {
            alert('Please select both Patient ID and Record Name.');
        }
    });

    function loadCXRData(patientID, recordName) {
        // Clear previous bounding boxes and annotations
        clearBoundingBoxesAndAnnotations();
    
        fetch(`/patient/${patientID}/${recordName}`)
            .then(response => response.json())
            .then(data => {
                images = data.images;
                currentIndex = 0;
                updateCXRImage();
            })
            .catch(error => console.error('Error loading CXR data:', error));
    }
    

    // // Function to load CXR data
    // function loadCXRData(patientID, recordName) {
    //     fetch(`/patient/${patientID}/${recordName}`)
    //         .then(response => response.json())
    //         .then(data => {
    //             images = data.images;
    //             currentIndex = 0;
    //             updateCXRImage();
    //         })
    //         .catch(error => console.error('Error loading CXR data:', error));
    // }

    function updateCXRImage() {
        if (images.length > 0) {
            document.getElementById('current-image').src = images[currentIndex];
            currentImage = document.getElementById('current-image');
            currentImage.onload = () => {
                boundingBoxCanvas.width = currentImage.clientWidth;
                boundingBoxCanvas.height = currentImage.clientHeight;
                // Ensure previous bounding boxes are cleared
                clearBoundingBoxesAndAnnotations();
            };
            document.getElementById('image-index').textContent = 'Images: ' + (currentIndex + 1) + ' / ' + images.length;
        }
    }
    

    function clearBoundingBoxesAndAnnotations() {
        const context = document.getElementById('bounding-box-canvas').getContext('2d');
        context.clearRect(0, 0, document.getElementById('bounding-box-canvas').width, document.getElementById('bounding-box-canvas').height);
        document.getElementById('report-content').innerHTML = '';
        document.getElementById('auto-annotate-button').disabled = false;
        const buttonsContainer = document.querySelector('#reports-container .button-container');
        if (buttonsContainer) {
            buttonsContainer.remove();
        }
    }
    

    // Event listener for changing the view
    document.getElementById('view-change-button').addEventListener('click', function() {
        currentIndex = (currentIndex + 1) % images.length;
        updateCXRImage();
    });

    // Event listener for automatic annotation
    document.getElementById('auto-annotate-button').addEventListener('click', function() {
        document.getElementById('auto-annotate-button').disabled = true;

        let animationInterval = setInterval(function() {
            let reportContent = document.getElementById('report-content');
            reportContent.textContent = reportContent.textContent === 'Waiting for results' ? 'Waiting for results.' :
                                        reportContent.textContent === 'Waiting for results.' ? 'Waiting for results..' :
                                        reportContent.textContent === 'Waiting for results..' ? 'Waiting for results...' :
                                        'Waiting for results';
        }, 500);

        fetch('/annotate-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ image_path: images[currentIndex] })
        })
        .then(response => response.json())
        .then(data => {
            clearInterval(animationInterval);
            document.getElementById('report-content').textContent = data.report;

            let buttonsContainer = document.createElement('div');
            buttonsContainer.classList.add('button-container');
            let showBoundingBoxButton = document.createElement('button');
            showBoundingBoxButton.id = 'show-bounding-box-button';
            showBoundingBoxButton.classList.add('btn', 'btn-primary', 'mt-3');
            showBoundingBoxButton.textContent = 'Show Bounding Box';
            buttonsContainer.appendChild(showBoundingBoxButton);
            document.getElementById('reports-container').appendChild(buttonsContainer);

            showBoundingBoxButton.addEventListener('click', function() {
                highlightReport(data.report);
            });
        })
        .catch(error => {
            console.error('Error:', error);
        });
    });

    // Function to highlight the report and draw bounding boxes
    function highlightReport(report) {
        let colors = ['#FF5733', '#33FF57', '#3357FF', '#FF33A8', '#FF8F33', '#8F33FF', '#FFC300', '#DAF7A6', '#C70039', '#900C3F'];
        let reportContent = document.getElementById('report-content');
        reportContent.innerHTML = ''; 

        let sentences = report.split('. ');
        let sentenceElements = [];

        sentences.forEach((sentence, index) => {
            let span = document.createElement('span');
            span.classList.add('sentence');
            span.style.color = colors[index % colors.length];
            span.textContent = sentence + (index < sentences.length - 1 ? '.' : '');
            reportContent.appendChild(span);
            sentenceElements.push(span);
        });

        fetch('/bounding-boxes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ patient_id: document.getElementById('patient-select').value, image_folder: document.getElementById('cxr-select').value })
        })
        .then(response => response.json())
        .then(data => {
            drawBoundingBoxes(data.bounding_boxes, colors, sentenceElements);
        })
        .catch(error => {
            console.error('Error:', error);
        });
    }

    // Function to draw bounding boxes on the canvas
    function drawBoundingBoxes(boundingBoxes, colors, sentenceElements) {
        const img = document.getElementById('current-image');
        const canvas = document.getElementById('bounding-box-canvas');
        canvas.width = img.clientWidth;
        canvas.height = img.clientHeight;

        const context = canvas.getContext('2d');

        boundingBoxes.forEach((box, index) => {
            context.strokeStyle = colors[index % colors.length];
            context.lineWidth = 2;
            context.strokeRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
        });

        sentenceElements.forEach((sentence, index) => {
            sentence.addEventListener('mouseover', () => {
                context.clearRect(0, 0, canvas.width, canvas.height);
                boundingBoxes.forEach((box, i) => {
                    context.strokeStyle = colors[i % colors.length];
                    context.lineWidth = (i === index) ? 7 : 2; 
                    context.strokeRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
                });
            });

            sentence.addEventListener('mouseout', () => {
                context.clearRect(0, 0, canvas.width, canvas.height);
                boundingBoxes.forEach((box, i) => {
                    context.strokeStyle = colors[i % colors.length];
                    context.lineWidth = 2; 
                    context.strokeRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
                });
            });
        });
    }

    // Initial load
    loadPatientOptions();

});
