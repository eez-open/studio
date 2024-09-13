import React from "react";
import { observer } from "mobx-react";

import { Dialog, showDialog } from "eez-studio-ui/dialog";
import { ButtonAction } from "eez-studio-ui/action";
import {
    action,
    makeObservable,
    observable,
    reaction,
    runInAction
} from "mobx";
import { Toolbar } from "eez-studio-ui/toolbar";
import { formatDurationWithParam } from "eez-studio-shared/util";
import { settingsController } from "home/settings";
import classNames from "classnames";

interface IMedia {
    message: string;
    data: any;
}

const MAX_AUDIO_DURATION = 60 * 60 * 1000;
const MAX_VIDEO_DURATION = 5 * 60 * 1000;

const MediaDialog = observer(
    class MediaDialog extends React.Component<{
        callback: (media: IMedia) => void;
        video: boolean;
    }> {
        refCanvas = React.createRef<HTMLCanvasElement>();
        refVideo = React.createRef<HTMLVideoElement>();
        audioCtx: AudioContext | undefined;
        mediaRecorder: MediaRecorder | undefined;

        recording: boolean = false;
        paused: boolean = false;

        duration: number = 0;

        chunks: BlobPart[];
        blob: Blob | undefined;
        mediaURL: string | undefined;

        error: string | undefined;

        devices: MediaDeviceInfo[] = [];
        selectedDeviceId: string = "";

        animationFrameRequest: number | undefined;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                mediaRecorder: observable,
                recording: observable,
                paused: observable,
                duration: observable,
                mediaURL: observable,
                error: observable,
                devices: observable,
                selectedDeviceId: observable
            });
        }

        componentDidMount(): void {
            reaction(
                () => this.selectedDeviceId,
                selectedDeviceId => {
                    if (selectedDeviceId) {
                        window.localStorage.setItem(
                            `selected_${
                                this.props.video ? "video" : "audio"
                            }_device`,
                            selectedDeviceId
                        );
                    }

                    this.onDeviceChange();
                }
            );

            navigator.mediaDevices.enumerateDevices().then(devices => {
                devices = devices.filter(
                    d =>
                        d.kind ===
                        (this.props.video ? "videoinput" : "audioinput")
                );

                let selectedDeviceId =
                    window.localStorage.getItem(
                        `selected_${
                            this.props.video ? "video" : "audio"
                        }_device`
                    ) || "";

                if (selectedDeviceId) {
                    if (!devices.find(d => d.deviceId === selectedDeviceId)) {
                        selectedDeviceId = "";
                    }
                }

                if (!selectedDeviceId) {
                    selectedDeviceId =
                        devices.length > 0 ? devices[0].deviceId : "";
                }

                runInAction(() => {
                    this.devices = devices;
                    this.selectedDeviceId = selectedDeviceId;
                });
            });
        }

        onDeviceChange() {
            if (this.refVideo.current) {
                this.refVideo.current.srcObject = null;
            }

            if (this.animationFrameRequest !== undefined) {
                cancelAnimationFrame(this.animationFrameRequest);
                this.animationFrameRequest = undefined;
            }

            if (this.mediaRecorder) {
                this.mediaRecorder.onstart = null;
                this.mediaRecorder.onpause = null;
                this.mediaRecorder.onresume = null;
                this.mediaRecorder.onstop = null;
                this.mediaRecorder.ondataavailable = null;
                this.mediaRecorder = undefined;
            }

            const constraints = this.props.video
                ? {
                      audio: true,
                      video: {
                          deviceId: this.selectedDeviceId
                              ? { exact: this.selectedDeviceId }
                              : undefined
                      }
                  }
                : {
                      audio: {
                          deviceId: this.selectedDeviceId
                              ? { exact: this.selectedDeviceId }
                              : undefined
                      }
                  };

            let onSuccess = (stream: MediaStream) => {
                if (this.refVideo.current) {
                    this.refVideo.current.srcObject = stream;
                }

                const mediaRecorder = new MediaRecorder(stream);
                runInAction(() => {
                    this.mediaRecorder = mediaRecorder;
                });

                let previousTime = Date.now();
                let timeout: NodeJS.Timeout | undefined;
                let wasPaused = false;
                const UPDATE_TIMEOUT = 10;
                const updateDuration = (action: string) => {
                    const currentTime = Date.now();

                    if (action === "onStart") {
                        runInAction(() => {
                            this.duration = 0;
                        });
                        previousTime = currentTime;
                        wasPaused = false;

                        timeout = setTimeout(
                            () => updateDuration(""),
                            UPDATE_TIMEOUT
                        );
                    } else if (action == "onPause") {
                        if (timeout) {
                            clearTimeout(timeout);
                            timeout = undefined;
                        }

                        runInAction(() => {
                            this.duration += currentTime - previousTime;
                        });

                        wasPaused = true;
                    } else if (action == "onResume") {
                        previousTime = currentTime;
                        wasPaused = false;

                        timeout = setTimeout(
                            () => updateDuration(""),
                            UPDATE_TIMEOUT
                        );
                    } else if (action == "onStop") {
                        if (timeout) {
                            clearTimeout(timeout);
                            timeout = undefined;
                        }

                        if (!wasPaused) {
                            runInAction(() => {
                                this.duration += currentTime - previousTime;
                            });
                        }
                    } else {
                        runInAction(() => {
                            this.duration += currentTime - previousTime;
                        });

                        if (
                            this.duration >=
                            (this.props.video
                                ? MAX_VIDEO_DURATION
                                : MAX_AUDIO_DURATION)
                        ) {
                            this.stopRecording();
                        }

                        previousTime = currentTime;

                        timeout = setTimeout(
                            () => updateDuration(""),
                            UPDATE_TIMEOUT
                        );
                    }
                };

                mediaRecorder.onstart = e => {
                    updateDuration("onStart");
                };

                mediaRecorder.onpause = e => {
                    updateDuration("onPause");
                };

                mediaRecorder.onresume = e => {
                    updateDuration("onResume");
                };

                mediaRecorder.onstop = e => {
                    updateDuration("onStop");

                    const blob = new Blob(this.chunks, {
                        type: mediaRecorder!.mimeType
                    });

                    this.blob = blob;

                    runInAction(() => {
                        this.mediaURL = window.URL.createObjectURL(blob);
                    });
                };

                mediaRecorder.ondataavailable = e => {
                    this.chunks.push(e.data);
                };

                this.visualize(stream);
            };

            let onError = (err: any) => {
                runInAction(() => {
                    this.error = "The following error occured: " + err;
                });
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

            const draw = () => {
                this.animationFrameRequest = requestAnimationFrame(draw);

                const canvas = this.refCanvas.current!;
                if (!canvas) {
                    return;
                }
                const canvasCtx = canvas.getContext("2d");
                if (!canvasCtx) {
                    return;
                }

                const WIDTH = canvas.width;
                const HEIGHT = canvas.height;

                analyser.getByteTimeDomainData(dataArray);

                canvasCtx.fillStyle = settingsController.isDarkTheme
                    ? "rgb(56, 57, 57)"
                    : "rgb(241, 243, 244)";
                canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

                canvasCtx.lineWidth = 2;
                canvasCtx.strokeStyle = settingsController.isDarkTheme
                    ? "rgb(241, 243, 244)"
                    : "rgb(56, 57, 57)";

                canvasCtx.beginPath();

                const HORZ_PADDING = 20;
                const VERT_PADDING = -80;

                let sliceWidth =
                    ((WIDTH - 2 * HORZ_PADDING) * 1.0) / bufferLength;
                let x = HORZ_PADDING;

                for (let i = 0; i < bufferLength; i++) {
                    let v = dataArray[i] / 128.0;
                    let y =
                        VERT_PADDING + (v * (HEIGHT - 2 * VERT_PADDING)) / 2;

                    if (i === 0) {
                        canvasCtx.moveTo(x, y);
                    } else {
                        canvasCtx.lineTo(x, y);
                    }

                    x += sliceWidth;
                }

                canvasCtx.lineTo(WIDTH - HORZ_PADDING, HEIGHT / 2);
                canvasCtx.stroke();
            };

            draw();
        }

        startRecording = action(() => {
            if (this.mediaRecorder) {
                this.chunks = [];
                this.blob = undefined;
                this.mediaURL = undefined;

                this.mediaRecorder.start();

                this.recording = true;
                this.paused = false;
            }
        });

        pauseRecording = action(() => {
            if (this.recording && !this.paused) {
                if (this.mediaRecorder) {
                    this.mediaRecorder.pause();
                }

                this.paused = true;
            }
        });

        resumeRecording = action(() => {
            if (this.recording && this.paused) {
                if (this.mediaRecorder) {
                    this.mediaRecorder.resume();
                }

                this.paused = false;
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
            const btnClassName = classNames("btn", {
                "btn-dark": settingsController.isDarkTheme,
                "btn-light": !settingsController.isDarkTheme
            });
            return (
                <Dialog
                    title={this.props.video ? "Record Video" : "Record Audio"}
                    modal={true}
                    onOk={this.handleSubmit}
                    okEnabled={() => this.blob != undefined}
                    okButtonText="Add"
                >
                    <div>
                        <select
                            className="form-select"
                            value={this.selectedDeviceId}
                            onChange={event => {
                                runInAction(() => {
                                    this.selectedDeviceId = event.target.value;
                                });
                            }}
                            style={{ marginBottom: 10 }}
                            disabled={this.recording}
                        >
                            {this.devices.map(device => (
                                <option
                                    key={device.deviceId}
                                    value={device.deviceId}
                                >
                                    {device.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    {this.error ? (
                        <div className="alert alert-danger">{this.error}</div>
                    ) : (
                        <div className="EezStudio_AudioRecordingDialog">
                            <canvas
                                ref={this.refCanvas}
                                width="466px"
                                height="54px"
                            ></canvas>

                            {this.props.video && (
                                <video
                                    ref={this.refVideo}
                                    autoPlay
                                    muted
                                    style={{ width: "100%", marginBottom: 10 }}
                                ></video>
                            )}

                            <Toolbar style={{ justifyContent: "center" }}>
                                {!this.recording && (
                                    <ButtonAction
                                        text="Start"
                                        icon="material:radio_button_checked"
                                        iconStyle={{ color: "red" }}
                                        title="Start recording"
                                        className={btnClassName}
                                        onClick={this.startRecording}
                                    />
                                )}
                                {this.recording && (
                                    <ButtonAction
                                        text="Stop"
                                        icon="material:stop"
                                        title="Stop recording"
                                        className={btnClassName}
                                        onClick={this.stopRecording}
                                    />
                                )}
                                {this.recording && !this.paused && (
                                    <ButtonAction
                                        text="Pause"
                                        icon="material:pause"
                                        title="Pause recording"
                                        className={btnClassName}
                                        onClick={this.pauseRecording}
                                    />
                                )}
                                {this.recording && this.paused && (
                                    <ButtonAction
                                        text="Resume"
                                        icon="material:play_circle_filled"
                                        iconStyle={{ color: "red" }}
                                        title="Resume recording"
                                        className={btnClassName}
                                        onClick={this.resumeRecording}
                                    />
                                )}
                            </Toolbar>
                            {this.recording && (
                                <div
                                    style={{
                                        marginTop: 10,
                                        display: "flex",
                                        justifyContent: "center"
                                    }}
                                >
                                    {formatDurationWithParam(
                                        this.duration,
                                        /*this.props.video ? "ss.SS" : */ "mm:ss.SS"
                                    )}
                                </div>
                            )}
                            {this.mediaURL ? (
                                this.props.video ? (
                                    <video
                                        controls
                                        src={this.mediaURL}
                                        style={{
                                            width: "100%",
                                            marginTop: 10
                                        }}
                                    ></video>
                                ) : (
                                    <audio
                                        controls
                                        src={this.mediaURL}
                                        style={{ width: "100%", marginTop: 10 }}
                                    ></audio>
                                )
                            ) : null}
                        </div>
                    )}
                </Dialog>
            );
        }
    }
);

export function showAddAudioDialog(callback: (media: IMedia) => void) {
    showDialog(<MediaDialog callback={callback} video={false} />);
}

export function showAddVideoDialog(callback: (media: IMedia) => void) {
    showDialog(<MediaDialog callback={callback} video={true} />);
}
