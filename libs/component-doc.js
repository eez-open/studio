function live(eventType, elementQuerySelector, cb) {
    document.addEventListener(eventType, function (event) {
        var qs = document.querySelectorAll(elementQuerySelector);
        if (qs) {
            var el = event.target,
                index = -1;
            while (
                el &&
                (index = Array.prototype.indexOf.call(qs, el)) === -1
            ) {
                el = el.parentElement;
            }

            if (index > -1) {
                cb.call(el, event);
            }
        }
    });
}

live(
    "click",
    ".EezStudio_Component_Documentation_PropertiesGroup h3",
    function (event) {
        event.preventDefault();
        event.target.parentElement.classList.toggle("collapsed");
    }
);
