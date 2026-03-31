// ==========================================
// UI部品の取得
// ==========================================
const imageInput = document.getElementById('imageInput');
const imageCanvas = document.getElementById('imageCanvas');
const ctx = imageCanvas.getContext('2d');

const drawCanvas = document.getElementById('drawCanvas');
const drawCtx = drawCanvas.getContext('2d');

const resultCanvas = document.getElementById('resultCanvas');
const resultCtx = resultCanvas.getContext('2d');

const brushSize = document.getElementById('brushSize');
const drawMode = document.getElementById('drawMode');
const smoothFactor = document.getElementById('smoothFactor');
const colorTemp = document.getElementById('colorTemp');

const processBtn = document.getElementById('processBtn');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const saveBtn = document.getElementById('saveBtn'); // 🌟追加：保存ボタンの取得

let currentImage = new Image();

// ==========================================
// 🕒 タイムマシン（描画の履歴管理）
// ==========================================
let historyStack = []; 
let currentStep = -1;  

function saveHistory() {
    if (currentStep < historyStack.length - 1) {
        historyStack = historyStack.slice(0, currentStep + 1);
    }
    historyStack.push(drawCanvas.toDataURL());
    currentStep++;
    updateButtonStates();
}

function updateButtonStates() {
    undoBtn.disabled = currentStep <= 0;
    redoBtn.disabled = currentStep >= historyStack.length - 1;
}

undoBtn.addEventListener('click', function() {
    if (currentStep > 0) {
        currentStep--;
        restoreHistory();
    }
});

redoBtn.addEventListener('click', function() {
    if (currentStep < historyStack.length - 1) {
        currentStep++;
        restoreHistory();
    }
});

function restoreHistory() {
    let img = new Image();
    img.onload = function() {
        drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
        drawCtx.drawImage(img, 0, 0);
    }
    img.src = historyStack[currentStep];
    updateButtonStates();
}

// ==========================================
// 1. 画像の読み込みと表示
// ==========================================
imageInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        currentImage.onload = function() {
            imageCanvas.width = currentImage.width;
            imageCanvas.height = currentImage.height;
            drawCanvas.width = currentImage.width;
            drawCanvas.height = currentImage.height;
            resultCanvas.width = currentImage.width;
            resultCanvas.height = currentImage.height;

            ctx.drawImage(currentImage, 0, 0);
            resultCtx.drawImage(currentImage, 0, 0);
            drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
            
            historyStack = [];
            currentStep = -1;
            saveHistory(); 
        }
        currentImage.src = event.target.result;
    }
    reader.readAsDataURL(file);
});

// ==========================================
// 2. お絵描き機能（マウス操作）とルーペ
// ==========================================
let isDrawing = false;
let lastX = 0; 
let lastY = 0; 

const loupeCanvas = document.getElementById('loupeCanvas');
const loupeCtx = loupeCanvas.getContext('2d');
const LOUPE_SIZE = 150; 
const ZOOM = 1.5;       
loupeCanvas.width = LOUPE_SIZE;
loupeCanvas.height = LOUPE_SIZE;

drawCanvas.addEventListener('mousedown', function(e) {
    isDrawing = true;
    lastX = e.offsetX; 
    lastY = e.offsetY;
    loupeCanvas.style.display = 'block'; 
});

drawCanvas.addEventListener('mousemove', function(e) {
    if (!isDrawing) return;
    
    drawCtx.beginPath(); 
    drawCtx.moveTo(lastX, lastY); 
    drawCtx.lineTo(e.offsetX, e.offsetY); 
    drawCtx.lineCap = 'round';
    drawCtx.lineJoin = 'round';
    drawCtx.lineWidth = brushSize.value;

    if (drawMode.value === 'eraser') {
        drawCtx.globalCompositeOperation = 'destination-out';
        drawCtx.strokeStyle = 'rgba(0, 0, 0, 1)';
    } else {
        drawCtx.globalCompositeOperation = 'source-over';
        drawCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; 
    }
    drawCtx.stroke();
    
    lastX = e.offsetX;
    lastY = e.offsetY;

    loupeCanvas.style.left = (e.offsetX - LOUPE_SIZE / 2) + 'px';
    loupeCanvas.style.top = (e.offsetY - LOUPE_SIZE - 20) + 'px';
    const srcSize = LOUPE_SIZE / ZOOM;
    const srcX = e.offsetX - srcSize / 2;
    const srcY = e.offsetY - srcSize / 2;

    loupeCtx.clearRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);
    loupeCtx.save();
    loupeCtx.beginPath();
    loupeCtx.arc(LOUPE_SIZE/2, LOUPE_SIZE/2, LOUPE_SIZE/2, 0, Math.PI * 2);
    loupeCtx.clip();
    loupeCtx.drawImage(imageCanvas, srcX, srcY, srcSize, srcSize, 0, 0, LOUPE_SIZE, LOUPE_SIZE);
    loupeCtx.drawImage(drawCanvas, srcX, srcY, srcSize, srcSize, 0, 0, LOUPE_SIZE, LOUPE_SIZE);
    loupeCtx.restore(); 
});

