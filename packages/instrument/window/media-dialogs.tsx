import React from "react";
import { observer } from "mobx-react";

import { Dialog, showDialog } from "eez-studio-ui/dialog";
import { ButtonAction } from "eez-studio-ui/action";
import { action, makeObservable, observable, runInAction } from "mobx";
import { Toolbar } from "eez-studio-ui/toolbar";

interface IMedia {
    message: string;
    data: any;
}

const AudioDialog = observer(
    class AudioDialog extends React.Component<{
        callback: (media: IMedia) => void;
    }> {
        refCanvas = React.createRef<HTMLCanvasElement>();
        audioCtx: AudioContext | undefined;
        mediaRecorder: MediaRecorder | undefined;

        recording: boolean = false;

        chunks: BlobPart[];
        blob: Blob | undefined;
        audioURL: string | undefined;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                recording: observable,
                audioURL: observable
            });
        }

        componentDidMount(): void {
            const constraints = { audio: true };

            let onSuccess = (stream: MediaStream) => {
                const mediaRecorder = new MediaRecorder(stream);

                this.mediaRecorder = mediaRecorder;

                mediaRecorder.onstop = e => {
                    const blob = new Blob(this.chunks, {
                        type: mediaRecorder!.mimeType
                    });

                    this.blob = blob;

                    runInAction(() => {
                        this.audioURL = window.URL.createObjectURL(blob);
                    });
                };

                this.mediaRecorder.ondataavailable = e => {
                    this.chunks.push(e.data);
                };

                this.visualize(stream);
            };

            let onError = (err: any) => {
                console.log("The following error occured: " + err);
            };

            navigator.mediaDevices
                .getUserMedia(constraints)
                .then(onSuccess, onError);
        }

        visualize(stream: MediaStream) {
            if (!this.audioCtx) {
                this.audioCtx = new AudioContext();
            }

            const source = this.audioCtx.createMediaStreamSource(stream);

            const analyser = this.audioCtx.createAnalyser();
            analyser.fftSize = 2048;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            source.connect(analyser);

            const canvas = this.refCanvas.current!;
            const canvasCtx = canvas.getContext("2d")!;

            const draw = () => {
                const WIDTH = canvas.width;
                const HEIGHT = canvas.height;

                requestAnimationFrame(draw);

                analyser.getByteTimeDomainData(dataArray);

                canvasCtx.fillStyle = "rgb(255, 255, 255)";
                canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

                canvasCtx.lineWidth = 2;
                canvasCtx.strokeStyle = "rgb(0, 0, 0)";

                canvasCtx.beginPath();

                let sliceWidth = (WIDTH * 1.0) / bufferLength;
                let x = 0;

                for (let i = 0; i < bufferLength; i++) {
                    let v = dataArray[i] / 128.0;
                    let y = (v * HEIGHT) / 2;

                    if (i === 0) {
                        canvasCtx.moveTo(x, y);
                    } else {
                        canvasCtx.lineTo(x, y);
                    }

                    x += sliceWidth;
                }

                canvasCtx.lineTo(canvas.width, canvas.height / 2);
                canvasCtx.stroke();
            };

            draw();
        }

        startRecording = action(() => {
            if (this.mediaRecorder) {
                this.chunks = [];
                this.blob = undefined;
                this.audioURL = undefined;

                this.mediaRecorder.start();

                this.recording = true;
            }
        });

        stopRecording = action(() => {
            if (this.mediaRecorder) {
                this.mediaRecorder.stop();
            }

            this.recording = false;
        });

        handleSubmit = () => {
            const blob = this.blob;

            if (!blob) {
                return false;
            }

            (async () => {
                const data = await blob.arrayBuffer();

                console.log(data.byteLength);

                this.props.callback({
                    message: JSON.stringify({
                        mimeType: blob.type
                    }),
                    data: Buffer.from(data)
                });
            })();

            return true;
        };

        render() {
            return (
                <Dialog
                    title="Record Audio"
                    modal={true}
                    onOk={this.handleSubmit}
                    okEnabled={() => this.blob != undefined}
                >
                    <Toolbar>
                        <ButtonAction
                            text="Start"
                            icon="material:radio_button_checked"
                            title="Start recording"
                            className="btn-success"
                            onClick={this.startRecording}
                            enabled={this.mediaRecorder && !this.recording}
                        />
                        <ButtonAction
                            text="Stop"
                            icon="material:stop"
                            title="Stop recording"
                            className="btn-danger"
                            onClick={this.stopRecording}
                            enabled={this.recording}
                        />
                        <canvas ref={this.refCanvas} height="36px"></canvas>
                    </Toolbar>
                    {this.audioURL && (
                        <audio
                            controls
                            src={this.audioURL}
                            style={{ width: "100%", marginTop: 10 }}
                        ></audio>
                    )}
                </Dialog>
            );
        }
    }
);

export function showAddAudioDialog(callback: (media: IMedia) => void) {
    showDialog(<AudioDialog callback={callback} />);
}

export function showAddVideoDialog(callback: (media: IMedia) => void) {}
