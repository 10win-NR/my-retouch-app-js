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
const loupeCanvas = document.getElementById('loupeCanvas');
const loupeCtx = loupeCanvas.getContext('2d');

const brushSize = document.getElementById('brushSize');
const drawMode = document.getElementById('drawMode');
const smoothFactor = document.getElementById('smoothFactor');
const colorTemp = document.getElementById('colorTemp');
const processBtn = document.getElementById('processBtn');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const saveBtn = document.getElementById('saveBtn');

const modeScrollBtn = document.getElementById('modeScrollBtn');
const modeDrawBtn = document.getElementById('modeDrawBtn');
let isTouchDrawMode = false; 

modeScrollBtn.addEventListener('click', () => {
    isTouchDrawMode = false;
    modeScrollBtn.style.background = '#007bff'; modeScrollBtn.style.color = 'white';
    modeDrawBtn.style.background = '#e0e0e0'; modeDrawBtn.style.color = '#333';
});

modeDrawBtn.addEventListener('click', () => {
    isTouchDrawMode = true;
    modeDrawBtn.style.background = '#ff4b4b'; modeDrawBtn.style.color = 'white';
    modeScrollBtn.style.background = '#e0e0e0'; modeScrollBtn.style.color = '#333';
});

let currentImage = new Image();
let historyStack = []; 
let currentStep = -1;  

function saveHistory() {
    if (currentStep < historyStack.length - 1) historyStack = historyStack.slice(0, currentStep + 1);
    historyStack.push(drawCanvas.toDataURL());
    currentStep++;
    updateButtonStates();
}

function updateButtonStates() {
    undoBtn.disabled = currentStep <= 0;
    redoBtn.disabled = currentStep >= historyStack.length - 1;
}

undoBtn.addEventListener('click', () => { if (currentStep > 0) { currentStep--; restoreHistory(); } });
redoBtn.addEventListener('click', () => { if (currentStep < historyStack.length - 1) { currentStep++; restoreHistory(); } });

function restoreHistory() {
    let img = new Image();
    img.onload = () => { drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height); drawCtx.drawImage(img, 0, 0); }
    img.src = historyStack[currentStep];
    updateButtonStates();
}

imageInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(event) {
        currentImage.onload = function() {
            imageCanvas.width = currentImage.width; imageCanvas.height = currentImage.height;
            drawCanvas.width = currentImage.width; drawCanvas.height = currentImage.height;
            resultCanvas.width = currentImage.width; resultCanvas.height = currentImage.height;

            ctx.drawImage(currentImage, 0, 0);
            resultCtx.drawImage(currentImage, 0, 0);
            drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
            
            historyStack = []; currentStep = -1; saveHistory(); 
        }
        currentImage.src = event.target.result;
    }
    reader.readAsDataURL(file);
});

// ==========================================
// 2. お絵描き機能
// ==========================================
let isDrawing = false;
let lastX = 0; let lastY = 0; 
const LOUPE_SIZE = 120; const ZOOM = 2.0;       
loupeCanvas.width = LOUPE_SIZE; loupeCanvas.height = LOUPE_SIZE;

function getCoordinates(e) {
    const rect = drawCanvas.getBoundingClientRect();
    let clientX, clientY, pageX, pageY;
    
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX; clientY = e.touches[0].clientY;
        pageX = e.touches[0].pageX; pageY = e.touches[0].pageY;
    } else {
        clientX = e.clientX; clientY = e.clientY;
        pageX = e.pageX; pageY = e.pageY;
    }

    const scaleX = drawCanvas.width / rect.width;
    const scaleY = drawCanvas.height / rect.height;

    return {
        x: (clientX - rect.left) * scaleX, 
        y: (clientY - rect.top) * scaleY,  
        pageX: pageX, 
        pageY: pageY
    };
}

function startDrawing(e) {
    if (!isTouchDrawMode && e.type.includes('touch')) return; 
    if (isTouchDrawMode && e.type.includes('touch')) e.preventDefault(); 
    isDrawing = true;
    const pos = getCoordinates(e);
    lastX = pos.x; lastY = pos.y;
    loupeCanvas.style.display = 'block';
}