function stopDrawing() {
    if (isDrawing) {
        isDrawing = false;
        loupeCanvas.style.display = 'none';
        saveHistory(); 
    }
}
drawCanvas.addEventListener('mouseup', stopDrawing);
drawCanvas.addEventListener('mouseout', stopDrawing);

// ==========================================
// 3. OpenCV.js による美肌化と合成処理
// ==========================================
processBtn.addEventListener('click', function() {
    if (typeof cv === 'undefined' || !cv.Mat) {
        alert('⏳ 画像処理エンジンの準備中です。数秒待ってからもう一度押してください。');
        return;
    }

    processBtn.textContent = "⏳ 処理中...";
    processBtn.disabled = true;

    setTimeout(function() {
        try {
            let src = cv.imread(imageCanvas); 
            let srcRgb = new cv.Mat();
            let smoothedRgb = new cv.Mat();

            cv.cvtColor(src, srcRgb, cv.COLOR_RGBA2RGB);

            let factor = parseInt(smoothFactor.value);
            let d = 5 + (25 * factor / 100);
            let sigma = 20 + (150 * factor / 100);
            cv.bilateralFilter(srcRgb, smoothedRgb, d, sigma, sigma);

            // --- 🌡️ 色温度調整 ---
            let channels = new cv.MatVector();
            cv.split(smoothedRgb, channels);
            let r = channels.get(0); 
            let b = channels.get(2); 
            let temp = parseInt(colorTemp.value);
            
            if (temp !== 0) {
                let scalarMat = new cv.Mat(r.rows, r.cols, r.type(), new cv.Scalar(Math.abs(temp)));
                if (temp > 0) {
                    cv.add(r, scalarMat, r);
                    cv.subtract(b, scalarMat, b);
                } else {
                    cv.add(b, scalarMat, b);
                    cv.subtract(r, scalarMat, r);
                }
                scalarMat.delete(); 
            }
            
            let smoothedTempRgb = new cv.Mat();
            cv.merge(channels, smoothedTempRgb);

            let smoothedTempRgba = new cv.Mat();
            cv.cvtColor(smoothedTempRgb, smoothedTempRgba, cv.COLOR_RGB2RGBA);

            let tempCanvas = document.createElement('canvas');
            tempCanvas.width = imageCanvas.width;
            tempCanvas.height = imageCanvas.height;
            cv.imshow(tempCanvas, smoothedTempRgba);

            let compositeCanvas = document.createElement('canvas');
            compositeCanvas.width = imageCanvas.width;
            compositeCanvas.height = imageCanvas.height;
            let compositeCtx = compositeCanvas.getContext('2d');
            
            compositeCtx.drawImage(drawCanvas, 0, 0); 
            compositeCtx.globalCompositeOperation = 'source-in'; 
            compositeCtx.drawImage(tempCanvas, 0, 0); 

            resultCtx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
            resultCtx.drawImage(currentImage, 0, 0); 
            resultCtx.globalCompositeOperation = 'source-over';
            resultCtx.drawImage(compositeCanvas, 0, 0); 

            src.delete(); srcRgb.delete(); smoothedRgb.delete(); 
            smoothedTempRgb.delete(); smoothedTempRgba.delete(); channels.delete(); b.delete(); r.delete();

            processBtn.textContent = "✨ なぞった部分を美肌にする ✨";
            processBtn.disabled = false;

        } catch (err) {
            console.error(err);
            alert('エラーが発生しました: ' + err.message);
            processBtn.textContent = "✨ なぞった部分を美肌にする ✨";
            processBtn.disabled = false;
        }
    }, 100); 
});

// ==========================================
// 4. 画像の保存機能（高画質対応）
// ==========================================
saveBtn.addEventListener('click', function() {
    if (!currentImage.src) {
        alert('まずは画像を読み込んでください！');
        return;
    }

    // resultCanvas の内容をBlob（バイナリデータ）として高画質出力
    resultCanvas.toBlob(function(blob) {
        if (!blob) {
            alert('画像の保存に失敗しました。');
            return;
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        // 元のファイル名に「_retouched」を付ける
        let fileName = "retouched_image.png";
        if (imageInput.files.length > 0) {
            const originalName = imageInput.files[0].name;
            const dotIndex = originalName.lastIndexOf('.');
            if (dotIndex !== -1) {
                fileName = originalName.substring(0, dotIndex) + '_retouched.png';
            }
        }

        a.download = fileName;
        document.body.appendChild(a);
        a.click(); 

        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
    }, 'image/png', 1.0); // PNG形式で最高画質を保証
});