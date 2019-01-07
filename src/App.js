import React, { Component } from 'react';
import './App.scss';

import { SketchPicker } from 'react-color'
import * as faceapi from 'face-api.js';
import Select from 'react-select';

import {
  CuteEyeImg,
  HeadImg,
  GlassesImg,
  MoustacheImg,
  RedEyeImg
} from './utils/resource';

let videoEl, overlay, context;

class App extends Component {

  constructor() {
    super();
    this.state = {
      loading: true,
      selectedFaceDetector: 'SSD_MOBILENETV1',
      FaceDetector: {
        SSD_MOBILENETV1: 'SSD_MOBILENETV1',
        TINY_FACE_DETECTOR: 'TINY_FACE_DETECTOR',
        MTCNN: 'MTCNN',
      },
      minConfidence: 0.5,
      inputSize: 512,
      scoreThreshold: 0.5,
      minFaceSize: 20,
      withFaceLandmarks: false,
      withBoxes: true,
      withLines: true,
      forwardTimes: [],
      time: 0,
      fps: 0,
      colorLandmarks: '#e4e62d',
      colorShow: false,
      selectedMode: { value: 'default', label: '基礎繪製' },
      modes: [
        { value: 'default', label: '基礎繪製' },
        { value: 'face-index', label: '臉部索引' },
        { value: 'eyes', label: '點狀眼睛' },
        { value: 'cute-eyes', label: '可愛眼睛' },
        { value: 'mousetache', label: '大黑鬍子' },
        { value: 'glasses', label: '太陽眼鏡' },
        { value: 'red-eye', label: '血輪眼' },
        { value: 'head', label: '川普大頭' }
      ],
    }
  }

  componentDidMount() {
    videoEl = document.getElementById('inputVideo');
    overlay = document.getElementById('overlay');
    context = overlay.getContext('2d');

    this.initDevices();

    // faceapi.nets.ssdMobilenetv1
    // faceapi.nets.mtcnn
    // faceapi.nets.tinyFaceDetector
    // console.log(faceapi.nets);
  }

  async initDevices() {
    // load face detection and face landmark models
    await this.changeFaceDetector(this.state.FaceDetector.TINY_FACE_DETECTOR)

    // try to access users webcam and stream the images
    // to the video element
    const stream = await navigator.mediaDevices.getUserMedia({ video: {} })
    videoEl.srcObject = stream;
  }

  async changeFaceDetector(detector) {
    if (!this.isFaceDetectionModelLoaded()) {
      await this.getCurrentFaceDetectionNet().load('./weights');
      await faceapi.nets.faceLandmark68Net.load('./weights');
      await faceapi.nets.faceRecognitionNet.load('./weights');
    }
  }

  // 清除畫布
  onCleanCanvas() {
    context.clearRect(0, 0, overlay.width, overlay.height);
  }

  async onPlay() {
    // check vedio valid
    if (videoEl.paused || videoEl.ended || !this.isFaceDetectionModelLoaded()) {
      return setTimeout(() => this.onPlay());
    }

    // show panel
    if (this.state.loading) {
      this.setState({
        loading: false,
      });
    }

    const options = this.getFaceDetectorOptions();
    const ts = Date.now();

    const faceDetectionTask = faceapi.detectSingleFace(videoEl, options);

    const result = this.state.withFaceLandmarks
      ? await faceDetectionTask.withFaceLandmarks()
      : await faceDetectionTask;

    this.updateTimeStats(Date.now() - ts);

    // 繪製特徵
    const drawFunction = this.state.withFaceLandmarks
      ? this.drawLandmarks.bind(this)
      : this.drawDetections.bind(this);

    if (result)
      drawFunction(videoEl, overlay, [result], this.state.withBoxes);

    if (!this.state.withBoxes && !this.state.withFaceLandmarks)
      this.onCleanCanvas();

    setTimeout(() => this.onPlay());
  }

  // 繪製臉部外框
  drawDetections(dimensions, canvas, results, withBoxes = true) {
    if (withBoxes) {
      const resizedDetections = this.resizeCanvasAndResults(dimensions, canvas, results);
      faceapi.drawDetection(canvas, resizedDetections);
    }
  }

  // 繪製臉部特徵
  drawLandmarks(dimensions, canvas, results, withBoxes = true) {
    try {
      const resizedResults = this.resizeCanvasAndResults(dimensions, canvas, results);

      if (withBoxes) {
        faceapi.drawDetection(canvas, resizedResults.map(det => det.faceDetection))
      }

      const points = resizedResults[0];

      // console.log(this.state.selectedMode);

      // 模式切換
      switch (this.state.selectedMode.value) {
        case 'face-index': this.drawFaceIndex(points); break;
        case 'cute-eyes': this.drawCuteEyes(points); break;
        case 'eyes': this.drawEyes(points); break;
        case 'red-eye': this.drawRedEye(points); break;
        case 'glasses': this.drawGlasses(points); break;
        case 'mousetache': this.drawMoustache(points); break;
        case 'head': this.drawHead(points); break;
        case 'default':
        default: this.drawDefault(resizedResults, canvas); break;
      }
    } catch (e) { /* console.log(e); */ };
  }