function draw(e) {
    if (!isDrawing) return;
    if (isTouchDrawMode && e.type.includes('touch')) e.preventDefault();
    const pos = getCoordinates(e);
    
    drawCtx.beginPath(); drawCtx.moveTo(lastX, lastY); drawCtx.lineTo(pos.x, pos.y); 
    drawCtx.lineCap = 'round'; drawCtx.lineJoin = 'round';
    
    const rect = drawCanvas.getBoundingClientRect();
    const scaleX = drawCanvas.width / rect.width;
    drawCtx.lineWidth = brushSize.value * scaleX; 

    if (drawMode.value === 'eraser') {
        drawCtx.globalCompositeOperation = 'destination-out';
        drawCtx.strokeStyle = 'rgba(0, 0, 0, 1)';
    } else {
        drawCtx.globalCompositeOperation = 'source-over';
        drawCtx.strokeStyle = 'rgba(255, 255, 255, 1.0)'; // マスクは完全な白に変更
    }
    drawCtx.stroke();
    lastX = pos.x; lastY = pos.y;

    loupeCanvas.style.left = (pos.pageX - LOUPE_SIZE / 2) + 'px';
    loupeCanvas.style.top = (pos.pageY - LOUPE_SIZE - 50) + 'px';

    const srcSizeInternal = (LOUPE_SIZE / ZOOM) * scaleX;
    const srcX = pos.x - srcSizeInternal / 2;
    const srcY = pos.y - srcSizeInternal / 2;

    loupeCtx.clearRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);
    loupeCtx.save();
    loupeCtx.beginPath(); loupeCtx.arc(LOUPE_SIZE/2, LOUPE_SIZE/2, LOUPE_SIZE/2, 0, Math.PI * 2); loupeCtx.clip();
    loupeCtx.drawImage(imageCanvas, srcX, srcY, srcSizeInternal, srcSizeInternal, 0, 0, LOUPE_SIZE, LOUPE_SIZE);
    loupeCtx.drawImage(drawCanvas, srcX, srcY, srcSizeInternal, srcSizeInternal, 0, 0, LOUPE_SIZE, LOUPE_SIZE);
    loupeCtx.restore(); 
}

function stopDrawing() {
    if (isDrawing) { isDrawing = false; loupeCanvas.style.display = 'none'; saveHistory(); }
}

drawCanvas.addEventListener('mousedown', startDrawing); drawCanvas.addEventListener('mousemove', draw);
drawCanvas.addEventListener('mouseup', stopDrawing); drawCanvas.addEventListener('mouseout', stopDrawing);
drawCanvas.addEventListener('touchstart', startDrawing, { passive: false }); drawCanvas.addEventListener('touchmove', draw, { passive: false });
drawCanvas.addEventListener('touchend', stopDrawing); drawCanvas.addEventListener('touchcancel', stopDrawing);

