const sampleData = {
  yesterday: {
    total: 0,
    change: 0,
    values: [0, 0, 0, 0, 0, 0],
    labels: ["08.00", "10.00", "12.00", "14.00", "16.00", "18.00"]
  },

  "7days": {
    total: 0,
    change: 0,
    values: [0, 0, 0, 0, 0, 0, 0],
    labels: ["Sab", "Min", "Sen", "Sel", "Rab", "Kam", "Jum"]
  },

  "30days": {
    total: 0,
    change: 0,
    values: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    labels: ["1", "3", "6", "8", "11", "13", "16", "18", "21", "23", "26", "30"]
  }
};

function renderChart(data) {
  const width = 600;
  const height = 300;
  const left = 45;
  const right = 20;
  const top = 20;
  const bottom = 45;

  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;

  const maxValue = Math.max(...data.values);
  const maxY = maxValue === 0 ? 5 : Math.ceil(maxValue / 5) * 5;
  const stepX = data.values.length > 1
    ? chartWidth / (data.values.length - 1)
    : 0;

  const points = data.values.map((value, index) => ({
    x: left + index * stepX,
    y: top + chartHeight - (value / maxY) * chartHeight,
    value
  }));

  const linePath = points.map((point, index) => {
    return `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`;
  }).join(" ");

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${top + chartHeight} L ${left} ${top + chartHeight} Z`;

  document.getElementById("chartLine").setAttribute("d", linePath);
  document.getElementById("chartArea").setAttribute("d", areaPath);

  let gridHTML = "";

  for (let i = 0; i <= 4; i++) {
    const y = top + (chartHeight / 4) * i;
    const value = Math.round(maxY - (maxY / 4) * i);

    gridHTML += `
      <line
        x1="${left}"
        y1="${y}"
        x2="${width - right}"
        y2="${y}"
        stroke="#e9e3df"
        stroke-dasharray="5 5"
      />
      <text
        x="${left - 10}"
        y="${y + 4}"
        text-anchor="end"
        fill="#95877f"
        font-size="12"
      >${value}</text>
    `;
  }

  document.getElementById("chartGrid").innerHTML = gridHTML;

  document.getElementById("chartPoints").innerHTML = points.map(point => `
    <circle
      cx="${point.x}"
      cy="${point.y}"
      r="5"
      fill="#16a36a"
      stroke="white"
      stroke-width="2"
    >
      <title>${point.value} porsi</title>
    </circle>
  `).join("");

  document.getElementById("chartLabels").innerHTML = points.map((point, index) => `
    <text
      x="${point.x}"
      y="${height - 12}"
      text-anchor="middle"
      fill="#95877f"
      font-size="12"
    >${data.labels[index]}</text>
  `).join("");
}

function renderPeriod(period) {
  const data = sampleData[period];

  document.getElementById("totalSold").textContent = data.total;
  document.getElementById("comparison").textContent = "0%";

  document.querySelectorAll(".period-btn").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.period === period
    );
  });

  renderChart(data);
}

document.querySelectorAll(".period-btn").forEach(button => {
  button.addEventListener("click", () => {
    renderPeriod(button.dataset.period);
  });
});

document.getElementById("back-button").addEventListener("click", () => {
  window.location.href = "/admin/product/product.html";
});

renderPeriod("7days");