  /**
   * 預設輪廓
   * @param {array} resizedResults 
   * @param {object} canvas 
   */
  drawDefault(resizedResults, canvas) {
    const faceLandmarks = resizedResults.map(det => det.faceLandmarks);
    const drawLandmarksOptions = {
      lineWidth: 2,
      drawLines: this.state.withLines,
      color: this.state.colorLandmarks,
    }
    faceapi.drawLandmarks(canvas, faceLandmarks, drawLandmarksOptions);
  }

  /**
   * 臉部特徵索引
   * @param {array} points 
   */
  drawFaceIndex(points) {
    points.faceLandmarks.positions.forEach(({ x, y }, index) => {
      context.fillStyle = this.state.colorLandmarks;
      context.font = '9px Changa one';
      context.fillText(index, x, y);
    });
  }

  /**
   * 大黑鬍子
   * @param {array} points 
   */
  drawMoustache(points) {
    try {
      // 兩眼最遠距離作為圖片大小
      const p1 = points.faceLandmarks.positions[36];
      const p2 = points.faceLandmarks.positions[45];
      const dist = Math.sqrt(Math.pow((p1.x - p2.x), 2) + Math.pow((p1.x - p2.x), 2), 0.5) * 0.8;
      // 人中位置
      const { x, y } = points.faceLandmarks.positions[51];
      context.drawImage(MoustacheImg, x - dist / 20 * 10, y - dist / 20 * 10.5, dist, dist);
    } catch (e) { }
  }

  /**
   * 太陽眼鏡
   * @param {array} points 
   */
  drawGlasses(points) {
    try {
      // 兩眼最遠距離作為圖片大小
      const p1 = points.faceLandmarks.positions[36];
      const p2 = points.faceLandmarks.positions[45];
      const dist = Math.sqrt(Math.pow((p1.x - p2.x), 2) + Math.pow((p1.x - p2.x), 2), 0.5) * 1.2;
      // 眉心位置
      const { x, y } = points.faceLandmarks.positions[27];
      context.drawImage(GlassesImg, x - dist / 20 * 10, y - dist / 20 * 9, dist, dist);
    } catch (e) { }
  }

  /**
   * 川普頭貼
   * @param {array} points 
   */
  drawHead(points) {
    try {
      const p1 = points.faceLandmarks.positions[2];
      const p2 = points.faceLandmarks.positions[15];
      const dist = Math.sqrt(Math.pow((p1.x - p2.x), 2) + Math.pow((p1.x - p2.x), 2), 0.5);
      const { x, y } = points.faceLandmarks.positions[29];
      // eslint-disable-next-line no-undef
      context.drawImage(HeadImg, x - dist / 20 * 11, y - dist / 20 * 16, dist, dist * HeadImg.height / HeadImg.width);
    } catch (e) { }
  }

  /**
   * 點狀眼睛
   * @param {array} poitns 
   */
  drawEyes(poitns) {
    // 左眼
    const lp1 = poitns.faceLandmarks.positions[37];
    const lp2 = poitns.faceLandmarks.positions[41];
    const lx = (lp1.x + lp2.x) / 2;
    const ly = (lp1.y + lp2.y) / 2;
    context.fillStyle = this.state.colorLandmarks;
    context.fillRect(lx, ly, 20, 20);
    // 右眼
    const rp1 = poitns.faceLandmarks.positions[43];
    const rp2 = poitns.faceLandmarks.positions[47];
    const rx = (rp1.x + rp2.x) / 2;
    const ry = (rp1.y + rp2.y) / 2;
    context.fillStyle = this.state.colorLandmarks;
    context.fillRect(rx, ry, 20, 20);
  }

  /**
   * 血輪眼
   * @param {array} poitns 
   */
  drawRedEye(poitns) {
    // 左眼
    const lp1 = poitns.faceLandmarks.positions[36];
    const lp2 = poitns.faceLandmarks.positions[39];
    context.drawImage(RedEyeImg, lp1.x - 10, lp1.y - 15, 50, 50);
    // 右眼
    const rp1 = poitns.faceLandmarks.positions[42];
    const rp2 = poitns.faceLandmarks.positions[45];
    context.drawImage(RedEyeImg, rp1.x - 10, rp2.y - 18, 50, 50);
  }

