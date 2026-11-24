const tool = document.querySelector("[data-fuel-calculator]");
const distance = tool.querySelector("#fuel-distance");
const litres = tool.querySelector("#fuel-litres");
const units = tool.querySelector("select");
const button = tool.querySelector("button");
const output = tool.querySelector("output");
const format = new Intl.NumberFormat(document.documentElement.lang, {
  maximumFractionDigits: 2,
});

function calculate() {
  const km = distance.valueAsNumber * (units.value === "mi" ? 1.609344 : 1);
  const fuel = litres.valueAsNumber;
  const per100 = (100 * fuel) / km;
  const measures = [
    [per100, "L/100 km"],
    [100 / per100, "km/L"],
    [235.214583 / per100, "MPG (US)"],
    [282.480936 / per100, "MPG (UK)"],
  ];

  if (!(km > 0 && fuel > 0) || measures.some(([value]) => !Number.isFinite(value) || value <= 0)) {
    output.textContent = output.dataset.invalid;
    return;
  }

  output.textContent = measures
    .map(([value, unit]) => `${format.format(value)} ${unit}`)
    .join(" · ");
}

button.hidden = false;
button.addEventListener("click", calculate);
calculate();
