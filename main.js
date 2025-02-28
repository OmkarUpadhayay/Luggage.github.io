$(function () {
    const { InferenceEngine, CVImage } = inferencejs;
    const inferEngine = new InferenceEngine();
    const video = $("#video")[0];
    var workerId;
    let detectedCount = 0; // Counter for total detected objects
    let countedObjects = new Set(); // Track objects that have already been counted
    let previousPredictions = []; // Add this line to store previous frame predictions
    let skipCountFrames = 0; // Counter for frames to skip counting
    const skipCountDuration = 15; // Number of frames to skip counting after a detection
    let frameCount = 0; // Initialize frame counter

    // Define the Region of Interest (ROI) coordinates and dimensions
    const roi = {
        x: 100,   // X-coordinate of the top-left corner of ROI
        y: 100,   // Y-coordinate of the top-left corner of ROI
        width: 400, // Width of the ROI
        height: 300 // Height of the ROI
    };

    // Load AI Model
    const loadModelPromise = inferEngine
        .startWorker("my-first-project-la9xd", "5", "rf_PJa5CqEWARUe88POnbX2eAIOFoB3")
        .then((id) => { workerId = id; });

    // Handle Video Upload
    $("#videoUpload").on("change", function (event) {
        const file = event.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            video.src = url;
            video.onloadeddata = function () {
                video.play();
                resizeCanvas();
                detectedCount = 0; // Reset counter when a new video is loaded
                countedObjects.clear(); // Clear the set of counted objects
                previousPredictions = []; // Clear previous predictions
                skipCountFrames = 0; // Reset skip counting counter
                $("#count").text(detectedCount); // Update the counter display
                detectFrame();
            };
        }
    });

    var canvas, ctx;
    const font = "16px sans-serif";

    const resizeCanvas = function () {
        $("canvas").remove();
        canvas = $("<canvas/>").attr({
            width: video.clientWidth,
            height: video.clientHeight
        }).css({
            position: "absolute",
            top: video.offsetTop,
            left: video.offsetLeft,
            pointerEvents: "none"
        });

        ctx = canvas[0].getContext("2d");
        $("#video").parent().append(canvas);
    };

    const renderPredictions = function (predictions) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        // Calculate scaling factors
        const scaleX = video.clientWidth / video.videoWidth;
        const scaleY = video.clientHeight / video.videoHeight;

        // Flag to track if we found a new object in this frame
        let newObjectFound = false;

        predictions.forEach(function (prediction) {
            let { x, y, width, height } = prediction.bbox;

            // Scale bounding box coordinates to canvas size
            x = x * scaleX;
            y = y * scaleY;
            width = width * scaleX;
            height = height * scaleY;

            // Ensure the bounding box is within the canvas boundaries
            x = Math.max(0, Math.min(x, video.clientWidth - width));
            y = Math.max(0, Math.min(y, video.clientHeight - height));

            // Check if the object falls within the defined ROI
            const isWithinROI = x >= roi.x && y >= roi.y && (x + width) <= (roi.x + roi.width) && (y + height) <= (roi.y + roi.height);

            // If the object is within the ROI, proceed with detection logic
            if (isWithinROI) {
                // Generate a unique ID for the object based on its bounding box
                const objectId = `${prediction.class}-${Math.round(x)}-${Math.round(y)}`;

                // Check for overlap with previous predictions
                const isNewObject = !previousPredictions.some(prev => {
                    const prevX = prev.bbox.x * scaleX;
                    const prevY = prev.bbox.y * scaleY;
                    const prevWidth = prev.bbox.width * scaleX;
                    const prevHeight = prev.bbox.height * scaleY;

                    // Check if the bounding boxes overlap significantly
                    return (x < prevX + prevWidth && x + width > prevX && y < prevY + prevHeight && y + height > prevY);
                });

                // If the object is new and we're not in a skip count period, increment the counter
                if (isNewObject && skipCountFrames <= 0) {
                    countedObjects.add(objectId); // Mark the object as counted
                    detectedCount++; // Increment the counter
                    $("#count").text(detectedCount); // Update the counter display
                    skipCountFrames = skipCountDuration; // Start the skip count period
                    newObjectFound = true;
                }

                // Draw bounding box
                ctx.strokeStyle = "#FFFF00"; // Yellow
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, width, height);

                // Draw label background
                ctx.fillStyle = "#FFFF00";
                const labelWidth = ctx.measureText(prediction.class).width + 10;
                ctx.fillRect(x, y - 20, labelWidth, 20);

                // Draw label text
                ctx.font = font;
                ctx.fillStyle = "#000000";
                ctx.fillText(prediction.class, x + 5, y - 5);
            }
        });

        // Display counting status for debugging (optional)
        if (skipCountFrames > 0) {
            ctx.font = "16px sans-serif";
            ctx.fillStyle = "#FF0000";
        
        }

        // Update previous predictions for the next frame
        previousPredictions = predictions.map(pred => ({ bbox: pred.bbox, class: pred.class }));
        
        // Decrease the skip counter if it's active
        if (skipCountFrames > 0) {
            skipCountFrames--;
        }
    };

    const detectFrame = function () {
        if (!workerId || video.paused || video.ended) return;

        const image = new CVImage(video);
        inferEngine
            .infer(workerId, image)
            .then((predictions) => {
                frameCount++; // Increment frame counter
                renderPredictions(predictions);
                requestAnimationFrame(detectFrame); // Continue detecting next frame
            })
            .catch((e) => {
                console.error("Error:", e);
                requestAnimationFrame(detectFrame); // Continue even after an error
            });
    };
});