// ==========================================
// 3. 究極のプロ仕様：テクスチャ合成コンシーラー
// ==========================================
processBtn.addEventListener('click', function() {
    if (typeof cv === 'undefined' || !cv.Mat) { alert('⏳ 準備中です。'); return; }

    processBtn.textContent = "⏳ 最高級コンシーラーでお化粧中...";
    processBtn.disabled = true;

    setTimeout(function() {
        try {
            const MAX_SIZE = 1200; 
            let scale = 1.0;
            if (currentImage.width > MAX_SIZE || currentImage.height > MAX_SIZE) {
                scale = MAX_SIZE / Math.max(currentImage.width, currentImage.height);
            }
            
            let smallW = Math.round(currentImage.width * scale);
            let smallH = Math.round(currentImage.height * scale);
            
            let smallCanvas = document.createElement('canvas');
            smallCanvas.width = smallW; smallCanvas.height = smallH;
            let smallCtx = smallCanvas.getContext('2d');
            smallCtx.drawImage(currentImage, 0, 0, smallW, smallH);

            let src = cv.imread(smallCanvas);
            let srcRgb = new cv.Mat();
            cv.cvtColor(src, srcRgb, cv.COLOR_RGBA2RGB);

            // 🌟 魔法1：強烈なメディアンフィルタでヒゲと肌荒れを「完全にすりつぶす」
            let medianMat = new cv.Mat();
            cv.medianBlur(srcRgb, medianMat, 7); // 7という強力な値で黒い点を消滅させる

            // 🌟 魔法2：すりつぶした跡を滑らかなグラデーションに整える
            let smoothedMat = new cv.Mat();
            cv.bilateralFilter(medianMat, smoothedMat, 5, 40, 40);

            let channels = new cv.MatVector();
            cv.split(smoothedMat, channels);
            let r = channels.get(0); let b = channels.get(2); 
            let temp = parseInt(colorTemp.value);
            
            if (temp !== 0) {
                let scalarMat = new cv.Mat(r.rows, r.cols, r.type(), new cv.Scalar(Math.abs(temp)));
                if (temp > 0) { cv.add(r, scalarMat, r); cv.subtract(b, scalarMat, b); } 
                else { cv.add(b, scalarMat, b); cv.subtract(r, scalarMat, r); }
                scalarMat.delete(); 
            }
            
            let smoothedTempRgb = new cv.Mat();
            cv.merge(channels, smoothedTempRgb);
            let smoothedTempRgba = new cv.Mat();
            cv.cvtColor(smoothedTempRgb, smoothedTempRgba, cv.COLOR_RGB2RGBA);

            cv.imshow(smallCanvas, smoothedTempRgba);

            let compositeCanvas = document.createElement('canvas');
            compositeCanvas.width = imageCanvas.width; compositeCanvas.height = imageCanvas.height;
            let compositeCtx = compositeCanvas.getContext('2d');
            
            // マスクのフチを強烈にぼかして、絶対に境目がバレないようにする
            compositeCtx.filter = 'blur(25px)'; 
            compositeCtx.drawImage(drawCanvas, 0, 0); 
            compositeCtx.filter = 'none'; 
            
            compositeCtx.globalCompositeOperation = 'source-in'; 

            // ふんわり美肌フィルター（コントラスト低め、ハイライト高め）
            compositeCtx.filter = 'contrast(90%) brightness(110%) saturate(105%)';
            compositeCtx.drawImage(smallCanvas, 0, 0, imageCanvas.width, imageCanvas.height); 
            compositeCtx.filter = 'none';

            // 🌟 魔法3：のっぺりした肌に「人工的な肌のキメ（ノイズ）」を植え付ける
            let patternCanvas = document.createElement('canvas');
            patternCanvas.width = 150; patternCanvas.height = 150;
            let pCtx = patternCanvas.getContext('2d');
            let pData = pCtx.createImageData(150, 150);
            for (let i = 0; i < pData.data.length; i += 4) {
                // グレーをベースに、微細なザラザラ感を作る
                let noise = (Math.random() - 0.5) * 40; 
                let val = 128 + noise;
                pData.data[i] = val; pData.data[i+1] = val; pData.data[i+2] = val;
                pData.data[i+3] = 255; 
            }
            pCtx.putImageData(pData, 0, 0);

            // ノイズを「オーバーレイ」で重ねることで、プラスチック感が消え本物の肌に見える
            compositeCtx.globalCompositeOperation = 'overlay';
            compositeCtx.globalAlpha = 0.25; // ノイズの強さ
            compositeCtx.fillStyle = compositeCtx.createPattern(patternCanvas, 'repeat');
            compositeCtx.fillRect(0, 0, compositeCanvas.width, compositeCanvas.height);

            // --- 🌟 結果出力 ---
            let factor = parseInt(smoothFactor.value);
            // 今回はテクスチャがあるので、強めに重ねても不自然になりません！
            let alpha = 0.3 + (factor / 100 * 0.7); // 最小でも30%の厚塗りを保証

            resultCtx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
            resultCtx.globalCompositeOperation = 'source-over';
            resultCtx.drawImage(currentImage, 0, 0); 
            
            resultCtx.globalAlpha = alpha; 
            resultCtx.drawImage(compositeCanvas, 0, 0); 
            resultCtx.globalAlpha = 1.0; 

            src.delete(); srcRgb.delete(); medianMat.delete(); smoothedMat.delete(); 
            smoothedTempRgb.delete(); smoothedTempRgba.delete(); channels.delete(); r.delete(); b.delete();

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
// 4. 画像の保存・共有機能
// ==========================================
saveBtn.addEventListener('click', function() {
    if (!currentImage.src) { alert('まずは画像を読み込んでください！'); return; }

    resultCanvas.toBlob(function(blob) {
        if (!blob) { alert('画像の保存に失敗しました。'); return; }

        let fileName = "retouched_image.jpg";
        if (imageInput.files.length > 0) {
            const originalName = imageInput.files[0].name;
            const dotIndex = originalName.lastIndexOf('.');
            if (dotIndex !== -1) {
                fileName = originalName.substring(0, dotIndex) + '_retouched.jpg';
            }
        }

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], fileName, { type: "image/jpeg" })] })) {
            const file = new File([blob], fileName, { type: "image/jpeg" });
            navigator.share({
                files: [file],
                title: '補正した画像を保存',
                text: '🕊️ 私だけの美肌アプリで作成しました'
            })
            .then(() => console.log('共有成功'))
            .catch((error) => console.log('共有失敗', error));
        } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click(); 
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }, 'image/jpeg', 0.95); 
});
