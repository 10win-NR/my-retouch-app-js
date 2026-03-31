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
const saveBtn = document.getElementById('saveBtn');

// 📱 スマホ用：モード切替ボタン
const modeScrollBtn = document.getElementById('modeScrollBtn');
const modeDrawBtn = document.getElementById('modeDrawBtn');
let isTouchDrawMode = false; // デフォルトはスクロールモード

modeScrollBtn.addEventListener('click', () => {
    isTouchDrawMode = false;
    modeScrollBtn.style.background = '#007bff';
    modeScrollBtn.style.color = 'white';
    modeDrawBtn.style.background = '#e0e0e0';
    modeDrawBtn.style.color = '#333';
});

modeDrawBtn.addEventListener('click', () => {
    isTouchDrawMode = true;
    modeDrawBtn.style.background = '#ff4b4b'; // なぞるモードは赤で強調
    modeDrawBtn.style.color = 'white';
    modeScrollBtn.style.background = '#e0e0e0';
    modeScrollBtn.style.color = '#333';
});

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

undoBtn.addEventListener('click', () => { if (currentStep > 0) { currentStep--; restoreHistory(); } });
redoBtn.addEventListener('click', () => { if (currentStep < historyStack.length - 1) { currentStep++; restoreHistory(); } });

function restoreHistory() {
    let img = new Image();
    img.onload = () => { drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height); drawCtx.drawImage(img, 0, 0); }
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
            // 内部解像度はオリジナルの高画質を維持
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
// 2. お絵描き機能（マウス＆タッチ対応・座標変換付き）
// ==========================================
let isDrawing = false;
let lastX = 0; 
let lastY = 0; 

const loupeCanvas = document.getElementById('loupeCanvas');
const loupeCtx = loupeCanvas.getContext('2d');
const LOUPE_SIZE = 120; 
const ZOOM = 2.0;       
loupeCanvas.width = LOUPE_SIZE;
loupeCanvas.height = LOUPE_SIZE;

// 🌟 スマホの見た目の座標を、内部の巨大な高画質座標に変換する魔法の関数
function getCoordinates(e) {
    const rect = drawCanvas.getBoundingClientRect();
    let clientX, clientY;
    
    // タッチかマウスか判定
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    // CSSの縮小率を計算して、内部のピクセル座標を割り出す
    const scaleX = drawCanvas.width / rect.width;
    const scaleY = drawCanvas.height / rect.height;

    return {
        x: (clientX - rect.left) * scaleX, // 内部座標X
        y: (clientY - rect.top) * scaleY,  // 内部座標Y
        cssX: clientX - rect.left,         // 見た目の座標X（ルーペ配置用）
        cssY: clientY - rect.top           // 見た目の座標Y（ルーペ配置用）
    };
}

function startDrawing(e) {
    if (!isTouchDrawMode && e.type.includes('touch')) return; // スクロールモードなら無視
    if (isTouchDrawMode && e.type.includes('touch')) e.preventDefault(); // なぞるモードなら画面スクロールを止める

    isDrawing = true;
    const pos = getCoordinates(e);
    lastX = pos.x;
    lastY = pos.y;
    loupeCanvas.style.display = 'block';
}

function draw(e) {
    if (!isDrawing) return;
    if (isTouchDrawMode && e.type.includes('touch')) e.preventDefault();

    const pos = getCoordinates(e);
    
    drawCtx.beginPath(); 
    drawCtx.moveTo(lastX, lastY); 
    drawCtx.lineTo(pos.x, pos.y); 
    drawCtx.lineCap = 'round';
    drawCtx.lineJoin = 'round';
    
    // 画面が縮小されている分、ペンも太く補正する
    const rect = drawCanvas.getBoundingClientRect();
    const scaleX = drawCanvas.width / rect.width;
    drawCtx.lineWidth = brushSize.value * scaleX; 

    if (drawMode.value === 'eraser') {
        drawCtx.globalCompositeOperation = 'destination-out';
        drawCtx.strokeStyle = 'rgba(0, 0, 0, 1)';
    } else {
        drawCtx.globalCompositeOperation = 'source-over';
        drawCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; 
    }
    drawCtx.stroke();
    
    lastX = pos.x;
    lastY = pos.y;

    // ルーペを指の少し上に配置（見た目の座標を使う）
    loupeCanvas.style.left = (pos.cssX - LOUPE_SIZE / 2) + 'px';
    loupeCanvas.style.top = (pos.cssY - LOUPE_SIZE - 40) + 'px'; // 指に隠れないよう上に

    // ルーペの中身を描画（内部の座標を使う）
    const srcSizeInternal = (LOUPE_SIZE / ZOOM) * scaleX;
    const srcX = pos.x - srcSizeInternal / 2;
    const srcY = pos.y - srcSizeInternal / 2;

    loupeCtx.clearRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);
    loupeCtx.save();
    loupeCtx.beginPath();
    loupeCtx.arc(LOUPE_SIZE/2, LOUPE_SIZE/2, LOUPE_SIZE/2, 0, Math.PI * 2);
    loupeCtx.clip();
    loupeCtx.drawImage(imageCanvas, srcX, srcY, srcSizeInternal, srcSizeInternal, 0, 0, LOUPE_SIZE, LOUPE_SIZE);
    loupeCtx.drawImage(drawCanvas, srcX, srcY, srcSizeInternal, srcSizeInternal, 0, 0, LOUPE_SIZE, LOUPE_SIZE);
    loupeCtx.restore(); 
}

function stopDrawing() {
    if (isDrawing) {
        isDrawing = false;
        loupeCanvas.style.display = 'none';
        saveHistory(); 
    }
}

