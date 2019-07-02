import { observable, action } from "mobx";

const windowSize = observable({
    width: window.innerWidth,
    height: window.innerHeight
});

var resizeTimeout: any;
window.addEventListener(
    "resize",
    function() {
        if (!resizeTimeout) {
            resizeTimeout = setTimeout(
                action(function() {
                    resizeTimeout = undefined;
                    windowSize.width = window.innerWidth;
                    windowSize.height = window.innerHeight;
                }),
                10
            );
        }
    },
    false
);

export default windowSize;