  /**
   * 可愛眼睛, 可自動縮放
   * @param {array} points 
   */
  drawCuteEyes(points) {
    try {
      // 兩眼最遠距離作為圖片大小
      const p1 = points.faceLandmarks.positions[36];
      const p2 = points.faceLandmarks.positions[45];
      const dist = Math.sqrt(Math.pow((p1.x - p2.x), 2) + Math.pow((p1.x - p2.x), 2), 0.5);
      // 眉心位置
      const { x, y } = points.faceLandmarks.positions[27];
      context.drawImage(CuteEyeImg, x - dist / 2, y - dist / 20 * 12, dist, dist);
    } catch (e) { }
  }

  resizeCanvasAndResults(dimensions, canvas, results) {
    const { width, height } = dimensions instanceof HTMLVideoElement
      ? faceapi.getMediaDimensions(dimensions)
      : dimensions;
    canvas.width = width;
    canvas.height = height;

    // resize detections (and landmarks) in case displayed image is smaller than
    // original size
    return results.map(res => res.forSize(width, height));
  }

  updateTimeStats(timeInMs) {
    const { forwardTimes } = this.state;
    this.setState({
      forwardTimes: [timeInMs].concat(forwardTimes).slice(0, 30)
    });
    const avgTimeInMs = this.state.forwardTimes.reduce((total, t) => total + t) / this.state.forwardTimes.length;
    this.setState({
      time: Math.round(avgTimeInMs),
      fps: faceapi.round(1000 / avgTimeInMs),
    });
  }

  isFaceDetectionModelLoaded() {
    return !!this.getCurrentFaceDetectionNet().params
  }

  getCurrentFaceDetectionNet() {
    const { selectedFaceDetector, FaceDetector } = this.state;
    switch (selectedFaceDetector) {
      case FaceDetector.SSD_MOBILENETV1: return faceapi.nets.ssdMobilenetv1;
      case FaceDetector.TINY_FACE_DETECTOR: return faceapi.nets.tinyFaceDetector;
      case FaceDetector.MTCNN: return faceapi.nets.mtcnn;
      default: return null;
    }
  }

  getFaceDetectorOptions() {
    const { selectedFaceDetector, FaceDetector, minConfidence, inputSize, scoreThreshold, minFaceSize } = this.state;
    return selectedFaceDetector === FaceDetector.SSD_MOBILENETV1
      ? new faceapi.SsdMobilenetv1Options({ minConfidence })
      : (
        selectedFaceDetector === FaceDetector.TINY_FACE_DETECTOR
          ? new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold })
          : new faceapi.MtcnnOptions({ minFaceSize })
      )
  }

  render() {
    return (
      <div className="App">
        <h1 className="title">FaceAPI Detection</h1>
        <Select
          className="select-modes"
          value={this.state.selectedMode}
          onChange={(e) => this.setState({ selectedMode: e })}
          options={this.state.modes}
        />
        <div className="face">
          <video onPlay={this.onPlay.bind(this)} id="inputVideo" autoPlay muted></video>
          <canvas id="overlay" />
          <div className="state" style={{ display: this.state.loading ? 'none' : 'block' }}>
            <span>Time: {this.state.time} ms</span>
            <span>Estimated Fps: {this.state.fps}</span>
          </div>
          <div className="control" style={{ display: this.state.loading ? 'none' : 'block' }}>
            <div className="item">
              <input
                id="lbBoxes"
                type="checkbox"
                checked={this.state.withBoxes}
                onChange={e => this.setState({ withBoxes: e.target.checked })}
              /><label htmlFor="lbBoxes">臉部外框</label>
            </div>

            <div className="item">
              <input
                id="lbMarks"
                type="checkbox"
                checked={this.state.withFaceLandmarks}
                onChange={e => this.setState({ withFaceLandmarks: e.target.checked })}
              />
              <label htmlFor="lbMarks">臉部輪廓</label>

              <div className="color-picker">
                <div className="swatch" onClick={() => this.setState({ colorShow: !this.state.colorShow })}>
                  <div className="color" style={{ backgroundColor: this.state.colorLandmarks }} />
                </div>
                {
                  this.state.colorShow
                    ?
                    <div className="popover">
                      <div
                        className="cover"
                        onClick={() => this.setState({ colorShow: false })}
                      />
                      <SketchPicker
                        color={this.state.colorLandmarks}
                        onChange={color => this.setState({ colorLandmarks: color.hex })}
                      />
                    </div>
                    : null
                }
              </div>
            </div>

            <div className="item">
              <input
                id="lbLines"
                type="checkbox"
                checked={this.state.withLines}
                onChange={e => this.setState({ withLines: e.target.checked })}
              /><label htmlFor="lbLines">特徵連線</label>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default App;
