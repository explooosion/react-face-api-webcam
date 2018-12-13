import React, { Component } from 'react';
import './App.scss';

import Header from './components/Header';

import * as faceapi from 'face-api.js';

let videoEl, overlay;

class App extends Component {

  constructor() {
    super();
    this.state = {
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
      withFaceLandmarks: true,
      withBoxes: true,
      forwardTimes: [],
      time: 0,
      fps: 0,
    }
  }

  componentDidMount() {
    videoEl = document.getElementById('inputVideo');
    overlay = document.getElementById('overlay');

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
      await this.getCurrentFaceDetectionNet().load('/weights');
      await faceapi.nets.faceLandmark68Net.load('/weights');
      await faceapi.nets.faceRecognitionNet.load('/weights');
    }
  }

  async onPlay() {

    if (videoEl.paused || videoEl.ended || !this.isFaceDetectionModelLoaded()) {
      return setTimeout(() => this.onPlay());
    }

    const options = this.getFaceDetectorOptions();
    const ts = Date.now();

    const faceDetectionTask = faceapi.detectSingleFace(videoEl, options);

    const result = this.state.withFaceLandmarks
      ? await faceDetectionTask.withFaceLandmarks()
      : await faceDetectionTask;

    this.updateTimeStats(Date.now() - ts);

    const drawFunction = this.state.withFaceLandmarks
      ? this.drawLandmarks.bind(this)
      : this.drawDetections.bind(this);

    if (result) {
      drawFunction(videoEl, overlay, [result], this.state.withBoxes);
    }

    setTimeout(() => this.onPlay());
  }

  drawDetections(dimensions, canvas, results) {
    const resizedDetections = this.resizeCanvasAndResults(dimensions, canvas, results);
    faceapi.drawDetection(canvas, resizedDetections);
  }

  drawLandmarks(dimensions, canvas, results, withBoxes = true) {
    try {
      const resizedResults = this.resizeCanvasAndResults(dimensions, canvas, results);

      if (withBoxes) {
        faceapi.drawDetection(canvas, resizedResults.map(det => det.detection))
      }

      const faceLandmarks = resizedResults.map(det => det.landmarks);
      const drawLandmarksOptions = {
        lineWidth: 2,
        drawLines: true,
        color: '#ff0',
      }
      faceapi.drawLandmarks(canvas, faceLandmarks, drawLandmarksOptions);

    } catch (e) { /* console.log(e); */ };
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
        <div className="face">
          <video onPlay={this.onPlay.bind(this)} id="inputVideo" autoPlay muted></video>
          <canvas id="overlay" />
          <div className="state">
            <span>Time: {this.state.time} ms</span>
            <span>Estimated Fps: {this.state.fps}</span>
          </div>
          <div className="control">
            <input
              id="lbmarks"
              type="checkbox"
              checked={this.state.withFaceLandmarks}
              onChange={(e) => { this.setState({ withFaceLandmarks: e.target.checked }) }}
            /><label htmlFor="lbmarks">臉部輪廓</label>
          </div>
        </div>
      </div>
    );
  }
}

export default App;
