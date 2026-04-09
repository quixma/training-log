
//slider functionality
const sliders = [
    ['energy-rating', 'energy-slider-value'],
    ['fatigue-rating', 'fatigue-slider-value'],
    ['motivation-rating', 'motivation-slider-value'],
    ['focus-rating', 'focus-slider-value'],
];

sliders.forEach(([inputId, spanId]) => {
    const input = document.getElementById(inputId);
    const span = document.getElementById(spanId);
    if (!input || !span) return;

    const update = () => {
        span.textContent = input.value;
    };

    input.addEventListener('input', update);
    update(); // init on load
});