// PCマウス用イベント
drawCanvas.addEventListener('mousedown', startDrawing);
drawCanvas.addEventListener('mousemove', draw);
drawCanvas.addEventListener('mouseup', stopDrawing);
drawCanvas.addEventListener('mouseout', stopDrawing);

// スマホタッチ用イベント（passive: false でスクロール防止を許可）
drawCanvas.addEventListener('touchstart', startDrawing, { passive: false });
drawCanvas.addEventListener('touchmove', draw, { passive: false });
drawCanvas.addEventListener('touchend', stopDrawing);
drawCanvas.addEventListener('touchcancel', stopDrawing);

// ==========================================
// 3. OpenCV.js による美肌化と合成処理 (超高速・陶器肌コンシーラー版)
// ==========================================
processBtn.addEventListener('click', function() {
    if (typeof cv === 'undefined' || !cv.Mat) {
        alert('⏳ 画像処理エンジンの準備中です。数秒お待ちください。');
        return;
    }

    processBtn.textContent = "⏳ お化粧中...";
    processBtn.disabled = true;

    // 画面がフリーズしないよう、少し時間をおいてから重い処理をスタート
    setTimeout(function() {
        try {
            let src = cv.imread(imageCanvas); 
            let srcRgb = new cv.Mat();
            cv.cvtColor(src, srcRgb, cv.COLOR_RGBA2RGB);

            // ---------------------------------------------------------
            // 🚀 高速化の魔法：計算用の一時縮小（ダウンサンプリング）
            // ---------------------------------------------------------
            // 12MPの画像をそのまま計算するとスマホがフリーズするので、計算用だけサイズを落とす
            let maxProcessingSize = 800; // 長辺を最大800pxにして計算
            let scale = maxProcessingSize / Math.max(srcRgb.cols, srcRgb.rows);
            let isDownscaled = scale < 1.0;

            let processMat = new cv.Mat();
            if (isDownscaled) {
                let smallSize = new cv.Size(Math.round(srcRgb.cols * scale), Math.round(srcRgb.rows * scale));
                cv.resize(srcRgb, processMat, smallSize, 0, 0, cv.INTER_AREA);
            } else {
                srcRgb.copyTo(processMat);
            }

            let factor = parseInt(smoothFactor.value);

            // ---------------------------------------------------------
            // 🌟 処理1： medianBlur (ヒゲ・肌荒れ消しコンシーラー)
            // ---------------------------------------------------------
            let medianMat = new cv.Mat();
            // 縮小画像にかけるので、カーネルサイズは小さめでも強烈に効く（かつ爆速）
            let kMedian = Math.floor(factor / 100 * 4) * 2 + 3; // 3〜11の奇数
            if (factor > 5) {
                cv.medianBlur(processMat, medianMat, kMedian);
            } else {
                processMat.copyTo(medianMat);
            }

            // ---------------------------------------------------------
            // 🌟 処理2： bilateralFilter (滑らかな陶器肌仕上げ)
            // ---------------------------------------------------------
            let smoothedMat = new cv.Mat();
            let sigmaSpace = 10 + (40 * factor / 100);
            let sigmaColor = 20 + (80 * factor / 100);
            cv.bilateralFilter(medianMat, smoothedMat, -1, sigmaColor, sigmaSpace);

            // ---------------------------------------------------------
            // 🌡️ 色温度調整
            // ---------------------------------------------------------
            let channels = new cv.MatVector();
            cv.split(smoothedMat, channels);
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

            // ---------------------------------------------------------
            // 🚀 魔法の仕上げ：元の12MPサイズに引き伸ばす（アップサンプリング）
            // ---------------------------------------------------------
            let finalLargeRgb = new cv.Mat();
            if (isDownscaled) {
                // 元の巨大な解像度に、滑らかに引き伸ばす
                cv.resize(smoothedTempRgb, finalLargeRgb, srcRgb.size(), 0, 0, cv.INTER_CUBIC);
            } else {
                smoothedTempRgb.copyTo(finalLargeRgb);
            }

            // RGBAに戻す
            let finalRgba = new cv.Mat();
            cv.cvtColor(finalLargeRgb, finalRgba, cv.COLOR_RGB2RGBA);

            // 一時的なキャンバスに書き出す
            let tempCanvas = document.createElement('canvas');
            tempCanvas.width = imageCanvas.width;
            tempCanvas.height = imageCanvas.height;
            cv.imshow(tempCanvas, finalRgba);

            // マスクによる合成（なぞった部分だけを切り抜く）
            let compositeCanvas = document.createElement('canvas');
            compositeCanvas.width = imageCanvas.width;
            compositeCanvas.height = imageCanvas.height;
            let compositeCtx = compositeCanvas.getContext('2d');
            
            compositeCtx.drawImage(drawCanvas, 0, 0); 
            compositeCtx.globalCompositeOperation = 'source-in'; 
            compositeCtx.drawImage(tempCanvas, 0, 0); 

            // 結果プレビューエリアへの出力
            resultCtx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
            resultCtx.drawImage(currentImage, 0, 0); 
            resultCtx.globalCompositeOperation = 'source-over';
            resultCtx.drawImage(compositeCanvas, 0, 0); 

            // メモリの完全な解放（これをサボるとまたフリーズします！）
            src.delete(); srcRgb.delete(); processMat.delete(); medianMat.delete(); 
            smoothedMat.delete(); smoothedTempRgb.delete(); finalLargeRgb.delete(); finalRgba.delete();
            channels.delete(); r.delete(); b.delete();

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
